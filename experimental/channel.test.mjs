import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {profiles,firmwareProfile,candidateReady} from './channel.mjs';
import {createBuilderServer} from '../relapse-host/builder/server/app.mjs';
test('exact supported set and correct YouTube versions',()=>{
 assert.equal(profiles.firmwares.length,33);
 for(const fw of ['9.05','11.40','7','13.61','14.00','../../13.60'])assert.throws(()=>firmwareProfile(fw));
 assert.equal(firmwareProfile('12.40').youtubeVersion,'01.000.003');
 assert.equal(firmwareProfile('12.60').youtubeVersion,'01.000.030');
 for(const p of profiles.firmwares)assert.equal(candidateReady(p.firmware,{candidates:[]}),false);
 assert.equal(candidateReady('7.00',{candidates:[{firmware:'7.00',status:'local-checks-passed',installerReady:true}]}),false);
});
test('experimental HTTP API binds firmware to jobs and refuses unready versions',async t=>{
 const storage=await fs.mkdtemp(path.join(os.tmpdir(),'snipers-ex-test-'));let received;
 const release={candidates:[{firmware:'7.00',status:'local-checks-passed',installerReady:true,startupReady:true}]};
 const server=await createBuilderServer({storage,origin:'http://localhost',release,worker:async args=>{
  received=args.firmware;const file=path.join(args.directory,'test.elf');await fs.writeFile(file,Buffer.alloc(4096));return{path:file,sha256:'a'.repeat(64),verifyOnly:true};
 }});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await fs.rm(storage,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port;
 const post=(route,data,key)=>fetch(url+route,{method:'POST',headers:{'X-Snipers-Builder':'1','Content-Type':'application/json',...(key?{Authorization:'Bearer '+key}:{})},body:JSON.stringify(data)});
 const health=await(await fetch(url+'/api/health')).json();assert.equal(health.channel,'experimental');assert.equal(health.basePath,'/builder/ex');
 const catalog=await(await fetch(url+'/api/catalog?firmware=12.40')).json();assert.equal(catalog.youtubeVersion,'01.000.003');assert.equal(catalog.buildAvailable,false);
 assert.equal((await post('/api/jobs',{firmware:'11.40'})).status,400);
 assert.equal((await post('/api/jobs',{firmware:'12.40'})).status,409);
 const job=await(await post('/api/jobs',{firmware:'7.00'})).json();assert.equal(job.firmware,'7.00');
 const submitted=await post('/api/jobs/'+job.id+'/build',{selection:['etahen'],firmware:'13.60'},job.key);assert.equal(submitted.status,202);
 for(let i=0;i<30&&!received;i++)await new Promise(r=>setTimeout(r,10));
 assert.equal(received,'7.00');
});
