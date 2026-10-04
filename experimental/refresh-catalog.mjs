import {OPTIONAL_PAYLOADS} from '../relapse-host/site/src/optional-manifest.js';
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const input='etahen-13.60/build/etaHEN-multifw-experimental.elf',data=fs.readFileSync(path.join(root,input));
const meta=JSON.parse(fs.readFileSync(path.join(root,'etahen-13.60/build/manifest.json')));
const sha256=createHash('sha256').update(data).digest('hex');if(sha256!==meta.sha256||data.length!==meta.bytes||meta.channel!=='experimental')throw Error('Experimental etaHEN build mismatch');
const hosted=[{id:'etahen',label:'etaHEN experimental',version:'2.5B · multi-firmware candidate',bytes:data.length,sha256,input,acknowledgement:'etahen',description:'Community test build with exact firmware profiles. Hardware behavior is not yet validated on these versions.'}];
for(const item of OPTIONAL_PAYLOADS){
 const input='relapse-host/site/'+item.path,bytes=fs.readFileSync(path.join(root,input));
 if(bytes.length!==item.bytes||createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('Optional payload hash mismatch: '+item.id);
 const {path:publicPath,...metadata}=item;
 hosted.push({...metadata,input,acknowledgement:'supervisor',requires:['etahen'],description:'Experimental startup supervisor. Upstream payload compatibility varies by firmware; community testing is pending.'});
}
fs.writeFileSync(new URL('./hosted-payloads.json',import.meta.url),JSON.stringify(hosted,null,2)+'\n');
console.log('Experimental catalog pinned to '+sha256);
