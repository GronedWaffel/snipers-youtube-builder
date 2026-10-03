// MIT. Reuse Relapse's userland setup only. Do not call main()/runKernelExploit.
import {establishPrimitive} from './src/webkit.js';
import {installWindowP} from './src/utils/mem.js';
function script(url){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>reject(Error('Could not load '+url));document.body.appendChild(s);});}
export async function prepare(log){
  window.writeLog=log;window.jb={mark:(name,detail)=>log(name+(detail?': '+detail:''))};
  await script('/online/2ea9344fcd6fbcb7/src/firmware.js');const reason=window.firmware.rejection();if(reason)throw Error(reason);
  await script('/online/2ea9344fcd6fbcb7/src/utils/syscalls.js');await script('/online/2ea9344fcd6fbcb7/src/rop.js');await script('/online/2ea9344fcd6fbcb7/src/main.js');await window.offsetsReady;
  log('Preparing browser connection…');
  const primitive=installWindowP(await establishPrimitive(window.jb.mark));
  if(!primitive||typeof primitive.read8!=='function')throw Error('Browser memory primitive unavailable');
  return window.prepareRop(primitive);
}
