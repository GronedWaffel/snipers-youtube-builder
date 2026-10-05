import {OPTIONAL_PAYLOADS} from '../relapse-host/site/src/optional-manifest.js';
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const sourceInput='etahen-13.60/build/etaHEN-multifw-experimental.elf',data=fs.readFileSync(path.join(root,sourceInput));
const meta=JSON.parse(fs.readFileSync(path.join(root,'etahen-13.60/build/manifest.json')));
const sha256=createHash('sha256').update(data).digest('hex');if(sha256!==meta.sha256||data.length!==meta.bytes||meta.channel!=='experimental')throw Error('Experimental etaHEN build mismatch');
const input='etahen-13.60/build/releases/etaHEN-'+sha256+'.elf';fs.mkdirSync(path.dirname(path.join(root,input)),{recursive:true});fs.writeFileSync(path.join(root,input),data);
const hosted=[{id:'etahen',label:'etaHEN Unified',version:'2.5B Unified r1',bytes:data.length,sha256,input,acknowledgement:'etahen',description:'Unified 11.00–13.60 release; see release notes for scoped hardware validation.'}];
for(const item of OPTIONAL_PAYLOADS){
 const input='relapse-host/site/'+item.path,bytes=fs.readFileSync(path.join(root,input));
 if(bytes.length!==item.bytes||createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('Optional payload hash mismatch: '+item.id);
 const {path:publicPath,...metadata}=item;
 hosted.push({...metadata,input,acknowledgement:'supervisor',requires:['etahen'],description:'Unified startup supervisor. Upstream payload compatibility varies by firmware; community testing is pending.'});
}
fs.writeFileSync(new URL('./hosted-payloads.json',import.meta.url),JSON.stringify(hosted,null,2)+'\n');
console.log('Experimental catalog pinned to '+sha256);
