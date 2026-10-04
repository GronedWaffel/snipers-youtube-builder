// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),workspace=path.dirname(root);
const sdk=process.env.PS5_PAYLOAD_SDK||path.join(workspace,'ps-neighbourhood/tools/ps5-sdk-0.43/ps5-payload-sdk');
const zig=process.env.ZIG||path.join(workspace,'ps-neighbourhood/tools/zig-x86_64-windows-0.14.1/zig.exe');
const out=path.join(import.meta.dirname,'collector.elf'),hash=import.meta.dirname;
const args=['cc','-target','x86_64-linux-none','-U__linux__','-D__FreeBSD__=11','-D__PS5__','-D__SCE__','-fshort-wchar','-isystem',sdk+'/target/include','-I',hash,'-Os','-fPIE','-fno-stack-protector','-fno-plt','-femulated-tls','-nostdlib','-pie','-Wl,--hash-style=gnu','-Wl,-z,max-page-size=0x4000','-Wl,-T,'+sdk+'/ldscripts/elf_x86_64.x',path.join(import.meta.dirname,'collector.c'),hash+'/sha256.c',sdk+'/target/lib/crt1.o',sdk+'/target/lib/libc.a','-L',sdk+'/target/lib','-ldl','-lkernel_web','-lSceLibcInternal','-o',out];
const cache=path.join(root,'relapse-host/artifacts/diagnostic-cache');fs.mkdirSync(cache,{recursive:true});
const result=spawnSync(zig,args,{encoding:'utf8',windowsHide:true,env:{...process.env,ZIG_GLOBAL_CACHE_DIR:cache}});if(result.status||result.error)throw Error(result.stderr||result.error?.message);
const bytes=fs.readFileSync(out),manifest={schema:1,url:'/diagnostics/collector.elf',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),readOnly:true};
fs.writeFileSync(path.join(import.meta.dirname,'collector.json'),JSON.stringify(manifest,null,2)+'\n');console.log(manifest);
