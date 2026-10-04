import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {profiles,firmwareProfile} from './channel.mjs';
const root=path.resolve(import.meta.dirname,'..'),workspace=path.dirname(root);
const env={...process.env,PS5_PAYLOAD_SDK:process.env.PS5_PAYLOAD_SDK||path.join(workspace,'ps-neighbourhood/tools/ps5-sdk-0.43/ps5-payload-sdk'),ZIG:process.env.ZIG||path.join(workspace,'ps-neighbourhood/tools/zig-x86_64-windows-0.14.1/zig.exe')};
const targets=process.argv.slice(2);for(const fw of targets)firmwareProfile(fw);
const logdir=path.join(root,'experimental/local/build-logs');fs.mkdirSync(logdir,{recursive:true});
for(const script of ['relapse-host/builder/build-readiness.mjs',...(targets.length?targets:profiles.firmwares.map(p=>p.firmware)).map(fw=>({fw,script:'relapse-host/builder/build-youtube-installer.mjs'}))]){
 const name=typeof script==='string'?script:script.script,fw=typeof script==='string'?null:script.fw;
 const r=spawnSync(process.execPath,[name],{cwd:root,env:{...env,...(fw?{SNIPERS_FIRMWARE:fw}:{})},encoding:'utf8',maxBuffer:8*1024**2,windowsHide:true});
 fs.writeFileSync(path.join(logdir,(fw||'readiness')+'.log'),(r.stdout||'')+(r.stderr||''));
 if(r.status||r.error){console.error((fw||name)+' failed: '+(r.stderr||r.stdout||r.error?.message));process.exit(1);}console.log((fw||'readiness')+' compiled');
}
