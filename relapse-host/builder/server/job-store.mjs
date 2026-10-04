import {firmwareProfile,CHANNEL} from '../../../experimental/channel.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import {isToken} from './payloads.mjs';
export async function saveJob(job){
 const tmp=path.join(job.directory,'state.json.new');
 await fs.writeFile(tmp,JSON.stringify(job),{mode:0o600});await fs.rename(tmp,path.join(job.directory,'state.json'));
}
export async function restoreJobs(storage,ttl){
 const jobs=new Map();
 for(const entry of await fs.readdir(storage,{withFileTypes:true})){
  if(!entry.isDirectory()||!isToken(entry.name))continue;
  const directory=path.join(storage,entry.name),info=await fs.lstat(directory);if(info.isSymbolicLink())continue;
  try{
   const file=path.join(directory,'state.json'),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>65536)throw Error('Invalid saved state');
   const job=JSON.parse(await fs.readFile(file,'utf8'));
   firmwareProfile(job.firmware);if(job.channel!==CHANNEL)throw Error('Wrong saved job channel');
   if(job.id!==entry.name||!isToken(job.key)||path.resolve(job.directory)!==directory||!Number.isFinite(job.expires)||!Array.isArray(job.files)||!Array.isArray(job.selection))throw Error('Invalid saved state');
   for(const target of [job.package,job.image,...job.files.map(f=>f.path)].filter(Boolean)){
    const relative=path.relative(directory,path.resolve(target));if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Saved path escaped build directory');
   }
   if(!['selecting','ready','failed'].includes(job.state)){job.state='failed';job.message='The server restarted during this build. Create a new bundle; nothing was installed.';}
   if(job.state==='ready'&&(!isToken(job.download)||!/^[A-F0-9]{10}$/.test(job.installCode)||!job.package))throw Error('Invalid ready state');
   jobs.set(job.id,job);
  }catch{
   // Keep orphan files for one TTL, count them against capacity, then remove
   // only their own token-named directory through the normal bounded cleanup.
   jobs.set(entry.name,{id:entry.name,directory,expires:info.mtimeMs+ttl,state:'orphan',files:[],selection:[]});
  }
 }
 return jobs;
}
