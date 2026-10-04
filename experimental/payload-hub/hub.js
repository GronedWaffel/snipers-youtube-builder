const status=document.getElementById('device-status'),buttons=[...document.querySelectorAll('.load')];
const firmware=/PlayStation 5\/(\d+\.\d+)/.exec(navigator.userAgent)?.[1];let started=false;
function log(message){document.getElementById('load-panel').hidden=false;const line=document.createElement('div');line.textContent=message;document.getElementById('progress').append(line);document.getElementById('load-status').textContent=message;}
try{
 const response=await fetch('/payloads/ex/catalog.json',{cache:'no-store'});if(!response.ok)throw Error('Experimental payload catalog unavailable');const catalog=await response.json();
 const reason=!firmware?'Open this page on your PS5 to load directly. Downloads work on any device.':!catalog.firmwares.includes(firmware)?'Firmware '+firmware+' is not a supported experimental target.':null;
 status.textContent=reason||'PS5 '+firmware+' detected. Existing jailbreak and ELF loader on 9021 required. Load one payload at a time.';
 for(const button of buttons){button.disabled=!!reason;button.onclick=async()=>{
  if(started||reason)return;started=true;buttons.forEach(b=>b.disabled=true);
  try{const item=catalog.records.find(x=>x.id===button.dataset.id);if(!item||!/^\/payloads\/ex\/[a-z0-9-]+\.elf$/.test(item.url))throw Error('Invalid payload entry');
   document.getElementById('load-title').textContent=item.name;log('Downloading and verifying '+item.name+'…');
   const {sha256Hex}=await import('/builder/ex/runtime/src/sha256.js');const r=await fetch(item.url,{cache:'no-store'});if(!r.ok)throw Error('Payload download failed');const bytes=new Uint8Array(await r.arrayBuffer());
   if(bytes.length!==item.bytes||sha256Hex(bytes)!==item.sha256)throw Error('Payload integrity check failed. Nothing sent.');
   const {prepare}=await import('/builder/ex/runtime/runtime.js');const {sendLocalElf}=await import('/builder/ex/autoload.js');const {p,chain}=await prepare(log);
   await sendLocalElf(p,chain,log,bytes,{label:item.name,completion:item.completion});log('Payload sent. Follow its console notifications. Reload this page before selecting another payload.');
  }catch(e){log(e.message+' No automatic retry was attempted.');}
 };}
}catch(e){status.textContent=e.message+'. Direct ELF download links remain available.';}
