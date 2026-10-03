const $=id=>document.getElementById(id);let bundle=null,started=false;
function log(message){const line=document.createElement('p');line.textContent=message;$('log').append(line);$('status').textContent=message;}
$('lookup').onsubmit=async event=>{
 event.preventDefault();if(started)return;bundle=null;$('install').hidden=true;$('install').disabled=true;$('payload-list').replaceChildren();
 const code=$('code').value.trim().toUpperCase();if(!/^[A-F0-9]{10}$/.test(code)){log('Enter all 10 characters of your build code.');return;}
 try{const r=await fetch('./api/install/'+code,{cache:'no-store'}),data=await r.json();if(!r.ok)throw Error(data.error||'Lookup failed.');
  bundle=data;if(incomingCode&&code===incomingCode.toUpperCase())$('lookup').hidden=true;for(const label of data.payloads){const li=document.createElement('li');li.textContent=label;$('payload-list').append(li);}
  $('install').textContent=data.verifyOnly?'Download and verify only':'Install this YouTube bundle';$('install').hidden=false;
  const {deviceReason}=await import('/payloads/loader.js');const reason=deviceReason(navigator.userAgent);
  $('install').disabled=!!reason;log(reason|| (data.verifyOnly?'This test will download and verify the bundle without replacing your startup file.':'Ready. This installs the listed payloads into YouTube startup and keeps a backup.'));
 }catch(e){log(e.message);}
};
$('install').onclick=async()=>{
 if(started||!bundle)return;started=true;$('install').disabled=true;$('lookup').querySelector('button').disabled=true;
 try{
  const response=await fetch('/payloads/catalog.json',{cache:'no-store'});if(!response.ok)throw Error('PS5 loader is unavailable.');const catalog=await response.json();
  const {sha256Hex}=await import(catalog.base+'src/sha256.js');
  // ELF is downloaded over the same HTTPS origin and checked before execution.
  const base=new URL('./',location.href);const url=new URL(bundle.download.replace(/^\//,''),base).pathname;
  if(!/^\/installers\/[a-f0-9]{48}\.elf$/.test(bundle.download)||!Number.isInteger(bundle.bytes)||bundle.bytes<64||bundle.bytes>1024*1024||!/^[a-f0-9]{64}$/.test(bundle.sha256))throw Error('Invalid installer metadata.');
  const download=await fetch(url,{cache:'no-store'});if(!download.ok)throw Error('Installer download failed.');
  const bytes=new Uint8Array(await download.arrayBuffer());
  if(bytes.length!==bundle.bytes||sha256Hex(bytes)!==bundle.sha256)throw Error('Installer integrity check failed. Nothing was sent.');
  const {prepare}=await import(catalog.runtime),{sendLocalElf}=await import('./autoload.js');
  const {p,chain}=await prepare(log);
  await sendLocalElf(p,chain,log,bytes,{label:'YouTube installer',completion:'optional',completionTimeoutMs:1200000});
 }catch(e){log(e.message+' No automatic retry was attempted.');}
};

const incomingCode=new URLSearchParams(location.search).get("code");if(incomingCode&&/^[A-F0-9]{10}$/i.test(incomingCode)){$("code").value=incomingCode;$("lookup").requestSubmit();}
