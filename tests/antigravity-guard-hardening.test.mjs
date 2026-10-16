import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const guard=path.resolve('adapters/antigravity/hooks/pretool-guard.mjs');
const ws=fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-guard-'));
function decision(command){const r=spawnSync(process.execPath,[guard],{input:JSON.stringify({toolCall:{name:'run_command',args:{CommandLine:command}},workspacePaths:[ws]}),encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout).decision}
const base='node .aledevos/runtime/aledevos.mjs gate run --task x';
test('plain governed runtime command remains allowed',()=>assert.equal(decision(base),'allow'));
test('Windows paths and ordinary quoted arguments remain allowed',()=>{assert.equal(decision('node .aledevos\\runtime\\aledevos.mjs gate run --project-root C:\\Work\\V2 --task x'),'allow');assert.equal(decision('node .aledevos/runtime/aledevos.mjs gate run --task "issue 25"'),'allow')});
test('direct Docker, Git, GitHub and encoded PowerShell remain denied',()=>{for(const cmd of ['docker rm x','docker compose down -v','git push --force','gh repo delete x','pwsh -EncodedCommand QQ=='])assert.equal(decision(cmd),'deny',cmd)});
test('governed prefix cannot chain, redirect, expand or switch encoding',()=>{for(const suffix of ['; docker rm x',' && git push --force',' | pwsh -EncodedCommand QQ==',' > secret.txt','`; docker rm x',' $(docker rm x)',' %COMSPEC%',' ^& docker rm x','\n docker rm x',' á',' --task "x; docker rm y"',' --task "x\\" && git push --force'])assert.equal(decision(base+suffix),'deny',suffix)});
test('non-existent host executor entrypoint is not permitted',()=>assert.equal(decision('node .aledevos/runtime/host-executor-client.mjs request --plan x --action y --session z'),'deny'));
