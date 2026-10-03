import fs from 'node:fs/promises';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const origin='https://sniperscheats.lol/builder/';
const results=await Promise.allSettled(['app.js','install.js','index.html','sources.zip'].map(async name=>{
 const response=await fetch(origin+(name==='index.html'?'':name),{signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);
 const bytes=Buffer.from(await response.arrayBuffer()),local=await fs.readFile(new URL('../web/'+name,import.meta.url));assert.deepEqual(bytes,local);
 return{name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}));
for(const result of results){if(result.status==='rejected')throw result.reason;console.log(JSON.stringify(result.value));}
const packageUrl='http://sniperscheats.lol/youtube-packages/YouTube-PPSA01650-01.000.030.pkg';
const head=await fetch(packageUrl,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),'101515264');
const part=await fetch(packageUrl,{headers:{Range:'bytes=0-3'}});assert.equal(part.status,206);assert.equal((await part.arrayBuffer()).byteLength,4);
console.log('Pinned package is available with byte-range support.');
