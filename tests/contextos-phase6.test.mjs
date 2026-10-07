import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  startTelemetryRun, appendTelemetryEvent, aggregateTelemetryRun, verifyTelemetryRun,
  compareTelemetrySummaries, validateTelemetryEvent
} from '../contextos/engine/telemetry.mjs';

const distRoot=path.resolve('.');
const runtime=path.resolve('contextos/engine/contextos.mjs');
const policyPath=path.resolve('contextos/policies/context-policy.json');
const policy=()=>JSON.parse(fs.readFileSync(policyPath,'utf8'));
const run=(cwd,...a)=>spawnSync(process.execPath,[runtime,...a],{cwd,encoding:'utf8'});
const jsonOut=r=>JSON.parse(r.stdout);
function dir(){return fs.mkdtempSync(path.join(os.tmpdir(),'contextos-p6-'))}
function source(agent='researcher',provenance='MEASURED'){return {runtime:'opencode',adapter:'opencode',agent,model:'qwen-local',provenance}}
function event({id='e1',runId='run1',task='TASK-1',kind='AGENT_CALL',agent='researcher',metrics={},timestamp='2026-10-05T15:00:01.000Z'}){return {version:'1.0.0',event_id:id,run_id:runId,task_id:task,timestamp,kind,source:source(agent),metrics,refs:{}}}
function start(cwd,runId='run1',benchmark='bench-a'){return startTelemetryRun({cwd,policy:policy(),input:{run_id:runId,task_id:'TASK-1',benchmark_key:benchmark,runtime:'opencode',adapter:'opencode',model:'qwen-local',runtime_profile:'opencode-qwen64k'},now:new Date('2026-10-05T15:00:00Z')})}

test('phase 6 policy enables privacy-safe telemetry and explicit benchmark rules',()=>{
  const p=policy();assert.equal(p.telemetry.version,'1.0.0');assert.equal(p.telemetry.enabled,true);assert.equal(p.telemetry.raw_prompt_storage,false);assert.equal(p.telemetry.transcript_storage,false);assert.equal(p.telemetry.benchmark_requires_matching_key,true);
});

test('telemetry run start creates isolated persistent run storage',()=>{
  const cwd=dir();const r=start(cwd);assert.equal(r.status,'TELEMETRY_RUN_STARTED');assert.ok(fs.existsSync(path.join(cwd,'.aledevos/state/telemetry/contextos/runs/run1/run.json')));assert.ok(fs.existsSync(path.join(cwd,'.aledevos/state/telemetry/contextos/runs/run1/events.jsonl')));
});

test('valid measured agent event passes validation and appends with hash chain',()=>{
  const cwd=dir(),p=policy();start(cwd);const e=event({metrics:{input_tokens:12000,output_tokens:900,context_tokens:18000,duration_ms:90000,generation_ms:25000,decode_tokens_per_sec:36,tool_calls:4,files_read:5,bytes_read:30000}});assert.equal(validateTelemetryEvent(e,p).valid,true);const a=appendTelemetryEvent({cwd,policy:p,event:e});assert.equal(a.seq,1);assert.match(a.event_sha256,/^[a-f0-9]{64}$/);
});

test('unknown metrics are not invented by the aggregator',()=>{
  const cwd=dir(),p=policy();start(cwd);appendTelemetryEvent({cwd,policy:p,event:event({metrics:{input_tokens:100}})});const s=aggregateTelemetryRun({cwd,policy:p,runId:'run1'});assert.equal(s.totals.input_tokens,100);assert.equal(s.totals.output_tokens,null);assert.equal(s.agents.researcher.reported_decode_tps_avg,null);assert.equal(s.workflow_duration_ms,null);assert.ok(s.coverage.metric_samples.input_tokens>=1);assert.equal(s.agents.researcher.derived_decode_tps,null);
});

