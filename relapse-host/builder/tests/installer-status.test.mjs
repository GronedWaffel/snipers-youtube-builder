import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../../..');
test('native installer reports status even with no browser output connection',()=>{
 const out=path.join(root,'relapse-host/artifacts/installer-status-test');fs.mkdirSync(out,{recursive:true});
 const zig=process.env.ZIG||path.join(root,'ps-neighbourhood/tools/zig-x86_64-windows-0.14.1/zig.exe'),exe=path.join(out,process.platform==='win32'?'test.exe':'test');
 const build=spawnSync(zig,['cc',path.join(import.meta.dirname,'installer-status.c'),'-o',exe],{encoding:'utf8',env:{...process.env,ZIG_GLOBAL_CACHE_DIR:path.join(out,'cache')}});assert.equal(build.status,0,build.stderr);
 const run=spawnSync(exe,[],{encoding:'utf8'});assert.equal(run.status,0,run.stdout+run.stderr);
});
