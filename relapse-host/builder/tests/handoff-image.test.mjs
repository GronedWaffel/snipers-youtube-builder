import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createHash} from 'node:crypto';
const base=new URL('../../artifacts/youtube-handoff-startup/',import.meta.url);
test('independent native ELF owns exact payload bytes and expected SHA-256 before YouTube closes',()=>{
 const elf=fs.readFileSync(new URL('youtube-handoff-startup.elf',base)),manifest=JSON.parse(fs.readFileSync(new URL('embedded-manifest.json',base)));
 assert.equal(manifest.map(x=>x.id).join(','),'etahen,etahen-ready,shadowmount,debug');
 for(const item of manifest){const input=fs.readFileSync(new URL('../../../'+item.input.replaceAll('\\','/'),import.meta.url));assert.equal(createHash('sha256').update(input).digest('hex'),item.sha256);assert.equal(input.length,item.bytes);const offset=elf.indexOf(input);assert.ok(offset>=0,item.id+' bytes absent');assert.ok(elf.indexOf(Buffer.from(item.sha256,'hex'))>=0,item.id+' integrity pin absent');}
});
test('full handoff dispatches only the owning ELF and never requests manual Home',async()=>{
 const source=fs.readFileSync(new URL('../handoff-probe-startup.js',import.meta.url),'utf8');const factory=vm.runInNewContext(source+'\ncreateSnipersStartup',{Uint8Array});const calls=[];const data=new Uint8Array(64);data.set([127,69,76,70,2,1]);data[18]=62;
 const controller=factory({read:async()=>data,verify:async()=>true,send:async item=>{calls.push(item.id);return{code:0};},log:()=>{},returnHome:()=>{throw Error('Unexpected manual Home');},dispose:()=>{}},[{id:'handoff-startup',bytes:64}]);
 await controller.run(await controller.prepare('13.60'),{handedOff:true,disarmed:true,crossed:false});assert.deepEqual(calls,['handoff-startup']);
});
