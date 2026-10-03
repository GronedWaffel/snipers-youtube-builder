export function deviceReason(ua){const m=/PlayStation 5\/(\d+\.\d+)/.exec(ua);return !m?'Open this page on your PS5 to load payloads. ELF downloads work on any device.':m[1]!=='13.60'?'Loading requires PS5 13.60. Detected '+m[1]+'.':null;}
export async function verifiedPayload(item,fetcher,hash){
 if(!item?.load||!/^\/(payloads|downloads)\/[A-Za-z0-9_.-]+\.elf$/.test(item.load.url))throw Error('Invalid payload selection.');
 const r=await fetcher(item.load.url,{cache:'no-store'});if(!r.ok)throw Error('Payload download failed ('+r.status+').');
 const b=new Uint8Array(await r.arrayBuffer());if(b.length!==item.load.bytes||hash(b)!==item.load.sha256)throw Error('Payload integrity check failed. Nothing was sent.');return b;
}
export function singleLoad({ua,verify,prepare,send,update}){let started=false;return async item=>{
 const reason=deviceReason(ua);if(reason){update('blocked',reason);return;}if(started)return;started=true;
 try{update('running','Checking '+item.name+'…');const bytes=await verify(item);const {p,chain}=await prepare();await send(p,chain,bytes,item);update('complete','Finished. Follow the console notification and instructions above.');}
 catch(e){update('failed',(e.message||String(e))+' No automatic retry.');}
};}