test('raw prompts, transcripts, completions and secrets are rejected recursively',()=>{
  const p=policy();for(const bad of [{prompt:'x'},{transcript:'x'},{nested:{api_key:'x'}},{nested:{password:'x'}},{completion_text:'x'}]){const e=event({metrics:{input_tokens:1}});e.refs=bad;const v=validateTelemetryEvent(e,p);assert.equal(v.valid,false);assert.ok(v.errors.some(x=>x.includes('SENSITIVE_FIELD_FORBIDDEN')));}
});

test('event task id must match the run task id',()=>{
  const cwd=dir(),p=policy();start(cwd);assert.throws(()=>appendTelemetryEvent({cwd,policy:p,event:event({task:'OTHER'})}),/TASK_ID_MISMATCH/);
});

test('duplicate event ids are rejected',()=>{
  const cwd=dir(),p=policy();start(cwd);const e=event({metrics:{input_tokens:1}});appendTelemetryEvent({cwd,policy:p,event:e});assert.throws(()=>appendTelemetryEvent({cwd,policy:p,event:e}),/EVENT_ID_DUPLICATE/);
});

test('context pressure history and peak are aggregated exactly',()=>{
  const cwd=dir(),p=policy();start(cwd);appendTelemetryEvent({cwd,policy:p,event:event({id:'c1',kind:'CONTEXT_SAMPLE',metrics:{context_tokens:21000,pressure_band:'WATCH'}})});appendTelemetryEvent({cwd,policy:p,event:event({id:'c2',kind:'CONTEXT_SAMPLE',metrics:{context_tokens:33000,pressure_band:'CHECKPOINT_REQUIRED'},timestamp:'2026-10-05T15:00:02Z'})});const s=aggregateTelemetryRun({cwd,policy:p,runId:'run1'});assert.equal(s.context.peak_tokens,33000);assert.equal(s.context.samples,2);assert.equal(s.context.pressure_bands.WATCH,1);assert.equal(s.context.pressure_bands.CHECKPOINT_REQUIRED,1);
});

test('handoff checkpoint compaction and resume metrics aggregate without content storage',()=>{
  const cwd=dir(),p=policy();start(cwd);for(const [i,kind,metrics] of [[1,'HANDOFF',{estimated_tokens:1800,bytes:6200}],[2,'CHECKPOINT',{estimated_tokens:4100,bytes:15000}],[3,'COMPACTION',{before_tokens:44000,after_tokens:12000,saved_tokens:32000}],[4,'RESUME',{estimated_tokens:3900}]])appendTelemetryEvent({cwd,policy:p,event:event({id:`x${i}`,kind,metrics,timestamp:`2026-10-05T15:00:0${i}Z`})});const s=aggregateTelemetryRun({cwd,policy:p,runId:'run1'});assert.equal(s.totals.handoffs,1);assert.equal(s.totals.handoff_tokens,1800);assert.equal(s.totals.checkpoints,1);assert.equal(s.totals.compactions,1);assert.equal(s.totals.resumes,1);
});

test('research cache hit rate is derived from exact status events',()=>{
  const cwd=dir(),p=policy();start(cwd);for(const [i,status] of ['HIT','HIT','MISS','STALE'].entries())appendTelemetryEvent({cwd,policy:p,event:event({id:`r${i}`,kind:'RESEARCH_CACHE',metrics:{cache_status:status},timestamp:`2026-10-05T15:00:0${i+1}Z`})});const s=aggregateTelemetryRun({cwd,policy:p,runId:'run1'});assert.equal(s.research_cache.hit,2);assert.equal(s.research_cache.miss,1);assert.equal(s.research_cache.stale,1);assert.equal(s.research_cache.hit_rate,0.5);
});

test('knowledge incremental metrics aggregate reparsed and reused counts',()=>{
  const cwd=dir(),p=policy();start(cwd);appendTelemetryEvent({cwd,policy:p,event:event({id:'k1',kind:'KNOWLEDGE_REFRESH',metrics:{scanned_files:100,reparsed_files:4,reused_files:96,research_invalidated:2,duration_ms:500}})});const s=aggregateTelemetryRun({cwd,policy:p,runId:'run1'});assert.equal(s.knowledge.refreshes,1);assert.equal(s.knowledge.reparsed_files,4);assert.equal(s.knowledge.reused_files,96);assert.equal(s.knowledge.research_invalidated,2);
});

