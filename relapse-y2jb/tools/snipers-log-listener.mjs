// Bounded local diagnostics for a console test. No packets are sent to the PS5.
import dgram from 'node:dgram';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const dir=path.join(root,'build/console-logs');fs.mkdirSync(dir,{recursive:true});
const file=path.join(dir,'y2jb-'+new Date().toISOString().replace(/[:.]/g,'-')+'.log');
const socket=dgram.createSocket('udp4');
const log=line=>{fs.appendFileSync(file,line+'\n');console.log(line);};
socket.on('message',(data,peer)=>{
    if(peer.address==='192.168.137.169') log(new Date().toISOString()+' '+data.toString('utf8').trimEnd());
});
socket.on('error',error=>{console.error(error.message);socket.close();process.exitCode=1;});
socket.bind(5051,'192.168.137.1',()=>log('Listening for PS5 diagnostics at 192.168.137.1:5051; file '+file));
const timeout=setTimeout(()=>socket.close(),30*60*1000);
socket.on('close',()=>clearTimeout(timeout));
