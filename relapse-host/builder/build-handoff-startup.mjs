import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),sdk=path.resolve(process.env.PS5_PAYLOAD_SDK||path.join(root,'ps-neighbourhood/tools/ps5-sdk-0.43/ps5-payload-sdk'));
const args=process.argv.slice(2);if(args.length&&!(args.length===4&&args[0]==='--out'&&args[2]==='--selection'))throw Error('Use --out DIRECTORY --selection SERVER_MANIFEST');
const out=path.resolve(args[1]||path.join(root,'relapse-host/artifacts/youtube-handoff-startup'));fs.mkdirSync(out,{recursive:true});
const selected=JSON.parse(fs.readFileSync(args[3]||path.join(root,'relapse-host/artifacts/youtube-installer/recommended-5f3068bc/selection.json')));
if(!Array.isArray(selected)||!selected.length||selected.length>9)throw Error('Invalid native selection');
const ids=new Set();let total=0;
for(let i=0;i<selected.length;i++){
 const p=selected[i];if(!/^[a-z0-9-]{1,64}$/.test(p.id)||ids.has(p.id)||typeof p.label!=='string'||Buffer.byteLength(p.label)>180||/[\x00-\x1f\x7f]/.test(p.label)||!Number.isInteger(p.bytes)||p.bytes<64||p.bytes>64*1024**2||!/^[a-f0-9]{64}$/.test(p.sha256)||!['etahen','supervisor','dispatch'].includes(p.acknowledgement))throw Error('Invalid native payload metadata');
 if(p.id==='etahen'&&(i!==0||p.acknowledgement!=='etahen'||selected[i+1]?.id!=='etahen-ready'))throw Error('etaHEN requires the following readiness check');
 if(p.acknowledgement==='etahen'&&p.id!=='etahen')throw Error('Invalid etaHEN transport');
 if(p.id==='etahen-ready'&&(i!==1||selected[0].id!=='etahen'||p.acknowledgement!=='supervisor'))throw Error('Unexpected readiness check');
 ids.add(p.id);total+=p.bytes;
}
if(total>129*1024**2)throw Error('Native bundle is too large');
let asm='.section .rodata\n',header='#include <stddef.h>\n#include <stdint.h>\nstruct embedded_payload {const char *label;const uint8_t *data;size_t bytes;uint8_t hash[32];int acknowledgement;};\n';
for(let i=0;i<selected.length;i++){
 const p=selected[i],input=path.resolve(root,p.input),bytes=fs.readFileSync(input);
 if(bytes.length!==p.bytes||createHash('sha256').update(bytes).digest('hex')!==p.sha256)throw Error('Pinned payload changed: '+p.id);
 if(input.includes('"')||input.includes('\n'))throw Error('Invalid assembler input path');
 asm+='.balign 16\n.global handoff_payload_'+i+'\nhandoff_payload_'+i+':\n.incbin "'+input.replaceAll('\\','/')+'"\n';
 header+='extern const uint8_t handoff_payload_'+i+'[];\n';
}
header+='static const struct embedded_payload payloads[]={\n'+selected.map((p,i)=>'{'+JSON.stringify(p.label)+',handoff_payload_'+i+','+p.bytes+',{'+[...Buffer.from(p.sha256,'hex')].join(',')+'},'+({etahen:0,supervisor:1,dispatch:2}[p.acknowledgement])+'}').join(',\n')+'\n};\n';
header+='static const int bundle_has_etahen='+Number(ids.has('etahen'))+';\n';
const custom=selected.filter(p=>p.acknowledgement==='dispatch').length;
header+='static const char *bundle_completion='+JSON.stringify(custom?'Snipers startup finished. Custom payloads sent; check their own status.':'Snipers startup complete: selected payloads ready.')+';\n';
fs.writeFileSync(out+'/payloads.S',asm);fs.writeFileSync(out+'/embedded-payloads.h',header);
const elf=out+'/youtube-handoff-startup.elf',native=path.join(root,'relapse-host/builder/native'),hashSource=path.join(root,'relapse-host/vendor/ftpsrv-0.21.1');
const argv=['cc','-target','x86_64-linux-none','-U__linux__','-D__FreeBSD__=11','-D__PS5__','-D__SCE__','-DSNIPERS_BUNDLED_STARTUP','-fshort-wchar','-isystem',sdk+'/target/include','-I',out,'-I',hashSource,'-Os','-fPIE','-fno-stack-protector','-fno-plt','-femulated-tls','-nostdlib','-pie','-Wl,--hash-style=gnu','-Wl,-z,max-page-size=0x4000','-Wl,-T,'+sdk+'/ldscripts/elf_x86_64.x',native+'/youtube-handoff-probe.c',hashSource+'/notify.c',hashSource+'/sha256.c',out+'/payloads.S',sdk+'/target/lib/crt1.o',sdk+'/target/lib/libc.a','-L',sdk+'/target/lib','-ldl','-lkernel_web','-lSceLibcInternal','-Wl,--no-as-needed','-lSceSystemService','-o',elf];
const r=spawnSync(process.env.ZIG||path.join(root,'ps-neighbourhood/tools/zig-x86_64-windows-0.14.1/zig.exe'),argv,{encoding:'utf8',windowsHide:true,env:{...process.env,ZIG_GLOBAL_CACHE_DIR:out+'/zig-cache',ZIG_LOCAL_CACHE_DIR:out+'/zig-local-cache'}});if(r.status||r.error)throw Error(r.stderr||r.error?.message);
const bytes=fs.readFileSync(elf),manifest=[{id:'handoff-startup',label:'Independent selected-payload startup',file:'payload-01.elf',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),input:path.relative(root,elf),acknowledgement:'supervisor'}];
fs.writeFileSync(out+'/selection.json',JSON.stringify(manifest,null,2));fs.writeFileSync(out+'/embedded-manifest.json',JSON.stringify(selected,null,2));console.log(JSON.stringify(manifest));