test('gates judges repairs and final state aggregate independently',()=>{
  const cwd=dir(),p=policy();start(cwd);appendTelemetryEvent({cwd,policy:p,event:event({id:'g1',kind:'GATE',agent:'verifier',metrics:{gate_status:'PASS',duration_ms:300}})});appendTelemetryEvent({cwd,policy:p,event:event({id:'j1',kind:'JUDGE',agent:'judge-requirements',metrics:{score:95,blockers:0}})});appendTelemetryEvent({cwd,policy:p,event:event({id:'j2',kind:'JUDGE',agent:'judge-quality',metrics:{score:91,blockers:0}})});appendTelemetryEvent({cwd,policy:p,event:event({id:'rep',kind:'REPAIR',agent:'repairer',metrics:{repair_count:1}})});appendTelemetryEvent({cwd,policy:p,event:event({id:'fin',kind:'FINAL_STATE',agent:'orchestrator',metrics:{final_state:'PASS'}})});const s=aggregateTelemetryRun({cwd,policy:p,runId:'run1'});assert.equal(s.gates.pass,1);assert.equal(s.judges.min_score,91);assert.equal(s.judges.avg_score,93);assert.equal(s.totals.repairs,1);assert.equal(s.final_state,'PASS');
});

test('per-agent token timing and derived decode rate are observable',()=>{
  const cwd=dir(),p=policy();start(cwd);appendTelemetryEvent({cwd,policy:p,event:event({id:'a1',agent:'builder',metrics:{input_tokens:8000,output_tokens:1000,generation_ms:25000,duration_ms:60000,decode_tokens_per_sec:39}})});const a=aggregateTelemetryRun({cwd,policy:p,runId:'run1'}).agents.builder;assert.equal(a.calls,1);assert.equal(a.input_tokens,8000);assert.equal(a.output_tokens,1000);assert.equal(a.derived_decode_tps,40);assert.equal(a.reported_decode_tps_avg,39);
});

test('run verification detects JSONL event-chain tampering',()=>{
  const cwd=dir(),p=policy();start(cwd);appendTelemetryEvent({cwd,policy:p,event:event({metrics:{input_tokens:5}})});aggregateTelemetryRun({cwd,policy:p,runId:'run1'});let v=verifyTelemetryRun({cwd,policy:p,runId:'run1'});assert.equal(v.valid,true);const ep=path.join(cwd,'.aledevos/state/telemetry/contextos/runs/run1/events.jsonl');let line=JSON.parse(fs.readFileSync(ep,'utf8').trim());line.event.metrics.input_tokens=999;fs.writeFileSync(ep,JSON.stringify(line)+'\n');v=verifyTelemetryRun({cwd,policy:p,runId:'run1'});assert.equal(v.valid,false);assert.equal(v.event_chain_valid,false);
});

test('summary integrity binds to the event-chain tail',()=>{
  const cwd=dir(),p=policy();start(cwd);appendTelemetryEvent({cwd,policy:p,event:event({metrics:{input_tokens:5}})});aggregateTelemetryRun({cwd,policy:p,runId:'run1'});const sp=path.join(cwd,'.aledevos/state/telemetry/contextos/runs/run1/summary.json');const s=JSON.parse(fs.readFileSync(sp,'utf8'));s.totals.input_tokens=999;fs.writeFileSync(sp,JSON.stringify(s,null,2));const v=verifyTelemetryRun({cwd,policy:p,runId:'run1'});assert.equal(v.valid,false);assert.equal(v.summary_valid,false);
});

