import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {makeCasePrompt,inspectProjection,inspectAdapterProjection,compareSnapshots,lfSha256,sourceTarget,
 summarizeObservations,main} from '../certification/pro/engine/p37-skills.mjs';

const repo=path.resolve('.');
const folders=[];
const tmp=()=>{const x=fs.mkdtempSync(path.join(os.tmpdir(),'p37-1-controlled-'));folders.push(x);return x;};
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
afterEach(()=>{for(const f of folders.splice(0))fs.rmSync(f,{recursive:true,force:true});});

test('P37.1 inherits all 13 pinned Skills and six separate scenarios; no certificates are issued',async()=>{
 const x=await main(['cases'],repo);
 assert.equal(x.skill_ids.length,13);
 assert.equal(new Set(x.skill_ids).size,13);
 assert.equal(x.required_cases.length,6);
 assert.equal(x.canonical_adapters.length,4);
 assert.equal(x.pro_certified,0);
 for(const id of x.skill_ids)for(const a of x.canonical_adapters){
  const t=sourceTarget(repo,a,id);
  assert.equal(t.kind,'skill');
  assert.equal(t.required_cases.length,6);
  assert.match(t.source_sha256,/^[a-f0-9]{64}$/);
 }
});

test('case prompts are explicit, distinguish positive/negative scenarios and are not self-certification',()=>{
 const ids=['activated_on_correct_request','rejected_out_of_scope_request',
  'executed_real_task','scoped_permissions_enforced','failure_and_recovery','independent_verification'];
 const prompts=ids.map(c=>makeCasePrompt('safe-edit',c));
 assert.equal(new Set(prompts).size,6);
 assert.match(prompts[0],/discovery\/routing/);
 assert.match(prompts[1],/Out-of-scope/);
 assert.match(prompts[2],/src\/utils.mjs/);
 assert.match(prompts[3],/NEGATIVE PERMISSION TEST/);
 assert.match(prompts[4],/node --test/);
 assert.match(prompts[5],/P37.3 signoff/);
 assert.throws(()=>makeCasePrompt('forged-skill',ids[0]),/UNKNOWN_SKILL/);
 assert.throws(()=>makeCasePrompt('safe-edit','anything'),/UNKNOWN_CASE/);
});

test('projected source has to match LF-normalized Skill source; drift fails closed',()=>{
 const root=tmp(),dir=path.join(root,'.agents/skills/safe-edit');fs.mkdirSync(dir,{recursive:true});
 const f=path.join(dir,'SKILL.md');
 fs.writeFileSync(f,'example\r\n');
 const target={adapter:'codex',id:'safe-edit',source_sha256:sha('example\n')};
 assert.equal(lfSha256(f),target.source_sha256);
 assert.equal(inspectProjection(root,target).ok,true);
 fs.writeFileSync(f,'changed\n');
 assert.equal(inspectProjection(root,target).reason,'INSTALLED_SKILL_HASH_DRIFT');
 fs.rmSync(f);
 assert.equal(inspectProjection(root,target).reason,'INSTALLED_SKILL_MISSING');
});

test('snapshot comparison catches control-plane writes, including new and deleted files',()=>{
 const before={files:{'.aledevos/project.json':'a','src/utils.mjs':'a','.agents/skills/safe-edit/SKILL.md':'a'},errors:[]};
 const after={files:{'.aledevos/project.json':'b','src/utils.mjs':'b','other.txt':'x'},errors:[]};
 const diff=compareSnapshots(before,after);
 assert.deepEqual(diff.protected_changes,['.agents/skills/safe-edit/SKILL.md','.aledevos/project.json']);
 assert.deepEqual(diff.changed_paths,['.agents/skills/safe-edit/SKILL.md','.aledevos/project.json','other.txt','src/utils.mjs']);
});

test('adapter native projection drift blocks even when a Skill file matches',()=>{
 const root=tmp(),project=tmp();
 fs.mkdirSync(path.join(root,'adapters/codex/.codex'),{recursive:true});
 fs.mkdirSync(path.join(root,'adapters/codex/.agents/skills'),{recursive:true});
 fs.writeFileSync(path.join(root,'adapters/codex/.codex/config.toml'),'sandbox = true\n');
 fs.mkdirSync(path.join(project,'.codex'),{recursive:true});
 fs.mkdirSync(path.join(project,'.agents/skills'),{recursive:true});
 fs.mkdirSync(path.join(project,'.aledevos'),{recursive:true});
 fs.writeFileSync(path.join(project,'.aledevos/project.json'),'{"adapters":["codex"]}\n');
 fs.writeFileSync(path.join(project,'.codex/config.toml'),'sandbox = true\n');
 assert.equal(inspectAdapterProjection(root,project,'codex').ok,true);
 fs.writeFileSync(path.join(project,'.codex/config.toml'),'sandbox = false\n');
 const result=inspectAdapterProjection(root,project,'codex');
 assert.equal(result.ok,false);
 assert.ok(result.errors.includes('DRIFT:.codex/config.toml'));
});

test('git metadata alterations are protected changes, not excluded from snapshots',()=>{
 const a={files:{},errors:[]};
 const b={files:{'.git/config':'changed'},errors:[]};
 assert.deepEqual(compareSnapshots(a,b).protected_changes,['.git/config']);
});

test('controlled fixture metadata never upgrades observational evidence to real certification',()=>{
 const root=tmp(),folder=path.join(root,'.aledevos/state/certification/p37/skills/codex/safe-edit');
 fs.mkdirSync(folder,{recursive:true});
 fs.writeFileSync(path.join(folder,'one.json'),JSON.stringify({adapter:'codex',skill:'safe-edit',status:'EVIDENCE_REVIEW_REQUIRED',runtime:{exit_code:0},pro_certified:false}));
 fs.writeFileSync(path.join(folder,'two.json'),JSON.stringify({adapter:'codex',skill:'safe-edit',status:'BLOCKED',runtime:{exit_code:127},pro_certified:false}));
 const report=summarizeObservations(root);
 assert.equal(report.observations,2);
 assert.equal(report.successful_cli_exits,1);
 assert.equal(report.targets_with_attempts,1);
 assert.equal(report.blocked_or_failed,1);
 assert.equal(report.pro_certified,0);
 assert.equal(report.status,'OBSERVATIONS_ONLY_NOT_CERTIFIED');
});

test('missing authorization refuses execution or installation before touching a workspace',async()=>{
 await assert.rejects(main(['prepare','--adapter','codex'],repo),/EXPLICIT_PREPARE_CONSENT_REQUIRED/);
 await assert.rejects(main(['run','--adapter','codex','--skill','safe-edit','--case','executed_real_task'],repo),/EXPLICIT_REAL_EXECUTION_CONSENT_REQUIRED/);
 await assert.rejects(main(['run','--adapter','codex','--skill','safe-edit','--case','not-a-case','--execute-real'],repo),/UNKNOWN_CASE/);
});

test('runtime profiles are adapter-owned; fake model/provider, mock-only and missing evidence cannot PASS',async()=>{
 const summary=await main(['summary'],repo);
 assert.equal(summary.pro_certified,0);
 assert.equal(summary.skill_adapter_targets,52);
 assert.equal(summary.skill_case_targets,312);
});
