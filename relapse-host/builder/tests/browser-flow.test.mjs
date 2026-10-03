import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const source=await fs.readFile(new URL('../web/app.js',import.meta.url),'utf8');
class Element{
 constructor(){this.children=[];this.attributes={};this.hidden=true;this.classList={add(){},remove(){}};}
 append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}
 setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this.attributes[k];delete this[k];}addEventListener(){}
}
async function browser(userAgent){
 const elements=new Map();const document={getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},createElement(){return new Element();}};
 const calls=[];const payloads=[{id:'etahen',label:'etaHEN',version:'r3',bytes:100},{id:'debug',label:'PS5Debug',version:'1.3.2',bytes:100,requires:['etahen']}];
 const fetch=async(url,options)=>{calls.push([String(url),options]);return{ok:true,json:async()=>String(url).endsWith('/api/catalog')?{payloads,recommended:['etahen','debug'],buildAvailable:true,verifyOnly:false}:options?.method==='POST'&&String(url).endsWith('/api/jobs')?{id:'job',key:'key'}:{state:'ready',message:'Ready',download:'/installers/'+'a'.repeat(48)+'.elf',installCode:'012345ABCD'}};};
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 await new AsyncFunction('document','navigator','location','fetch',source)(document,{userAgent},{href:'https://sniperscheats.lol/builder/',pathname:'/builder/'},fetch);
 await elements.get('build').onclick();return{elements,calls};
}
test('PS5 can build and continue directly without another device or entering a code',async()=>{
 const{elements,calls}=await browser('Mozilla/5.0 (PlayStation; PlayStation 5/13.60)');
 assert.equal(elements.get('continue').hidden,false);assert.equal(elements.get('continue').href,'./install?code=012345ABCD');
 assert.equal(elements.get('handoff').hidden,true);assert.equal(elements.get('download').hidden,true);
 assert.equal(calls.filter(([url])=>url.endsWith('/build')).length,1);
});
test('other devices retain the optional code handoff and ELF download',async()=>{
 const{elements}=await browser('Desktop browser');assert.equal(elements.get('continue').hidden,true);
 assert.equal(elements.get('handoff').hidden,false);assert.equal(elements.get('install-code').textContent,'012345ABCD');assert.equal(elements.get('download').hidden,false);
});
test('changing a completed selection invalidates its code and direct install link',async()=>{
 const{elements}=await browser('PlayStation 5/13.60');
 const checkbox=elements.get('catalog').children[1].children.at(-1);checkbox.checked=false;checkbox.onchange();
 assert.equal(elements.get('continue').hidden,true);assert.equal(elements.get('handoff').hidden,true);assert.equal(elements.get('download').hidden,true);assert.equal(elements.get('install-code').textContent,'');
});
