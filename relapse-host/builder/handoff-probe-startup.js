// SPDX-License-Identifier: MIT
// Probe-only image: closes YouTube after confirmed kernel cleanup, no payload chain.
function createSnipersStartup(io,manifest){
 let verified=null,attempted=false;
 return {
  async prepare(firmware){
   if(firmware!=='13.60'||manifest.length!==1||!['handoff-probe','handoff-startup'].includes(manifest[0].id))throw Error('Unexpected handoff image');
   const item=manifest[0],data=await io.read(item);
   if(!(data instanceof Uint8Array)||data.length!==item.bytes||data[0]!==127||data[1]!==69||data[2]!==76||data[3]!==70||data[4]!==2||data[5]!==1||data[18]!==62||data[19]!==0||!await io.verify(data,item))throw Error('Handoff probe integrity failed');
   verified=[{item,data}];return verified;
  },
  async run(files,state){
   if(!verified||files!==verified)throw Error('Probe not verified');
   if(!state?.handedOff||!state.disarmed||state.crossed)throw Error('Kernel handoff/cleanup not confirmed; YouTube will stay open');
   if(attempted)throw Error('Probe already attempted; reboot before retrying');attempted=true;
   io.log('Independent handoff: stay in YouTube; no manual dashboard action.');
   const result=await io.send(files[0].item,files[0].data);
   if(result?.code!==0)throw Error('Independent probe did not accept the handoff');
   files[0].data=null;
   io.log('Handoff accepted. The independent ELF now controls YouTube closing and its startup sequence.');
  },
  dispose(){if(verified)for(const file of verified)file.data=null;verified=null;io.dispose();}
 };
}
