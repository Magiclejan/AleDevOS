import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const runtime=path.resolve('contextos/engine/contextos.mjs');
const run=(...a)=>spawnSync(process.execPath,[runtime,...a],{encoding:'utf8'});
const jsonOut=r=>JSON.parse(r.stdout);

test('OpenCode/Qwen profile reserves native buffer before budgeting input',()=>{
  const r=run('budget','resolve','--profile','opencode-qwen64k','--agent','orchestrator');
  assert.equal(r.status,0);
  const x=jsonOut(r);
  assert.equal(x.context_window,65536);
  assert.equal(x.reserve_tokens,20000);
  assert.equal(x.usable_input_tokens,45536);
  assert.equal(x.target_tokens,10000);
});

test('agent-specific targets stay below safety thresholds',()=>{
  for(const agent of ['orchestrator','researcher','architect','builder','verifier','judge-requirements','repairer']){
    const x=jsonOut(run('budget','resolve','--profile','opencode-qwen64k','--agent',agent));
    assert.ok(x.target_tokens < x.thresholds.checkpoint,`${agent} target must be below checkpoint`);
  }
});

test('budget check reports checkpoint pressure deterministically',()=>{
  const base=jsonOut(run('budget','resolve','--profile','opencode-qwen64k','--agent','researcher'));
  const r=run('budget','check','--profile','opencode-qwen64k','--agent','researcher','--used',String(base.thresholds.checkpoint));
  assert.equal(r.status,18);
  const x=jsonOut(r);
  assert.equal(x.pressure_band,'CHECKPOINT_REQUIRED');
  assert.equal(x.action,'EMIT_CHECKPOINT');
  assert.equal(x.large_reads_allowed,false);
});

test('budget check hard guard stops new large reads',()=>{
  const base=jsonOut(run('budget','resolve','--profile','opencode-qwen64k','--agent','builder'));
  const r=run('budget','check','--profile','opencode-qwen64k','--agent','builder','--used',String(base.thresholds.hard_guard));
  assert.equal(r.status,20);
  const x=jsonOut(r);
  assert.equal(x.pressure_band,'HARD_GUARD');
  assert.equal(x.action,'STOP_NEW_READS');
  assert.equal(x.large_reads_allowed,false);
});

test('valid structured handoff passes validation',()=>{
  const r=run('handoff','validate','--file','contextos/templates/HANDOFF.example.json');
  assert.equal(r.status,0,r.stderr);
  const x=jsonOut(r);
  assert.equal(x.valid,true);
  assert.ok(x.estimated_tokens < x.max_estimated_tokens);
});

test('transcript dumps are rejected',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'contextos-'));
  const h=JSON.parse(fs.readFileSync('contextos/templates/HANDOFF.example.json','utf8'));
  h.context_metrics.transcript_included=true;
  const f=path.join(dir,'handoff.json');fs.writeFileSync(f,JSON.stringify(h));
  const r=run('handoff','validate','--file',f);
  assert.equal(r.status,21);
  assert.match(r.stdout,/transcript_included/);
});

test('oversized handoffs are rejected by estimated-token ceiling',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'contextos-'));
  const h=JSON.parse(fs.readFileSync('contextos/templates/HANDOFF.example.json','utf8'));
  h.risks=Array.from({length:20},(_,i)=>`risk-${i} `+'x'.repeat(880));
  const f=path.join(dir,'handoff.json');fs.writeFileSync(f,JSON.stringify(h));
  const r=run('handoff','validate','--file',f);
  assert.equal(r.status,21);
  assert.match(r.stdout,/estimated_tokens_exceed_limit/);
});

test('missing required handoff fields fail validation',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'contextos-'));
  const h=JSON.parse(fs.readFileSync('contextos/templates/HANDOFF.example.json','utf8'));
  delete h.next_action;
  const f=path.join(dir,'handoff.json');fs.writeFileSync(f,JSON.stringify(h));
  const r=run('handoff','validate','--file',f);
  assert.equal(r.status,21);
  assert.match(r.stdout,/missing:next_action/);
});

test('installer packages ContextOS runtime and contracts',()=>{
  const s=fs.readFileSync('scripts/05-install-into-project.ps1','utf8');
  assert.match(s,/contextos\\engine\\contextos\.mjs/);
  assert.match(s,/contextos\\policies\\context-policy\.json/);
  assert.match(s,/core\\context-contracts/);
});

test('all core and OpenCode agents carry Phase 1 handoff discipline',()=>{
  for(const dir of ['core/agents','adapters/opencode/.opencode/agents']){
    for(const name of fs.readdirSync(dir).filter(x=>x.endsWith('.md'))){
      const s=fs.readFileSync(path.join(dir,name),'utf8');
      assert.match(s,/## ContextOS Phase 1/,`${dir}/${name}`);
      assert.match(s,/Transfer state, not transcript history/,`${dir}/${name}`);
    }
  }
});
