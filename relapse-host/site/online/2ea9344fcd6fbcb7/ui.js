import {rejection,createStartAction} from './ui-controller.js';
window.hostBooted=true;window.hostHasStarted=false;
const button=document.getElementById('start'),status=document.getElementById('status');
const reason=rejection(navigator.userAgent);
button.disabled=!!reason;button.textContent=reason?'PS5 13.60 required':'Start';
status.textContent=reason||'Online-only · fresh boot required. Select payloads, then Start once.';
document.getElementById('cache-status').textContent='Online-only. This page does not save an offline copy.';
const start=createStartAction({userAgent:navigator.userAgent,run:async()=>{
 const installShortcut=document.getElementById('add-shortcut').checked;
 const optionalPayloads=Array.from(document.querySelectorAll('[data-payload]:checked'),e=>e.dataset.payload);
 document.querySelectorAll('input').forEach(e=>e.disabled=true);
 const {run}=await import('./src/site.js');return run({installShortcut,optionalPayloads});
},update:(state,message)=>{
 window.hostHasStarted=true;button.disabled=true;button.textContent=state==='running'?'Starting…':state==='sent'?'Payload requested':'Stopped — no automatic retry';
 status.textContent=message;if(state==='failed')document.getElementById('progress').open=true;
}});button.addEventListener('click',start);
