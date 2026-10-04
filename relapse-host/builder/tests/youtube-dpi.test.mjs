import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../../..');
test('actual native YouTube installer reconciles DPI replies against package completion',()=>{
 const out=path.join(root,'relapse-host/artifacts/dpi-regression');fs.mkdirSync(out,{recursive:true});
 const zig=process.env.ZIG||path.join(root,'ps-neighbourhood/tools/zig-x86_64-windows-0.14.1/zig.exe');
 const exe=path.join(out,process.platform==='win32'?'youtube-dpi.exe':'youtube-dpi');
 const built=spawnSync(zig,['cc','-std=c11','-O1',path.join(import.meta.dirname,'youtube-dpi.c'),'-o',exe],{encoding:'utf8',env:{...process.env,ZIG_GLOBAL_CACHE_DIR:path.join(out,'zig-cache'),ZIG_LOCAL_CACHE_DIR:path.join(out,'zig-local-cache')}});
 assert.equal(built.status,0,built.stderr||built.error?.message);
 const result=spawnSync(exe,[],{encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr);
 assert.equal((result.stdout.match(/PASS /g)||[]).length,11);console.log(result.stdout.trim());
});
