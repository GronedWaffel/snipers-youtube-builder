import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const sdk=path.join(root,'artifacts/builder-tools/openorbis/OpenOrbis/PS4Toolchain');
// TEST10001 is an existing Category1 test slot on the development console.
// Check it is unused before installing; never overwrite another homebrew app.
const titleId='TEST10001';
const bootOnly=process.argv.includes('--boot-only');
const revision=bootOnly?5:4;
const out=path.join(root,'artifacts/builder-probe-r'+revision);fs.mkdirSync(path.join(out,'sce_sys'),{recursive:true});
const zig=path.resolve(root,'../ps-neighbourhood/tools/zig-x86_64-windows-0.14.1/zig.exe');
function run(exe,args){const r=spawnSync(exe,args,{cwd:out,encoding:'utf8',windowsHide:true,env:{...process.env,DOTNET_ROLL_FORWARD:'Major',OO_PS4_TOOLCHAIN:sdk,ZIG_GLOBAL_CACHE_DIR:path.join(root,'artifacts/builder-tools/zig-cache')}});if(r.error||r.status)throw Error(r.error?.message||r.stderr||r.stdout);if(r.stdout)console.log(r.stdout.trim());}
run(zig,['cc','-target','x86_64-freebsd','-fPIC','-fno-stack-protector','-funwind-tables','-O1','-nostdinc','-isystem',path.join(sdk,'include'),'-c',path.join(root,'builder/native',bootOnly?'boot-only.c':'probe.c'),'-o','probe.o']);
run(zig,['ld.lld','-m','elf_x86_64','-pie','--script',path.join(sdk,'link.x'),'--eh-frame-hdr','-L',path.join(sdk,'lib'),'probe.o','-lc','-lkernel',path.join(sdk,'lib/crt1.o'),'-o','probe.elf']);
const bin=path.join(sdk,'bin/windows');
// PS5-compatible FSELF settings documented by aydencharles/ps5-kylin-explorer.
const authInfo='000000000000000000000000001C004000FF000000000080000000000000000000000000000000000000008000400040000000000000008000000000000000080040FFFF000000F000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
run(path.join(bin,'create-fself.exe'),['-in=probe.elf','-out=probe.oelf','--eboot','eboot.bin','--paid',bootOnly?'0x3800000000000011':'0x3100000000000002',...(bootOnly?[]:['--authinfo',authInfo])]);
const pkgtool=path.join(bin,'PkgTool.Core.exe');
run(pkgtool,['sfo_new','sce_sys/param.sfo']);
const content='IV0000-'+titleId+'_00-SNIPERSSETUP0000';
for(const [key,type,size,value] of [['APP_TYPE','Integer',4,1],['APP_VER','Utf8',8,'0.0'+revision],['ATTRIBUTE','Integer',4,0],['CATEGORY','Utf8',4,'gd'],['CONTENT_ID','Utf8',48,content],['DOWNLOAD_DATA_SIZE','Integer',4,0],['SYSTEM_VER','Integer',4,0],['TITLE','Utf8',128,'Snipers Setup Test '+revision],['TITLE_ID','Utf8',12,titleId],['VERSION','Utf8',8,'0.0'+revision]])run(pkgtool,['sfo_setentry','sce_sys/param.sfo',key,'--type',type,'--maxsize',String(size),'--value',String(value)]);
fs.copyFileSync(path.join(sdk,'samples/hello_world/sce_sys/icon0.png'),path.join(out,'sce_sys/icon0.png'));
const runtime=['sce_module/libc.prx','sce_module/libSceFios2.prx','sce_sys/about/right.sprx'];
for(const file of runtime){const target=path.join(out,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(sdk,'samples/hello_world',file),target);}
run(path.join(bin,'create-gp4.exe'),['-out','pkg.gp4','--content-id='+content,'--files',['eboot.bin','sce_sys/param.sfo','sce_sys/icon0.png',...runtime].join(' ')]);
run(pkgtool,['pkg_build','pkg.gp4','.']);
run(pkgtool,['pkg_validate',content+'.pkg']);
// Structural validation alone did not catch missing boot-time modules. Extract
// the final package and compare every packaged runtime byte with its source.
run(pkgtool,['pkg_extract',content+'.pkg','readback']);
for(const file of ['eboot.bin',...runtime])if(!fs.readFileSync(path.join(out,file)).equals(fs.readFileSync(path.join(out,'readback/uroot',file))))throw Error('Package readback differs: '+file);
console.log(path.join(out,content+'.pkg'));
