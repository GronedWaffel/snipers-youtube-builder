import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const y2jbCandidate=process.argv.includes('--y2jb-candidate');
const out=path.join(root,y2jbCandidate?'artifacts/optional-y2jb':'artifacts/optional');
const compatCandidate=y2jbCandidate||process.argv.includes('--compat-candidate');
const candidateDir=y2jbCandidate?'artifacts/y2jb-candidates':'artifacts/candidates';
const sdk=path.resolve(process.env.PS5_PAYLOAD_SDK||path.join(root,'../ps-neighbourhood/tools/ps5-sdk-0.43/ps5-payload-sdk'));
const zig=path.resolve(process.env.ZIG||path.join(root,'../ps-neighbourhood/tools/zig-x86_64-windows-0.14.1/zig.exe'));
await mkdir(out,{recursive:true});
await mkdir(path.join(root,'site/payloads'),{recursive:true});
// Update from the producer when present; source archives contain the exact
// published ABI so standalone builds need no sibling checkout.
const producer=path.resolve(root,'../etahen-13.60/Source Code/include/port_startup_state.hpp');
try { await writeFile(path.join(root,'optional/port_startup_state.hpp'),await readFile(producer)); }
catch(error) { if(error.code!=='ENOENT')throw error; await readFile(path.join(root,'optional/port_startup_state.hpp')); }
const sony=(await readFile(path.join(root,'deploy/sony-domains.txt'),'utf8')).split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));
const dnsConfig='[general]\nlog=/dev/null\ndebug=0\nquiet=0\nbind=127.0.0.1\nbind6=::1\n\n[upstream]\nserver=1.1.1.1\nserver=8.8.8.8\ntimeout_ms=1500\n\n[overrides]\nmanuals.playstation.net=74.50.81.85\n'+sony.flatMap(s=>[s+'=0.0.0.0','*.'+s+'=0.0.0.0']).join('\n')+'\n\n[exceptions]\n';
await writeFile(path.join(root,'optional/nanodns-default.hpp'),'// Generated from the Sony-only host policy. Existing console configs are preserved.\nstatic const char nanodns_default[] = '+JSON.stringify(dnsConfig)+';\n');
const common=['-target','x86_64-linux-none','-U__linux__','-D__FreeBSD__=11','-D__PS5__','-D__SCE__','-DETAHEN_PORT_1360=1','-fshort-wchar','-isystem',path.join(sdk,'target/include'),'-march=znver2','-fPIC','-fno-stack-protector','-fno-plt','-femulated-tls','-O1','-fno-exceptions'];
function run(args){const r=spawnSync(zig,args,{cwd:root,encoding:'utf8',env:{...process.env,ZIG_GLOBAL_CACHE_DIR:path.join(out,'zig-cache')}});if(r.status!==0)throw Error(r.stderr||r.error?.message||r.stdout);}
const objects=[];
for(const [source,name,extra] of [['optional/vendor/libelfldr/elfldr.c','elfldr',['-I','optional/vendor/libelfldr']],['optional/vendor/libNineS/pt.c','pt',['-I','optional/vendor/libNineS']],['shortcut/syscall-shim.S','shim',[]]]){
 const obj=path.join(out,name+'.o');run(['cc',...common,...extra,'-c',source,'-o',obj]);objects.push(obj);
}
const inputs=[
 {id:'nanodns',label:'NanoDNS',version:'0.4',input:path.join(root,'vendor/nanodns.elf'),sha256:'fcfb7d47c3b295560ea1603dc015f7c4950353ef0faca16428bd425680ef1fc5',source:'https://github.com/drakmor/nanoDNS/releases/tag/0.4'},
 {id:'shadowmount',label:'ShadowMountPlus',version:'1.7beta2 experimental supervisor',input:path.join(root,'vendor/shadowmountplus-1.7beta2.elf'),sha256:'3f716a7b2220c7e87e87452ae05cad689ef842d3beb4cdad6c526cb6dfc2b6b5',source:'https://github.com/drakmor/ShadowMountPlus/releases/tag/1.7beta2'},
 {id:'filemanager',label:'Web File Manager',version:'1.9',input:path.join(root,'vendor/filemanager.elf'),sha256:'711cb076e887fcd55d973ade8b84bb6c22720be295bfde18e32761f6e0479a3e',source:'https://github.com/owendswang/ps5-web-file-manager/releases/tag/v1.9'},
 {id:'websrv',label:'Homebrew web server',version:'0.34',input:path.join(root,'vendor/websrv.elf'),sha256:'54730c867c6e1148536fdcb370e63a7762d989ea87b62488ad4caff64d43f263',source:'https://github.com/ps5-payload-dev/websrv/releases/tag/v0.34'},
 {id:'ftp',label:'ftpsrv',version:'0.21.1',input:path.join(root,'vendor/ftp.elf'),sha256:'7d4b31c83eae4e056580482a3a074e1db25922efc74ac1e439473b45d71a5938',source:'https://github.com/ps5-payload-dev/ftpsrv/releases/tag/v0.21.1'},
 {id:'debug',label:'PS5Debug-NG',version:'1.3.2',input:path.resolve(process.env.PS5DEBUG_ELF||path.join(root,'../ps-neighbourhood/data/payloads/ps5debug-NG_v1.3.2.elf')),sha256:'949b0e6e0fe3f24f4a820319fd76d9ccb92f9770cbb1a64b09a8eca5c1fc9ff3',source:'https://github.com/Pharaoh2k/ps5debug-NG'}
];
inputs.push({id:'payloadmanager',label:'Payload Manager',version:'0.5.2',input:path.join(root,'vendor/pldmgr.elf'),sha256:'62b3ba2a4937c2afc502f9a4e7242cca538610ebb4ae2800c7c6f72e7f268e7c',source:'https://github.com/itsPLK/ps5-payload-manager/releases/tag/v0.5.2'});
const manifest=[];
if(compatCandidate){
 const compat=JSON.parse(await readFile(path.join(root,candidateDir,'shadowmount-compat-manifest.json'),'utf8'));
 const item=inputs.find(i=>i.id==='shadowmount');
 item.input=path.join(root,candidateDir,compat.file);
 item.sha256=compat.sha256;item.version=compat.version;
}
const onlyArg=process.argv.find(arg=>arg.startsWith('--only='));
const only=onlyArg?.slice(7);
if(only&&!inputs.some(item=>item.id===only))throw Error('Unknown payload: '+only);
for(const item of inputs.filter(i=>(!compatCandidate||i.id==='shadowmount')&&(!only||i.id===only))){
 const child=await readFile(item.input);if(createHash('sha256').update(child).digest('hex')!==item.sha256)throw Error('Unrecognized input: '+item.id);
 const embed=path.join(out,item.id+'-'+item.sha256+'.S');await writeFile(embed,'.section .data\n.balign 16\n.global child_start\nchild_start:\n.incbin "'+item.input.replaceAll('\\','/')+'"\n');
 run(['cc',...common,'-c',embed,'-o',embed+'.o']);
 const obj=path.join(out,item.id+'.o');run(['cc',...common,'-nostdinc++','-I',path.join(sdk,'target/include/c++/v1'),'-std=c++20','-D_Bool=bool','-DOPTIONAL_'+item.id.toUpperCase(),'-c','optional/launcher.cpp','-o',obj]);
 const file='optional-'+item.id+'.elf',elf=path.join(root,compatCandidate?candidateDir:'artifacts/optional',file);
 run(['ld.lld','--eh-frame-hdr','--wrap=syscall','--wrap=__syscall','--wrap=ptrace','--no-dependent-libraries','-pie','--hash-style=gnu','-z','max-page-size=0x4000','-T',path.join(sdk,'ldscripts/elf_x86_64.x'),obj,embed+'.o',...objects,path.join(sdk,'target/lib/crt1.o'),'-L',path.join(sdk,'target/lib'),'--start-group',path.join(sdk,'target/lib/libc.a'),'-ldl','--end-group','-lkernel_web','-lSceLibcInternal','-o',elf]);
 const bytes=await readFile(elf);if(bytes.readUInt32LE(0)!==0x464c457f||bytes.readUInt16LE(18)!==62)throw Error('Invalid ELF');
 const sha256=createHash('sha256').update(bytes).digest('hex');
 let publicFile=file;
 if(!compatCandidate){publicFile='optional-'+item.id+'-'+sha256.slice(0,12)+'.elf';await writeFile(path.join(root,'site/payloads',publicFile),bytes);}
 manifest.push({id:item.id,label:item.label,version:item.version,path:'payloads/'+publicFile,bytes:bytes.length,sha256,...(item.custom?{customSha256:item.sha256}:{upstreamSha256:item.sha256}),source:item.source});
}
if(only&&!compatCandidate){
 const {OPTIONAL_PAYLOADS:previous}=await import('../site/src/optional-manifest.js');
 manifest.unshift(...previous.filter(item=>item.id!==only));
}
await writeFile(path.join(root,compatCandidate?candidateDir+'/optional-manifest.js':'site/src/optional-manifest.js'),'// Generated by scripts/build-optional.mjs; exact pinned inputs only.\nexport const OPTIONAL_PAYLOADS = '+JSON.stringify(manifest,null,2)+';\n');
console.log(JSON.stringify(manifest));
