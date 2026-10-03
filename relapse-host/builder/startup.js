// SPDX-License-Identifier: MIT
// Selectable startup. Raw ELF dispatch never claims that a payload is ready.
function createSnipersStartup(io,manifest){
 let verified=null,attempted=false;
 return {
  async prepare(firmware){
   if(firmware!=='13.60')throw Error('This payload set requires PS5 13.60');
   if(!Array.isArray(manifest)||!manifest.length||manifest.length>9)throw Error('Invalid startup manifest');
   const ids=new Set();
   for(let i=0;i<manifest.length;i++){
    const item=manifest[i];if(ids.has(item.id)||!['etahen','supervisor','dispatch'].includes(item.acknowledgement))throw Error('Invalid or duplicate payload');ids.add(item.id);
    if(item.id==='etahen'&&(i!==0||manifest[i+1]?.id!=='etahen-ready'))throw Error('etaHEN must run first and have a readiness check');
    if(item.id==='etahen-ready'&&(i!==1||manifest[0].id!=='etahen'))throw Error('Unexpected readiness check');
   }
   const files=[];
   for(const item of manifest){io.log('Checking '+item.label+' before Relapse starts...');const data=await io.read(item);
    if(!(data instanceof Uint8Array)||data.length!==item.bytes||data[0]!==127||data[1]!==69||data[2]!==76||data[3]!==70||data[4]!==2||data[5]!==1||data[18]!==62||data[19]!==0||!await io.verify(data,item))throw Error(item.label+': missing, incomplete or incorrect ELF');
    files.push({item,data});
   }
   verified=files;return files;
  },
  async run(files,state){
   if(!verified||files!==verified)throw Error('Payloads were not verified');
   if(!state?.handedOff||!state.disarmed||state.crossed)throw Error('Relapse did not confirm loader handoff and cleanup');
   if(attempted)throw Error('Startup was already attempted; reboot before retrying');attempted=true;
   await io.returnHome();let dispatched=0,confirmed=0;
   for(const entry of files){const {item}=entry;io.log('Starting '+item.label+'...');const response=await io.send(item,entry.data);entry.data=null;
    if(item.acknowledgement==='supervisor'){
     if(!response||![0,1].includes(response.code))throw Error(item.label+': readiness was not confirmed; startup stopped');
     if(!item.internal)confirmed++;
    }else{
     if(!response?.sent)throw Error(item.label+': transfer did not complete');
     if(item.acknowledgement==='dispatch'){dispatched++;io.log(item.label+': sent; this custom payload does not report readiness.');}
    }
   }
   const eta=manifest.some(x=>x.id==='etahen');
   io.log('Startup sequence finished. '+(eta?'etaHEN ready. ':'')+confirmed+' selected services confirmed; '+dispatched+' custom payloads sent.');
   io.notify('Snipers startup finished'+(dispatched?'\nCustom payloads sent; check their own status.':''));
  },
  dispose(){if(verified)for(const x of verified)x.data=null;verified=null;io.dispose();}
 };
}
