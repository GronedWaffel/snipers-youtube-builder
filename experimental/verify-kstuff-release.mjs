import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const profiles=JSON.parse(await fs.readFile(new URL('./firmware-profiles.json',import.meta.url)));
const response=await fetch('https://api.github.com/repos/EchoStretch/kstuff-lite/commits/v1.11',{headers:{'User-Agent':'Snipers-offset-verification'}});
if(!response.ok)throw Error('Tag lookup '+response.status);
const commit=(await response.json()).sha;let cursor=0;const checked=[];
await Promise.all(Array.from({length:4},async()=>{while(cursor<profiles.firmwares.length){const profile=profiles.firmwares[cursor++];
 const url='https://raw.githubusercontent.com/EchoStretch/kstuff-lite/'+commit+'/prosper0gdb/offsets/'+profile.firmware.replace('.','_')+'.h';
 const r=await fetch(url);if(!r.ok)throw Error(profile.firmware+' '+r.status);const source=await r.text();
 const mapping={allproc:'allproc',sysentvec:'sysentvec',sysentvecPs4:'sysentvec_ps4',cryptSingletonArray:'crypt_singleton_array',sysents:'sysents',sysentsPs4:'sysents_ps4'};
 for(const [field,name]of Object.entries(mapping)){const m=source.match(new RegExp('DEF\\('+name+',\\s*(0x[\\da-f]+)\\)','i'));if(!m||parseInt(m[1],16)!==profile.offsets[field])throw Error('Release offset mismatch '+profile.firmware+' '+field);}
 checked.push({firmware:profile.firmware,sha256:createHash('sha256').update(source).digest('hex')});
}}));
await fs.writeFile(new URL('./upstream/kstuff-v1.11-verification.json',import.meta.url),JSON.stringify({commit,checked:checked.sort((a,b)=>parseFloat(a.firmware)-parseFloat(b.firmware))},null,2));
console.log('All '+checked.length+' readiness profiles match the embedded kstuff v1.11 release source at '+commit);
