import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const stable=path.resolve(import.meta.dirname,'../..');const baseline=JSON.parse(fs.readFileSync(new URL('./local/stable-baseline.json',import.meta.url)));
const changes=baseline.filter(x=>createHash('sha256').update(fs.readFileSync(path.join(stable,x.path))).digest('hex')!==x.sha256);
if(changes.length){console.error(changes.map(x=>x.path).join('\n'));process.exit(1);}
console.log('All '+baseline.length+' stable source hashes remain unchanged.');
