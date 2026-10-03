// SPDX-License-Identifier: MIT
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {crc32} from 'node:zlib';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = path.dirname(root);
const etaProfile = process.env.SNIPERS_ETA_PROFILE === '1';
const logIP = process.env.SNIPERS_LOG_IP || 'off';
if (logIP !== 'off' && (!/^\d+\.\d+\.\d+\.\d+$/.test(logIP) || logIP.split('.').some(x=>Number(x)>255)))
    throw Error('SNIPERS_LOG_IP must be an IPv4 address');
const args = process.argv.slice(2);
const handoffProbe=args.includes('--handoff-probe');
if(handoffProbe)args.splice(args.indexOf('--handoff-probe'),1);
const handoffStartup=args.includes('--handoff-startup');
if(handoffStartup)args.splice(args.indexOf('--handoff-startup'),1);
const nativeHandoff=handoffProbe||handoffStartup;
if(handoffProbe&&handoffStartup)throw Error('Choose either the isolated probe or full handoff startup');
const selectionAt=args.indexOf('--selection');
const selectionFile=selectionAt>=0?args[selectionAt+1]:null;
if(selectionAt>=0){if(!selectionFile)throw Error('Missing selection file');args.splice(selectionAt,2);}
if (args.length && (args.length !== 2 || args[0] !== '--out')) throw Error('Usage: node tools/build-snipers.mjs [--out NEW_DIRECTORY] [--selection SERVER_MANIFEST]');
if(selectionFile&&(!args.length||etaProfile))throw Error('Custom builds require --out and cannot use the withdrawn eta timing profile');
if(nativeHandoff&&(!selectionFile||etaProfile))throw Error('Native handoff requires its isolated selection and normal kernel configuration');
const out = args.length ? path.resolve(args[1]) : path.join(root,etaProfile?'dist/snipers-y2jb-13.60-r11-eta-timing':'dist/snipers-y2jb-13.60-r10-mount-wait');
if (fs.existsSync(out)) throw Error('Output already exists; select a new --out directory: ' + out);
const cache = 'cache/splash_screen/aHR0cHM6Ly93d3cueW91dHViZS5jb20vdHY=';
const dest = path.join(out,'download0',cache);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
function replaceOnce(text, from, to) {
    if (!text.includes(from) || text.indexOf(from) !== text.lastIndexOf(from)) throw Error('Source anchor changed: '+from);
    return text.replace(from, () => to);
}
function run(exe, argv) {
    const env = {...process.env};
    if (exe === (process.env.DOTNET || 'dotnet')) {
        env.APPDATA = path.join(root,'build/dotnet-appdata');
        env.DOTNET_CLI_HOME = path.join(root,'build/dotnet-home');
        env.NUGET_PACKAGES = path.join(root,'build/nuget-packages');
        env.DOTNET_SKIP_FIRST_TIME_EXPERIENCE = '1';
        env.DOTNET_CLI_TELEMETRY_OPTOUT = '1';
        env.DOTNET_GENERATE_ASPNET_CERTIFICATE = 'false';
        env.DOTNET_ADD_GLOBAL_TOOLS_TO_PATH = 'false';
        fs.mkdirSync(env.APPDATA,{recursive:true});
    }
    const result = spawnSync(exe,argv,{cwd:root,stdio:'inherit',windowsHide:true,env});
    if (result.error || result.status !== 0) throw result.error || Error('Build failed: '+exe);
}
let inputs = [
    {id:'etahen',label:'etaHEN 2.5B 13.60 r3',file:'etaHEN-13.60-r3.elf',bytes:30410624,
     sha256:'aa166a43347d10a31f7efa5ca26ec32f512c65e8910466bfc8033537337b87b2',
     input:'etahen-13.60/build/etaHEN-13.60-experimental.elf'},
    {id:'shadowmount',label:'ShadowMountPlus 1.7beta2 r2 Y2JB',file:'snipers-shadowmount.elf',bytes:2658120,
     sha256:'27ff1d6c01ed3f19cbd9845f8fe0c591ce8b8f32f7003a1e3481924d6b8b50b5',
     input:'relapse-host/artifacts/y2jb-candidates/optional-shadowmount.elf'},
    {id:'debug',label:'PS5Debug-NG 1.3.2',file:'snipers-ps5debug.elf',bytes:4280080,
     sha256:'04383e969a5436c9655d80a936dce28d5ac2c2f9d5fd6b98e27e90e6dc624bd6',
     input:'relapse-host/site/payloads/optional-debug-04383e969a54.elf'}
];
if(selectionFile){
    const custom=JSON.parse(fs.readFileSync(path.resolve(selectionFile),'utf8'));
    if(!Array.isArray(custom)||!custom.length||custom.length>9)throw Error('Invalid build selection');
    const ids=new Set(),names=new Set();let total=0;
    for(const item of custom){
        if(!/^[a-z0-9-]{1,64}$/.test(item.id)||ids.has(item.id)||!/^payload-[0-9]{2}\.elf$/.test(item.file)||names.has(item.file)||
            typeof item.label!=='string'||item.label.length>180||!['etahen','supervisor','dispatch'].includes(item.acknowledgement)||
            !Number.isInteger(item.bytes)||item.bytes<64||item.bytes>(handoffStartup?130:64)*1024*1024||!/^[a-f0-9]{64}$/.test(item.sha256)||typeof item.input!=='string')throw Error('Invalid selected payload metadata');
        ids.add(item.id);names.add(item.file);total+=item.bytes;
    }
    if(total>(handoffStartup?130:129)*1024*1024)throw Error('Payload selection exceeds image limit');
    inputs=custom;
}
if(handoffProbe&&(inputs.length!==1||inputs[0].id!=='handoff-probe'||inputs[0].acknowledgement!=='supervisor'))throw Error('Handoff probe must be the only payload');
if(handoffStartup&&(inputs.length!==1||inputs[0].id!=='handoff-startup'||inputs[0].acknowledgement!=='supervisor'))throw Error('Handoff startup must be the only outer payload');
if(etaProfile)Object.assign(inputs[0],{
    label:'etaHEN 2.5B 13.60 r3 timing candidate',file:'etaHEN-13.60-r3-profile.elf',bytes:30409520,
    sha256:'c29f9ed233f9cc0f5c28f5c12d861942f537c119c2e6e091a1f4ad9b22cb7f6e',
    input:'etahen-13.60/build/startup-profile/etaHEN-13.60-startup-profile.elf'
});
const payloads = inputs.map(item => {
    const bytes = fs.readFileSync(path.join(workspace,item.input));
    if (bytes.length !== item.bytes || hash(bytes) !== item.sha256) throw Error('Unrecognized input: '+item.input);
    return bytes;
});
const hostLock = JSON.parse(read('third_party/y2jb-host/SOURCE.json'));
const kernelPin = 'dd8e4e0914c5e9d066ee1f9b056be76cb992c8e0';
const kernelDirectory=path.join(root,'third_party/Relapse-Exploit');
const kernelHead = spawnSync('git',['-c','safe.directory='+kernelDirectory,'-C',kernelDirectory,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true});
if (kernelHead.status !== 0 || kernelHead.stdout.trim() !== kernelPin) throw Error('Relapse kernel submodule is not at the pinned commit');
for (const file of hostLock.files) {
    if (hash(fs.readFileSync(path.join(root,'third_party/y2jb-host',file.path))) !== file.sha256)
        throw Error('Original Y2JB input changed: '+file.path);
}
const manifest = inputs.map(({input,...item}, i) => ({...item,crc32:crc32(payloads[i]).toString(16).padStart(8,'0')}));
fs.mkdirSync(dest,{recursive:true});
fs.mkdirSync(path.join(root,'build'),{recursive:true});
const baseline = path.join(root,'build/relapse-1360-base.js');
run(process.execPath,['tools/build.mjs','--fw','13.60','--out',baseline]);
let payload = fs.readFileSync(baseline,'utf8');
payload = replaceOnce(payload,'const NET_LOG = "auto";', 'const NET_LOG = '+JSON.stringify(logIP)+';');
payload = replaceOnce(payload,'const NET_LOG_PORT = 5050;', 'const NET_LOG_PORT = 5051;');
// Optional PC diagnostics must never wait for a listener or working internet.
payload = replaceOnce(payload,'0n, net_log_sa, 16n)', '0x80n /* MSG_DONTWAIT */, net_log_sa, 16n)');
let startup=read('src/snipers-startup.js'),transport=read('src/snipers-y2jb.js');
if(selectionFile){
    startup=fs.readFileSync(path.join(workspace,nativeHandoff?'relapse-host/builder/handoff-probe-startup.js':'relapse-host/builder/startup.js'),'utf8');
    transport=replaceOnce(transport,"if (item.id === 'etahen') {", "if (item.id === 'etahen' || item.acknowledgement === 'dispatch') {");
    transport=replaceOnce(transport,"logger('etaHEN sent. ShadowMount supervisor will wait for the current Toolbox startup.');", "logger(item.id === 'etahen' ? 'etaHEN sent; the readiness check runs next.' : item.label + ': ELF sent; no readiness protocol supplied.');");
}
const helpers = read('src/snipers-integrity.js') + '\n' + read('src/snipers-dashboard.js') + '\n' + startup + '\n' + transport + '\n' + read('src/snipers-network.js');
payload = replaceOnce(payload,'(async function () {','(async function () {\nlet snipers = null;\n'+helpers);
payload = replaceOnce(payload,'        const chain = new Y2Chain(p);',
    '        snipers = createSnipersStartup(createSnipersY2jbIO(log_now), '+JSON.stringify(manifest)+');\n'+
    '        const snipersFiles = await snipers.prepare(fw);\n        const chain = new Y2Chain(p);');
