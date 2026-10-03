import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),sdk=path.join(root,'ps-neighbourhood/tools/ps5-sdk-0.43/ps5-payload-sdk');
const out=path.join(root,'relapse-host/artifacts/youtube-handoff-probe');fs.mkdirSync(out,{recursive:true});
const elf=path.join(out,'youtube-handoff-probe.elf');
const argv=['cc','-target','x86_64-linux-none','-U__linux__','-D__FreeBSD__=11','-D__PS5__','-D__SCE__','-fshort-wchar','-isystem',sdk+'/target/include','-Os','-fPIE','-fno-stack-protector','-fno-plt','-femulated-tls','-nostdlib','-pie','-Wl,--hash-style=gnu','-Wl,-z,max-page-size=0x4000','-Wl,-T,'+sdk+'/ldscripts/elf_x86_64.x',path.join(root,'relapse-host/builder/native/youtube-handoff-probe.c'),path.join(root,'relapse-host/vendor/ftpsrv-0.21.1/notify.c'),sdk+'/target/lib/crt1.o',sdk+'/target/lib/libc.a','-L',sdk+'/target/lib','-ldl','-lkernel_web','-lSceLibcInternal','-Wl,--no-as-needed','-lSceSystemService','-o',elf];
const r=spawnSync(path.join(root,'ps-neighbourhood/tools/zig-x86_64-windows-0.14.1/zig.exe'),argv,{encoding:'utf8',windowsHide:true,env:{...process.env,ZIG_GLOBAL_CACHE_DIR:out+'/zig-cache'}});if(r.status||r.error)throw Error(r.stderr||r.error?.message);
const b=fs.readFileSync(elf),manifest=[{id:'handoff-probe',label:'Independent YouTube handoff probe',file:'payload-01.elf',bytes:b.length,sha256:createHash('sha256').update(b).digest('hex'),input:path.relative(root,elf),acknowledgement:'supervisor'}];
fs.writeFileSync(out+'/selection.json',JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest));

