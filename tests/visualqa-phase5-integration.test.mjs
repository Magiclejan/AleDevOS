import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const json=p=>JSON.parse(read(p));

test('installer deploys Phase 5 runtime, state roots and v1.26 marker',()=>{
  const s=read('scripts/05-install-into-project.ps1');
  assert.match(s,/visualqa\\engine\\visual-judge\.mjs/);
  for(const x of ['packets','submissions','judgments','repairs','cycles','acceptance']) assert.match(s,new RegExp(`visualqa\\\\phase5\\\\${x}`));
  assert.match(s,/v1\.26 VisualQA-P5/);
});

test('Visual Judge is product-read-only and native-image only',()=>{
  const s=read('adapters/opencode/.opencode/agents/visual-judge.md');
  assert.match(s,/resource: "\*"\n\s+effect: deny/);
  assert.match(s,/phase5\/submissions\/\*\*/);
  assert.match(s,/native image input/i);
  assert.match(s,/UNVERIFIED/);
  assert.doesNotMatch(s,/repair authorize \*/);
  assert.doesNotMatch(s,/acceptance seal \*/);
});

test('Visual Repair Controller cannot edit or judge and owns bounded cycle commands',()=>{
  const s=read('adapters/opencode/.opencode/agents/visual-repair-controller.md');
  assert.match(s,/action: edit[\s\S]*?resource: "\*"[\s\S]*?effect: deny/);
  for(const cmd of ['repair authorize','repair verify','cycle finalize','cycle verify','acceptance seal','acceptance verify']) assert.match(s,new RegExp(cmd.replace(' ','\\s')));
  assert.match(s,/There is no third repair/);
  assert.match(s,/Baseline promotion.*forbidden/i);
});

test('Orchestrator delegates Phase 5 roles and mandates fresh P2 through P5 after repair',()=>{
  const s=read('adapters/opencode/.opencode/agents/orchestrator.md');
  assert.match(s,/resource: "visual-judge"/);
  assert.match(s,/resource: "visual-repair-controller"/);
  assert.match(s,/new evidence revision/);
  assert.match(s,/fresh P2 → P3 → P4 → P5/);
  assert.match(s,/never invoke a third repair/i);
  assert.match(s,/Never auto-promote a baseline/i);
});

test('Repairer is constrained to authorized findings and cannot mutate Visual QA control plane',()=>{
  const s=read('adapters/opencode/.opencode/agents/repairer.md');
  assert.match(s,/Visual QA Phase 5/i);
  assert.match(s,/repair verify/);
  assert.match(s,/concrete findings|approved scope/i);
  assert.match(s,/baseline/i);
  assert.match(s,/fresh P2/i);
});

test('Core Phase 5 contract pins native image, fresh evidence and max two repairs',()=>{
  const s=read('core/design/contracts/VISUAL_QA_JUDGE_REPAIR.md');
  assert.match(s,/NATIVE_IMAGE/);
  assert.match(s,/max_repairs=2|two-repair/i);
  assert.match(s,/fresh.*P2.*P3.*P4.*P5/is);
  assert.match(s,/baseline promotion/i);
  assert.match(s,/motion/i);
  assert.match(s,/WCAG/i);
});

test('Phase 5 schemas and adapter capabilities are registered',()=>{
  for(const f of ['visual-judge-packet','visual-judgment-submission','visual-judgment-report','visual-repair-plan','visual-repair-cycle','visual-qa-acceptance']) assert.doesNotThrow(()=>json(`visualqa/schemas/${f}.schema.json`));
  const c=json('adapters/opencode/adapter-capabilities.json').capabilities;
  assert.equal(c.visual_qa_judge.status,'implemented');
  assert.equal(c.visual_qa_bounded_repair.status,'implemented');
});

test('release metadata closes static P1-P5 while keeping runtime smoke and nonclaims explicit',()=>{
  const vnum=read('VERSION.txt').trim().match(/^(\d+)\.(\d+)\./);
  assert.ok(vnum && Number(vnum[1])===1 && Number(vnum[2])>=26,'Phase 5 must remain frozen in v1.26+ releases');
  const r=read('README.md'),n=read('docs/NEXT_VALIDATION.md'),v=read('docs/VISUALQA_PHASE5_VALIDATION.md');
  assert.match(r,/Phase 5.*COMPLETE|Phase 5.*FROZEN/is);
  assert.match(n,/Playwright.*Chromium/i);
  assert.match(n,/native-image/i);
  assert.match(v,/motion/i);
  assert.match(v,/full WCAG/i);
});
