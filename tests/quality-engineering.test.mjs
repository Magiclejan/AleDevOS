import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const runtime=path.resolve('core/engine/aledevos.mjs');
const policySource=path.resolve('quality-engineering/policies/quality-engineering-policy.json');
const run=(cwd,...a)=>spawnSync(process.execPath,[runtime,...a],{cwd,encoding:'utf8'});
const temp=()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-qe-'));
  const p=path.join(cwd,'.aledevos/quality-engineering/policies');
  fs.mkdirSync(p,{recursive:true});
  fs.copyFileSync(policySource,path.join(p,'quality-engineering-policy.json'));
  fs.mkdirSync(path.join(cwd,'.aledevos/state'),{recursive:true});
  return cwd;
};
const statePath=cwd=>path.join(cwd,'.aledevos/state/current.json');
function state(cwd){return JSON.parse(fs.readFileSync(statePath(cwd),'utf8'))}
function writeState(cwd,s){fs.writeFileSync(statePath(cwd),JSON.stringify(s,null,2))}
function init(cwd,id='QE'){assert.equal(run(cwd,'state','init','--task-id',id,'--adapter','codex','--criterion','AC1').status,0)}
function canonicalPass(cwd){
  const s=state(cwd);
  s.gates.canonical={status:'PASS',results:[{id:'tests',status:'PASS'}]};
  writeState(cwd,s);
}
function evidenceFile(cwd,rel,body='ok'){
  const p=path.join(cwd,rel);
  fs.mkdirSync(path.dirname(p),{recursive:true});
  fs.writeFileSync(p,body);
}
function git(cwd,...a){return spawnSync('git',a,{cwd,encoding:'utf8'});}
function initGit(cwd){
  git(cwd,'init');
  git(cwd,'config','user.email','test@unit.invalid');
  git(cwd,'config','user.name','Test');
}

test('analysis quality plan can PASS without invented test evidence',()=>{
  const cwd=temp();init(cwd,'ANALYSIS');
  assert.equal(run(cwd,'quality','plan','--change-class','analysis','--risk','low').status,0);
  const q=run(cwd,'quality','verify');
  assert.equal(q.status,0,q.stdout+q.stderr);
  assert.match(q.stdout,/QUALITY_ENGINEERING_PASS/);
  assert.equal(state(cwd).gates.quality_engineering.status,'PASS');
});

test('bugfix blocks without regression, regression-analysis and diff-review evidence',()=>{
  const cwd=temp();init(cwd,'BUG1');
  run(cwd,'quality','plan','--change-class','bugfix','--risk','high');
  const q=run(cwd,'quality','verify');
  assert.equal(q.status,34);
  assert.match(q.stdout,/regression-test/);
  assert.match(q.stdout,/regression-analysis/);
  assert.match(q.stdout,/diff-review/);
  assert.equal(state(cwd).gates.quality_engineering.status,'BLOCKED');
});

test('bugfix passes only with real regression evidence and canonical gate PASS',()=>{
  const cwd=temp();init(cwd,'BUG2');
  run(cwd,'quality','plan','--change-class','bugfix','--risk','high');
  evidenceFile(cwd,'tests/regression.test.js','test("regression",()=>{});');
  evidenceFile(cwd,'.aledevos/state/tasks/BUG2/regression-analysis.json','{}');
  evidenceFile(cwd,'.aledevos/state/tasks/BUG2/diff-review.json','{}');

  run(cwd,'quality','evidence','--type','test','--ref','gate:canonical/tests','--source','tests/regression.test.js','--layer','unit','--coverage','regression','--regression','true');
  run(cwd,'quality','evidence','--type','regression-analysis','--ref','.aledevos/state/tasks/BUG2/regression-analysis.json');
  run(cwd,'quality','evidence','--type','diff-review','--ref','.aledevos/state/tasks/BUG2/diff-review.json');

  let q=run(cwd,'quality','verify');
  assert.equal(q.status,34);
  assert.match(q.stdout,/canonical-gate-pass/);

  canonicalPass(cwd);
  q=run(cwd,'quality','verify');
  assert.equal(q.status,0,q.stdout+q.stderr);
  assert.match(q.stdout,/QUALITY_ENGINEERING_PASS/);
});

