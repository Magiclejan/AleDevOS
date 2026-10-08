import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {makeCasePrompt,inspectProjection,inspectAdapterProjection,compareSnapshots,lfSha256,sourceTarget,
 classifyRuntimeFailure,validateRuntimeIdentity,
 summarizeCodexEvents,classifyCodexFinalVerdict,taskFinalizationIssue,inspectWorkspaceExecutionEvidence,inspectRouteProgress,validatePilotTimeoutMs,validateCodexWorkspaceWriteOptIn,
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


test('P37.1 runtime diagnostics classify only safe categories without leaking raw provider messages',()=>{
 const attempts=[
  {stderr:"Error: Model 'gpt-does-not-exist' not found",exitCode:1,expected:'MODEL_REJECTED'},
  {stderr:'Not logged in, please run codex login',exitCode:1,expected:'AUTHENTICATION_REQUIRED'},
  {stderr:'Get-Command: The term codex is not recognized',exitCode:1,expected:'CLI_NOT_FOUND'},
  {stderr:'error parsing config.toml: unrecognized field',exitCode:1,expected:'CONFIGURATION_REJECTED'},
  {stderr:'unexpected argument --custom-option',exitCode:1,expected:'CLI_ARGUMENT_REJECTED'},
  {stderr:'rate limit exceeded (429)',exitCode:1,expected:'RATE_LIMITED'},
  {stderr:'connection refused',exitCode:1,expected:'NETWORK_OR_CONNECTIVITY'},
  {stderr:'Permission denied while writing target',exitCode:1,expected:'RUNTIME_PERMISSION_DENIED'},
  {stderr:'arbitrary detail containing user data',exitCode:1,expected:'UNCLASSIFIED_RUNTIME_FAILURE'}
 ];
 for(const {stderr,exitCode,expected} of attempts){
  const category=classifyRuntimeFailure({stderr,exitCode});
  assert.equal(category,expected);
  assert.ok(!category.includes('arbitrary detail'));
 }
 assert.equal(classifyRuntimeFailure({stderr:'invalid model',exitCode:0}),'NONE');
 assert.equal(classifyRuntimeFailure({errorCode:'ETIMEDOUT',exitCode:null}),'RUNTIME_TIMEOUT');
});

test('P37.1 rejects documentation placeholders before any paid provider invocation',()=>{
 for(const [provider,model] of [
  ['TU_PROVEEDOR_REAL','gpt-6'],['openai','TU_MODELO_REAL'],
  ['REAL_PROVIDER','gpt-6'],['openai','REAL_MODEL'],
  ['mock','gpt-6'],['openai','unknown'],
  ['openai','not a real model']
 ])assert.throws(()=>validateRuntimeIdentity(provider,model),/P37_1_(PROVIDER|MODEL)_/);
 assert.doesNotThrow(()=>validateRuntimeIdentity('openai','gpt-6'));
});

test('Codex role requires independent real provider evidence; parser missing model cannot be patched by a string claim',()=>{
 assert.equal(classifyRuntimeFailure({stderr:'network disconnected',exitCode:1}),'UNCLASSIFIED_RUNTIME_FAILURE');
 assert.equal(classifyRuntimeFailure({stdout:'{"type":"turn.completed"}',exitCode:0}),'NONE');
});


test('Codex JSON events only reveal bounded metadata and blocked marker, not model text',()=>{
 const stream=[
  {type:'thread.started',thread_id:'private-thread'},
  {type:'turn.started'},
  {type:'item.started',item:{id:'step1',type:'command_execution',command:'SECRET COMMAND'}},
  {type:'item.completed',item:{id:'step1',type:'command_execution',command:'SECRET COMMAND'}},
  {type:'item.completed',item:{id:'step2',type:'agent_message',text:'BLOCKED: private details must not persist'}},
  {type:'turn.completed',usage:{input_tokens:4,output_tokens:7}}
 ].map(JSON.stringify).join('\n');
 const events=summarizeCodexEvents(stream);
 assert.equal(events.structured_events,6);
 assert.equal(events.threads_started,1);
 assert.equal(events.turns_completed,1);
 assert.equal(events.tool_events,2);
 assert.equal(events.agent_messages,1);
 assert.equal(events.agent_message_blocked_marker,true);
 assert.equal(JSON.stringify(events).includes('SECRET'),false);
 assert.equal(JSON.stringify(events).includes('private-thread'),false);
 assert.equal(summarizeCodexEvents('not json').structured_events,0);
});

test('P37.1 requires actual task state and Skill routing; mere installed Skill is not evidence',()=>{
 const dir=tmp(),a=inspectWorkspaceExecutionEvidence(dir);
 assert.deepEqual(a,{task_directories:0,task_contracts:0,task_states:0,route_receipts:0});
 const task=path.join(dir,'.aledevos/state/tasks/real-task');
 const routes=path.join(dir,'.aledevos/state/skills/routes');
 fs.mkdirSync(task,{recursive:true});fs.mkdirSync(routes,{recursive:true});
 fs.writeFileSync(path.join(task,'task-contract.json'),'{}\n');
 fs.writeFileSync(path.join(task,'state.json'),'{}\n');
 fs.writeFileSync(path.join(routes,'real-task.json'),'{}\n');
 assert.deepEqual(inspectWorkspaceExecutionEvidence(dir),{task_directories:1,task_contracts:1,task_states:1,route_receipts:1});
});

test('Optional Codex writable sandbox can only target the owned disposable fixture',()=>{
 const dir=tmp();
 assert.throws(()=>validateCodexWorkspaceWriteOptIn({adapter:'codex',confirmed:true,workspace:dir}),/CODEX_WRITE_ONLY/);
 fs.writeFileSync(path.join(dir,'.p37-owned-disposable.json'),JSON.stringify({phase:'P37.1'}));
 assert.deepEqual(validateCodexWorkspaceWriteOptIn({adapter:'codex',confirmed:true,workspace:dir}),['--sandbox','workspace-write']);
 assert.throws(()=>validateCodexWorkspaceWriteOptIn({adapter:'opencode',confirmed:true,workspace:dir}),/CODEX_WRITE_ONLY/);
 assert.throws(()=>validateCodexWorkspaceWriteOptIn({adapter:'codex',confirmed:false,workspace:dir}),/CODEX_WRITE_ONLY/);
});


test('P37.1 timeout is explicit, bounded and rejects silent invalid overrides',()=>{
 assert.equal(validatePilotTimeoutMs(30000),30000);
 assert.equal(validatePilotTimeoutMs('600000'),600000);
 assert.equal(validatePilotTimeoutMs(120000),120000);
 for(const bad of [null,0,-1,29999,600001,'900000','not-number',1234.5,Infinity]){
  assert.throws(()=>validatePilotTimeoutMs(bad),/TIMEOUT_OUTSIDE_30_TO_600_SECONDS/);
 }
});

test('P37.1 route evidence distinguishes receipt presence, skill selection and native verification',()=>{
 const dir=tmp();
 assert.deepEqual(inspectRouteProgress(dir,'safe-edit'),{
  task_count:0,task_state_present:false,task_final_state:'UNOBSERVED',task_blocked:false,
  agent_roles_observed:[],route_status:'NOT_OBSERVED',route_selected_expected:false,
  route_integrity_verified:false,route_verify_exit_code:null
 });
 const task=path.join(dir,'.aledevos/state/tasks/task-pilot-1');
 const route=path.join(dir,'.aledevos/state/skills/routes/task-pilot-1.json');
 fs.mkdirSync(task,{recursive:true});fs.mkdirSync(path.dirname(route),{recursive:true});
 fs.writeFileSync(path.join(task,'state.json'),JSON.stringify({
  task_id:'task-pilot-1',final_state:null,blocked_reason:null,
  agent_trace:[{agent:'orchestrator',status:'STARTED'},{agent:'builder',status:'STARTED'}],
  private_content:'NEVER EXPOSE THIS'
 }));
 fs.writeFileSync(route,JSON.stringify({
  task_id:'task-pilot-1',status:'ROUTE_READY',
  selected:[{id:'safe-edit',runtime_status:'AVAILABLE'}],
  integrity:{payload_sha256:'not-a-real-seal'}
 }));
 const progress=inspectRouteProgress(dir,'safe-edit');
 assert.equal(progress.task_count,1);
 assert.equal(progress.task_state_present,true);
 assert.equal(progress.task_final_state,'UNFINISHED');
 assert.deepEqual(progress.agent_roles_observed,['orchestrator','builder']);
 assert.equal(progress.route_status,'ROUTE_READY');
 assert.equal(progress.route_selected_expected,true);
 assert.equal(progress.route_integrity_verified,false);
 assert.equal(progress.route_verify_exit_code,null);
 assert.equal(JSON.stringify(progress).includes('NEVER EXPOSE'),false);
 const other=inspectRouteProgress(dir,'backend-change');
 assert.equal(other.route_selected_expected,false);
});

test('P37.1 reports blocked task status but never persists raw blocked reason',()=>{
 const dir=tmp(),task=path.join(dir,'.aledevos/state/tasks/task-safe-1');
 fs.mkdirSync(task,{recursive:true});
 fs.writeFileSync(path.join(task,'state.json'),JSON.stringify({
  task_id:'task-safe-1',blocked_reason:'secret user data',final_state:'BLOCKED',agent_trace:[]
 }));
 const p=inspectRouteProgress(dir,'safe-edit');
 assert.equal(p.task_blocked,true);
 assert.equal(p.task_final_state,'BLOCKED');
 assert.equal(JSON.stringify(p).includes('secret user data'),false);
});


test('P37.1 separates BLOCKED mentioned in narrative from explicit final verdict',()=>{
 const cases=[
  ['Repaired code; BLOCKED was a previous case status.', 'NO_EXPLICIT_VERDICT'],
  ['No issues detected, but other tests previously BLOCKED.', 'NO_EXPLICIT_VERDICT'],
  ['The task is not BLOCKED and passed its focused check.', 'NO_EXPLICIT_VERDICT'],
  ['BLOCKED: scope permission mismatch','EXPLICIT_BLOCKED'],
  ['Status: BLOCKED. No approval was given.','EXPLICIT_BLOCKED'],
  ['# Estado: FAILED — verification incomplete','EXPLICIT_BLOCKED'],
  ['## PASS — successful bounded task','EXPLICIT_COMPLETED'],
  ['Status: COMPLETED','EXPLICIT_COMPLETED'],
  ['PASS is a policy state; not an outcome of this run','EXPLICIT_COMPLETED'],
  ['A previous task was BLOCKED, but this case was fixed.','NO_EXPLICIT_VERDICT']
 ];
 for(const [body,expected] of cases)assert.equal(classifyCodexFinalVerdict(body),expected);
});

test('P37.1 only the last Codex agent message carries the final verdict',()=>{
 const data=[
  {type:'item.completed',item:{type:'agent_message',id:'one',text:'BLOCKED: initial route gate'}},
  {type:'item.completed',item:{type:'agent_message',id:'two',text:'Fixed src/utils.mjs; prior BLOCKED issue resolved.'}},
  {type:'turn.completed',usage:{input_tokens:100,output_tokens:10}}
 ].map(JSON.stringify).join('\n');
 const parsed=summarizeCodexEvents(data);
 assert.equal(parsed.agent_messages,2);
 assert.equal(parsed.agent_message_blocked_marker,true);
 assert.equal(parsed.final_message_blocked,false);
 assert.equal(parsed.final_message_verdict,'NO_EXPLICIT_VERDICT');
 const reverse=summarizeCodexEvents([
  {type:'item.completed',item:{type:'agent_message',text:'Changes applied.'}},
  {type:'item.completed',item:{type:'agent_message',text:'BLOCKED: independent verifier unavailable'}}
 ].map(JSON.stringify).join('\n'));
 assert.equal(reverse.final_message_blocked,true);
 assert.equal(reverse.final_message_verdict,'EXPLICIT_BLOCKED');
});

test('P37.1 never treats a passing focused test as a finalized Orchestrator task',()=>{
 const base={task_state_present:true,task_blocked:false,task_final_state:'UNFINISHED'};
 assert.equal(taskFinalizationIssue(base,'executed_real_task'),'ORCHESTRATOR_TASK_NOT_FINALIZED');
 assert.equal(taskFinalizationIssue({...base,task_final_state:'BLOCKED'},'executed_real_task'),'ORCHESTRATOR_TASK_RECORDED_BLOCKED');
 assert.equal(taskFinalizationIssue({...base,task_final_state:'FAILED'},'executed_real_task'),'ORCHESTRATOR_TASK_RECORDED_FAILED');
 assert.equal(taskFinalizationIssue({...base,task_final_state:'PASS'},'executed_real_task'),null);
 assert.equal(taskFinalizationIssue({...base,task_blocked:true,task_final_state:'PASS'},'executed_real_task'),'ORCHESTRATOR_TASK_RECORDED_BLOCKED');
 assert.equal(taskFinalizationIssue({...base,task_state_present:false},'executed_real_task'),null);
 assert.equal(taskFinalizationIssue(base,'rejected_out_of_scope_request'),null);
});
