import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
// Run with node --experimental-vm-modules --test ui.test.mjs.
// Exercise the real upload handler without executing a console exploit.
async function page(replies){
 const elements=[];let collections=0,uploads=0;
 const document={createElement(tag){
  const el={tag,style:{},children:[],attributes:{},textContent:'',setAttribute(k,v){this.attributes[k]=v;},append(...items){this.children.push(...items);},focus(){document.activeElement=this;},scrollIntoView(){},remove(){this.removed=true;}};
  elements.push(el);return el;
 },querySelector(){return document.body;}};
 document.body=document.createElement('body');
 const context=vm.createContext({document,navigator:{userAgent:'PlayStation 5/13.60'},location:{pathname:'/builder/ex/',search:''},URLSearchParams,Uint8Array,console,
  async fetch(url){
   if(url.endsWith('collector.json'))return {ok:true,json:async()=>({url:'/diagnostics/collector.elf',bytes:64,sha256:'a'.repeat(64)})};
   if(url.endsWith('/runtime'))return {ok:true,json:async()=>({runtime:'/mock-runtime'})};
   if(url.endsWith('.elf'))return {ok:true,arrayBuffer:async()=>new ArrayBuffer(64)};
   if(url.endsWith('/reports')){uploads++;const reply=replies.shift();return {ok:reply.ok,json:async()=>reply.body};}
   throw Error('Unexpected fetch '+url);
  }});
 const exports={
  './protocol.mjs':{collectorParser:()=>({line(){},finish:()=>({schema:1,files:[],skipped:[]})})},
  '/builder/ex/sha256.js':{sha256Hex:()=> 'a'.repeat(64)},
  '/mock-runtime':{prepare:async()=>({p:{},chain:{}})},
  './transport.js':{sendLocalElf:async()=>{collections++;}},
 };
 async function dependency(name){const values=exports[name];assert.ok(values,name);const module=new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v]of Object.entries(values))this.setExport(k,v);},{context});await module.link(()=>{});await module.evaluate();return module;}
 const source=await readFile(new URL('./ui.js',import.meta.url),'utf8');
 const module=new vm.SourceTextModule(source,{context,importModuleDynamically:dependency});await module.link(dependency);await module.evaluate();
 return {elements,document,button:elements.find(x=>x.tag==='button'),stats:()=>({collections,uploads}),dialog:()=>elements.find(x=>x.attributes.role==='dialog')};
}
const receipt={ok:true,body:{id:'b'.repeat(32),containsNewTrace:true}};
test('confirmed upload presents a focused, dismissible receipt and blocks duplicate clicks',async()=>{
 const p=await page([receipt]);assert.equal(p.dialog(),undefined);await p.button.onclick();
 const dialog=p.dialog();assert.ok(dialog);assert.ok(dialog.children.some(x=>x.textContent.includes('Log uploaded successfully')));
 assert.ok(dialog.children.some(x=>x.textContent.includes(receipt.body.id)));
 const done=dialog.children.find(x=>x.tag==='button');assert.equal(p.document.activeElement,done);await p.button.onclick();assert.deepEqual(p.stats(),{collections:1,uploads:1});
 done.onclick();assert.ok(p.elements.find(x=>x.id==='diagnostic-upload-confirmation').removed);
});
for(const response of [{ok:false,body:{error:'Upload is busy'}},{ok:true,body:{id:'invalid',containsNewTrace:true}}]){
 test('unconfirmed upload keeps the report for retry without claiming success: '+response.ok,async()=>{
  const p=await page([response,receipt]);await p.button.onclick();assert.equal(p.dialog(),undefined);assert.equal(p.button.disabled,false);assert.equal(p.button.textContent,'Retry log upload');
  await p.button.onclick();assert.ok(p.dialog());assert.deepEqual(p.stats(),{collections:1,uploads:2});
 });
}
