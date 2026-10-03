// Authorized local hardware test only. Public website remains verification-only.
import fs from 'node:fs';import http from 'node:http';import net from 'node:net';import path from 'node:path';import {createHash,randomBytes} from 'node:crypto';
import {configureInstaller} from './server/installer.mjs';
const full=process.argv.includes('--startup');
const root=path.resolve(import.meta.dirname,'../..');
const directoryAt=process.argv.indexOf('--directory');
if(directoryAt>=0&&!process.argv[directoryAt+1])throw Error('Missing candidate directory');
const out=directoryAt>=0?path.resolve(process.argv[directoryAt+1]):path.join(root,full?'relapse-host/artifacts/youtube-handoff-startup':'relapse-host/artifacts/youtube-handoff-probe');
const image=path.join(out,'image/download0.dat'),content=fs.readFileSync(image),sha256=createHash('sha256').update(content).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(out,'image/build-manifest.json')));
if(manifest.imageSha256!==sha256||manifest.payloads.length!==1||manifest.payloads[0].id!==(full?'handoff-startup':'handoff-probe')||!manifest.homeNavigation.closesYouTube)throw Error('Not the verified handoff image');
const token=randomBytes(24).toString('hex'),job=token.slice(0,32),url='/youtube-bundles/'+token+'.dat';
const installer=configureInstaller(fs.readFileSync(path.join(root,'relapse-host/artifacts/youtube-installer/Snipers-YouTube-Installer.template.elf')),{address:'192.168.137.1',port:8788,host:'192.168.137.1',path:url,job,bytes:content.length,sha256});
const record={job,imageSha256:sha256,installerSha256:installer.sha256,remoteBackup:'/user/download/PPSA01650/download0.dat.snipers-backup-'+job,startedAt:new Date().toISOString()};
fs.writeFileSync(path.join(out,'install-receipt.json'),JSON.stringify(record,null,2));fs.writeFileSync(path.join(out,'installer.elf'),installer.bytes);
const server=http.createServer((req,res)=>{if(req.url!==url||!['GET','HEAD'].includes(req.method)){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':content.length,'Cache-Control':'no-store'});if(req.method==='HEAD')res.end();else fs.createReadStream(image).pipe(res);});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(8788,'192.168.137.1',resolve);});
let response='';
try{
 await new Promise((resolve,reject)=>{const socket=net.connect({host:'192.168.137.169',port:9021,allowHalfOpen:true});let settled=false;
  const timer=setTimeout(()=>socket.destroy(Error('Installer timed out; no automatic retry')),600000);
  socket.on('connect',()=>socket.end(installer.bytes));
  socket.on('data',chunk=>{response+=chunk.toString();fs.appendFileSync(path.join(out,'install-console.log'),chunk);process.stdout.write(chunk);if(response.length>262144)return socket.destroy(Error('Unexpected installer output size'));const match=/SNPR_OPTION_RESULT=(-?\d+)\r?\n/.exec(response);if(match){settled=true;clearTimeout(timer);socket.destroy();if(!['0','1'].includes(match[1]))reject(Error('Installer stopped: '+response.slice(-500)));else resolve();}});
  socket.on('error',reject);socket.on('close',()=>{clearTimeout(timer);if(!settled)reject(Error('Installer connection ended without a result'));});
 });
 record.completedAt=new Date().toISOString();record.nativeVerificationPassed=true;fs.writeFileSync(path.join(out,'install-receipt.json'),JSON.stringify(record,null,2));
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
