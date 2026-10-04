import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),sdk=path.join(root,'ps-neighbourhood/tools/ps5-sdk-0.43/ps5-payload-sdk');
const out=path.join(root,'relapse-host/artifacts/youtube-installer');fs.mkdirSync(out,{recursive:true});
const json=path.join(root,'etahen-13.60/Source Code/extern/tiny-json');
const common=['-target','x86_64-linux-none','-U__linux__','-D__FreeBSD__=11','-D__PS5__','-D__SCE__','-fshort-wchar','-isystem',sdk+'/target/include','-I',json,'-Os','-fPIE','-fno-stack-protector','-fno-plt','-femulated-tls'];
function run(args){const r=spawnSync(path.join(root,'ps-neighbourhood/tools/zig-x86_64-windows-0.14.1/zig.exe'),args,{encoding:'utf8',windowsHide:true,env:{...process.env,ZIG_GLOBAL_CACHE_DIR:path.join(out,'zig-cache')}});if(r.status||r.error)throw Error(r.stderr||r.error?.message);}
run(['cc',...common,'-x','c','-c',json+'/tiny-json.cpp','-o',out+'/tiny-json.o']);
const elf=out+'/Snipers-YouTube-Preflight.elf';
run(['cc',...common,'-nostdlib','-pie','-Wl,--hash-style=gnu','-Wl,-z,max-page-size=0x4000','-Wl,-T,'+sdk+'/ldscripts/elf_x86_64.x',path.join(root,'relapse-host/builder/native/youtube-preflight.c'),out+'/tiny-json.o',sdk+'/target/lib/crt1.o',sdk+'/target/lib/libc.a','-L',sdk+'/target/lib','-ldl','-lkernel_web','-lSceLibcInternal','-Wl,--no-as-needed','-lSceSystemService','-o',elf]);
const bytes=fs.readFileSync(elf),manifest={file:path.basename(elf),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),readOnly:true,hardwareValidated:false};fs.writeFileSync(out+'/preflight-manifest.json',JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest));
const hashSource=path.join(root,'relapse-host/vendor/ftpsrv-0.21.1');
const installer=out+'/Snipers-YouTube-Installer.template.elf';
run(['cc',...common,'-I',hashSource,'-nostdlib','-pie','-Wl,--hash-style=gnu','-Wl,-z,max-page-size=0x4000','-Wl,-T,'+sdk+'/ldscripts/elf_x86_64.x',path.join(root,'relapse-host/builder/native/youtube-installer.c'),hashSource+'/sha256.c',hashSource+'/notify.c',out+'/tiny-json.o',sdk+'/target/lib/crt1.o',sdk+'/target/lib/libc.a','-L',sdk+'/target/lib','-ldl','-lkernel_web','-lSceLibcInternal','-Wl,--no-as-needed','-lSceSystemService','-o',installer]);
const native=fs.readFileSync(installer);console.log(JSON.stringify({file:path.basename(installer),bytes:native.length,sha256:createHash('sha256').update(native).digest('hex'),configured:false,hardwareValidated:false}));
