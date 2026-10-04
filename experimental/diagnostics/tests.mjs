import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';import {gunzipSync} from 'node:zlib';
import {collectorParser,FILES} from './protocol.mjs';import {validateReport,createDiagnosticServer} from './server.mjs';
import {sendLocalElf} from './transport.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
function sample(text='schema=1 build=ex-diag-test component=critical event=Toolbox readiness timed out result=-1\n'){
 const data=Buffer.from(text);return {schema:1,firmwareRaw:0x13600000,browserFirmware:'13.60',files:[{name:FILES[3],hex:data.toString('hex'),sha256:sha(data),offset:0,totalBytes:data.length,mtime:1791100000}],skipped:FILES.filter((_,i)=>i!==3).map(name=>({name,errno:2}))};
}
test('collector framing rejects incomplete, corrupt and unknown files',()=>{
 const input=sample(),p=collectorParser();p.line('SNPR_DIAG_META='+JSON.stringify({schema:1,firmwareRaw:input.firmwareRaw}));
 const {hex,sha256,...meta}=input.files[0];p.line('SNPR_DIAG_FILE='+JSON.stringify(meta));p.line('SNPR_DIAG_DATA='+hex);assert.throws(()=>p.finish(),/Incomplete/);p.line('SNPR_DIAG_END='+sha256);
 for(const item of input.skipped)p.line('SNPR_DIAG_SKIP='+JSON.stringify(item));assert.deepEqual(p.finish().files,input.files);
 assert.throws(()=>p.line('SNPR_DIAG_FILE='+JSON.stringify({name:'../../account.db'})),/Invalid/);
 const corrupt=sample();corrupt.files[0].hex='aa';assert.throws(()=>validateReport(corrupt),/checksum/);
});
test('validated report retains failure context and redacts incidental identifiers',()=>{
 const result=validateReport(sample('schema=1 build=ex-diag-test component=bootstrap event=RUN BEGIN\ncomponent=critical event=failed result=-1 IP=192.168.0.5 PSID=secret account_id=42 user id 55\n'));
 assert.equal(result.summary.runStarts,1);assert.equal(result.summary.suspectedFailures.length,1);assert.deepEqual(result.summary.builds,['ex-diag-test']);assert.ok(!result.report.files[0].text.includes('secret'));assert.ok(!result.report.files[0].text.includes('192.168'));
 const duplicate=sample();duplicate.skipped.push(duplicate.skipped[0]);assert.throws(()=>validateReport(duplicate),/missing-file/);
 const unknown=sample();unknown.files[0].name='/etc/passwd';assert.throws(()=>validateReport(unknown),/Unrecognized/);
});
test('private upload stores verified report with receipt, enforces origin, quota and rate limits',async t=>{
 const storage=await fs.mkdtemp(path.join(os.tmpdir(),'snipers-diagnostics-'));
 const server=await createDiagnosticServer({storage,origin:'https://snipers.test',maxReports:2});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));assert.ok(path.basename(storage).startsWith('snipers-diagnostics-'));await fs.rm(storage,{recursive:true});});
 const base='http://127.0.0.1:'+server.address().port,headers={'Content-Type':'application/json','Origin':'https://snipers.test','X-Snipers-Diagnostics':'1'};
 assert.equal((await fetch(base+'/api/reports',{method:'POST',body:'{}'})).status,403);
 const send=()=>fetch(base+'/api/reports',{method:'POST',headers,body:JSON.stringify(sample())});
 const response=await send();assert.equal(response.status,201);const receipt=await response.json();assert.match(receipt.id,/^[a-f0-9]{32}$/);
 const saved=JSON.parse(gunzipSync(await fs.readFile(path.join(storage,receipt.id+'.json.gz'))));assert.equal(saved.summary.suspectedFailures.length,1);assert.equal(saved.id,receipt.id);
 assert.equal((await fetch(base+'/api/reports/'+receipt.id)).status,404);
 assert.equal((await send()).status,201);assert.equal((await send()).status,503);
});
test('full four-megabyte trace is accepted without regex recursion or silent truncation',()=>{
 const input=sample();input.files=FILES.slice(0,4).map(name=>{const data=Buffer.alloc(1024*1024,65);return {name,hex:data.toString('hex'),sha256:sha(data),offset:0,totalBytes:data.length,mtime:1};});input.skipped=FILES.slice(4).map(name=>({name,errno:2}));assert.equal(validateReport(input).summary.bytes,4*1024*1024);
});
test('browser transport preserves a large fragmented report and always closes its socket',async()=>{
 const input=sample('schema=1 build=test event=RUN BEGIN\n'.repeat(1500)),file=input.files[0];
 const {hex,sha256,...meta}=file;
 const lines=['SNPR_DIAG_META='+JSON.stringify({schema:1,firmwareRaw:input.firmwareRaw}),'SNPR_DIAG_FILE='+JSON.stringify(meta)];
 for(let i=0;i<hex.length;i+=4096)lines.push('SNPR_DIAG_DATA='+hex.slice(i,i+4096));
 lines.push('SNPR_DIAG_END='+sha256,...input.skipped.map(x=>'SNPR_DIAG_SKIP='+JSON.stringify(x)),'SNPR_OPTION_MESSAGE=Collected','SNPR_OPTION_RESULT=0');
 const stream=Buffer.from(lines.join('\n')+'\n');let position=0,reads=0,closed=0;
 function pointer(backing,offset=0){return {backing,offset,add32:n=>pointer(backing,offset+n)};}
 const p={malloc:n=>pointer(new Uint8Array(n)),write1:(p,v)=>{p.backing[p.offset]=v;},write8:()=>{}};
 const zero={low:0,hi:0};
 const chain={async syscall(op,...args){
  if(op===97)return {low:9,hi:0};if(op===133)return {low:args[2],hi:0};
  if(op===209){new DataView(args[0].backing.buffer).setInt16(6,1,true);return {low:1,hi:0};}
  if(op===3){const count=Math.min([1,47,8192,511][reads++%4],stream.length-position);args[1].backing.set(stream.subarray(position,position+count));position+=count;return {low:count,hi:0};}
  if(op===6)closed++;return zero;
 }};
 const elf=new Uint8Array(64);elf.set([0x7f,69,76,70]);const parser=collectorParser();
 await sendLocalElf(p,chain,()=>{},elf,{completion:'optional',onLine:line=>parser.line(line)});
 assert.deepEqual(parser.finish().files,input.files);assert.equal(closed,1);
});
