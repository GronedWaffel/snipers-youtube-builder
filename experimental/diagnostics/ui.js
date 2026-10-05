// SPDX-License-Identifier: GPL-3.0-or-later
import {collectorParser} from './protocol.mjs';
const section=document.createElement('section');section.className='how';section.id='experimental-report';section.style.display='block';
const title=document.createElement('h2');title.textContent='Help improve etaHEN';
const description=document.createElement('p');description.textContent='After a failed attempt, restore your jailbreak and ELF loader, then upload from this PS5. We collect startup traces and selected etaHEN component/error logs, including previous attempts. These may include game or plugin paths. No saves, account databases, or arbitrary folders are collected. Reports are private and retained for 30 days.';
const button=document.createElement('button');button.className='primary';button.textContent='Upload etaHEN log';
const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
section.append(title,description,button,status);(document.querySelector('main')||document.body).append(section);
const fw=/PlayStation 5\/(\d+\.\d+)/.exec(navigator.userAgent)?.[1];
if(!fw){button.disabled=true;status.textContent='Open this page on your jailbroken PS5 to collect its logs automatically.';}
let busy=false,pendingReport=null,completed=false;
function showReceipt(reply){
 const message='Your diagnostic logs have been received. Thank you for helping improve etaHEN. You can close this page now.';
 status.textContent='Log uploaded successfully. Report ID: '+reply.id+'. '+message;
 status.style.cssText='padding:20px;border:2px solid #63e6a4;border-radius:12px;background:#123629;color:#fff;font-size:20px;overflow-wrap:anywhere';
 button.textContent='Log uploaded successfully';
 const overlay=document.createElement('div');overlay.id='diagnostic-upload-confirmation';
 overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;padding:24px;overflow:auto';
 const card=document.createElement('div');card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-labelledby','diagnostic-success-title');card.setAttribute('aria-describedby','diagnostic-success-message');
 card.style.cssText='box-sizing:border-box;width:100%;max-width:720px;padding:36px;border:3px solid #63e6a4;border-radius:18px;background:#10281f;color:#fff;font:20px/1.5 system-ui,sans-serif';
 const heading=document.createElement('h2');heading.id='diagnostic-success-title';heading.textContent='Log uploaded successfully';heading.style.cssText='color:#8affbf;font-size:32px;line-height:1.2;margin:0 0 20px';
 const body=document.createElement('p');body.id='diagnostic-success-message';body.textContent=message;
 const receipt=document.createElement('p');receipt.textContent='Report ID: '+reply.id;receipt.style.cssText='font:18px/1.5 monospace;overflow-wrap:anywhere';
 const detail=document.createElement('p');detail.textContent=reply.containsNewTrace?'Detailed experimental startup trace included.':'Older component logs received. Use the latest experimental etaHEN for the detailed startup trace.';
 const done=document.createElement('button');done.type='button';done.textContent='Done';done.style.cssText='padding:14px 32px;font:700 22px system-ui,sans-serif;background:#8affbf;color:#10281f;border:0;border-radius:8px;cursor:pointer';
 const dismiss=()=>{overlay.remove();status.tabIndex=-1;status.focus();status.scrollIntoView({block:'center'});};
 done.onclick=dismiss;overlay.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();dismiss();}else if(event.key==='Tab'){event.preventDefault();done.focus();}};
 card.append(heading,body,receipt,detail,done);overlay.append(card);document.body.append(overlay);done.focus();
}
button.onclick=async()=>{
 if(busy)return;
 if(!location.pathname.startsWith('/builder/')){location.href='/builder/?diagnostics=1';return;}
 section.scrollIntoView({block:'center'});
 busy=true;button.disabled=true;const log=text=>{if(!completed)status.textContent=text;};
 let report=pendingReport;
 try{
  if(!report){
  log('Preparing the read-only log collector…');
  const [metaResponse,runtimeResponse]=await Promise.all([fetch('/diagnostics/collector.json',{cache:'no-store'}),fetch('/builder/api/runtime',{cache:'no-store'})]);
  if(!metaResponse.ok||!runtimeResponse.ok)throw Error('Log collector unavailable. Please try again later.');
  const meta=await metaResponse.json(),runtime=await runtimeResponse.json();
  if(meta.url!=='/diagnostics/collector.elf'||!Number.isInteger(meta.bytes)||meta.bytes<64||meta.bytes>1024*1024||!/^[a-f0-9]{64}$/.test(meta.sha256))throw Error('Invalid collector metadata.');
  const {sha256Hex}=await import('/builder/sha256.js');
  const response=await fetch(meta.url,{cache:'no-store'});if(!response.ok)throw Error('Collector download failed.');const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length!==meta.bytes||sha256Hex(bytes)!==meta.sha256)throw Error('Collector checksum failed. Nothing was sent.');
  // The worker resolves offsets relative to the page. Absolute runtime URLs
  // are retained; /build redirects into /builder/ which serves those aliases.
  const {prepare}=await import(runtime.runtime),{sendLocalElf}=await import('./transport.js');
  const parser=collectorParser(),{p,chain}=await prepare(log);
  await sendLocalElf(p,chain,log,bytes,{label:'etaHEN diagnostic collector',completion:'optional',completionTimeoutMs:180000,onLine:line=>parser.line(line)});
  report=parser.finish();report.browserFirmware=fw;
  for(const file of report.files){const data=new Uint8Array(file.hex.length/2);for(let i=0;i<data.length;i++)data[i]=parseInt(file.hex.slice(i*2,i*2+2),16);if(sha256Hex(data)!==file.sha256)throw Error('Collected log checksum failed.');}
  pendingReport=report;
  }
  log('Uploading diagnostic report securely…');
  const upload=await fetch('/diagnostics/api/reports',{method:'POST',headers:{'Content-Type':'application/json','X-Snipers-Diagnostics':'1'},body:JSON.stringify(report)});
  const reply=await upload.json();if(!upload.ok)throw Error(reply.error||'Upload failed.');
  if(!/^[a-f0-9]{32}$/.test(reply.id)||typeof reply.containsNewTrace!=='boolean')throw Error('The server did not return a valid upload receipt. Please retry.');
  pendingReport=null;
  completed=true;showReceipt(reply);
 }catch(error){log(error.message+' No console files were changed.');status.style.cssText='padding:16px;border:2px solid #ff7777;color:#fff;background:#401c1c;font-size:20px';status.scrollIntoView({block:'center'});busy=false;button.disabled=false;button.textContent=pendingReport?'Retry log upload':'Try log collection again';}
};

if(fw&&new URLSearchParams(location.search).get("diagnostics")==="1")button.click();
