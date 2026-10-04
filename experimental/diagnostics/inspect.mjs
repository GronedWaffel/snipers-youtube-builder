// Run on the VPS through authorized SSH. Reports are never publicly served.
import fs from 'node:fs/promises';import path from 'node:path';import {gunzipSync} from 'node:zlib';
const root=process.env.DIAGNOSTIC_STORAGE||'/var/lib/snipers-diagnostics',id=process.argv[2];
async function read(name){return JSON.parse(gunzipSync(await fs.readFile(path.join(root,name))));}
if(id==='--list'){
 const names=(await fs.readdir(root)).filter(n=>/^[a-f0-9]{32}\.json\.gz$/.test(n));const rows=[];
 for(const name of names){const r=await read(name);rows.push({id:r.id,received:r.received,firmwareRaw:r.collectorFirmwareRaw.toString(16),builds:r.summary.builds,runs:r.summary.runStarts,failures:r.summary.suspectedFailures.length,newTrace:r.summary.containsNewTrace});}
 rows.sort((a,b)=>b.received.localeCompare(a.received));console.log(JSON.stringify(rows,null,2));
}else if(/^[a-f0-9]{32}$/.test(id||'')){
 const r=await read(id+'.json.gz');console.log(JSON.stringify(process.argv.includes('--full')?r:{id:r.id,received:r.received,collectorFirmwareRaw:r.collectorFirmwareRaw,browserFirmware:r.browserFirmware,summary:r.summary,skipped:r.skipped},null,2));
}else throw Error('Usage: node inspect.mjs --list | <report ID> [--full]');
