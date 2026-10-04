import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'relapse-host/artifacts/youtube-installer');fs.mkdirSync(out,{recursive:true});
const sdk=process.env.PS5_PAYLOAD_SDK||path.join(root,'ps-neighbourhood/tools/ps5-sdk-0.43/ps5-payload-sdk'),optional=path.join(root,'relapse-host/optional');
// Reuse the exact current etaHEN readiness check, without spawning any child.
const source=fs.readFileSync(path.join(optional,'launcher.cpp'),'utf8').replace(/\r\n/g,'\n');
const cut=source.indexOf('#ifdef OPTIONAL_PAYLOADMANAGER\n#include "payloadmanager-config.hpp"');
if(cut<0||!source.slice(0,cut).includes('static int eta_ready()'))throw Error('Readiness source anchor changed.');
const cxx=source.slice(0,cut)+`\nint main(){
 uint32_t fw=0;size_t size=sizeof fw;
 if(sysctlbyname("kern.sdk_version",&fw,&size,nullptr,0)||!snipers_firmware_profile(fw))return finish(-1,"unsupported experimental firmware");
 for(int i=0;i<=60;i++){int ready=eta_ready();if(ready==1)return finish(0,"etaHEN Toolbox and kstuff are ready");
 if(ready<0)return finish(-2,"etaHEN startup failed; no following payloads will run");
 if(i==60)break;progress("Waiting for etaHEN Toolbox and kstuff");sleep(1);}
 return finish(-3,"etaHEN readiness timed out; no following payloads will run");
}\n`;
fs.writeFileSync(out+'/readiness.cpp',cxx.replace('static const char* label="PS5Debug-NG";','static const char* label="etaHEN readiness";'));
const common=['-target','x86_64-linux-none','-U__linux__','-D__FreeBSD__=11','-D__PS5__','-D__SCE__','-DETAHEN_PORT_1360=1','-DOPTIONAL_DEBUG','-fshort-wchar','-isystem',sdk+'/target/include','-I',optional,'-Os','-fPIE','-fno-stack-protector','-fno-plt','-femulated-tls','-nostdinc++','-isystem',sdk+'/target/include/c++/v1','-std=c++20','-D_Bool=bool','-fno-exceptions'];
const elf=out+'/Snipers-EtaHEN-Ready.elf';const args=['cc',...common,'-nostdlib','-pie','-Wl,--hash-style=gnu','-Wl,-z,max-page-size=0x4000','-Wl,-T,'+sdk+'/ldscripts/elf_x86_64.x',out+'/readiness.cpp',sdk+'/target/lib/crt1.o',sdk+'/target/lib/libc.a','-L',sdk+'/target/lib','-ldl','-lkernel_web','-lSceLibcInternal','-o',elf];
const r=spawnSync(process.env.ZIG||path.join(root,'ps-neighbourhood/tools/zig-x86_64-windows-0.14.1/zig.exe'),args,{encoding:'utf8',windowsHide:true,env:{...process.env,ZIG_GLOBAL_CACHE_DIR:out+'/zig-cache'}});if(r.status||r.error)throw Error(r.stderr||r.error?.message);
const bytes=fs.readFileSync(elf);const manifest={id:'etahen-ready',label:'etaHEN readiness',file:'snipers-etahen-ready.elf',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),input:'relapse-host/artifacts/youtube-installer/Snipers-EtaHEN-Ready.elf',acknowledgement:'supervisor',internal:true};fs.writeFileSync(out+'/readiness-manifest.json',JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest));
