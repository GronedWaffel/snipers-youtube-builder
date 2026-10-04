// SPDX-License-Identifier: GPL-3.0-or-later
export const FILES=[
 'etaHEN/experimental-diagnostics/trace.log.3','etaHEN/experimental-diagnostics/trace.log.2',
 'etaHEN/experimental-diagnostics/trace.log.1','etaHEN/experimental-diagnostics/trace.log',
 'etaHEN/bootstrap-experimental.previous.log','etaHEN/bootstrap-experimental.log',
 'etaHEN/experimental-daemon.previous.log','etaHEN/experimental-daemon.log','etaHEN/experimental-utility.previous.log','etaHEN/experimental-utility.log',
 'etaHEN/experimental-daemon-crash.previous.log','etaHEN/experimental-daemon-crash.log','etaHEN/experimental-utility-crash.previous.log','etaHEN/experimental-utility-crash.log',
 'snipers-youtube-handoff-startup.log'];
export function collectorParser(){
 let current=null,report=null;const seen=new Set();let total=0;
 return {line(line){
  if(!line.startsWith('SNPR_DIAG_'))return;
  const i=line.indexOf('='),key=line.slice(0,i),value=line.slice(i+1);
  if(key==='SNPR_DIAG_META'){if(report)throw Error('Duplicate collector header');report={...JSON.parse(value),files:[],skipped:[]};return;}
  if(!report)throw Error('Missing collector header');
  if(key==='SNPR_DIAG_FILE'||key==='SNPR_DIAG_SKIP'){
   const item=JSON.parse(value);if(current||!FILES.includes(item.name)||seen.has(item.name))throw Error('Invalid diagnostic file');seen.add(item.name);
   if(key==='SNPR_DIAG_SKIP'){report.skipped.push(item);return;}
   current={...item,chunks:[]};return;
  }
  if(key==='SNPR_DIAG_DATA'){
   if(!current||!/^(?:[a-f0-9]{2}){1,2048}$/.test(value))throw Error('Invalid diagnostic chunk');
   total+=value.length/2;if(total>5*1024*1024)throw Error('Diagnostic size limit exceeded');current.chunks.push(value);return;
  }
  if(key==='SNPR_DIAG_END'){
   if(!current||!/^[a-f0-9]{64}$/.test(value))throw Error('Invalid diagnostic checksum');
   const {chunks,...item}=current;report.files.push({...item,hex:chunks.join(''),sha256:value});current=null;return;
  }
  throw Error('Unsupported collector record');
 },finish(){if(!report||current||seen.size!==FILES.length||!report.files.length)throw Error('Incomplete diagnostic collection');return report;}};
}
