import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const runtime=path.resolve('contextos/engine/contextos.mjs');
const run=(cwd,...a)=>spawnSync(process.execPath,[runtime,...a],{cwd,encoding:'utf8'});
const jsonOut=r=>JSON.parse(r.stdout);

function makeWorkspace(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'contextos-p2-'));
  fs.mkdirSync(path.join(dir,'.aledevos','state'),{recursive:true});
  const state={
    version:1,
    task_id:'task-p2',
    approved_scope:['src/a.ts','tests/a.test.ts'],
    scope_version:2,
    acceptance_criteria:[{id:'AC1',status:'VERIFIED'},{id:'AC2',status:'UNVERIFIED'}],
    gates:{scope:{status:'PASS'}},
    judges:{},
    blockers:[],
    repair_count:1,
    max_repairs:2,
    blocked_reason:null,
    final_state:null,
    history:[{at:'2026-10-05T12:00:00.000Z',type:'STATE_INIT'}]
  };
  fs.writeFileSync(path.join(dir,'.aledevos','state','current.json'),JSON.stringify(state,null,2));
  spawnSync('git',['init'],{cwd:dir,encoding:'utf8'});
  fs.mkdirSync(path.join(dir,'src'),{recursive:true});
  fs.writeFileSync(path.join(dir,'src','a.ts'),'export const a = 1;\n');
  return {dir,state};
}

function capture(dir,id='cp1',used='33000'){
  return run(dir,'checkpoint','capture','--id',id,'--agent','orchestrator','--phase','verification','--reason','PRE_COMPACTION','--objective','Synthetic task','--summary','Ready for verifier','--next-agent','verifier','--next-action','Run canonical gates','--profile','opencode-qwen64k','--used',used,'--decision','Keep scope unchanged','--evidence','Builder completed approved diff','--test','canonical gate','--required-read','git diff HEAD','--forbidden-action','Do not edit product code');
}

function createResume(dir,cp='cp1',id='rs1'){
  return run(dir,'resume','create','--checkpoint-id',cp,'--id',id);
}

test('checkpoint capture seals exact AleDevOS run state under protected runtime state',()=>{
  const {dir,state}=makeWorkspace();
  const r=capture(dir);
  assert.equal(r.status,0,r.stderr||r.stdout);
  const out=jsonOut(r);
  assert.equal(out.status,'CHECKPOINT_CAPTURED');
  const cp=JSON.parse(fs.readFileSync(path.join(dir,'.aledevos','state','contextos','checkpoints','cp1.json'),'utf8'));
  assert.deepEqual(cp.run_state,state);
  assert.equal(cp.context_metrics.transcript_included,false);
  assert.match(cp.integrity.payload_sha256,/^[a-f0-9]{64}$/);
});

test('sealed checkpoint verifies successfully',()=>{
  const {dir}=makeWorkspace();capture(dir);
  const r=run(dir,'checkpoint','verify','--id','cp1');
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(jsonOut(r).status,'CHECKPOINT_VALID');
});

test('tampered checkpoint is rejected by integrity hash',()=>{
  const {dir}=makeWorkspace();capture(dir);
  const p=path.join(dir,'.aledevos','state','contextos','checkpoints','cp1.json');
  const cp=JSON.parse(fs.readFileSync(p,'utf8'));cp.summary='tampered';fs.writeFileSync(p,JSON.stringify(cp,null,2));
  const r=run(dir,'checkpoint','verify','--id','cp1');
  assert.notEqual(r.status,0);
  assert.match(r.stdout,/payload_sha256:mismatch/);
});

test('resume packet preserves critical checkpoint state exactly',()=>{
  const {dir}=makeWorkspace();capture(dir);
  const rr=createResume(dir);assert.equal(rr.status,0,rr.stderr||rr.stdout);
  const cp=JSON.parse(fs.readFileSync(path.join(dir,'.aledevos','state','contextos','checkpoints','cp1.json'),'utf8'));
  const rs=JSON.parse(fs.readFileSync(path.join(dir,'.aledevos','state','contextos','resume','rs1.json'),'utf8'));
  assert.deepEqual(rs.state.run_state,cp.run_state);
  assert.deepEqual(rs.state.working_set,cp.working_set);
  assert.equal(rs.source_checkpoint_sha256,cp.integrity.payload_sha256);
});

