// SPDX-License-Identifier: GPL-3.0-or-later
import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';import {gzip} from 'node:zlib';import {promisify} from 'node:util';
import {FILES} from './protocol.mjs';
const zip=promisify(gzip),ROOT=import.meta.dirname,MAX_BYTES=12*1024*1024,RETENTION=30*86400000;
const fail=(status,message)=>Object.assign(Error(message),{status});
const sha=data=>createHash('sha256').update(data).digest('hex');
// Keep reports private, including their summaries. No public report-read route.
export function validateReport(input){
 if(input?.schema!==1||!Number.isInteger(input.firmwareRaw)||input.firmwareRaw<0||input.firmwareRaw>0xffffffff||!Array.isArray(input.files)||!input.files.length||input.files.length>FILES.length||!Array.isArray(input.skipped))throw fail(400,'Invalid diagnostic report.');
 const seen=new Set();let bytes=0;
 const files=input.files.map(file=>{
  if(!FILES.includes(file.name)||seen.has(file.name))throw fail(400,'Unrecognized or duplicate diagnostic file.');seen.add(file.name);
  const limit=file.name.includes('/experimental-diagnostics/')?1024*1024:64*1024;
  if(typeof file.hex!=='string'||file.hex.length>limit*2||(file.hex.length%2||/[^a-f0-9]/.test(file.hex)))throw fail(400,'Invalid diagnostic data.');
  const data=Buffer.from(file.hex,'hex');bytes+=data.length;
  if(bytes>5*1024*1024||sha(data)!==file.sha256)throw fail(400,'Diagnostic checksum mismatch.');
  if(!Number.isSafeInteger(file.totalBytes)||!Number.isSafeInteger(file.offset)||file.offset<0||file.totalBytes<file.offset||file.totalBytes-file.offset!==data.length||!Number.isSafeInteger(file.mtime))throw fail(400,'Invalid diagnostic file metadata.');
  // Avoid retaining common identifiers incidentally printed by old logs.
  const text=data.toString('utf8').replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g,'[IP redacted]').replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email redacted]').replace(/(\b(?:psid|account[_ -]?id|user[_ -]?id|token|password|authorization)\s*[:=]?\s*)[^\s,;]+/gi,'$1[redacted]').replace(/[a-f0-9]{48,64}/gi,'[digest or token redacted]');
  return {name:file.name,bytes:data.length,originalSha256:file.sha256,totalBytes:file.totalBytes,offset:file.offset,mtime:file.mtime,truncated:file.offset>0,text};
 });
 const skipped=input.skipped.map(item=>{if(!FILES.includes(item.name)||seen.has(item.name)||!Number.isInteger(item.errno)||item.errno<0||item.errno>4096)throw fail(400,'Invalid missing-file record.');seen.add(item.name);return {name:item.name,errno:item.errno};});
 if(seen.size!==FILES.length)throw fail(400,'Incomplete diagnostic file inventory.');
 const trace=files.filter(f=>f.name.includes('experimental-diagnostics/')).map(f=>f.text).join('\n');
 const lines=trace.split('\n'),builds=[...new Set([...trace.matchAll(/\bbuild=([A-Za-z0-9._-]+)/g)].map(m=>m[1]))];
 const report={schema:1,collectorFirmwareRaw:input.firmwareRaw,browserFirmware:/^\d{1,2}\.\d{2}$/.test(input.browserFirmware||'')?input.browserFirmware:null,files,skipped};
 const summary={builds,bytes,files:files.length,skipped:skipped.length,runStarts:lines.filter(l=>l.includes('RUN BEGIN')).length,lastStages:lines.filter(l=>l.includes('event=')).slice(-35),suspectedFailures:lines.filter(l=>/failed|timed out|unsupported|rejected|restarted|result=-[1-9]/i.test(l)).slice(-50),containsNewTrace:!!trace.trim()};
 return {report,summary};
}
export async function createDiagnosticServer({storage,origin='https://sniperscheats.lol',maxDiskBytes=1024**3,maxReports=10000}={}){
 storage=path.resolve(storage);await fs.mkdir(storage,{recursive:true,mode:0o700});await fs.chmod(storage,0o700);
 const inventory=new Map(),rates=new Map();let disk=0,inflight=0;
 for(const name of await fs.readdir(storage)){if(!/^[a-f0-9]{32}\.json\.gz$/.test(name))continue;const stat=await fs.lstat(path.join(storage,name));if(!stat.isFile()||stat.isSymbolicLink())continue;inventory.set(name,{bytes:stat.size,mtime:stat.mtimeMs});disk+=stat.size;}
 async function clean(){for(const [name,item]of inventory)if(item.mtime<Date.now()-RETENTION){await fs.unlink(path.join(storage,name));inventory.delete(name);disk-=item.bytes;}}
 await clean();
 const server=http.createServer(async(req,res)=>{
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
  try{
   const route=new URL(req.url,'http://localhost').pathname;
   if(req.method==='GET'&&route==='/api/health')return json(200,{online:true,reportUpload:true});
   if(['GET','HEAD'].includes(req.method)&&['/ui.js','/transport.js','/protocol.mjs','/collector.json','/collector.elf'].includes(route)){
    const data=await fs.readFile(path.join(ROOT,route.slice(1)));res.setHeader('Content-Type',route.endsWith('.elf')?'application/octet-stream':route.endsWith('.json')?'application/json':'text/javascript');res.setHeader('Content-Length',data.length);res.end(req.method==='HEAD'?undefined:data);return;
   }
   if(req.method!=='POST'||route!=='/api/reports')throw fail(404,'Not found.');
   if(req.headers.origin!==origin||req.headers['x-snipers-diagnostics']!=='1'||!String(req.headers['content-type']).startsWith('application/json'))throw fail(403,'Upload from the Snipers website.');
   // Nginx overwrites X-Real-IP, and this service binds to loopback only.
   const now=Date.now(),client=String(req.headers['x-real-ip']||req.socket.remoteAddress);
   for(const [key,value]of rates)if(value.until<now)rates.delete(key);
   let rate=rates.get(client);if(!rate){if(rates.size>=10000)throw fail(429,'Try again later.');rate={count:0,until:now+3600000};rates.set(client,rate);}
   if(rate.count>=6)throw fail(429,'Six reports per hour are allowed. Please try later.');
   if(inflight>=2)throw fail(503,'Log upload is busy. Please try again shortly.');
   if(disk>=maxDiskBytes||inventory.size>=maxReports)throw fail(503,'Diagnostic storage is full. Please try later.');
   if(Number(req.headers['content-length'])>MAX_BYTES)throw fail(413,'Report is too large.');
   inflight++;rate.count++;
   try{
    const chunks=[];let length=0;
    for await(const chunk of req){length+=chunk.length;if(length>MAX_BYTES)throw fail(413,'Report is too large.');chunks.push(chunk);}
    let input;try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{throw fail(400,'Invalid report JSON.');}
    const {report,summary}=validateReport(input),id=randomBytes(16).toString('hex'),received=new Date().toISOString();
    const data=await zip(JSON.stringify({id,received,expires:new Date(Date.now()+RETENTION).toISOString(),summary,...report}));
    // Reserve quota synchronously before the write: concurrent uploads cannot overrun it.
    if(disk+data.length>maxDiskBytes||inventory.size>=maxReports)throw fail(503,'Diagnostic storage is full.');
    const name=id+'.json.gz';disk+=data.length;inventory.set(name,{bytes:data.length,mtime:Date.now()});
    try{await fs.writeFile(path.join(storage,name),data,{flag:'wx',mode:0o600});}catch(error){disk-=data.length;inventory.delete(name);throw error;}
    return json(201,{id,received,files:report.files.length,containsNewTrace:summary.containsNewTrace});
   }finally{inflight--;}
  }catch(error){if(res.headersSent)return res.destroy();json(error.status||500,{error:error.status?error.message:'Could not save the report. Please try again.'});}
 });
 server.requestTimeout=60000;server.headersTimeout=10000;
 const timer=setInterval(()=>clean().catch(()=>console.error('Diagnostic retention cleanup failed')),3600000);timer.unref();server.on('close',()=>clearInterval(timer));return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.join(ROOT,'server.mjs')){
 const server=await createDiagnosticServer({storage:process.env.DIAGNOSTIC_STORAGE||'/var/lib/snipers-diagnostics'});server.listen(Number(process.env.PORT||8790),'127.0.0.1');
}
