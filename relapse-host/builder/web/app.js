const $=id=>document.getElementById(id),mib=n=>(n/1024**2).toFixed(1)+' MiB';
let recommended=[],catalog=[],selected=[],available=false,busy=false,builtSelection=null;const custom=new Map();const onPS5=/PlayStation 5/.test(navigator.userAgent);
const selectionKey=()=>$('firmware').value+':'+selected.map(x=>x.id).join(',');
function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function problem(){if(!selected.length)return 'Choose at least one payload.';if(selected.length>8)return 'Choose no more than 8 payloads.';let seen=new Set(),total=0;for(const item of selected){if(item.id==='etahen'&&seen.size)return 'etaHEN must run first.';if(item.requires?.some(id=>!seen.has(id)))return item.label+' needs etaHEN earlier in the startup order.';seen.add(item.id);total+=item.bytes;}return total>128*1024**2?'Combined payloads exceed 128 MiB.':'';}
function render(){
  if(!busy&&builtSelection!==null&&builtSelection!==selectionKey()){builtSelection=null;$('handoff').hidden=true;$('continue').hidden=true;$('download').hidden=true;$('download').removeAttribute('href');$('install-code').textContent='';$('build-progress').hidden=true;}
  $('firmware').disabled=busy;
  $('catalog').replaceChildren();for(const item of catalog){const label=node('label',undefined,'payload-card');label.append(node('span',{etahen:'η',shadowmount:'◇',debug:'⌘'}[item.id]||'+','payload-icon'));const copy=node('span');copy.append(node('span',item.label,'payload-name'),node('span',item.version+' · '+mib(item.bytes),'payload-version'),node('span',item.description+(item.startupStatus?' '+item.startupStatus+'.':''),'payload-description'));const input=node('input');input.type='checkbox';input.checked=selected.some(x=>x.id===item.id);input.disabled=busy;input.setAttribute('aria-label','Include '+item.label);input.onchange=()=>{selected=input.checked?[...selected,item]:selected.filter(x=>x.id!==item.id);render();};label.append(copy,input);$('catalog').append(label);}
  $('selection').replaceChildren();selected.forEach((item,index)=>{const li=node('li'),copy=node('span',undefined,'item-text');copy.append(node('strong',item.label),node('small',mib(item.bytes)+(custom.has(item.id)?' · Your file':' · Hosted')));const buttons=node('span',undefined,'row-actions');for(const [symbol,title,action,disabled]of [['↑','Move '+item.label+' up',()=>{[selected[index-1],selected[index]]=[selected[index],selected[index-1]];},index===0],['↓','Move '+item.label+' down',()=>{[selected[index+1],selected[index]]=[selected[index],selected[index+1]];},index===selected.length-1],['×','Remove '+item.label,()=>{selected.splice(index,1);custom.delete(item.id);},false]]){const b=node('button',symbol);b.type='button';b.title=title;b.setAttribute('aria-label',title);b.disabled=busy||disabled;b.onclick=()=>{action();render();};buttons.append(b);}li.append(copy,buttons);$('selection').append(li);});
  $('count').textContent=selected.length;$('total').textContent=mib(selected.reduce((sum,x)=>sum+x.bytes,0));$('selection-error').textContent=problem();$('build').disabled=busy||!available||!!problem();$('recommended').disabled=busy;$('choose-files').disabled=busy;$('choose-folder').disabled=busy;
}
async function addFiles(files){if(busy)return;let added=0,skipped=0;const messages=[];for(const file of files){if(!/\.(elf|bin)$/i.test(file.name)){skipped++;continue;}if(selected.length>=8){messages.push('Maximum 8 payloads.');break;}if(file.size<64||file.size>64*1024**2){messages.push(file.name+': must be 64 bytes to 64 MiB.');continue;}const b=new Uint8Array(await file.slice(0,64).arrayBuffer());if(b[0]!==127||b[1]!==69||b[2]!==76||b[3]!==70||b[4]!==2||b[5]!==1||b[18]!==62||b[19]!==0){messages.push(file.name+': expected a 64-bit x86 ELF.');continue;}if([...custom.values()].some(x=>x.name===file.name&&x.size===file.size&&x.lastModified===file.lastModified)){messages.push(file.name+': already selected.');continue;}const id='local-'+crypto.randomUUID();custom.set(id,file);selected.push({id,label:file.name,bytes:file.size});added++;}render();$('file-status').textContent=[added?added+' file'+(added===1?'':'s')+' added.':'',skipped?skipped+' non-payload file'+(skipped===1?'':'s')+' skipped.':'',...messages].filter(Boolean).join(' ');}
$('choose-files').onclick=()=>$('files').click();$('choose-folder').onclick=()=>$('folder').click();for(const id of ['files','folder'])$(id).onchange=async e=>{await addFiles(e.target.files);e.target.value='';};
$('recommended').onclick=()=>{custom.clear();selected=catalog.filter(x=>recommended.includes(x.id));$('file-status').textContent='';render();};
for(const event of ['dragenter','dragover'])$('drop-zone').addEventListener(event,e=>{e.preventDefault();$('drop-zone').classList.add('drag-over');});for(const event of ['dragleave','drop'])$('drop-zone').addEventListener(event,e=>{e.preventDefault();$('drop-zone').classList.remove('drag-over');if(event==='drop')void addFiles(e.dataTransfer.files);});
async function api(url,options={}){const r=await fetch(new URL(url.replace(/^\//,''),new URL('./',location.href)),{...options,cache:'no-store',headers:{'X-Snipers-Builder':'1',...options.headers}});const data=await r.json();if(!r.ok)throw Error(data.error||'Request failed.');return data;}
$('build').onclick=async()=>{
  if(!available||busy||problem())return;busy=true;builtSelection=selectionKey();render();$('build-progress').hidden=false;$('download').hidden=true;$('handoff').hidden=true;$('continue').hidden=true;$('progress').removeAttribute('value');
  try{const job=await api('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({firmware:$('firmware').value})}),headers={Authorization:'Bearer '+job.key};const order=[];
    for(const item of selected){if(!custom.has(item.id)){order.push(item.id);continue;}$('build-status').textContent='Uploading '+item.label+'…';const uploaded=await api('/api/jobs/'+job.id+'/files',{method:'POST',headers:{...headers,'X-Payload-Name':encodeURIComponent(item.label),'Content-Type':'application/octet-stream'},body:custom.get(item.id)});order.push(uploaded.id);}
    let status=await api('/api/jobs/'+job.id+'/build',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({selection:order})});
    while(['queued','building'].includes(status.state)){$('build-status').textContent=status.message;await new Promise(r=>setTimeout(r,2000));status=await api('/api/jobs/'+job.id,{headers});}
    $('build-status').textContent=status.message;if(status.state==='ready'){$('download').href=new URL(status.download.replace(/^\//,''),new URL('./',location.href)).href;$('install-code').textContent=status.installCode;$('handoff').hidden=onPS5;$('continue').href='./install?code='+encodeURIComponent(status.installCode);$('continue').hidden=!onPS5;$('download').download='Snipers-YouTube-Installer.elf';$('download').hidden=onPS5;$('progress').value=100;}
  }catch(e){$('build-status').textContent=e.message;}finally{busy=false;render();}
};
async function loadFirmware(){
  available=false;busy=true;render();
  try{const response=await api('/api/catalog?firmware='+encodeURIComponent($('firmware').value));
   catalog=response.payloads;recommended=response.recommended;custom.clear();selected=catalog.filter(x=>recommended.includes(x.id));available=response.buildAvailable;
   $('youtube-version').textContent='YouTube '+response.youtubeVersion;
   $('connection').textContent='EXPERIMENTAL';
   $('availability').textContent=available?'Community test build available for '+response.firmware+'. Hardware validation is still needed.':'Experimental '+response.firmware+' builds are being prepared. The stable builder remains available.';
  }catch(e){$('availability').textContent=e.message;}finally{busy=false;render();}
}
$('firmware').onchange=()=>void loadFirmware();
try{const data=await api('/api/firmwares');$('firmware').replaceChildren();
 for(const item of data.firmwares){const option=node('option',item.firmware+' — experimental');option.value=item.firmware;$('firmware').append(option);}
 for(const [firmware,reason] of Object.entries(data.excluded)){const option=node('option',firmware+' — missing Relapse offsets');option.disabled=true;option.title=reason;$('firmware').append(option);}
 const detected=/PlayStation 5\/(\d+\.\d+)/.exec(navigator.userAgent)?.[1];
 if(data.firmwares.some(x=>x.firmware===detected))$('firmware').value=detected;
 $('firmware').disabled=false;await loadFirmware();
}catch(e){$('connection').textContent='CONNECTION FAILED';$('availability').textContent=e.message;}
// Clear only this host’s old jailbreak cache. Never create an offline cache.
if('serviceWorker'in navigator){try{const registrations=await navigator.serviceWorker.getRegistrations();for(const registration of registrations){const script=registration.active?.scriptURL||registration.waiting?.scriptURL;if(script===location.origin+'/sw.js')await registration.unregister();}if('caches'in window)for(const name of await caches.keys())if(name.startsWith('snipers-offline-'))await caches.delete(name);}catch{}}

