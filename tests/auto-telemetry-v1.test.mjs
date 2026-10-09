import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const runtime=path.resolve('core/engine/aledevos.mjs');
const run=(cwd,...args)=>spawnSync(process.execPath,[runtime,...args],{cwd,encoding:'utf8'});
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-auto-telemetry-'));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));

test('state init starts task telemetry automatically without telemetry CLI commands',()=>{
  const cwd=temp();
  const r=run(cwd,'state','init','--task-id','auto-telemetry-init','--adapter','opencode','--benchmark-key','auto-telemetry-v1');
  assert.equal(r.status,0,r.stderr+r.stdout);
  const state=read(path.join(cwd,'.aledevos','state','current.json'));
  assert.equal(state.telemetry_status,'ACTIVE');
  assert.match(state.telemetry_run_id,/^run-auto-telemetry-init-/);
  assert.equal(state.telemetry_benchmark_key,'auto-telemetry-v1');
  const dir=path.join(cwd,'.aledevos','state','telemetry','contextos','runs',state.telemetry_run_id);
  assert.ok(fs.existsSync(path.join(dir,'run.json')));
  assert.ok(fs.existsSync(path.join(dir,'events.jsonl')));
  const records=fs.readFileSync(path.join(dir,'events.jsonl'),'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  assert.equal(records.length,1);
  assert.equal(records[0].event.kind,'RUN_START');
  assert.equal(records[0].event.task_id,'auto-telemetry-init');
});

test('gate judge repair and final state are auto-emitted and summary verifies',()=>{
  const cwd=temp();
  let r=run(cwd,'state','init','--task-id','auto-telemetry-flow','--adapter','opencode','--benchmark-key','auto-telemetry-v1');
  assert.equal(r.status,0,r.stderr+r.stdout);

  r=spawnSync('git',['init'],{cwd,encoding:'utf8'});
  assert.equal(r.status,0,r.stderr+r.stdout);

  r=run(cwd,'integrity','scan');
  assert.equal(r.status,0,r.stderr+r.stdout);

  // Supply the canonical gate and native-role prerequisites in this telemetry-only fixture.
  // The test exercises emitted telemetry; role ordering/gate enforcement has separate negative tests.
  const currentPath=path.join(cwd,'.aledevos','state','current.json');
  const ready=read(currentPath);
  for(const gate of ['scope','canonical','quality_engineering'])ready.gates[gate]={status:'PASS'};
  ready.agent_trace.push({agent:'judge-requirements',status:'STARTED'});
  fs.writeFileSync(currentPath,JSON.stringify(ready,null,2));

  r=run(cwd,'state','judge','--judge','requirements','--score','95','--blockers','0','--unverified','0');
  assert.equal(r.status,0,r.stderr+r.stdout);

  r=run(cwd,'state','repair-start');
  assert.equal(r.status,0,r.stderr+r.stdout);

  r=run(cwd,'state','block','--reason','auto-telemetry-test');
  assert.equal(r.status,0,r.stderr+r.stdout);

  r=run(cwd,'state','finalize');
  assert.equal(r.status,6,r.stderr+r.stdout);
  assert.match(r.stdout,/BLOCKED/);

  const state=read(path.join(cwd,'.aledevos','state','current.json'));
  assert.equal(state.final_state,'BLOCKED');
  assert.equal(state.telemetry_status,'VERIFIED');
  assert.ok(state.telemetry_summary_path);

  const summary=read(path.join(cwd,state.telemetry_summary_path));
  assert.equal(summary.final_state,'BLOCKED');
  assert.equal(summary.gates.pass,1);
  assert.equal(summary.judges.count,1);
  assert.equal(summary.judges.min_score,95);
  assert.equal(summary.totals.repairs,1);
  for(const kind of ['RUN_START','GATE','JUDGE','REPAIR','FINAL_STATE'])assert.ok(summary.coverage.event_kinds.includes(kind));

  const runDir=path.join(cwd,'.aledevos','state','telemetry','contextos','runs',state.telemetry_run_id);
  const records=fs.readFileSync(path.join(runDir,'events.jsonl'),'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  assert.deepEqual(records.map(x=>x.seq),[1,2,3,4,5]);
  for(let i=1;i<records.length;i++)assert.equal(records[i].prev_sha256,records[i-1].integrity.event_sha256);
});

test('automatic lifecycle telemetry does not invent AGENT_CALL token metrics before runtime binding exists',()=>{
  const cwd=temp();
  const r=run(cwd,'state','init','--task-id','auto-telemetry-no-agent-call','--adapter','opencode');
  assert.equal(r.status,0,r.stderr+r.stdout);
  const state=read(path.join(cwd,'.aledevos','state','current.json'));
  const events=fs.readFileSync(path.join(cwd,'.aledevos','state','telemetry','contextos','runs',state.telemetry_run_id,'events.jsonl'),'utf8');
  assert.doesNotMatch(events,/"kind":"AGENT_CALL"/);
});