test('matching benchmark keys produce comparable before/after deltas',()=>{
  const base={run_id:'a',benchmark_key:'same',totals:{input_tokens:1000,output_tokens:100,compactions:2,handoff_tokens:400,files_read:10,bytes_read:10000,repairs:1},context:{peak_tokens:40000},workflow_duration_ms:100000,research_cache:{hit_rate:0.2}};const cand={run_id:'b',benchmark_key:'same',totals:{input_tokens:600,output_tokens:100,compactions:1,handoff_tokens:250,files_read:6,bytes_read:6000,repairs:0},context:{peak_tokens:25000},workflow_duration_ms:70000,research_cache:{hit_rate:0.6}};const c=compareTelemetrySummaries({baseline:base,candidate:cand});assert.equal(c.comparable,true);assert.equal(c.metrics['totals.input_tokens'].absolute_delta,-400);assert.equal(c.metrics['context.peak_tokens'].ratio_delta,-0.375);
});

test('mismatched benchmark keys refuse authoritative comparison',()=>{
  const c=compareTelemetrySummaries({baseline:{run_id:'a',benchmark_key:'one',totals:{},context:{},research_cache:{}},candidate:{run_id:'b',benchmark_key:'two',totals:{},context:{},research_cache:{}}});assert.equal(c.comparable,false);assert.equal(c.warning,'BENCHMARK_KEY_MISMATCH_OR_MISSING');
});

test('CLI can start emit summarize verify and compare runs',()=>{
  const cwd=dir();let r=run(cwd,'telemetry','start','--run-id','runA','--task-id','TASK-1','--benchmark-key','bench','--runtime','opencode','--adapter','opencode','--model','qwen-local','--profile','opencode-qwen64k');assert.equal(r.status,0,r.stderr+r.stdout);const e=event({runId:'runA',metrics:{input_tokens:100,output_tokens:20}});fs.writeFileSync(path.join(cwd,'event.json'),JSON.stringify(e));r=run(cwd,'telemetry','emit','--file','event.json');assert.equal(r.status,0,r.stderr+r.stdout);r=run(cwd,'telemetry','summarize','--run-id','runA');assert.equal(r.status,0,r.stderr+r.stdout);assert.equal(jsonOut(r).totals.input_tokens,100);r=run(cwd,'telemetry','verify','--run-id','runA');assert.equal(r.status,0,r.stderr+r.stdout);assert.equal(jsonOut(r).valid,true);
});

test('CLI comparison returns non-zero when benchmark keys are not comparable',()=>{
  const cwd=dir();for(const [id,key] of [['a','one'],['b','two']]){let r=run(cwd,'telemetry','start','--run-id',id,'--task-id','TASK-1','--benchmark-key',key);assert.equal(r.status,0,r.stderr+r.stdout)}const r=run(cwd,'telemetry','compare','--baseline-run','a','--candidate-run','b');assert.equal(r.status,61);assert.equal(jsonOut(r).comparable,false);
});

test('installer packages telemetry runtime and persistent telemetry directory',()=>{
  const s=fs.readFileSync(path.resolve('scripts/05-install-into-project.ps1'),'utf8');assert.match(s,/ContextOS Phase 1\+2\+3\+4\+5\+6/);assert.match(s,/telemetry\.mjs/);assert.match(s,/telemetry\\runs/);
});

test('all core and OpenCode agents carry Phase 6 truthful telemetry discipline',()=>{
  for(const d of ['core/agents','adapters/opencode/.opencode/agents'])for(const name of fs.readdirSync(d).filter(x=>x.endsWith('.md'))){const body=fs.readFileSync(path.join(d,name),'utf8');assert.match(body,/## ContextOS Phase 6/,`${d}/${name}`);assert.match(body,/Never estimate or invent/i,`${d}/${name}`);assert.match(body,/prompt|transcript/i,`${d}/${name}`)}
});

test('phase 6 self-test preserves prior compatibility markers and adds final marker',()=>{
  const r=run(distRoot,'self-test');assert.equal(r.status,0,r.stderr||r.stdout);for(const phase of [3,4,5,6])assert.match(r.stdout,new RegExp(`CONTEXTOS_PHASE${phase}_SELF_TEST_PASS`));
});
