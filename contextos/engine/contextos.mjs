#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildKnowledgeMaps, refreshKnowledgeMaps, verifyKnowledgeMaps, summarizeKnowledge, knowledgeFreshness } from './knowledge.mjs';
import { putResearchCache, getResearchCache, verifyResearchCache, explicitInvalidateResearch } from './research-cache.mjs';
import { startTelemetryRun, appendTelemetryEvent, aggregateTelemetryRun, verifyTelemetryRun, compareTelemetrySummaries, writeTelemetryComparison } from './telemetry.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const cwd=process.cwd();
const args=process.argv.slice(2);
const [group,cmd]=args;
const stateRoot=path.join(cwd,'.aledevos','state','contextos');
const checkpointDir=path.join(stateRoot,'checkpoints');
const resumeDir=path.join(stateRoot,'resume');
const diffDir=path.join(stateRoot,'diffs');
const ledgerDir=path.join(stateRoot,'dedup');
const packetDir=path.join(stateRoot,'packets');
const defaultRunState=path.join(cwd,'.aledevos','state','current.json');

function fail(message,code=1){console.error(message);process.exit(code)}
function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''))}
function writeJson(p,v){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n','utf8')}
function take(flag,fallback=null){const i=args.indexOf(flag);return i>=0&&i+1<args.length?args[i+1]:fallback}
function takes(flag){const out=[];for(let i=0;i<args.length;i++)if(args[i]===flag&&i+1<args.length)out.push(args[i+1]);return out}
function has(flag){return args.includes(flag)}
function asInt(v,name){const n=Number(v);if(!Number.isInteger(n)||n<0)fail(`INVALID_${name.toUpperCase()}: ${v}`,2);return n}
function policyPath(){return take('--policy',path.join(root,'policies','context-policy.json'))}
function loadPolicy(){const p=policyPath();if(!fs.existsSync(p))fail(`POLICY_NOT_FOUND: ${p}`,2);return readJson(p)}
function profile(policy,name){const p=policy.runtime_profiles?.[name];if(!p)fail(`UNKNOWN_PROFILE: ${name}`,3);return p}
function budgetConfig(policy,agent){return policy.agent_budgets?.[agent]||policy.agent_budgets?.default||{target_ratio:0.3,max_target_tokens:14000}}
function budgetDecision(policy,profileName,agent,usedTokens=null){
  const p=profile(policy,profileName);
  const reserve=Math.max(Number(p.max_output_tokens||0),Number(p.native_compaction_buffer_tokens||0));
  const usable=Math.max(1,Number(p.context_window)-reserve);
  const a=budgetConfig(policy,agent);
  const target=Math.max(1,Math.min(Math.floor(usable*Number(a.target_ratio||0.3)),Number(a.max_target_tokens||usable)));
  const ratios=policy.pressure_ratios;
  const thresholds={watch:Math.floor(usable*ratios.watch),checkpoint:Math.floor(usable*ratios.checkpoint),compact:Math.floor(usable*ratios.compact),hard_guard:Math.floor(usable*ratios.hard_guard)};
  const out={version:'0.3.0',profile:profileName,agent,context_window:Number(p.context_window),reserve_tokens:reserve,usable_input_tokens:usable,target_tokens:target,thresholds};
  if(usedTokens===null)return out;
  const used=Number(usedTokens);
  let pressure='NORMAL',action='CONTINUE',large=true;
  if(used>=thresholds.hard_guard){pressure='HARD_GUARD';action='STOP_NEW_READS';large=false}
  else if(used>=thresholds.compact){pressure='COMPACT_REQUIRED';action='COMPACT_OR_NEW_SESSION';large=false}
  else if(used>=thresholds.checkpoint){pressure='CHECKPOINT_REQUIRED';action='EMIT_CHECKPOINT';large=false}
  else if(used>=thresholds.watch){pressure='WATCH';action='REDUCE_CONTEXT'}
  else if(used>target){action='REDUCE_CONTEXT'}
  return {...out,used_tokens:used,remaining_input_tokens:usable-used,pressure_band:pressure,target_exceeded:used>target,large_reads_allowed:large,action};
}
function estimateTokens(value){return Math.max(1,Math.ceil((typeof value==='string'?value:JSON.stringify(value)).length/4))}
function canonicalize(value){
  if(Array.isArray(value))return '['+value.map(canonicalize).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalize(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
function sha256Text(s){return crypto.createHash('sha256').update(s).digest('hex')}
function sha256Object(v){return sha256Text(canonicalize(v))}
function safeId(v,label='id'){const s=String(v||'');if(!/^[A-Za-z0-9._-]{1,160}$/.test(s))fail(`INVALID_${label.toUpperCase()}: ${s}`,2);return s}
function rel(p){return path.relative(cwd,p).replaceAll('\\','/')}
function checkpointPath(id){return path.join(checkpointDir,`${safeId(id,'checkpoint_id')}.json`)}
function resumePath(id){return path.join(resumeDir,`${safeId(id,'resume_id')}.json`)}
function diffPath(id){return path.join(diffDir,`${safeId(id,'diff_id')}.json`)}
function ledgerPath(id){return path.join(ledgerDir,`${safeId(id,'ledger_id')}.json`)}
function packetPath(id){return path.join(packetDir,`${safeId(id,'packet_id')}.json`)}
function git(argsv){return spawnSync('git',argsv,{cwd,encoding:'utf8',windowsHide:true})}
function gitSnapshot(){
  const inside=git(['rev-parse','--is-inside-work-tree']);
  if(inside.status!==0)return {is_git_repo:false,head:null,changed_paths:[],diff_stat:null};
  const head=git(['rev-parse','HEAD']);
  const status=git(['status','--porcelain=v1','-uall']);
  const stat=git(['diff','--stat','HEAD']);
  const paths=[];
  for(const line of (status.stdout||'').split(/\r?\n/)){if(!line.trim())continue;let p=line.slice(3).trim();if(p.includes(' -> '))p=p.split(' -> ').pop();paths.push(p.replace(/^"|"$/g,'').replaceAll('\\','/'))}
  return {is_git_repo:true,head:head.status===0?head.stdout.trim():null,changed_paths:[...new Set(paths)],diff_stat:stat.status===0?stat.stdout.trim():null};
}
function validateHandoff(h,policy){
  const errors=[];
  const req=['version','handoff_id','task_id','from_agent','to_agent','phase','objective','approved_scope','summary','affected_files','decisions','evidence','relevant_tests','risks','open_questions','next_action','context_metrics'];
  for(const k of req)if(h?.[k]===undefined)errors.push(`missing:${k}`);
  if(h?.version!=='0.1.0')errors.push('version:must_equal_0.1.0');
  for(const k of ['handoff_id','task_id','from_agent','to_agent','phase','objective','summary','next_action'])if(h?.[k]!==undefined&&typeof h[k]!=='string')errors.push(`${k}:must_be_string`);
  for(const k of ['approved_scope','affected_files','decisions','evidence','relevant_tests','risks','open_questions'])if(h?.[k]!==undefined&&!Array.isArray(h[k]))errors.push(`${k}:must_be_array`);
  const limits=policy.handoff||{};
  if(typeof h?.summary==='string'&&h.summary.length>Number(limits.max_summary_chars||2200))errors.push('summary:too_long');
  if(Array.isArray(h?.evidence)&&h.evidence.length>Number(limits.max_evidence_items||24))errors.push('evidence:too_many_items');
  if(Array.isArray(h?.decisions)&&h.decisions.length>Number(limits.max_decisions||16))errors.push('decisions:too_many_items');
  if(Array.isArray(h?.open_questions)&&h.open_questions.length>Number(limits.max_open_questions||12))errors.push('open_questions:too_many_items');
  if(h?.context_metrics?.transcript_included!==false)errors.push('context_metrics.transcript_included:must_be_false');
  const estimated=estimateTokens(h);
  if(estimated>Number(limits.max_estimated_tokens||4000))errors.push(`handoff:estimated_tokens_exceed_limit:${estimated}`);
  if(h?.context_metrics && h.context_metrics.handoff_estimated_tokens!==null && h.context_metrics.handoff_estimated_tokens!==undefined){const declared=Number(h.context_metrics.handoff_estimated_tokens);if(!Number.isFinite(declared)||declared<0)errors.push('context_metrics.handoff_estimated_tokens:invalid')}
  return {valid:errors.length===0,estimated_tokens:estimated,max_estimated_tokens:Number(limits.max_estimated_tokens||4000),errors};
}
function checkpointPayload(c){const x=structuredClone(c);delete x.integrity;return x}
function validateCheckpoint(c,policy,{verifyHash=true}={}){
  const errors=[];
  const req=['version','checkpoint_id','task_id','created_at','reason','agent','phase','task','run_state','working_set','summary','decisions','evidence','relevant_tests','risks','open_questions','next','context_metrics','integrity'];
  for(const k of req)if(c?.[k]===undefined)errors.push(`missing:${k}`);
  if(c?.version!=='0.2.0')errors.push('version:must_equal_0.2.0');
  const reasons=policy.checkpoint?.reasons||['BUDGET_CHECKPOINT','PRE_COMPACTION','PRE_NEW_SESSION','MANUAL'];
  if(c?.reason&&!reasons.includes(c.reason))errors.push('reason:invalid');
  if(c?.task_id&&c?.run_state?.task_id&&c.task_id!==c.run_state.task_id)errors.push('run_state.task_id:mismatch');
  if(c?.run_state?.repair_count>c?.run_state?.max_repairs)errors.push('run_state:repair_count_exceeds_max');
  if(c?.context_metrics?.transcript_included!==false)errors.push('context_metrics.transcript_included:must_be_false');
  if(c?.integrity?.algorithm!=='sha256')errors.push('integrity.algorithm:must_equal_sha256');
  const estimated=estimateTokens(c);
  const max=Number(policy.checkpoint?.max_estimated_tokens||8000);
  if(estimated>max)errors.push(`checkpoint:estimated_tokens_exceed_limit:${estimated}`);
  if(verifyHash&&c?.integrity?.payload_sha256){const actual=sha256Object(checkpointPayload(c));if(actual!==c.integrity.payload_sha256)errors.push('integrity.payload_sha256:mismatch')}
  else if(verifyHash)errors.push('integrity.payload_sha256:missing');
  return {valid:errors.length===0,estimated_tokens:estimated,max_estimated_tokens:max,errors,payload_sha256:c?.integrity?.payload_sha256||null};
}
function criticalState(c){return {task:c.task,run_state:c.run_state,working_set:c.working_set,summary:c.summary,decisions:c.decisions,evidence:c.evidence,relevant_tests:c.relevant_tests,risks:c.risks,open_questions:c.open_questions,next:c.next}}
function resumePayload(r){const x=structuredClone(r);delete x.integrity;return x}
function validateResume(r,checkpoint,policy,{verifyHash=true}={}){
  const errors=[];
  const req=['version','resume_id','created_at','source_checkpoint_id','source_checkpoint_sha256','task_id','state','critical_state_sha256','context_metrics','integrity'];
  for(const k of req)if(r?.[k]===undefined)errors.push(`missing:${k}`);
  if(r?.version!=='0.2.0')errors.push('version:must_equal_0.2.0');
  if(r?.integrity?.algorithm!=='sha256')errors.push('integrity.algorithm:must_equal_sha256');
  const expectedState=criticalState(checkpoint),expectedHash=sha256Object(expectedState);
  if(r?.source_checkpoint_id!==checkpoint?.checkpoint_id)errors.push('source_checkpoint_id:mismatch');
  if(r?.source_checkpoint_sha256!==checkpoint?.integrity?.payload_sha256)errors.push('source_checkpoint_sha256:mismatch');
  if(r?.critical_state_sha256!==expectedHash)errors.push('critical_state_sha256:mismatch');
  if(sha256Object(r?.state)!==expectedHash)errors.push('state:not_exact_checkpoint_state');
  if(r?.task_id!==checkpoint?.task_id)errors.push('task_id:mismatch');
  const estimated=estimateTokens(r),max=Number(policy.checkpoint?.resume_max_estimated_tokens||8000);
  if(estimated>max)errors.push(`resume:estimated_tokens_exceed_limit:${estimated}`);
  if(verifyHash&&r?.integrity?.payload_sha256){const actual=sha256Object(resumePayload(r));if(actual!==r.integrity.payload_sha256)errors.push('integrity.payload_sha256:mismatch')}
  else if(verifyHash)errors.push('integrity.payload_sha256:missing');
  return {valid:errors.length===0,estimated_tokens:estimated,max_estimated_tokens:max,errors,critical_state_sha256:expectedHash};
}
function captureCheckpoint(policy){
  if(!fs.existsSync(defaultRunState))fail(`RUN_STATE_NOT_FOUND: ${defaultRunState}`,31);
  const runState=readJson(defaultRunState),agent=take('--agent');if(!agent)fail('Missing --agent',2);
  const phase=take('--phase');if(!phase)fail('Missing --phase',2);
  const reason=take('--reason','MANUAL'),nextAgent=take('--next-agent');if(!nextAgent)fail('Missing --next-agent',2);
  const nextAction=take('--next-action');if(!nextAction)fail('Missing --next-action',2);
  const profileName=take('--profile','opencode-qwen64k'),usedRaw=take('--used'),used=usedRaw===null?null:asInt(usedRaw,'used');
  const checkpointId=safeId(take('--id',`${runState.task_id}-${Date.now()}`),'checkpoint_id'),pressure=used===null?null:budgetDecision(policy,profileName,agent,used);
  const cp={version:'0.2.0',checkpoint_id:checkpointId,task_id:runState.task_id,created_at:new Date().toISOString(),reason,agent,phase,task:{objective:take('--objective',''),constraints:takes('--constraint')},run_state:runState,working_set:gitSnapshot(),summary:take('--summary',''),decisions:takes('--decision'),evidence:takes('--evidence'),relevant_tests:takes('--test'),risks:takes('--risk'),open_questions:takes('--question'),next:{agent:nextAgent,action:nextAction,required_reads:takes('--required-read'),forbidden_actions:takes('--forbidden-action')},context_metrics:{runtime_profile:profileName,used_tokens:used,pressure_band:pressure?.pressure_band||null,transcript_included:false},integrity:{algorithm:'sha256',payload_sha256:''}};
  cp.integrity.payload_sha256=sha256Object(checkpointPayload(cp));const result=validateCheckpoint(cp,policy);
  if(!result.valid){console.log(JSON.stringify(result,null,2));process.exit(32)}
  const p=checkpointPath(checkpointId);if(fs.existsSync(p))fail(`CHECKPOINT_EXISTS: ${checkpointId}`,33);writeJson(p,cp);
  console.log(JSON.stringify({status:'CHECKPOINT_CAPTURED',checkpoint_id:checkpointId,path:rel(p),payload_sha256:cp.integrity.payload_sha256,estimated_tokens:result.estimated_tokens},null,2));
}
function loadCheckpointById(id,policy){const p=checkpointPath(id);if(!fs.existsSync(p))fail(`CHECKPOINT_NOT_FOUND: ${id}`,34);const cp=readJson(p),v=validateCheckpoint(cp,policy);if(!v.valid){console.log(JSON.stringify(v,null,2));process.exit(35)}return {p,cp,v}}
function loadResumeById(id,checkpoint,policy){const p=resumePath(id);if(!fs.existsSync(p))fail(`RESUME_NOT_FOUND: ${id}`,36);const r=readJson(p),v=validateResume(r,checkpoint,policy);if(!v.valid){console.log(JSON.stringify(v,null,2));process.exit(37)}return {p,r,v}}
function createResume(policy){
  const checkpointId=take('--checkpoint-id');if(!checkpointId)fail('Missing --checkpoint-id',2);const {cp}=loadCheckpointById(checkpointId,policy);
  const resumeId=safeId(take('--id',`${checkpointId}-resume`),'resume_id'),state=criticalState(cp),stateHash=sha256Object(state);
  const r={version:'0.2.0',resume_id:resumeId,created_at:new Date().toISOString(),source_checkpoint_id:cp.checkpoint_id,source_checkpoint_sha256:cp.integrity.payload_sha256,task_id:cp.task_id,state,critical_state_sha256:stateHash,context_metrics:{source_profile:cp.context_metrics.runtime_profile,source_used_tokens:cp.context_metrics.used_tokens,source_pressure_band:cp.context_metrics.pressure_band,transcript_included:false},integrity:{algorithm:'sha256',payload_sha256:''}};
  r.integrity.payload_sha256=sha256Object(resumePayload(r));const v=validateResume(r,cp,policy);if(!v.valid){console.log(JSON.stringify(v,null,2));process.exit(38)}
  const p=resumePath(resumeId);if(fs.existsSync(p))fail(`RESUME_EXISTS: ${resumeId}`,39);writeJson(p,r);
  console.log(JSON.stringify({status:'RESUME_CREATED',resume_id:resumeId,path:rel(p),source_checkpoint_id:checkpointId,critical_state_sha256:stateHash,estimated_tokens:v.estimated_tokens},null,2));
}
function transitionPlan(policy){
  const agent=take('--agent','orchestrator'),profileName=take('--profile','opencode-qwen64k'),used=asInt(take('--used'),'used');
  const strategy=take('--strategy','native');if(!['native','new-session'].includes(strategy))fail('Invalid --strategy',2);
  const d=budgetDecision(policy,profileName,agent,used),out={version:'0.3.0',profile:profileName,agent,used_tokens:used,pressure_band:d.pressure_band,checkpoint_required:false,resume_required:false,ready:true,action:d.action};
  if(d.pressure_band==='NORMAL'||d.pressure_band==='WATCH')return out;
  out.checkpoint_required=true;out.resume_required=true;
  const checkpointId=take('--checkpoint-id');if(!checkpointId){out.ready=false;out.action='CAPTURE_CHECKPOINT';return out}
  let cp;try{cp=loadCheckpointById(checkpointId,policy).cp}catch{out.ready=false;out.action='CAPTURE_VALID_CHECKPOINT';return out}
  const resumeId=take('--resume-id');if(!resumeId){out.ready=false;out.action='CREATE_RESUME_PACKET';out.checkpoint_id=checkpointId;return out}
  try{loadResumeById(resumeId,cp,policy)}catch{out.ready=false;out.action='CREATE_VALID_RESUME_PACKET';return out}
  out.checkpoint_id=checkpointId;out.resume_id=resumeId;
  if(d.pressure_band==='CHECKPOINT_REQUIRED'){out.action='CHECKPOINT_READY';return out}
  if(d.pressure_band==='HARD_GUARD'){out.action='NEW_SESSION_AND_RESUME';return out}
  out.action=strategy==='native'?'COMPACT_AND_RESUME':'NEW_SESSION_AND_RESUME';return out;
}
function clipText(text,maxChars){if(text.length<=maxChars)return {text,truncated:false,original_chars:text.length};let end=maxChars;const nl=text.lastIndexOf('\n',maxChars);if(nl>Math.floor(maxChars*0.7))end=nl+1;return {text:text.slice(0,end),truncated:true,original_chars:text.length}}
function diffPayload(d){const x=structuredClone(d);delete x.integrity;return x}
function validateDiffSnapshot(d,policy,{verifyHash=true}={}){
  const errors=[];for(const k of ['version','diff_id','created_at','base','base_sha','status','changed_paths','tracked_patch','untracked_files','index_state','integrity'])if(d?.[k]===undefined)errors.push(`missing:${k}`);
  if(d?.version!=='0.3.0')errors.push('version:must_equal_0.3.0');
  if(d?.index_state?.mutated!==false)errors.push('index_state:must_not_mutate');
  const max=Number(policy.diff_first?.max_snapshot_estimated_tokens||14000),estimated=estimateTokens(d);
  if(estimated>max)errors.push(`diff_snapshot:estimated_tokens_exceed_limit:${estimated}`);
  if(verifyHash&&d?.integrity?.payload_sha256){if(sha256Object(diffPayload(d))!==d.integrity.payload_sha256)errors.push('integrity.payload_sha256:mismatch')}else if(verifyHash)errors.push('integrity.payload_sha256:missing');
  return {valid:errors.length===0,estimated_tokens:estimated,max_estimated_tokens:max,errors};
}
function captureDiff(policy){
  const inside=git(['rev-parse','--is-inside-work-tree']);if(inside.status!==0)fail('DIFF_REQUIRES_GIT_REPOSITORY',40);
  const base=take('--base',policy.diff_first?.default_base||'HEAD'),baseSha=git(['rev-parse',base]);if(baseSha.status!==0)fail(`INVALID_GIT_BASE: ${base}`,40);
  const id=safeId(take('--id',`diff-${Date.now()}`),'diff_id'),before=git(['diff','--cached','--binary']).stdout||'';
  const status=git(['status','--porcelain=v1','-uall']);if(status.status!==0)fail('GIT_STATUS_FAILED',40);
  const tracked=git(['diff','--no-ext-diff','--unified=3',base,'--','.']);if(tracked.status!==0)fail('GIT_DIFF_FAILED',40);
  const maxPatchChars=Number(policy.diff_first?.max_tracked_patch_chars||40000),patch=clipText(tracked.stdout||'',maxPatchChars);
  const changed=[],untracked=[];
  for(const line of (status.stdout||'').split(/\r?\n/)){
    if(!line.trim())continue;const code=line.slice(0,2);let p=line.slice(3).trim();if(p.includes(' -> '))p=p.split(' -> ').pop();p=p.replace(/^"|"$/g,'').replaceAll('\\','/');changed.push(p);
    if(code==='??'){
      const abs=path.resolve(cwd,p);if(!abs.startsWith(path.resolve(cwd)+path.sep)&&abs!==path.resolve(cwd))continue;
      if(!fs.existsSync(abs)||!fs.statSync(abs).isFile())continue;const b=fs.readFileSync(abs),binary=b.includes(0),maxChars=Number(policy.diff_first?.max_untracked_preview_chars||6000);
      const s=binary?'':b.toString('utf8'),preview=clipText(s,maxChars);
      untracked.push({path:p,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex'),binary,preview:binary?null:preview.text,preview_truncated:binary?false:preview.truncated});
    }
  }
  const after=git(['diff','--cached','--binary']).stdout||'';
  const d={version:'0.3.0',diff_id:id,created_at:new Date().toISOString(),base,base_sha:baseSha.stdout.trim(),status:(status.stdout||'').trimEnd(),changed_paths:[...new Set(changed)],tracked_patch:{text:patch.text,truncated:patch.truncated,original_chars:patch.original_chars,estimated_tokens:estimateTokens(patch.text)},untracked_files:untracked,index_state:{sha256_before:sha256Text(before),sha256_after:sha256Text(after),mutated:before!==after},integrity:{algorithm:'sha256',payload_sha256:''}};
  d.integrity.payload_sha256=sha256Object(diffPayload(d));const v=validateDiffSnapshot(d,policy);if(!v.valid){console.log(JSON.stringify(v,null,2));process.exit(41)}
  const p=diffPath(id);if(fs.existsSync(p))fail(`DIFF_SNAPSHOT_EXISTS: ${id}`,42);writeJson(p,d);
  console.log(JSON.stringify({status:'DIFF_CAPTURED',diff_id:id,path:rel(p),changed_paths:d.changed_paths,tracked_patch_tokens:d.tracked_patch.estimated_tokens,tracked_patch_truncated:d.tracked_patch.truncated,untracked_files:d.untracked_files.map(x=>({path:x.path,bytes:x.bytes,sha256:x.sha256,preview_truncated:x.preview_truncated})),index_mutated:false,payload_sha256:d.integrity.payload_sha256,estimated_tokens:v.estimated_tokens},null,2));
}
function loadDiffById(id,policy){const p=diffPath(id);if(!fs.existsSync(p))fail(`DIFF_SNAPSHOT_NOT_FOUND: ${id}`,43);const d=readJson(p),v=validateDiffSnapshot(d,policy);if(!v.valid){console.log(JSON.stringify(v,null,2));process.exit(44)}return {p,d,v}}
function emptyLedger(id){return {version:'0.3.0',ledger_id:id,updated_at:null,hashes:{},ids:{}}}
function loadLedger(id){const p=ledgerPath(id);return fs.existsSync(p)?readJson(p):emptyLedger(id)}
function validateContextInput(input,policy,targetAgent){
  const errors=[];if(input?.version!=='0.3.0')errors.push('version:must_equal_0.3.0');if(!input?.task_id)errors.push('missing:task_id');if(!Array.isArray(input?.items))errors.push('missing:items');
  const ids=new Set(),allowed=policy.dedup?.allowed_kinds||[];let hasDiff=false;
  for(const [i,item] of (input?.items||[]).entries()){
    if(!item?.id||typeof item.id!=='string')errors.push(`items[${i}].id:required`);else if(ids.has(item.id))errors.push(`items[${i}].id:duplicate_id:${item.id}`);else ids.add(item.id);
    if(!item?.kind||typeof item.kind!=='string')errors.push(`items[${i}].kind:required`);else if(allowed.length&&!allowed.includes(item.kind))errors.push(`items[${i}].kind:not_allowed:${item.kind}`);
    if(item?.kind==='transcript')errors.push(`items[${i}].kind:transcript_forbidden`);
    if(item?.content===undefined)errors.push(`items[${i}].content:required`);
    if(item?.kind==='full_file'&&!String(item?.fallback_reason||'').trim())errors.push(`items[${i}].full_file:fallback_reason_required`);
    if(String(item?.kind||'').startsWith('diff_'))hasDiff=true;
  }
  if((policy.diff_first?.review_agents||[]).includes(targetAgent)&&(input?.items||[]).some(x=>x.kind==='full_file')&&!hasDiff)errors.push('full_file:diff_first_evidence_missing');
  return errors;
}
function kindRank(policy,kind){const order=policy.diff_first?.priority_order||[];const i=order.indexOf(kind);return i<0?order.length+100:i}
function planContext(policy){
  const file=take('--file');if(!file)fail('Missing --file',2);const p=path.resolve(cwd,file);if(!fs.existsSync(p))fail(`CONTEXT_INPUT_NOT_FOUND: ${p}`,2);
  const input=readJson(p),targetAgent=take('--agent',input.target_agent||'default'),profileName=take('--profile','opencode-qwen64k'),errors=validateContextInput(input,policy,targetAgent);
  if(errors.length){console.log(JSON.stringify({valid:false,errors},null,2));process.exit(45)}
  const ledgerId=safeId(take('--ledger-id',input.task_id),'ledger_id'),ledger=loadLedger(ledgerId),budget=budgetDecision(policy,profileName,targetAgent),maxCfg=Number(policy.dedup?.max_packet_estimated_tokens||12000),ratio=Number(policy.dedup?.max_packet_ratio_of_agent_target||0.8),packetBudget=Math.max(1,Math.min(maxCfg,Math.floor(budget.target_tokens*ratio)));
  const priorHashes=ledger.hashes||{},priorIds=ledger.ids||{},seen=new Map(),rows=[];
  for(const [index,item] of input.items.entries()){
    const hash=sha256Object(item.content),tokens=estimateTokens(item.content),changed=priorIds[item.id]&&priorIds[item.id]!==hash,prev=priorHashes[hash];
    let decision='CANDIDATE',reason='NEW_CONTENT',reference_to=null;
    if(seen.has(hash)){decision='REFERENCE_ONLY';reason='DUPLICATE_IN_PACKET';reference_to=seen.get(hash)}
    else if(changed){decision='CANDIDATE';reason='CHANGED_CONTENT'}
    else if(prev){decision='REFERENCE_ONLY';reason='ALREADY_SEEN';reference_to=prev.item_id}
    seen.set(hash,item.id);
    rows.push({index,id:item.id,kind:item.kind,source:item.source||null,required:item.required===true,fallback_reason:item.fallback_reason||null,sha256:hash,estimated_tokens:tokens,changed_since_ledger:Boolean(changed),decision,reason,reference_to,content:item.content});
  }
  rows.sort((a,b)=>kindRank(policy,a.kind)-kindRank(policy,b.kind)||(b.required?1:0)-(a.required?1:0)||a.index-b.index);
  let used=0,saved=0;const maxInline=Number(policy.dedup?.max_inline_item_estimated_tokens||6000),outItems=[];
  for(const row of rows){
    if(row.decision==='REFERENCE_ONLY'){saved+=row.estimated_tokens;const {content,...rest}=row;outItems.push(rest);continue}
    if(row.estimated_tokens>maxInline){if(row.required){errors.push(`required_item_too_large:${row.id}:${row.estimated_tokens}`);continue}saved+=row.estimated_tokens;const {content,...rest}=row;outItems.push({...rest,decision:'OMIT_BUDGET',reason:'ITEM_TOO_LARGE'});continue}
    if(used+row.estimated_tokens>packetBudget){if(row.required){errors.push(`required_context_exceeds_packet_budget:${row.id}`);continue}saved+=row.estimated_tokens;const {content,...rest}=row;outItems.push({...rest,decision:'OMIT_BUDGET',reason:'PACKET_BUDGET'});continue}
    used+=row.estimated_tokens;outItems.push({...row,decision:'INLINE',reason:row.changed_since_ledger?'CHANGED_CONTENT':'NEW_CONTENT'});
  }
  if(errors.length){console.log(JSON.stringify({valid:false,packet_budget_tokens:packetBudget,estimated_inline_tokens:used,errors},null,2));process.exit(46)}
  const packetId=safeId(take('--id',`packet-${Date.now()}`),'packet_id'),packet={version:'0.3.0',packet_id:packetId,task_id:input.task_id,target_agent:targetAgent,runtime_profile:profileName,ledger_id:ledgerId,created_at:new Date().toISOString(),policy:{diff_first:true,transcript_allowed:false,packet_budget_tokens:packetBudget},estimated_inline_tokens:used,dedup_saved_tokens:saved,items:outItems.map(x=>x.decision==='INLINE'?x:((({content,...rest})=>rest)(x)))};
  if(has('--commit-ledger')){
    for(const x of outItems.filter(x=>x.decision==='INLINE')){ledger.hashes[x.sha256]={item_id:x.id,kind:x.kind,first_seen_at:ledger.hashes[x.sha256]?.first_seen_at||packet.created_at,last_seen_at:packet.created_at};ledger.ids[x.id]=x.sha256}
    ledger.updated_at=packet.created_at;writeJson(ledgerPath(ledgerId),ledger);
  }
  const outId=take('--out');if(outId)writeJson(packetPath(outId),packet);
  console.log(JSON.stringify({valid:true,...packet,items:packet.items.map(x=>x.decision==='INLINE'?{...x,content:undefined}:x),ledger_committed:has('--commit-ledger'),packet_path:outId?rel(packetPath(outId)):null},null,2));
}

if(group==='budget'&&cmd==='resolve'){const policy=loadPolicy(),agent=take('--agent','default'),profileName=take('--profile','opencode-qwen64k');console.log(JSON.stringify(budgetDecision(policy,profileName,agent),null,2));process.exit(0)}
if(group==='budget'&&cmd==='check'){const policy=loadPolicy(),agent=take('--agent','default'),profileName=take('--profile','opencode-qwen64k'),used=asInt(take('--used'),'used'),d=budgetDecision(policy,profileName,agent,used);console.log(JSON.stringify(d,null,2));process.exit(d.pressure_band==='HARD_GUARD'?20:d.pressure_band==='COMPACT_REQUIRED'?19:d.pressure_band==='CHECKPOINT_REQUIRED'?18:0)}
if(group==='handoff'&&cmd==='validate'){const file=take('--file');if(!file)fail('Missing --file',2);const p=path.resolve(cwd,file);if(!fs.existsSync(p))fail(`HANDOFF_NOT_FOUND: ${p}`,2);const h=readJson(p),result=validateHandoff(h,loadPolicy());console.log(JSON.stringify(result,null,2));process.exit(result.valid?0:21)}
if(group==='handoff'&&cmd==='stats'){const file=take('--file');if(!file)fail('Missing --file',2);const p=path.resolve(cwd,file);if(!fs.existsSync(p))fail(`HANDOFF_NOT_FOUND: ${p}`,2);const h=readJson(p);console.log(JSON.stringify({estimated_tokens:estimateTokens(h),bytes:fs.statSync(p).size},null,2));process.exit(0)}
if(group==='checkpoint'&&cmd==='capture'){captureCheckpoint(loadPolicy());process.exit(0)}
if(group==='checkpoint'&&cmd==='verify'){const policy=loadPolicy(),id=take('--id');if(!id)fail('Missing --id',2);const {p,v}=loadCheckpointById(id,policy);console.log(JSON.stringify({status:'CHECKPOINT_VALID',checkpoint_id:id,path:rel(p),...v},null,2));process.exit(0)}
if(group==='resume'&&cmd==='create'){createResume(loadPolicy());process.exit(0)}
if(group==='resume'&&cmd==='validate'){const policy=loadPolicy(),id=take('--id'),checkpointId=take('--checkpoint-id');if(!id||!checkpointId)fail('Missing --id/--checkpoint-id',2);const {cp}=loadCheckpointById(checkpointId,policy);const {p,v}=loadResumeById(id,cp,policy);console.log(JSON.stringify({status:'RESUME_VALID',resume_id:id,path:rel(p),...v},null,2));process.exit(0)}
if(group==='transition'&&cmd==='plan'){const out=transitionPlan(loadPolicy());console.log(JSON.stringify(out,null,2));process.exit(out.ready?0:out.action.includes('CHECKPOINT')?22:23)}
if(group==='diff'&&cmd==='capture'){captureDiff(loadPolicy());process.exit(0)}
if(group==='diff'&&cmd==='verify'){const policy=loadPolicy(),id=take('--id');if(!id)fail('Missing --id',2);const {p,v}=loadDiffById(id,policy);console.log(JSON.stringify({status:'DIFF_VALID',diff_id:id,path:rel(p),...v},null,2));process.exit(0)}
if(group==='context'&&cmd==='plan'){planContext(loadPolicy());process.exit(0)}
if(group==='context'&&cmd==='ledger-show'){const id=take('--ledger-id');if(!id)fail('Missing --ledger-id',2);console.log(JSON.stringify(loadLedger(id),null,2));process.exit(0)}
if(group==='knowledge'&&cmd==='build'){try{console.log(JSON.stringify(buildKnowledgeMaps({cwd,policy:loadPolicy()}),null,2));process.exit(0)}catch(e){console.log(JSON.stringify({status:'KNOWLEDGE_BUILD_FAILED',error:String(e?.message||e)},null,2));process.exit(47)}}
if(group==='knowledge'&&cmd==='refresh'){try{console.log(JSON.stringify(refreshKnowledgeMaps({cwd,policy:loadPolicy()}),null,2));process.exit(0)}catch(e){console.log(JSON.stringify({status:'KNOWLEDGE_REFRESH_FAILED',error:String(e?.message||e)},null,2));process.exit(50)}}
if(group==='knowledge'&&cmd==='freshness'){try{const out=knowledgeFreshness({cwd,policy:loadPolicy()});console.log(JSON.stringify(out,null,2));process.exit(out.fresh?0:51)}catch(e){console.log(JSON.stringify({status:'KNOWLEDGE_FRESHNESS_FAILED',error:String(e?.message||e)},null,2));process.exit(51)}}
if(group==='knowledge'&&cmd==='verify'){const out=verifyKnowledgeMaps({cwd,policy:loadPolicy()});console.log(JSON.stringify(out,null,2));process.exit(out.valid?0:48)}
if(group==='knowledge'&&cmd==='summary'){try{console.log(JSON.stringify(summarizeKnowledge({cwd,policy:loadPolicy()}),null,2));process.exit(0)}catch(e){console.log(JSON.stringify({status:'KNOWLEDGE_SUMMARY_FAILED',error:String(e?.message||e)},null,2));process.exit(49)}}
if(group==='research'&&cmd==='put'){const file=take('--file');if(!file)fail('Missing --file',2);try{console.log(JSON.stringify(putResearchCache({cwd,policy:loadPolicy(),input:readJson(path.resolve(cwd,file))}),null,2));process.exit(0)}catch(e){console.log(JSON.stringify({status:'RESEARCH_CACHE_PUT_FAILED',error:String(e?.message||e)},null,2));process.exit(52)}}
if(group==='research'&&cmd==='get'){const query=take('--query');if(!query)fail('Missing --query',2);const out=getResearchCache({cwd,policy:loadPolicy(),query,namespace:take('--namespace','repo')});console.log(JSON.stringify(out,null,2));process.exit(out.usable?0:out.status==='MISS'?53:54)}
if(group==='research'&&cmd==='verify'){const out=verifyResearchCache({cwd,policy:loadPolicy()});console.log(JSON.stringify(out,null,2));process.exit(out.valid?0:55)}
if(group==='research'&&cmd==='invalidate'){const query=take('--query');if(!query)fail('Missing --query',2);try{console.log(JSON.stringify(explicitInvalidateResearch({cwd,policy:loadPolicy(),query,namespace:take('--namespace','repo'),reason:take('--reason','MANUAL')}),null,2));process.exit(0)}catch(e){console.log(JSON.stringify({status:'RESEARCH_CACHE_INVALIDATE_FAILED',error:String(e?.message||e)},null,2));process.exit(56)}}
if(group==='telemetry'&&cmd==='start'){try{const input={run_id:take('--run-id'),task_id:take('--task-id'),benchmark_key:take('--benchmark-key',null),runtime:take('--runtime',null),adapter:take('--adapter',null),model:take('--model',null),runtime_profile:take('--profile',null),labels:{}};if(!input.run_id||!input.task_id)fail('Missing --run-id/--task-id',2);console.log(JSON.stringify(startTelemetryRun({cwd,policy:loadPolicy(),input}),null,2));process.exit(0)}catch(e){console.log(JSON.stringify({status:'TELEMETRY_START_FAILED',error:String(e?.message||e)},null,2));process.exit(57)}}
if(group==='telemetry'&&cmd==='emit'){const file=take('--file');if(!file)fail('Missing --file',2);try{console.log(JSON.stringify(appendTelemetryEvent({cwd,policy:loadPolicy(),event:readJson(path.resolve(cwd,file))}),null,2));process.exit(0)}catch(e){console.log(JSON.stringify({status:'TELEMETRY_EMIT_FAILED',error:String(e?.message||e)},null,2));process.exit(58)}}
if(group==='telemetry'&&cmd==='summarize'){const id=take('--run-id');if(!id)fail('Missing --run-id',2);try{console.log(JSON.stringify(aggregateTelemetryRun({cwd,policy:loadPolicy(),runId:id}),null,2));process.exit(0)}catch(e){console.log(JSON.stringify({status:'TELEMETRY_SUMMARY_FAILED',error:String(e?.message||e)},null,2));process.exit(59)}}
if(group==='telemetry'&&cmd==='verify'){const id=take('--run-id');if(!id)fail('Missing --run-id',2);try{const out=verifyTelemetryRun({cwd,policy:loadPolicy(),runId:id});console.log(JSON.stringify(out,null,2));process.exit(out.valid?0:60)}catch(e){console.log(JSON.stringify({status:'TELEMETRY_VERIFY_FAILED',error:String(e?.message||e)},null,2));process.exit(60)}}
if(group==='telemetry'&&cmd==='compare'){const b=take('--baseline-run'),c=take('--candidate-run');if(!b||!c)fail('Missing --baseline-run/--candidate-run',2);try{const policy=loadPolicy(),baseline=aggregateTelemetryRun({cwd,policy,runId:b,write:false}),candidate=aggregateTelemetryRun({cwd,policy,runId:c,write:false}),comparison=compareTelemetrySummaries({baseline,candidate}),out=writeTelemetryComparison({cwd,policy,comparison,id:take('--id',null)});console.log(JSON.stringify(out,null,2));process.exit(comparison.comparable?0:61)}catch(e){console.log(JSON.stringify({status:'TELEMETRY_COMPARE_FAILED',error:String(e?.message||e)},null,2));process.exit(61)}}
if(group==='self-test'){
  const policy=loadPolicy(),d=budgetDecision(policy,'opencode-qwen64k','orchestrator',0);if(d.usable_input_tokens!==45536)fail(`SELF_TEST_FAILED usable=${d.usable_input_tokens}`,30);
  if(policy.checkpoint?.checkpoint_before_compaction!==true)fail('SELF_TEST_FAILED checkpoint_before_compaction',30);
  if(policy.diff_first?.enabled!==true||policy.dedup?.enabled!==true)fail('SELF_TEST_FAILED phase3_policy',30);
  if(policy.knowledge?.enabled!==true||policy.knowledge?.version!=='0.5.0')fail('SELF_TEST_FAILED phase5_knowledge_policy',30);
  if(policy.research_cache?.enabled!==true)fail('SELF_TEST_FAILED phase5_research_cache_policy',30);
  if(policy.telemetry?.enabled!==true||policy.telemetry?.version!=='1.0.0'||policy.telemetry?.raw_prompt_storage!==false)fail('SELF_TEST_FAILED phase6_telemetry_policy',30);
  console.log('CONTEXTOS_PHASE3_SELF_TEST_PASS\nCONTEXTOS_PHASE4_SELF_TEST_PASS\nCONTEXTOS_PHASE5_SELF_TEST_PASS\nCONTEXTOS_PHASE6_SELF_TEST_PASS');process.exit(0)
}
console.log('ContextOS 1.0 runtime (Phase 6 complete)\nCommands: budget resolve/check | handoff validate/stats | checkpoint capture/verify | resume create/validate | transition plan | diff capture/verify | context plan/ledger-show | knowledge build/refresh/freshness/verify/summary | research put/get/verify/invalidate | telemetry start/emit/summarize/verify/compare | self-test');
