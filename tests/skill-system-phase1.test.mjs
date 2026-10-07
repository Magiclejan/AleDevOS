import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const distRoot=path.resolve('.');
const runtime=path.resolve('skillsystem/engine/skillsystem.mjs');
const run=(cwd,...a)=>spawnSync(process.execPath,[runtime,...a],{cwd,encoding:'utf8'});
const jsonOut=r=>JSON.parse(r.stdout);
function dir(){return fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-skills-p1-'))}
function copyDir(src,dst){fs.mkdirSync(dst,{recursive:true});fs.cpSync(src,dst,{recursive:true});}
function project(){
  const p=dir();
  copyDir(path.resolve('skillsystem/catalogs'),path.join(p,'.aledevos/skillsystem/catalogs'));
  copyDir(path.resolve('skillsystem/policies'),path.join(p,'.aledevos/skillsystem/policies'));
  copyDir(path.resolve('skillsystem/bindings'),path.join(p,'.aledevos/skillsystem/bindings'));
  copyDir(path.resolve('adapters/opencode/.opencode/skills'),path.join(p,'.opencode/skills'));
  return p;
}
function build(p){return run(p,'registry','build','--project-root',p,'--adapter','opencode')}

test('phase 1 registry guarantees remain metadata-only and on-demand as later phases are enabled',()=>{
  const p=JSON.parse(fs.readFileSync('skillsystem/policies/skill-policy.json','utf8'));
  assert.equal(p.default_context_loading,'on-demand');
  assert.equal(p.embed_instruction_bodies_in_registry,false);
  assert.equal(p.execution_lifecycle.engine_direct_execution,false);assert.equal(p.execution_lifecycle.adapter_executes,true);
});

test('core catalog contains the 13 existing AleDevOS core skills',()=>{
  const c=JSON.parse(fs.readFileSync('skillsystem/catalogs/core-skills.json','utf8'));
  assert.equal(c.skills.length,13);
  for(const id of ['task-contract','repo-map','implementation-plan','safe-edit','test-strategy','requirements-check','regression-analysis','diff-review','security-check','repair-loop','backend-change','frontend-change','database-change']) assert.ok(c.skills.some(x=>x.id===id),id);
});

test('external seed contains declared existing UX/motion/mobile skills without invented instructions',()=>{
  const c=JSON.parse(fs.readFileSync('skillsystem/catalogs/external-existing-skills.seed.json','utf8'));
  assert.equal(c.skills.length,18);
  for(const id of ['animate','design-system','frontend-design','ui-ux-pro-max','mobile-native','write-swift']){
    const s=c.skills.find(x=>x.id===id);assert.ok(s,id);assert.equal(s.instruction_ref,null);assert.equal(s.instruction_sha256,null);assert.equal(s.declared_status,'DECLARED_UNRESOLVED');
  }
});

test('OpenCode binding covers every bundled core skill exactly once',()=>{
  const c=JSON.parse(fs.readFileSync('skillsystem/catalogs/core-skills.json','utf8'));
  const b=JSON.parse(fs.readFileSync('skillsystem/bindings/opencode.json','utf8'));
  assert.equal(b.bindings.length,c.skills.length);assert.equal(new Set(b.bindings.map(x=>x.skill_id)).size,b.bindings.length);
  for(const s of c.skills) assert.ok(b.bindings.some(x=>x.skill_id===s.id),s.id);
});

test('OpenCode binding hashes match the actual adapter skill files in the master distribution',()=>{
  const b=JSON.parse(fs.readFileSync('skillsystem/bindings/opencode.json','utf8'));
  for(const x of b.bindings){const p=path.resolve('adapters/opencode',x.path.replace(/^\.opencode\//,'.opencode/'));assert.ok(fs.existsSync(p),x.skill_id);const h=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');assert.equal(h,x.expected_sha256,x.skill_id)}
});

test('registry build creates 31 metadata records but only 13 usable skills',()=>{
  const p=project(),r=build(p);assert.equal(r.status,0,r.stderr+r.stdout);const o=jsonOut(r);assert.equal(o.summary.total,31);assert.equal(o.summary.usable,13);assert.equal(o.summary.unresolved,18);
});

test('registry never embeds skill instruction bodies',()=>{
  const p=project();assert.equal(build(p).status,0);const raw=fs.readFileSync(path.join(p,'.aledevos/skills/registry.json'),'utf8');assert.doesNotMatch(raw,/# Task Contract/);assert.doesNotMatch(raw,/Produce:\s*- Objective/);
});

test('registry verify succeeds on an intact build',()=>{
  const p=project();assert.equal(build(p).status,0);const r=run(p,'registry','verify','--project-root',p);assert.equal(r.status,0,r.stderr+r.stdout);assert.equal(jsonOut(r).valid,true);
});

test('registry integrity tampering is detected',()=>{
  const p=project();assert.equal(build(p).status,0);const rp=path.join(p,'.aledevos/skills/registry.json');const r=JSON.parse(fs.readFileSync(rp,'utf8'));r.skills[0].domain='tampered';fs.writeFileSync(rp,JSON.stringify(r,null,2));const v=run(p,'registry','verify','--project-root',p);assert.notEqual(v.status,0);assert.equal(jsonOut(v).valid,false);assert.ok(jsonOut(v).errors.includes('registry_integrity_mismatch'));
});

test('runtime binding drift fails closed for bundled skills',()=>{
  const p=project();fs.appendFileSync(path.join(p,'.opencode/skills/task-contract/SKILL.md'),'\n# drift\n');const r=build(p);assert.notEqual(r.status,0);assert.match(r.stderr,/SKILL_BINDING_VALIDATION_FAILED/);assert.match(r.stderr,/task-contract:BINDING_DRIFT/);
});

test('missing bundled runtime binding fails closed',()=>{
  const p=project();fs.rmSync(path.join(p,'.opencode/skills/task-contract/SKILL.md'));const r=build(p);assert.notEqual(r.status,0);assert.match(r.stderr,/task-contract:MISSING_BINDING/);
});

test('duplicate logical skill IDs fail closed across catalogs',()=>{
  const p=project();const extra={schema_version:'1.0',catalog_id:'dup',catalog_version:'1',skills:[JSON.parse(fs.readFileSync(path.join(p,'.aledevos/skillsystem/catalogs/core-skills.json'),'utf8')).skills[0]]};fs.writeFileSync(path.join(p,'.aledevos/skillsystem/catalogs/dup.json'),JSON.stringify(extra));const r=build(p);assert.notEqual(r.status,0);assert.match(r.stderr,/DUPLICATE_SKILL_ID/);
});

test('usable-only listing excludes unresolved external declarations',()=>{
  const p=project();assert.equal(build(p).status,0);const r=run(p,'registry','list','--project-root',p,'--usable-only');assert.equal(r.status,0);const xs=jsonOut(r);assert.equal(xs.length,13);assert.ok(xs.every(x=>x.usable===true));assert.equal(xs.some(x=>x.id==='animate'),false);
});

test('capability filtering is metadata-only and deterministic',()=>{
  const p=project();assert.equal(build(p).status,0);const r=run(p,'registry','list','--project-root',p,'--capability','ux.motion');assert.equal(r.status,0);const xs=jsonOut(r);assert.ok(xs.length>=1);assert.ok(xs.every(x=>x.capabilities.includes('ux.motion')));assert.ok(xs.every(x=>x.usable===false));
});

test('doctor reports external declarations separately from blockers',()=>{
  const p=project();assert.equal(build(p).status,0);const r=run(p,'registry','doctor','--project-root',p);assert.equal(r.status,0,r.stderr+r.stdout);const o=jsonOut(r);assert.equal(o.status,'SKILL_REGISTRY_HEALTHY');assert.equal(o.summary.unresolved,18);assert.ok(o.unresolved.includes('design-system'));
});

test('phase 1 still forbids direct engine invocation of runtime-specific skills',()=>{const p=JSON.parse(fs.readFileSync('skillsystem/policies/skill-policy.json','utf8'));assert.equal(p.execution_lifecycle.engine_direct_execution,false);});

test('installer packages the Skill System runtime and builds/verifies the registry after adapter skills are copied',()=>{
  const s=fs.readFileSync('scripts/05-install-into-project.ps1','utf8');assert.match(s,/Skill System Phase 4/);assert.match(s,/skillsystem\.mjs/);assert.match(s,/registry build/);assert.match(s,/registry verify/);assert.match(s,/Join-Path \$ale 'skills'/);
});

test('registry schemas and catalog JSON all parse cleanly',()=>{
  for(const d of ['skillsystem/schemas','skillsystem/catalogs','skillsystem/policies','skillsystem/bindings'])for(const f of fs.readdirSync(d).filter(x=>x.endsWith('.json')))assert.doesNotThrow(()=>JSON.parse(fs.readFileSync(path.join(d,f),'utf8')),`${d}/${f}`);
});
