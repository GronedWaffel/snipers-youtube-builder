import {firmwareProfile} from '../../../experimental/channel.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';import {configureInstaller} from './installer.mjs';
import {createReadStream} from 'node:fs';
const workspace=path.resolve(import.meta.dirname,'../../..');
function run(args,progress,firmware){return new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,args,{cwd:workspace,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,SNIPERS_FIRMWARE:firmware}});let tail='';
 const timer=setTimeout(()=>child.kill(),15*60*1000);
 for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{tail=(tail+b).slice(-12000);if(String(b).includes('UFS'))progress('Building and verifying the YouTube filesystem.');});
 child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Image builder failed: '+tail));});
});}
export function createImageWorker({address,host,port=80,verifyOnly=true}){
 return async({firmware,directory,payloads,downloadToken,progress})=>{
  firmwareProfile(firmware);
  if(!/^[a-f0-9]{48}$/.test(downloadToken))throw Error('Missing download identity');
  const selected=[];
  for(const item of payloads){
   selected.push({...item,input:path.relative(workspace,item.path||path.join(workspace,item.input))});
   if(item.id==='etahen')selected.push(JSON.parse(await fs.readFile(path.join(workspace,'relapse-host/artifacts/youtube-installer/readiness-manifest.json'),'utf8')));
  }
  const manifest=selected.map(({path:_,requires,description,version,startupStatus,...item},i)=>({...item,file:'payload-'+String(i+1).padStart(2,'0')+'.elf'}));
  const selection=path.join(directory,'selection.json');await fs.writeFile(selection,JSON.stringify(manifest,null,2),{flag:'wx'});
  const native=path.join(directory,'native');progress('Building the independent startup with your selected payloads.');
  await run(['relapse-host/builder/build-handoff-startup.mjs','--out',native,'--selection',selection],progress,firmware);
  const output=path.join(directory,'image');progress('Building your selected payloads into YouTube startup.');
  await run(['relapse-y2jb/tools/build-snipers.mjs','--out',output,'--selection',path.join(native,'selection.json'),'--handoff-startup'],progress,firmware);
  const imagePath=path.join(output,'download0.dat'),image=await fs.stat(imagePath),hash=createHash('sha256');
  for await(const chunk of createReadStream(imagePath))hash.update(chunk);
  const imageHash=hash.digest('hex');
  const template=await fs.readFile(path.join(workspace,'relapse-host/artifacts/youtube-installer/'+firmware+'/Snipers-YouTube-Installer.template.elf'));
  const configured=configureInstaller(template,{address,host,port,path:'/builder/youtube-bundles/'+downloadToken+'.dat',job:downloadToken.slice(0,32),bytes:image.size,sha256:imageHash,verifyOnly});
  const installer=path.join(directory,'Snipers-YouTube-Installer.elf');await fs.writeFile(installer,configured.bytes,{flag:'wx'});
  return{path:installer,sha256:configured.sha256,imagePath,imageSha256:imageHash,verifyOnly};
 };
}
