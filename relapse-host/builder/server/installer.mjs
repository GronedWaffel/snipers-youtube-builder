import {createHash} from 'node:crypto';
const marker=Buffer.from('SNPRYTINSTALL01\0','ascii');
export function configureInstaller(template,{address,port=80,host,path,job,bytes,sha256,verifyOnly=false}){
  const parts=typeof address==='string'?address.split('.'):[];
  if(parts.length!==4||parts.some(p=>!/^\d{1,3}$/.test(p)||Number(p)>255)||Number(parts[0])===0||Number(parts[0])>=224)throw Error('Expected a unicast IPv4 address.');
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid server port.');
  if(typeof host!=='string'||!(/^[A-Za-z0-9.-]{1,127}$/).test(host)||host.includes('..'))throw Error('Invalid HTTP host.');
  if(typeof path!=='string'||!(/^\/[A-Za-z0-9/_.-]{1,254}$/).test(path)||path.includes('..'))throw Error('Invalid bundle download path.');
  if(!/^[a-f0-9]{32}$/.test(job)||bytes!==336789504||!/^[a-f0-9]{64}$/.test(sha256))throw Error('Invalid pinned image metadata.');
  const elf=Buffer.from(template),offset=elf.indexOf(marker);
  if(offset<0||elf.indexOf(marker,offset+1)>=0||offset+485>elf.length)throw Error('Installer configuration marker must appear exactly once.');
  // Require a pristine template, not an already personalized installer.
  if(elf.subarray(offset+16,offset+485).some(n=>n!==0))throw Error('Installer template is already configured.');
  elf.writeUInt32LE(verifyOnly?1:2,offset+16);Buffer.from(parts.map(Number)).copy(elf,offset+20);
  elf.writeUInt16BE(port,offset+24);elf.writeBigUInt64LE(BigInt(bytes),offset+28);
  Buffer.from(sha256,'hex').copy(elf,offset+36);elf.write(job,offset+68,'ascii');
  elf.write(host,offset+101,'ascii');elf.write(path,offset+229,'ascii');
  return {bytes:elf,sha256:createHash('sha256').update(elf).digest('hex')};
}