payload = replaceOnce(payload,'        const upstreamPin = exploit.pinToSingleCore.bind(exploit);',
    '        const readInterface = exploit.firstInterfaceAddress.bind(exploit);\n'+
    '        log_now("Network preflight before kernel attempt...");\n'+
    '        await waitForSnipersInterface(readInterface, log_now);\n'+
    '        exploit.firstInterfaceAddress = () => waitForSnipersInterface(readInterface, log_now);\n'+
    '        const upstreamPin = exploit.pinToSingleCore.bind(exploit);');
payload = replaceOnce(payload,'        send_notification("relapse complete\\nelfldr on <ps5-ip>:9021");',
    '        await snipers.run(snipersFiles, {handedOff:exploit.handedOff, disarmed:exploit.disarmed, crossed:exploit.crossed});');
payload = replaceOnce(payload,'        restore_log_socket();',
    '        if (snipers) snipers.dispose();\n        restore_log_socket();');
// Upstream wording certifies app-close behavior too broadly; this integration
// has not been tested on hardware. Never close YouTube automatically.
payload = replaceOnce(payload,' - both pipes hold their own buffers again, the app is safe to close',
    ' - pipe buffers restored; closing YouTube on 13.60 still needs hardware validation');
if (Buffer.byteLength(payload) > 0x40000) throw Error('Relapse payload exceeds remote-loader compatibility limit');
const hostFiles = hostLock.files.filter(file => file.path.startsWith('download0/'));
for (const file of hostFiles) {
    if (file.path.endsWith('/remotejsloader.js')) continue;
    const target = path.join(out,file.path);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(path.join(root,'third_party/y2jb-host',file.path),target);
}
let main = fs.readFileSync(path.join(dest,'main.js'),'utf8').replace(/\r\n/g,'\n');
main = replaceOnce(main,'await checkLogServer();','NETWORK_LOGGING = false; // No remote log server in this build.');
main = replaceOnce(main,"await load_localscript('remotejsloader.js');",
    "if (String(FW_VERSION) !== '13.60') {\n"+
    "            send_notification('Snipers startup requires PS5 13.60'); return;\n        }\n"+
    "        await load_localscript('relapse.js');");
