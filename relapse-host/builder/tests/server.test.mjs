import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {createBuilderServer} from '../server/app.mjs';import {sha256} from '../server/payloads.mjs';
async function setup(t,options={}){const storage=await fs.mkdtemp(path.join(os.tmpdir(),'snipers-builder-test-'));const server=await createBuilderServer({storage,origin:'http://builder.test',release:{candidates:[{firmware:'13.60',status:'local-checks-passed',installerReady:true,startupReady:true}]},...options});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;t.after(async()=>{await new Promise(r=>server.close(r));const target=path.resolve(storage);assert.equal(path.dirname(target),path.resolve(os.tmpdir()));assert.ok(path.basename(target).startsWith('snipers-builder-test-'));await fs.rm(target,{recursive:true,force:true});});return{base,request:(url,options={})=>fetch(base+(url==='/api/catalog'?url+'?firmware=13.60':url),url==='/api/jobs'&&options.method==='POST'?{...options,body:options.body||JSON.stringify({firmware:'13.60'})}:options)};}
const headers={'X-Snipers-Builder':'1',Origin:'http://builder.test','Content-Type':'application/json'};
async function newJob(request){const r=await request('/api/jobs',{method:'POST',headers});assert.equal(r.status,201);return r.json();}
async function mockWorker({directory}){const bytes=Buffer.alloc(4096,0x61),file=path.join(directory,'test.elf');await fs.writeFile(file,bytes);return{path:file,sha256:sha256(bytes)};}
test('native gate blocks package creation while catalog and preview stay available',async t=>{const{request}=await setup(t);const c=await(await request('/api/catalog')).json();assert.equal(c.buildAvailable,false);assert.equal(c.payloads.length,8);assert.equal((await request('/api/jobs',{method:'POST',headers})).status,503);const page=await request('/');assert.equal(page.status,200);assert.equal(page.headers.get('Cache-Control'),'no-store');assert.ok((await page.text()).includes('Your payloads.'));});
test('rejects cross-origin mutations and unauthenticated reads',async t=>{const{request}=await setup(t,{worker:mockWorker});assert.equal((await request('/api/jobs',{method:'POST',headers:{...headers,Origin:'https://elsewhere.test'}})).status,403);assert.equal((await request('/api/jobs',{method:'POST'})).status,403);const job=await newJob(request);assert.equal((await request('/api/jobs/'+job.id)).status,403);assert.equal((await request('/api/jobs/'+job.id,{headers:{Authorization:'Bearer '+job.key}})).status,200);});
test('queue limit holds under concurrent creation',async t=>{const{request}=await setup(t,{worker:mockWorker,maxJobs:2});const replies=await Promise.all(Array.from({length:6},()=>request('/api/jobs',{method:'POST',headers})));assert.equal(replies.filter(r=>r.status===201).length,2);assert.equal(replies.filter(r=>r.status===503).length,4);});

test('100 sessions fit by default while builds still execute one at a time',async t=>{
 let active=0,peak=0,release;const gate=new Promise(resolve=>{release=resolve;});
 const worker=async input=>{active++;peak=Math.max(peak,active);try{await gate;return await mockWorker(input);}finally{active--;}};
 const {request}=await setup(t,{worker});t.after(()=>release());
 assert.equal((await(await request('/api/health')).json()).maxJobs,100);
 const replies=await Promise.all(Array.from({length:105},()=>request('/api/jobs',{method:'POST',headers})));
 assert.equal(replies.filter(r=>r.status===201).length,100);
 assert.equal(replies.filter(r=>r.status===503).length,5);
 const jobs=await Promise.all(replies.filter(r=>r.status===201).slice(0,3).map(r=>r.json()));
 for(const job of jobs)assert.equal((await request('/api/jobs/'+job.id+'/build',{method:'POST',headers:{...headers,Authorization:'Bearer '+job.key},body:JSON.stringify({selection:['etahen']})})).status,202);
 assert.equal(active,1);release();
 let states=[];
 for(let i=0;i<100;i++){
  states=await Promise.all(jobs.map(async job=>(await request('/api/jobs/'+job.id,{headers:{Authorization:'Bearer '+job.key}})).json()));
  if(states.every(j=>j.state==='ready'))break;
  await new Promise(resolve=>setTimeout(resolve,10));
 }
 assert.ok(states.every(j=>j.state==='ready'));assert.equal(peak,1);
});

