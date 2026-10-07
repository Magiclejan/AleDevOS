import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {auditAgents} from '../certification/pro/engine/pro-agent-audit.mjs';
import {loadFlow,validateHandoff} from '../certification/pro/engine/pro-handoff-check.mjs';
const policy=JSON.parse(fs.readFileSync('certification/pro/roles/p36-2-role-contracts.json','utf8'));
const workflow=loadFlow();
const toCopy=['core/agents','adapters/opencode/.opencode/agents','adapters/codex/.codex/agents','adapters/claude-code/.claude/agents','adapters/antigravity/.agents/agents'];
const fixtures=[];
function project(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-pro-agents-'));fixtures.push(root);
 for(const dir of toCopy){const target=path.join(root,dir);fs.mkdirSync(path.dirname(target),{recursive:true});fs.cpSync(dir,target,{recursive:true})}
 return root;
}
afterEach(()=>{for(const root of fixtures.splice(0))fs.rmSync(root,{recursive:true,force:true})});

test('P36.2 contracts span exactly 25 specialist roles and 22 canonical Core roles',()=>{
 assert.equal(policy.roles.length,25);
 assert.equal(policy.expected_core_role_ids.length,22);
 assert.deepEqual(policy.expected_adapters,['opencode','codex','claude-code','antigravity']);
 assert.equal(new Set(policy.roles.map(x=>x.id)).size,25);
 const q=auditAgents();
 assert.equal(q.summary.expected_roles,25);
 assert.equal(q.summary.projected_role_files,122);
 assert.equal(q.summary.adapter_roles,100);
 assert.equal(q.summary.invalid_contracts,0,JSON.stringify(q.role_contract_findings));
 assert.equal(q.summary.pro_certified,0);
 assert.equal(q.summary.role_files_blocked,0,JSON.stringify(q.role_sources.filter(x=>x.issues.length)));
 assert.equal(q.status,'STRUCTURAL_CANDIDATE');
 assert.ok(q.role_sources.every(x=>x.source_sha256?.length===64&&x.certification==='NOT_CERTIFIED'));
});
test('all roles define individual inputs, outputs, decisions, responsibilities and negative boundaries',()=>{
 for(const r of policy.roles){
  for(const k of ['objective','trigger','non_trigger','prohibition','handoff','examples'])assert.ok(r[k].length>=20,r.id+':'+k);
  assert.ok(r.inputs.length>=3&&r.outputs.length>=3&&r.procedure.length>=4&&r.decisions.length>=2,r.id);
 }
 assert.ok(policy.roles.find(x=>x.id==='orchestrator').procedure.some(s=>/independent judges/i.test(s)));
 assert.ok(policy.roles.find(x=>x.id==='visual-judge').procedure.some(s=>/pixels|image/i.test(s)));
 assert.ok(policy.roles.find(x=>x.id==='repairer').procedure.some(s=>/two-repair/i.test(s)));
});
test('source audit reports deficient role documentation rather than claiming PRO_CERTIFIED',()=>{
 const q=auditAgents();
 assert.ok(['STRUCTURAL_CANDIDATE','STRUCTURAL_BLOCKED'].includes(q.status));
 assert.ok(q.role_sources.some(x=>x.adapter==='core'&&x.id==='security-reviewer'));
 assert.ok(q.role_sources.every(x=>x.status!=='PRO_CERTIFIED'));
 assert.ok(q.nonclaims.some(x=>/not automatically replaced/i.test(x)));
});
test('one unexpected read-only edit grant is detected even if markdown describes a safe judge',()=>{
 const root=project();
 const p=path.join(root,'adapters/opencode/.opencode/agents/judge-requirements.md');
 const s=fs.readFileSync(p,'utf8');
 assert.match(s,/- action: edit\s+resource: "\*"\s+effect: deny/);
 fs.writeFileSync(p,s.replace(/(- action: edit\s+resource: "\*"\s+effect:) deny/,'$1 allow'));
 const q=auditAgents(root,policy);
 assert.ok(q.role_sources.find(x=>x.adapter==='opencode'&&x.id==='judge-requirements').issues.some(x=>/UNAUTHORIZED_EDIT_ALLOW:\*/.test(x)));
});
test('missing projected agent is BLOCKED and changes coverage accounting',()=>{
 const root=project();
 fs.rmSync(path.join(root,'adapters/opencode/.opencode/agents/visual-judge.md'));
 const q=auditAgents(root,policy);
 assert.ok(q.role_sources.find(x=>x.adapter==='opencode'&&x.id==='visual-judge').issues.includes('ROLE_FILE_MISSING'));
 assert.ok(q.role_contract_findings.some(x=>x.code==='ROLE_SET_MISMATCH'));
});
test('a fake pre-certified role contract is rejected even if the role files exist',()=>{
 const altered=structuredClone(policy);
 altered.roles[0].operational_certification='PRO_CERTIFIED';
 const q=auditAgents(process.cwd(),altered);
 assert.ok(q.role_contract_findings.some(x=>x.code==='PREMATURE_CERTIFICATION'));
 assert.equal(q.summary.pro_certified,0);
});
test('orchestrator handoffs require the right owner and previously verified stage',()=>{
 const valid=validateHandoff(workflow,{from:'INTAKE',to:'TASK_CONTRACT',actor:'orchestrator',completed_stages:['INTAKE']});
 assert.equal(valid.allowed,true);
 assert.equal(valid.authority,'STATIC_ONLY_NOT_EXECUTION_PERMISSION');
 const writerAsJudge=validateHandoff(workflow,{from:'VERIFY',to:'JUDGE_REQUIREMENTS',actor:'builder',completed_stages:['VERIFY']});
 assert.equal(writerAsJudge.allowed,false);
 assert.ok(writerAsJudge.errors.includes('ROLE_OWNERSHIP_DENIED'));
 const skip=validateHandoff(workflow,{from:'INTAKE',to:'FINALIZE',actor:'orchestrator',completed_stages:['INTAKE']});
 assert.equal(skip.allowed,false);
 assert.ok(skip.errors.some(x=>x.startsWith('RELEASE_GATE_STAGE_MISSING:')));
});
test('visual P5 is blocked without fresh chain, native-image capability and actual Visual Judge role',()=>{
 const textOnly=validateHandoff(workflow,{from:'VERIFY',to:'JUDGE_QUALITY',actor:'judge-quality',completed_stages:['JUDGE_REGRESSION'],
  visual_stage:'P5',native_image_capable:false,visual_actor:'visual-judge',fresh_visual_phases:['P2','P3','P4']});
 assert.ok(textOnly.errors.includes('NATIVE_IMAGE_CAPABILITY_REQUIRED'));
 const stale=validateHandoff(workflow,{from:'VERIFY',to:'JUDGE_QUALITY',actor:'judge-quality',completed_stages:['JUDGE_REGRESSION'],
  visual_stage:'P5',native_image_capable:true,visual_actor:'visual-judge',fresh_visual_phases:['P2']});
 assert.ok(stale.errors.includes('VISUAL_EVIDENCE_MISSING:P3'));
 assert.ok(stale.errors.includes('VISUAL_EVIDENCE_MISSING:P4'));
});
test('a third repair, missing finding or judge-as-repair are all denied',()=>{
 const third=validateHandoff(workflow,{from:'ROUTING',to:'WRITER',actor:'repairer',completed_stages:['ROUTING'],repair_cycle:3,failed_finding_id:'F-1'});
 assert.ok(third.errors.includes('REPAIR_CYCLE_EXHAUSTED_OR_INVALID'));
 const fake=validateHandoff(workflow,{from:'ROUTING',to:'WRITER',actor:'judge-quality',completed_stages:['ROUTING'],repair_cycle:1});
 assert.ok(fake.errors.includes('REPAIR_WRITER_ROLE_REQUIRED'));
 assert.ok(fake.errors.includes('FAILED_FINDING_REQUIRED'));
});

test('missing required governance marker is detected without changing role authority',()=>{
 const root=project();
 const p=path.join(root,'core/agents/verifier.md');
 const s=fs.readFileSync(p,'utf8');
 assert.match(s,/## Skill System Phase 4/);
 fs.writeFileSync(p,s.replace('## Skill System Phase 4','## Missing policy marker'));
 const q=auditAgents(root,policy);
 assert.ok(q.role_sources.find(x=>x.adapter==='core'&&x.id==='verifier').issues.includes('REQUIRED_PHASE_DISCIPLINE_MISSING:governance'));
 assert.equal(q.summary.pro_certified,0);
});
