import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
const parts=[
 'http://gst.prod.dl.playstation.net/gst/prod/00/PPSA01650_00/app/pkg/6/f_cca4b4736587963783ca48003630bc1234eedb0f9248571bcb0328d0a0a5da89/UP4381-PPSA01650_00-YOUTUBESIEA00000.pkg',
 'http://sgst.prod.dl.playstation.net/sgst/prod/00/PPSA01650_00/app/info/7/f_cfbc3abdcd214584551586f604b4d8538750889cd41704788e5f24bbc6685327/UP4381-PPSA01650_00-YOUTUBESIEA00000_sc.pkg'
];
const data=[];for(const url of parts){const r=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error('Sony package '+r.status);const b=Buffer.from(await r.arrayBuffer());if(b.length<1024||b.length>256*1024**2)throw Error('Unexpected package length');data.push(b);}
const merged=Buffer.concat(data),sha256=b=>createHash('sha256').update(b).digest('hex');
await fs.mkdir(new URL('./local/packages/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('./local/packages/YouTube-PPSA01650-01.000.003.pkg',import.meta.url),merged);
const record={version:'01.000.003',titleId:'PPSA01650',bytes:merged.length,sha256:sha256(merged),assembly:'Base package followed by matching US SC metadata; TheWizWiki joiner convention',parts:parts.map((url,i)=>({url,bytes:data[i].length,sha256:sha256(data[i]),magic:data[i].subarray(0,4).toString('hex')}))};
await fs.writeFile(new URL('./youtube-003.json',import.meta.url),JSON.stringify(record,null,2));console.log(JSON.stringify(record));
