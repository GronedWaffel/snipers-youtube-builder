import {CHANNEL,BASE_PATH,profiles,firmwareProfile,readRelease,candidateReady} from '../../../experimental/channel.mjs';
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {timingSafeEqual} from 'node:crypto';
import {LIMITS, RECOMMENDED, publicCatalog, newToken, isToken, displayName, inspectPayload, validateSelection} from './payloads.mjs';
import {saveJob,restoreJobs} from './job-store.mjs';

const web = fileURLToPath(new URL('../web/', import.meta.url));
const TTL = 20 * 60 * 1000;
const error = (status, message) => Object.assign(Error(message), {status});
async function body(req, limit) {
  const chunks = [];let size = 0;
  if (Number(req.headers['content-length']) > limit) throw error(413, 'Upload is too large.');
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw error(413, 'Upload is too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function equal(a,b){return typeof a==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}

// The worker is a trusted server function; requests never supply commands,
// executable paths, source code, or remote download URLs.
export async function createBuilderServer({storage, origin, worker=null, verifyOnly=true, maxJobs=100, maxConcurrentBuilds=1, ttl=TTL,release=readRelease()}={}) {
  if(!Number.isSafeInteger(maxJobs)||maxJobs<1||maxJobs>10000)throw Error('maxJobs must be an integer between 1 and 10000');
  if(!Number.isSafeInteger(maxConcurrentBuilds)||maxConcurrentBuilds<1||maxConcurrentBuilds>8)throw Error('maxConcurrentBuilds must be an integer between 1 and 8');
  storage=path.resolve(storage);await fsp.mkdir(storage,{recursive:true});
  const jobs=await restoreJobs(storage,ttl),queue=[],lookups=new Map();let running=0,uploads=0,creating=0;
  const snapshot=j=>({id:j.id,firmware:j.firmware,channel:CHANNEL,state:j.state,created:j.created,expires:j.expires,message:j.message,
    files:j.files.map(({path:_,...f})=>f),selection:j.selection,
    ...(j.state==='ready'?{download:'/installers/'+j.download+'.elf',bytes:j.bytes,sha256:j.sha256,installCode:j.installCode,verifyOnly:j.verifyOnly}:{} )});
  function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
  function authorized(req,id){const j=jobs.get(id);if(!j||j.state==='orphan'||j.expires<Date.now())throw error(404,'Build expired or not found.');
    if(!equal(req.headers.authorization,'Bearer '+j.key))throw error(403,'This build belongs to another session.');return j;}
  async function processQueue(){
    if(!worker||running>=maxConcurrentBuilds)return;running++;
    try{while(queue.length){const j=queue.shift();if(j.expires<Date.now())continue;
      j.state='building';j.message='Building your YouTube startup and installer ELF.';await saveJob(j);
      try{
        j.download=newToken();j.installCode=newToken().slice(0,10).toUpperCase();
        const output=await worker({firmware:j.firmware,directory:j.directory,downloadToken:j.download,payloads:validateSelection(j.selection,j.files),
          progress:message=>{j.message=String(message).slice(0,200);}});
        const pkg=path.resolve(output.path),relative=path.relative(j.directory,pkg);
        if(relative.startsWith('..')||path.isAbsolute(relative)||!pkg.endsWith('.elf'))throw Error('Worker returned a path outside its build directory.');
        const stat=await fsp.lstat(pkg);
        if(!stat.isFile()||stat.isSymbolicLink()||stat.size<4096||stat.size>512*1024**2||!/^[a-f0-9]{64}$/.test(output.sha256))throw Error('Invalid installer output.');
        if(output.imagePath){
          const image=path.resolve(output.imagePath),relative=path.relative(j.directory,image),info=await fsp.lstat(image);
          if(relative.startsWith('..')||path.isAbsolute(relative)||!info.isFile()||info.isSymbolicLink()||info.size!==336789504||!/^[a-f0-9]{64}$/.test(output.imageSha256))throw Error('Invalid startup image output.');
          j.image=image;j.imageBytes=info.size;j.imageSha256=output.imageSha256;
        }
        j.package=pkg;j.bytes=stat.size;j.sha256=output.sha256;j.verifyOnly=!!output.verifyOnly;j.state='ready';j.message=output.verifyOnly?'Verification ELF ready. This test downloads and checks your bundle without replacing YouTube startup.':'Installer ELF ready. Close YouTube, then load this ELF from the website on your jailbroken PS5.';
      }catch(e){console.error('Build failed:',e.message);j.state='failed';j.message='Installer build failed. Your console has not been changed.';}
      await saveJob(j);
    }}finally{running--;if(queue.length)void processQueue().catch(e=>console.error('Queue persistence error:',e.message));}
  }
  async function clean(){for(const [id,j]of jobs)if(j.expires<Date.now()&&!['building','uploading'].includes(j.state)){
    jobs.delete(id);const target=path.resolve(j.directory);
    if(path.dirname(target)!==storage||!isToken(path.basename(target)))throw Error('Refusing cleanup outside build storage.');
    await fsp.rm(target,{recursive:true,force:true});
  }}
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    try{
      const url=new URL(req.url,'http://localhost'),route=url.pathname;
      if(req.method==='GET'&&route==='/api/runtime')return json(res,200,{runtime:BASE_PATH+'/runtime/runtime.js',base:BASE_PATH+'/runtime/'});
      if(req.method==='GET'&&route==='/api/firmwares')return json(res,200,{channel:CHANNEL,basePath:BASE_PATH,firmwares:profiles.firmwares.map(({firmware,youtubeVersion,status})=>({firmware,youtubeVersion,status,buildAvailable:!!worker&&candidateReady(firmware,release)})),excluded:profiles.excluded});
      if(req.method==='GET'&&route==='/api/catalog'){const p=firmwareProfile(url.searchParams.get('firmware'));return json(res,200,{channel:CHANNEL,firmware:p.firmware,youtubeVersion:p.youtubeVersion,buildAvailable:!!worker&&candidateReady(p.firmware,release),verifyOnly,startup:{automaticClose:true,dashboardSeconds:5},limits:LIMITS,recommended:RECOMMENDED,payloads:publicCatalog()});}
      if(req.method==='GET'&&route==='/api/health')return json(res,200,{online:true,channel:CHANNEL,basePath:BASE_PATH,buildAvailable:!!worker&&release.candidates.some(c=>candidateReady(c.firmware,release)),maxJobs,maxConcurrentBuilds,activeBuilds:running,queuedBuilds:queue.length});
      const code=/^\/api\/install\/([A-F0-9]{10})$/.exec(route);
      if(req.method==='GET'&&code){
        // Nginx must overwrite X-Real-IP. Service binds only to localhost.
        const client=String(req.headers['x-real-ip']||req.socket.remoteAddress),now=Date.now();
        for(const [key,value]of lookups)if(value.until<now)lookups.delete(key);
        let rate=lookups.get(client);if(!rate){if(lookups.size>10000)throw error(429,'Try again shortly.');rate={until:now+60000,count:0};lookups.set(client,rate);}
        if(++rate.count>30)throw error(429,'Too many code lookups. Wait a minute before trying again.');
        const job=[...jobs.values()].find(j=>j.installCode===code[1]&&j.state==='ready'&&j.expires>now);
        if(!job)throw error(404,'Code expired or not found.');
        return json(res,200,{firmware:job.firmware,channel:CHANNEL,download:'/installers/'+job.download+'.elf',sha256:job.sha256,bytes:job.bytes,verifyOnly:job.verifyOnly,expires:job.expires,
          payloads:validateSelection(job.selection,job.files).map(x=>x.label)});
      }
      const bundle=/^\/youtube-bundles\/([a-f0-9]{48})\.dat$/.exec(route);
      const download=/^\/installers\/([a-f0-9]{48})\.elf$/.exec(route)||bundle;
      if(download&&['GET','HEAD'].includes(req.method)){
        const j=[...jobs.values()].find(j=>j.download===download[1]&&j.state==='ready'&&j.expires>Date.now());
        if(!j)throw error(404,'Installer expired or not found.');
        if(bundle&&!j.image)throw error(404,'Startup image is unavailable.');
        const bytes=bundle?j.imageBytes:j.bytes,file=bundle?j.image:j.package;
        let start=0,end=bytes-1,status=200;
        if(req.headers.range){const m=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
          if(!m)throw error(416,'Unsupported byte range.');start=Number(m[1]);end=m[2]?Number(m[2]):end;
          if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||end>=bytes)throw error(416,'Byte range is outside the download.');
          status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${bytes}`);
        }
        res.writeHead(status,{'Content-Type':'application/octet-stream','Content-Length':end-start+1,'Accept-Ranges':'bytes','Content-Disposition':'attachment; filename="'+(bundle?'download0.dat':'Snipers-YouTube-Installer.elf')+'"'});
        if(req.method==='HEAD')return res.end();
        const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);return;
      }
      if(route.startsWith('/api/')){
        if(req.method!=='GET'&&(req.headers['x-snipers-builder']!=='1'||(req.headers.origin&&req.headers.origin!==origin)))throw error(403,'Open the builder on its own website to continue.');
        if(req.method==='POST'&&route==='/api/jobs'){
          if(!worker)throw error(503,'The installer ELF is undergoing console testing. Builds are not enabled yet.');
          const input=JSON.parse((await body(req,1024)).toString());const profile=firmwareProfile(input.firmware);
          if(!candidateReady(profile.firmware,release))throw error(409,'This experimental firmware build is still being prepared.');
          await clean();if(jobs.size+creating>=maxJobs)throw error(503,'The build queue is full. Please try again later.');
          creating++;
          try{const id=newToken(),key=newToken(),directory=path.join(storage,id);await fsp.mkdir(directory,{recursive:false,mode:0o700});
            const j={id,key,directory,firmware:profile.firmware,channel:CHANNEL,created:Date.now(),expires:Date.now()+ttl,state:'selecting',message:'Choose your payloads.',files:[],selection:[]};await saveJob(j);jobs.set(id,j);
            return json(res,201,{...snapshot(j),key});
          }finally{creating--;}
        }
        const match=/^\/api\/jobs\/([a-f0-9]{48})(?:\/(files|build))?$/.exec(route);
        if(!match)throw error(404,'API route not found.');const j=authorized(req,match[1]);
        if(req.method==='GET'&&!match[2])return json(res,200,snapshot(j));
        if(req.method==='POST'&&match[2]==='files'){
          if(j.state!=='selecting')throw error(409,'This build is busy.');
          if(uploads>=2)throw error(429,'The upload service is busy. Try again shortly.');
          if(j.files.length>=LIMITS.files)throw error(400,'Maximum 8 uploaded payloads.');
          const label=displayName(decodeURIComponent(req.headers['x-payload-name']||''));
          uploads++;j.state='uploading';
          try{
            const bytes=await body(req,LIMITS.fileBytes),meta=inspectPayload(bytes);
            if(j.files.some(f=>f.sha256===meta.sha256))throw error(400,'That payload was already uploaded.');
            if(j.files.reduce((n,f)=>n+f.bytes,0)+bytes.length>LIMITS.totalBytes)throw error(413,'Combined uploads exceed 128 MiB.');
            const id=newToken(),file=path.join(j.directory,id+'.elf');await fsp.writeFile(file,bytes,{flag:'wx',mode:0o600});
            const item={id:'upload-'+id,label,...meta,path:file,acknowledgement:'dispatch'};j.files.push(item);await saveJob({...j,state:'selecting'});
            return json(res,201,{id:item.id,label,...meta});
          }finally{uploads--;j.state='selecting';}
        }
        if(req.method==='POST'&&match[2]==='build'){
          if(j.state!=='selecting')throw error(409,'This build was already submitted.');
          let input;try{input=JSON.parse((await body(req,4096)).toString());}catch{throw error(400,'Invalid build request.');}
          validateSelection(input.selection,j.files);j.selection=input.selection;j.state='queued';j.message='Waiting for the current build to finish.';await saveJob(j);queue.push(j);
          json(res,202,snapshot(j));void processQueue().catch(e=>console.error('Queue persistence error:',e.message));return;
        }
        throw error(405,'Method not allowed.');
      }
      const staticFiles={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/install':'install.html','/install.html':'install.html','/install.js':'install.js','/style.css':'style.css','/sw.js':'sw.js','/credits':'credits.html','/sources.zip':'sources.zip'};
      // The existing PS5 browser runtime resolves these two files against its page.
      // Alias only the pinned worker and supported firmware; no kernel run is added.
      const runtimeFiles={'/src/utils/rop_slave.js':'src/utils/rop_slave.js','/offsets/13.60.js':'offsets/13.60.js','/autoload.js':'../../src/autoload.js','/sha256.js':'../../src/sha256.js'};
      const runtimeRelative=route.startsWith('/runtime/')?route.slice(9):null;
      if(runtimeRelative&&/^[A-Za-z0-9_./-]+\.js$/.test(runtimeRelative)&&!runtimeRelative.split('/').includes('..')){
        const allowedRuntime=new Set(['runtime.js','src/firmware.js','src/utils/syscalls.js','src/rop.js','src/main.js','src/webkit.js','src/utils/mem.js','src/utils/int64.js','src/utils/rop_slave.js','src/sha256.js']);
        if(allowedRuntime.has(runtimeRelative))runtimeFiles[route]=runtimeRelative;
      }
      for(const p of profiles.firmwares)runtimeFiles['/offsets/'+p.firmware+'.js']='offsets/'+p.firmware+'.js';
      if(!['GET','HEAD'].includes(req.method)||!staticFiles[route]&&!runtimeFiles[route])throw error(404,'Page not found.');
      const filename=staticFiles[route]||runtimeFiles[route],data=await fsp.readFile(runtimeFiles[route]?fileURLToPath(new URL('../../site/online/2ea9344fcd6fbcb7/'+filename,import.meta.url)):path.join(web,filename));
      res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
      res.setHeader('Content-Type',filename.endsWith('.zip')?'application/zip':filename.endsWith('.js')?'text/javascript; charset=utf-8':filename.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');
      res.end(req.method==='HEAD'?undefined:data);
    }catch(e){if(res.headersSent)return res.destroy();json(res,e.status||400,{error:e.status||e instanceof URIError?e.message:'Invalid payload or selection: '+e.message});}
  });
  server.requestTimeout=120000;server.headersTimeout=15000;
  const timer=setInterval(()=>clean().catch(e=>console.error(e.message)),60000);timer.unref();server.on('close',()=>clearInterval(timer));
  return server;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||8787);
  const server=await createBuilderServer({storage:process.env.BUILDER_STORAGE||fileURLToPath(new URL('../../artifacts/builder-jobs/',import.meta.url)),origin:process.env.BUILDER_ORIGIN||'http://127.0.0.1:'+port});
  server.listen(port,'127.0.0.1',()=>console.log('Builder preview: http://127.0.0.1:'+port+' (console builds gated until validation)'));
}
