import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),workspace=path.dirname(root),eta=path.join(root,'etahen-13.60');
const env={...process.env,PS5_PAYLOAD_SDK:process.env.PS5_PAYLOAD_SDK||path.join(workspace,'ps-neighbourhood/tools/ps5-sdk-0.43/ps5-payload-sdk'),ZIG:process.env.ZIG||path.join(workspace,'ps-neighbourhood/tools/zig-x86_64-windows-0.14.1/zig.exe')};
fs.mkdirSync(path.join(eta,'build'),{recursive:true});
for(const args of [['scripts/build-core.mjs'],['scripts/build-shellui.mjs'],['scripts/build-services.mjs','fps_elf'],['scripts/build-services.mjs','daemon'],['scripts/build-services.mjs','util'],['scripts/build-toolbox-card.mjs'],['scripts/build-bootstrapper.mjs']]){
 const result=spawnSync(process.execPath,args,{cwd:eta,env,encoding:'utf8',maxBuffer:32*1024*1024,windowsHide:true});
 const name=path.basename(args[0],'.mjs')+(args[1]?'-'+args[1]:'');fs.writeFileSync(path.join(eta,'build',name+'.log'),(result.stdout||'')+(result.stderr||''));
 if(result.status||result.error){console.error(name+' failed\n'+(result.stderr||result.stdout||result.error?.message).slice(-7000));process.exit(1);}console.log(name+' passed');
}
console.log('Experimental etaHEN compiled; hardware behavior has not been validated.');