test('invalid capacity configuration fails before starting the service',async()=>{
 for(const maxJobs of [0,-1,1.5,NaN,10001])await assert.rejects(createBuilderServer({maxJobs}),/maxJobs/);
 for(const maxConcurrentBuilds of [0,-1,1.5,NaN,9])await assert.rejects(createBuilderServer({maxConcurrentBuilds}),/maxConcurrentBuilds/);
});
test('two workers fill available slots, keep excess jobs queued and recover from a failed build',async t=>{
 let active=0,peak=0,started=0,release;const gate=new Promise(resolve=>{release=resolve;});
 const worker=async input=>{const index=started++;active++;peak=Math.max(peak,active);try{await gate;if(index===0)throw Error('Expected worker failure');return await mockWorker(input);}finally{active--;}};
 const {request}=await setup(t,{worker,maxConcurrentBuilds:2});t.after(()=>release());
 const jobs=[];
 for(let i=0;i<5;i++){
  const job=await newJob(request);jobs.push(job);
  assert.equal((await request('/api/jobs/'+job.id+'/build',{method:'POST',headers:{...headers,Authorization:'Bearer '+job.key},body:JSON.stringify({selection:['etahen']})})).status,202);
 }
 const health=await(await request('/api/health')).json();assert.equal(health.maxConcurrentBuilds,2);assert.equal(health.activeBuilds,2);assert.equal(health.queuedBuilds,3);assert.equal(active,2);
 release();let states=[];
 for(let i=0;i<100;i++){
  states=await Promise.all(jobs.map(async job=>(await request('/api/jobs/'+job.id,{headers:{Authorization:'Bearer '+job.key}})).json()));
  if(states.every(j=>['ready','failed'].includes(j.state)))break;
  await new Promise(resolve=>setTimeout(resolve,10));
 }
 assert.equal(states.filter(j=>j.state==='ready').length,4);assert.equal(states.filter(j=>j.state==='failed').length,1);assert.equal(peak,2);assert.equal(started,5);
 assert.equal((await(await request('/api/health')).json()).activeBuilds,0);
});
test('build transitions once; downloads support HEAD and byte ranges',async t=>{const{request}=await setup(t,{worker:mockWorker});const job=await newJob(request),auth={...headers,Authorization:'Bearer '+job.key};const submit=()=>request('/api/jobs/'+job.id+'/build',{method:'POST',headers:auth,body:JSON.stringify({selection:['etahen','debug']})});assert.equal((await submit()).status,202);assert.equal((await submit()).status,409);let state;for(let i=0;i<40;i++){state=await(await request('/api/jobs/'+job.id,{headers:auth})).json();if(state.state==='ready')break;await new Promise(r=>setTimeout(r,5));}assert.equal(state.state,'ready');const head=await request(state.download,{method:'HEAD'});assert.equal(head.headers.get('content-length'),'4096');const chunk=await request(state.download,{headers:{Range:'bytes=10-19'}});assert.equal(chunk.status,206);assert.equal(chunk.headers.get('content-range'),'bytes 10-19/4096');assert.equal((await chunk.arrayBuffer()).byteLength,10);assert.equal((await request(state.download,{headers:{Range:'bytes=9999-'}})).status,416);assert.equal((await request('/installers/'+'0'.repeat(48)+'.elf')).status,404);});
test('invalid uploads cannot enter the selection or escape storage',async t=>{const{request}=await setup(t,{worker:mockWorker});const job=await newJob(request);const r=await request('/api/jobs/'+job.id+'/files',{method:'POST',headers:{...headers,Authorization:'Bearer '+job.key,'X-Payload-Name':encodeURIComponent('../../bad.elf')},body:Buffer.alloc(100)});assert.equal(r.status,400);const state=await(await request('/api/jobs/'+job.id,{headers:{Authorization:'Bearer '+job.key}})).json();assert.equal(state.files.length,0);assert.equal(state.state,'selecting');});

test('build codes expose only the completed installer and expire with the job',async t=>{const{request}=await setup(t,{worker:mockWorker});const job=await newJob(request),auth={...headers,Authorization:'Bearer '+job.key};await request('/api/jobs/'+job.id+'/build',{method:'POST',headers:auth,body:JSON.stringify({selection:['etahen']})});let state;for(let i=0;i<40;i++){state=await(await request('/api/jobs/'+job.id,{headers:auth})).json();if(state.state==='ready')break;await new Promise(r=>setTimeout(r,5));}assert.match(state.installCode,/^[A-F0-9]{10}$/);const publicData=await(await request('/api/install/'+state.installCode)).json();assert.deepEqual(publicData.payloads,['etaHEN experimental']);assert.equal(publicData.download,state.download);assert.equal(publicData.key,undefined);assert.equal(publicData.files,undefined);assert.equal((await request('/api/install/0000000000')).status,404);});
test('installer page serves the pinned browser worker and firmware aliases',async t=>{const{request}=await setup(t);for(const path of ['/install','/src/utils/rop_slave.js','/offsets/13.60.js','/autoload.js','/sha256.js'])assert.equal((await request(path)).status,200);assert.equal((await request('/offsets/99.99.js')).status,404);assert.match(await(await request('/autoload.js')).text(),/SNPR_OPTION_PROGRESS=/);});

test('experimental installer serves every firmware and browser runtime dependency',async t=>{
 const {profiles}=await import('../../../experimental/channel.mjs');
 const {request}=await setup(t);
 for(const p of profiles.firmwares)assert.equal((await request('/offsets/'+p.firmware+'.js')).status,200,p.firmware);
 for(const file of ['runtime.js','src/firmware.js','src/utils/syscalls.js','src/rop.js','src/main.js','src/webkit.js','src/utils/mem.js','src/utils/int64.js','src/utils/rop_slave.js','src/sha256.js'])assert.equal((await request('/runtime/'+file)).status,200,file);
 for(const fw of ['9.05','11.40'])assert.equal((await request('/offsets/'+fw+'.js')).status,404);
 const runtime=await(await request('/api/runtime')).json();assert.equal(runtime.runtime,'/builder/ex/runtime/runtime.js');
});