test('feature requires happy path, edge or error path, regression analysis, diff review and reuse decision',()=>{
  const cwd=temp();init(cwd,'FEATURE');
  run(cwd,'quality','plan','--change-class','feature','--risk','medium');
  canonicalPass(cwd);
  evidenceFile(cwd,'tests/feature.test.js','test("feature",()=>{});');
  evidenceFile(cwd,'src/existing-component.ts','export const Existing=1;');
  evidenceFile(cwd,'.aledevos/state/tasks/FEATURE/regression-analysis.json','{}');
  evidenceFile(cwd,'.aledevos/state/tasks/FEATURE/diff-review.json','{}');

  run(cwd,'quality','evidence','--type','test','--ref','gate:canonical/tests','--source','tests/feature.test.js','--layer','unit','--coverage','happy');
  run(cwd,'quality','evidence','--type','regression-analysis','--ref','.aledevos/state/tasks/FEATURE/regression-analysis.json');
  run(cwd,'quality','evidence','--type','diff-review','--ref','.aledevos/state/tasks/FEATURE/diff-review.json');

  let q=run(cwd,'quality','verify');
  assert.equal(q.status,34);
  assert.match(q.stdout,/feature-edge-or-error-path/);
  assert.match(q.stdout,/reuse-decision/);

  run(cwd,'quality','evidence','--type','test','--ref','gate:canonical/tests','--source','tests/feature.test.js','--layer','unit','--coverage','edge');
  run(cwd,'quality','reuse','--decision','REUSE','--target','component','--evidence','src/existing-component.ts');
  q=run(cwd,'quality','verify');
  assert.equal(q.status,0,q.stdout+q.stderr);
});

test('nonexistent evidence reference cannot make Quality Engineering pass',()=>{
  const cwd=temp();init(cwd,'FAKE');
  run(cwd,'quality','plan','--change-class','docs','--risk','low');
  run(cwd,'quality','evidence','--type','diff-review','--ref','.aledevos/state/tasks/FAKE/does-not-exist.json');
  const q=run(cwd,'quality','verify');
  assert.equal(q.status,34);
  assert.match(q.stdout,/invalid-evidence-ref/);
});

test('new tasks cannot finalize PASS before Quality Engineering gate passes',()=>{
  const cwd=temp();init(cwd,'FINAL');
  let s=state(cwd);
  s.acceptance_criteria[0].status='VERIFIED';
  s.gates.scope={status:'PASS'};
  s.gates.integrity={status:'PASS'};
  s.gates.canonical={status:'PASS'};
  for(const j of ['requirements','regression','quality'])s.judges[j]={score:95,blockers:0,unverified:0};
  writeState(cwd,s);

  let q=run(cwd,'state','finalize');
  assert.equal(q.status,5);
  assert.match(q.stdout,/NOT_FINAL/);

  run(cwd,'quality','plan','--change-class','analysis','--risk','low');
  assert.equal(run(cwd,'quality','verify').status,0);
  q=run(cwd,'state','finalize');
  assert.equal(q.status,0,q.stdout+q.stderr);
  assert.match(q.stdout,/PASS/);
});


test('new abstraction path forces an explicit reuse decision even for a bugfix',()=>{
  const cwd=temp();initGit(cwd);
  evidenceFile(cwd,'src/components/Button.tsx','export const Button=()=>null;');
  evidenceFile(cwd,'.gitignore','.aledevos/state/\n');
  git(cwd,'add','.');git(cwd,'commit','-m','base');

  init(cwd,'AUTO-REUSE');
  run(cwd,'quality','plan','--change-class','bugfix','--risk','medium');
  canonicalPass(cwd);
  evidenceFile(cwd,'tests/regression.test.js','test("regression",()=>{});');
  evidenceFile(cwd,'.aledevos/state/tasks/AUTO-REUSE/regression-analysis.json','{}');
  evidenceFile(cwd,'.aledevos/state/tasks/AUTO-REUSE/diff-review.json','{}');
  evidenceFile(cwd,'src/components/NewButton.tsx','export const NewButton=()=>null;');

  run(cwd,'quality','evidence','--type','test','--ref','gate:canonical/tests','--source','tests/regression.test.js','--layer','unit','--coverage','regression','--regression','true');
  run(cwd,'quality','evidence','--type','regression-analysis','--ref','.aledevos/state/tasks/AUTO-REUSE/regression-analysis.json');
  run(cwd,'quality','evidence','--type','diff-review','--ref','.aledevos/state/tasks/AUTO-REUSE/diff-review.json');

  let q=run(cwd,'quality','verify');
  assert.equal(q.status,34);
  assert.match(q.stdout,/reuse-decision-autodetected/);
  assert.ok(q.stdout.includes('src/components/NewButton.tsx'));

  run(cwd,'quality','reuse','--decision','EXTEND','--target','component','--evidence','src/components/Button.tsx','--reason','Existing canonical component covers the abstraction boundary');
  q=run(cwd,'quality','verify');
  assert.equal(q.status,0,q.stdout+q.stderr);
});