test('resume validation rejects any critical-state drift',()=>{
  const {dir}=makeWorkspace();capture(dir);createResume(dir);
  const p=path.join(dir,'.aledevos','state','contextos','resume','rs1.json');
  const rs=JSON.parse(fs.readFileSync(p,'utf8'));rs.state.run_state.repair_count=2;fs.writeFileSync(p,JSON.stringify(rs,null,2));
  const r=run(dir,'resume','validate','--id','rs1','--checkpoint-id','cp1');
  assert.notEqual(r.status,0);
  assert.match(r.stdout,/state:not_exact_checkpoint_state|payload_sha256:mismatch/);
});

test('compact pressure blocks transition until checkpoint exists',()=>{
  const {dir}=makeWorkspace();
  const r=run(dir,'transition','plan','--profile','opencode-qwen64k','--agent','orchestrator','--used','33000','--strategy','native');
  assert.equal(r.status,22);
  const x=jsonOut(r);assert.equal(x.ready,false);assert.equal(x.action,'CAPTURE_CHECKPOINT');
});

test('compact pressure blocks transition until resume packet exists',()=>{
  const {dir}=makeWorkspace();capture(dir);
  const r=run(dir,'transition','plan','--profile','opencode-qwen64k','--agent','orchestrator','--used','33000','--strategy','native','--checkpoint-id','cp1');
  assert.equal(r.status,23);
  const x=jsonOut(r);assert.equal(x.ready,false);assert.equal(x.action,'CREATE_RESUME_PACKET');
});

test('verified artifacts authorize native compact and resume at compact pressure',()=>{
  const {dir}=makeWorkspace();capture(dir);createResume(dir);
  const r=run(dir,'transition','plan','--profile','opencode-qwen64k','--agent','orchestrator','--used','33000','--strategy','native','--checkpoint-id','cp1','--resume-id','rs1');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const x=jsonOut(r);assert.equal(x.ready,true);assert.equal(x.pressure_band,'COMPACT_REQUIRED');assert.equal(x.action,'COMPACT_AND_RESUME');
});

test('hard guard always requires a fresh session plus verified resume',()=>{
  const {dir}=makeWorkspace();capture(dir,'cp1','37000');createResume(dir);
  const r=run(dir,'transition','plan','--profile','opencode-qwen64k','--agent','orchestrator','--used','37000','--strategy','native','--checkpoint-id','cp1','--resume-id','rs1');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const x=jsonOut(r);assert.equal(x.pressure_band,'HARD_GUARD');assert.equal(x.action,'NEW_SESSION_AND_RESUME');
});

test('checkpoint and resume packets reject transcript history by contract',()=>{
  const {dir}=makeWorkspace();capture(dir);createResume(dir);
  const cp=JSON.parse(fs.readFileSync(path.join(dir,'.aledevos','state','contextos','checkpoints','cp1.json'),'utf8'));
  const rs=JSON.parse(fs.readFileSync(path.join(dir,'.aledevos','state','contextos','resume','rs1.json'),'utf8'));
  assert.equal(cp.context_metrics.transcript_included,false);
  assert.equal(rs.context_metrics.transcript_included,false);
  assert.equal('transcript' in cp,false);
  assert.equal('transcript' in rs,false);
});

test('installer packages Phase 2 schemas, templates and runtime state directories',()=>{
  const s=fs.readFileSync(path.resolve('scripts/05-install-into-project.ps1'),'utf8');
  assert.match(s,/contextos\\schemas/);
  assert.match(s,/contextos\\templates/);
  assert.match(s,/state\\contextos/);
});

test('Core and OpenCode agents carry checkpoint/resume discipline',()=>{
  for(const dir of ['core/agents','adapters/opencode/.opencode/agents']){
    for(const name of fs.readdirSync(path.resolve(dir)).filter(x=>x.endsWith('.md'))){
      const s=fs.readFileSync(path.resolve(dir,name),'utf8');
      assert.match(s,/## ContextOS Phase 2/,`${dir}/${name}`);
      assert.match(s,/verified checkpoint/i,`${dir}/${name}`);
    }
  }
});