for (const script of ['kernel.js','aioshellcode.js','relapse.js']) {
    main = replaceOnce(main, "await load_localscript('"+script+"');",
        "{ const started = Date.now(); await log('Loading "+script+"...');\n"+
        "        await load_localscript('"+script+"');\n"+
        "        await log('Loaded "+script+" in ' + (Date.now()-started) + ' ms'); }");
}
fs.writeFileSync(path.join(dest,'main.js'),main);
fs.writeFileSync(path.join(dest,'relapse.js'),payload);
inputs.forEach((item,index) => fs.writeFileSync(path.join(dest,item.file),payloads[index]));
for (const file of fs.readdirSync(dest).filter(x=>x.endsWith('.js'))) run(process.execPath,['--check',path.join(dest,file)]);
if(process.env.SNIPERS_UFS_DLL){
    run(process.env.DOTNET || 'dotnet',[path.resolve(process.env.SNIPERS_UFS_DLL),path.join(out,'download0'),path.join(out,'download0.dat')]);
}else{
    run(process.env.DOTNET || 'dotnet',['restore','tools/ufs2/ImageBuilder.csproj','--configfile','tools/ufs2/NuGet.Config']);
    run(process.env.DOTNET || 'dotnet',['run','--no-restore','--project','tools/ufs2/ImageBuilder.csproj','--configuration','Release','--',path.join(out,'download0'),path.join(out,'download0.dat')]);
}
const imageHash = hash(fs.readFileSync(path.join(out,'download0.dat')));
fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),imageHash+'  download0.dat\n');
fs.writeFileSync(path.join(out,'build-manifest.json'),JSON.stringify({
    name:handoffStartup?'Experimental independent YouTube payload startup':handoffProbe?'Experimental YouTube close handoff probe':selectionFile?'Snipers selectable YouTube startup':etaProfile?'Snipers Relapse Y2JB 13.60 r11 eta timing':'Snipers Relapse Y2JB 13.60 r10',hardwareValidated:false,
    etaStartupProfiling:etaProfile,
    relapseCommit:'bcddec7de9ee5382b675cff30cbc7f21ad03af14',
    kernelCommit:kernelPin,
    y2jbCommit:hostLock.commit,firmware:'13.60',youtubeVersion:'01.000.030',
    imageSha256:imageHash,payloads:manifest,
    generatedRelapse:{bytes:Buffer.byteLength(payload),sha256:hash(payload)},
    diagnosticUDP:logIP === 'off' ? null : logIP+':5051',
    homeNavigation:{automatic:nativeHandoff,manualPauseMs:nativeHandoff?0:10000,closesYouTube:nativeHandoff},
    integrity:{buildAndInstall:'SHA-256',startup:'Pinned CRC32, exact size and ELF header checks; accidental corruption detection'},
    loading:handoffStartup?'Independent ELF owns bundled payloads, closes YouTube and starts the readiness-gated chain':handoffProbe?'Experimental independent ELF closes YouTube after kernel cleanup; no etaHEN or optional payloads':'Local startup on YouTube launch; no network downloads, no automatic app close'
},null,2));
for (const file of ['SNIPERS-SETUP.md','SNIPERS-CREDITS.md','LICENSE']) fs.copyFileSync(path.join(root,file),path.join(out,file));
console.log('Built and locally verified: '+out);
