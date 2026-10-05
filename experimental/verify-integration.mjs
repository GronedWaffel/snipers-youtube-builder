// Build real local images; never send them to a console or the live service.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createImageWorker} from '../relapse-host/builder/server/worker.mjs';
import {validateSelection,HOSTED} from '../relapse-host/builder/server/payloads.mjs';
import {firmwareProfile,profiles} from './channel.mjs';
const root=path.resolve(import.meta.dirname,'..'), workspace=path.dirname(root);
process.env.PS5_PAYLOAD_SDK ||= path.join(workspace,'ps-neighbourhood/tools/ps5-sdk-0.43/ps5-payload-sdk');
process.env.ZIG ||= path.join(workspace,'ps-neighbourhood/tools/zig-x86_64-windows-0.14.1/zig.exe');
process.env.SNIPERS_UFS_DLL ||= path.join(root,'relapse-y2jb/tools/ufs2/bin/Release/net9.0/ImageBuilder.dll');
const allPayloads=process.argv.includes('--all-payloads');
const targets=process.argv.slice(2).filter(x=>x!=='--all-payloads');if(!targets.length)targets.push(...profiles.firmwares.map(p=>p.firmware));
const results=[];
for(const firmware of targets){
  firmwareProfile(firmware);
  const base=path.join(import.meta.dirname,'local/integration');await fs.mkdir(base,{recursive:true});
  const directory=await fs.mkdtemp(path.join(base,firmware+'-'));
  const downloadToken=createHash('sha256').update(directory).digest('hex').slice(0,48);
  const output=await createImageWorker({address:'127.0.0.1',host:'localhost',verifyOnly:true})({firmware,directory,downloadToken,payloads:validateSelection(allPayloads?HOSTED.map(x=>x.id):['etahen','shadowmount','debug']),progress:message=>console.log(firmware+': '+message)});
  const manifest=JSON.parse(await fs.readFile(path.join(directory,'image/build-manifest.json'),'utf8'));
  if(manifest.firmware!==firmware||manifest.channel!=='unified')throw Error('Image target mismatch');
  results.push({firmware,imageSha256:output.imageSha256,installerSha256:output.sha256,directory,consoleTested:false});
  console.log(firmware+': full image and personalized installer passed');
  if(!['11.00','12.40','12.60','13.60'].includes(firmware)){
    if(path.dirname(path.resolve(directory))!==path.resolve(base))throw Error('Unexpected verification output path');
    await fs.rm(directory,{recursive:true});
  }
}
await fs.writeFile(path.join(import.meta.dirname,allPayloads?'local/all-payload-results.json':'local/integration-results.json'),JSON.stringify(results,null,2)+'\n');
