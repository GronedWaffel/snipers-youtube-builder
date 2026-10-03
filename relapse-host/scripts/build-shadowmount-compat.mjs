// Build drakmor's ShadowMountPlus with the scoped 13.60 kstuff-lite guard.
// Output goes to artifacts/candidates, never directly into the live host.
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectElf} from '../../etahen-13.60/scripts/verify-elf.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const src=path.join(root,'vendor/ShadowMountPlus-1.7beta2');
const y2jb=process.argv.includes('--y2jb-candidate');
const version=y2jb?'1.7beta2-snipers1360-r2-y2jb':'1.7beta2-snipers1360-r1';
const dependencies=path.join(root,'artifacts/shadowmount-build/dependencies');
const out=path.join(root,y2jb?'artifacts/shadowmount-y2jb-build':'artifacts/shadowmount-build');
const sdk=path.resolve(process.env.PS5_PAYLOAD_SDK||path.join(root,'../ps-neighbourhood/tools/ps5-sdk-0.43/ps5-payload-sdk'));
const zig=path.resolve(process.env.ZIG||path.join(root,'../ps-neighbourhood/tools/zig-x86_64-windows-0.14.1/zig.exe'));
const homebrew=path.join(dependencies,'opt/ps5-payload-sdk/target/user/homebrew');
const dependencyHash=createHash('sha256').update(readFileSync(path.join(dependencies,'ps5-payload-dev-v0.40.3.tar.gz'))).digest('hex');
if(dependencyHash!=='0d71dd90c4ad6ef562923be0eb87ca8ce47825b6a2f209e04bb5d57d3359aee8')throw Error('Unexpected dependency archive');
const candidate=path.join(root,y2jb?'artifacts/y2jb-candidates':'artifacts/candidates');
mkdirSync(out,{recursive:true});mkdirSync(candidate,{recursive:true});
function run(args){const r=spawnSync(zig,args,{cwd:src,encoding:'utf8',maxBuffer:8*1024**2,env:{...process.env,ZIG_GLOBAL_CACHE_DIR:path.join(out,'zig-cache')}});if(r.error||r.status)throw Error(r.stderr||r.error?.message||r.stdout);}
const common=['-target','x86_64-linux-none','-U__linux__','-D__FreeBSD__=11','-D__PS5__','-D__SCE__','-D_BSD_SOURCE','-DNDEBUG','-isystem',path.join(sdk,'target/include'),'-I',path.join(src,'include'),'-I',path.join(src,'src'),'-I',path.join(homebrew,'include'),'-I',path.join(homebrew,'include/libpng16'),'-march=znver2','-fshort-wchar','-fPIC','-fno-stack-protector','-fno-plt','-femulated-tls','-O2','-ffunction-sections','-fdata-sections','-std=gnu11','-DSHADOWMOUNT_VERSION="1.7beta2-snipers1360-r1"','-DSHADOWMOUNT_BUILD_TIME="2026-09-30T12:00:00Z"'];
const assets=[['smp_icon.png','smp_icon_png'],['config.ini.example','config_ini_example'],['web/index.html','web_index_html'],['assets/shell_icon_param.json','assets_shell_icon_param_json']];
if(y2jb){
 const i=common.findIndex(value=>value.startsWith('-DSHADOWMOUNT_VERSION='));
 common[i]='-DSHADOWMOUNT_VERSION="'+version+'"';
 common[common.findIndex(value=>value.startsWith('-DSHADOWMOUNT_BUILD_TIME='))]='-DSHADOWMOUNT_BUILD_TIME="2026-10-03T04:00:00Z"';
 common.push('-DSNIPERS_Y2JB_STARTUP=1');
}
const files=readdirSync(path.join(src,'src')).filter(f=>f==='main.c'||/^sm_.*\.c$/.test(f)).map(f=>path.join(src,'src',f));
files.push(path.join(src,'src/sm_shellcore_bridge.S'));
files.push(path.join(root,'shortcut/syscall-shim.S'));
for(const [file,symbol] of assets){
 const b=readFileSync(path.join(src,file)),generated=path.join(out,symbol+'.c');
 writeFileSync(generated,`unsigned char ${symbol}[]={${Array.from(b).join(',')}};\nunsigned int ${symbol}_len=${b.length};\n`);files.push(generated);
}
const objects=[];
for(const file of files){const object=path.join(out,path.basename(file)+'.o');run(['cc',...common,'-c',file,'-o',object]);objects.push(object);console.log('Compiled',path.basename(file));}
const extra=path.join(out,'libkernel_sys_ext.o'),stub=path.join(out,'libkernel_sys_ext.so');
run(['cc',...common,'-c',path.join(src,'src/libkernel_sys_ext.c'),'-o',extra]);
const kernelStub=path.join(out,'libkernel_sys_base.o');
run(['cc',...common,'-c',path.join(dependencies,'sdk-0.43/sce_stubs/libkernel_sys.c'),'-o',kernelStub]);
run(['ld.lld','-shared','-soname','libkernel_sys.sprx',kernelStub,extra,'-o',stub]);
const elf=path.join(candidate,'shadowmountplus-'+version+'.elf');
run(['ld.lld','--strip-all','--eh-frame-hdr','--wrap=syscall','--wrap=__syscall','--wrap=ptrace','--no-dependent-libraries','-pie','--gc-sections','--hash-style=gnu','-z','max-page-size=0x4000','-T',path.join(sdk,'ldscripts/elf_x86_64.x'),...objects,path.join(sdk,'target/lib/crt1.o'),'-L',path.join(sdk,'target/lib'),'--start-group',...['json-c','microhttpd','png16','z','sqlite3','openlibm'].map(n=>path.join(homebrew,'lib/lib'+n+'.a')),path.join(sdk,'target/lib/libc.a'),'-ldl','--end-group','--no-as-needed',stub,...['kernel_sys','SceLibcInternal','SceNotification','SceSystemService','SceUserService','SceAppInstUtil','SceNet','SceSsl','SceHttp'].map(n=>'-l'+n),'-o',elf]);

const data=readFileSync(elf);inspectElf(data);
const manifest={version,upstream:'https://github.com/drakmor/ShadowMountPlus/releases/tag/1.7beta2',file:path.basename(elf),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),change:'Disable legacy sysentvec tag control on 13.60 with bundled kstuff-lite; retain mounting and KEKCALL services.',dependencies:{url:'https://github.com/ps5-payload-dev/pacbrew-repo/releases/download/v0.40.3/ps5-payload-dev.tar.gz',sha256:dependencyHash},hardwareValidated:false};
if(y2jb)manifest.change+=' Recognize the active PPSA01650 ppr_pfs app mount and skip its otherwise unavoidable 15-second release timeout; preserve other mount waits.';
writeFileSync(path.join(candidate,'shadowmount-compat-manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest,null,2));
