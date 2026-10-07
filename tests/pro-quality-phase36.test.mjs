import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {auditP36} from '../certification/pro/engine/pro-quality-audit.mjs';

const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const write=(root,rel,s)=>{const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s);return f};
const policy=JSON.parse(fs.readFileSync('certification/pro/policies/p36-quality.json','utf8'));
const sections=policy.skill_required_sections.map(x=>'## '+({
  use_when:'When to use',do_not_use:'Do not use',inputs:'Inputs',outputs:'Outputs',
  procedure:'Procedure',decisions:'Decisions',permissions:'Permissions',
  failure_modes:'Failures',verification:'Verification',evidence:'Evidence',examples:'Examples'
}[x.id])+'\nExample meaningful contract.\n').join('\n');
const body='---\nname: task-contract\ndescription: Define a bounded and testable work contract.\n---\n\n# Task contract\n\n'+sections;
function fixture(content=body){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-pro-p36-'));
  const p={...policy,scope:{bundled_skills:['task-contract'],agent_roots:['core/agents','adapters/opencode/.opencode/agents']}};
  const rel='adapters/opencode/.opencode/skills/task-contract/SKILL.md';
  write(root,rel,content);
  write(root,'core/agents/architect.md','## Skill System Phase 4\n## ContextOS Phase 5\n## ContextOS Phase 6\n');
  write(root,'adapters/opencode/.opencode/agents/architect.md','---\npermissions:\n  - action: edit\n    resource: "*"\n    effect: deny\n---\n## Skill System Phase 4\n');
  write(root,'skillsystem/bindings/opencode.json',JSON.stringify({schema_version:'1.0',adapter:'opencode',bindings:[{
    skill_id:'task-contract',path:'.opencode/skills/task-contract/SKILL.md',expected_sha256:hash(content)
  }]}));
  return {root,p};
}

test('current 13 bundled Skills are honestly inventoried without issuing PRO certification',()=>{
  const r=auditP36();
  assert.equal(r.summary.bundled_skills,13);
  assert.ok(r.summary.agents_inventoried>=40);
  assert.equal(r.summary.pro_certified,0);
  assert.equal(r.status,'P36_NEEDS_WORK');
  assert.ok(r.skills.some(s=>s.status==='NEEDS_PRO_EXPANSION'));
  assert.ok(r.skills.every(s=>s.certification==='NOT_CERTIFIED'));
});

test('a complete-looking Skill is only a DOCUMENTATION_CANDIDATE, not certified',()=>{
  const {root,p}=fixture();
  const r=auditP36(root,p);
  assert.equal(r.skills[0].status,'DOCUMENTATION_CANDIDATE');
  assert.equal(r.skills[0].certification,'NOT_CERTIFIED');
  assert.equal(r.agents.length,2);
});

test('three-line stub and generic description are rejected with actionable findings',()=>{
  const short='---\nname: task-contract\ndescription: do it\n---\n# task\nDo good work.\n';
  const {root,p}=fixture(short);
  const result=auditP36(root,p).skills[0];
  assert.equal(result.status,'NEEDS_PRO_EXPANSION');
  assert.ok(result.missing_sections.includes('procedure'));
  assert.ok(result.problem_codes.includes('DESCRIPTION_UNSPECIFIED'));
});

test('binding drift is blocked even if the Skill has all headings',()=>{
  const {root,p}=fixture();
  fs.appendFileSync(path.join(root,'adapters/opencode/.opencode/skills/task-contract/SKILL.md'),'\nMalicious drift');
  assert.equal(auditP36(root,p).skills[0].status,'BINDING_DRIFT');
});

test('missing agent root fails closed and no false full-coverage report is returned',()=>{
  const {root,p}=fixture();
  fs.rmSync(path.join(root,'core/agents'),{recursive:true,force:true});
  assert.throws(()=>auditP36(root,p),/P36_AGENT_ROOT_MISSING/);
});
