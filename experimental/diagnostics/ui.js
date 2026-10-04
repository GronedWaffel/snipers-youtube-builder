// SPDX-License-Identifier: GPL-3.0-or-later
import {collectorParser} from './protocol.mjs';
const section=document.createElement('section');section.className='how';section.id='experimental-report';section.style.display='block';
const title=document.createElement('h2');title.textContent='Help improve experimental etaHEN';
const description=document.createElement('p');description.textContent='After a failed attempt, restore your jailbreak and ELF loader, then upload from this PS5. We collect startup traces and selected etaHEN component/error logs, including previous attempts. These may include game or plugin paths. No saves, account databases, or arbitrary folders are collected. Reports are private and retained for 30 days.';
const button=document.createElement('button');button.className='primary';button.textContent='Upload experimental etaHEN log';
const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
section.append(title,description,button,status);(document.querySelector('main')||document.body).append(section);
const fw=/PlayStation 5\/(\d+\.\d+)/.exec(navigator.userAgent)?.[1];
if(!fw){button.disabled=true;status.textContent='Open this page on your jailbroken PS5 to collect its logs automatically.';}
let busy=false,pendingReport=null;
button.onclick=async()=>{
 if(busy)return;
 if(!location.pathname.startsWith('/builder/ex/')){location.href='/builder/ex/?diagnostics=1';return;}
 section.scrollIntoView({block:'center'});
 busy=true;button.disabled=true;const log=text=>{status.textContent=text;};
 let report=pendingReport;
 try{
  if(!report){
  log('Preparing the read-only log collector…');
  const [metaResponse,runtimeResponse]=await Promise.all([fetch('/diagnostics/collector.json',{cache:'no-store'}),fetch('/builder/ex/api/runtime',{cache:'no-store'})]);
  if(!metaResponse.ok||!runtimeResponse.ok)throw Error('Log collector unavailable. Please try again later.');
  const meta=await metaResponse.json(),runtime=await runtimeResponse.json();
  if(meta.url!=='/diagnostics/collector.elf'||!Number.isInteger(meta.bytes)||meta.bytes<64||meta.bytes>1024*1024||!/^[a-f0-9]{64}$/.test(meta.sha256))throw Error('Invalid collector metadata.');
  const {sha256Hex}=await import('/builder/ex/sha256.js');
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
  pendingReport=null;
  log('Log uploaded. Report ID: '+reply.id+'. '+(reply.containsNewTrace?'Thank you—this includes the detailed experimental startup trace.':'Older component logs were collected. Install the latest experimental etaHEN to record the new detailed trace.'));
 }catch(error){log(error.message+' No console files were changed.');busy=false;button.disabled=false;}
};

if(fw&&new URLSearchParams(location.search).get("diagnostics")==="1")button.click();
