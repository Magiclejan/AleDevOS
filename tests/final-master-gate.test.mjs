import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assessFreezePreconditions } from '../release/templates/final-master-gate.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..');
const release=path.join(root,'release/engine/v1-release.mjs');
const finalizer=path.join(root,'release/templates/final-master-gate.mjs');
const certifier=path.join(root,'release/templates/final-master-gate-certifier.mjs');
const policy=JSON.parse(fs.readFileSync(path.join(root,'release/policies/v1-release-policy.json'),'utf8'));
const ids=policy.master_validation.checks.map(x=>x.id);

const finalCampaignScripts=[
  '53-master-validation-p2-target-adapters.ps1',
  '55-master-validation-p3-target-multimodel.ps1',
  '57-master-validation-p4-target-visual.ps1',
  '59-master-validation-p5-target-advanced-execution.ps1',
  '61-master-validation-p6-target-full-stack.ps1',
  '63-master-validation-p7-target-efficiency.ps1',
  '65-master-validation-p8-target-security-reliability.ps1',
  '67-final-master-gate.ps1'
];
function run(file,args=[]){const r=spawnSync(process.execPath,[file,...args],{cwd:root,encoding:'utf8',windowsHide:true,shell:false});let q=null;try{q=JSON.parse(r.stdout||'{}')}catch{}return{...r,q}}
function h(s){return crypto.createHash('sha256').update(String(s)).digest('hex')}
function readyReport(){return{phase:'ALEDEVOS_V1_MASTER_VALIDATION_GATE',status:'V1_RELEASE_READY',summary:{total:33,passed:33,blocked:0,failed:0},required_checks:ids.map((id,i)=>({id,status:'PASS',evidence_sha256:id==='package_certifications_current'?null:h(`${id}:${i}`)})),legacy_gate_authorizes_v1_freeze:false}}

test('final package version is v1.51',()=>assert.equal(fs.readFileSync(path.join(root,'VERSION.txt'),'utf8').trim(),'1.51.0-final-master-gate'));
test('final policy keeps exactly 33 checks',()=>assert.equal(policy.master_validation.checks.length,33));
test('final policy phase is FINAL gate',()=>assert.equal(policy.master_validation.phase,'MASTER_VALIDATION_FINAL_GATE'));
test('final policy remains fail closed',()=>assert.equal(policy.master_validation.fail_closed,true));
test('final policy permits no deferred PASS',()=>assert.equal(policy.master_validation.allow_pass_for_deferred_validator,false));
test('all master check ids remain unique',()=>assert.equal(new Set(ids).size,33));
test('P8 assurance remains final dependency check',()=>assert.ok(ids.includes('security_reliability_assurance_real')));
test('successful freeze preconditions require 33/33',()=>assert.equal(assessFreezePreconditions(readyReport(),ids).ok,true));
test('blocked master report cannot freeze',()=>{const q=readyReport();q.status='V1_RELEASE_BLOCKED';q.summary.blocked=1;q.summary.passed=32;q.required_checks[2].status='MISSING';assert.equal(assessFreezePreconditions(q,ids).ok,false)});
test('failed master report cannot freeze',()=>{const q=readyReport();q.status='V1_RELEASE_FAILED';q.summary.failed=1;q.summary.passed=32;q.required_checks[3].status='FAIL';assert.equal(assessFreezePreconditions(q,ids).ok,false)});
test('32 of 33 cannot freeze',()=>{const q=readyReport();q.summary.passed=32;assert.ok(assessFreezePreconditions(q,ids).errors.includes('summary_passed_not_33'))});
test('duplicate check id cannot freeze',()=>{const q=readyReport();q.required_checks[2].id=q.required_checks[1].id;assert.ok(assessFreezePreconditions(q,ids).errors.includes('duplicate_check_id'))});
test('missing evidence hash cannot freeze',()=>{const q=readyReport();q.required_checks[5].evidence_sha256=null;assert.ok(assessFreezePreconditions(q,ids).errors.some(x=>x.startsWith('evidence_sha_missing:')))});
test('legacy gate can never gain freeze authority',()=>{const q=readyReport();q.legacy_gate_authorizes_v1_freeze=true;assert.ok(assessFreezePreconditions(q,ids).errors.includes('legacy_gate_freeze_authority_invalid'))});
test('check-set drift cannot freeze',()=>{const q=readyReport();q.required_checks[4].id='invented-check';assert.ok(assessFreezePreconditions(q,ids).errors.includes('check_set_drift'))});
test('final inventory is fail-closed without target evidence',()=>{const r=run(finalizer,['inventory','--root',root]);assert.equal(r.status,0,r.stderr);assert.equal(r.q.status,'FINAL_MASTER_GATE_NOT_READY');assert.notEqual(r.q.master_status,'V1_RELEASE_READY')});
test('master matrix remains ready at package level',()=>{const r=run(release,['master','matrix','--project-root',root]);assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(r.q.check_count,33);assert.equal(r.q.status,'MASTER_VALIDATION_MATRIX_READY')});
test('clean package master gate stays BLOCKED without target proof',()=>{const r=run(release,['master-gate','evaluate','--project-root',root]);assert.equal(r.status,4,r.stdout+r.stderr);assert.equal(r.q.status,'V1_RELEASE_BLOCKED');assert.equal(r.q.summary.total,33)});
test('freeze issue rejects missing master report',()=>{const p=path.join(os.tmpdir(),`missing-${Date.now()}.json`),r=run(finalizer,['freeze','issue','--root',root,'--report',p]);assert.equal(r.status,4);assert.equal(r.q.status,'FINAL_MASTER_GATE_BLOCKED')});
test('freeze issue rejects current BLOCKED report',()=>{const d=fs.mkdtempSync(path.join(root,'.aledev-final-')),rp=path.join(d,'report.json');const g=run(release,['master-gate','evaluate','--project-root',root,'--out',rp]);assert.equal(g.status,4);const r=run(finalizer,['freeze','issue','--root',root,'--report',rp]);assert.equal(r.status,4);assert.match(r.q.error,/not_ready|freeze_preconditions|master_report/);fs.rmSync(d,{recursive:true,force:true})});
test('rehashed synthetic READY report is not trusted',()=>{const d=fs.mkdtempSync(path.join(root,'.aledevos-final-test-')),rp=path.join(d,'fake.json');const q=readyReport();q.schema_version='1.0';q.package_version='1.51.0-final-master-gate';q.master_policy_sha256='a'.repeat(64);q.package_baseline_sha256='b'.repeat(64);q.groups={};q.non_claims={};q.created_at=new Date().toISOString();q.master_report_sha256='c'.repeat(64);fs.writeFileSync(rp,JSON.stringify(q));const r=run(finalizer,['freeze','issue','--root',root,'--report',rp]);assert.equal(r.status,4);fs.rmSync(d,{recursive:true,force:true})});
test('freeze certificate schema is present',()=>assert.ok(fs.existsSync(path.join(root,'release/schemas/v1-freeze-certificate.schema.json'))));
test('final campaign schema is present',()=>assert.ok(fs.existsSync(path.join(root,'release/schemas/final-master-campaign.schema.json'))));
test('campaign example has final phase contract',()=>{const q=JSON.parse(fs.readFileSync(path.join(root,'release/templates/FINAL_MASTER_CAMPAIGN.example.json'),'utf8'));assert.equal(q.phase,'ALEDEVOS_V1_FINAL_MASTER_CAMPAIGN')});
test('campaign runner references every target phase P2 through P8',()=>{const s=fs.readFileSync(path.join(root,'scripts/67-final-master-gate.ps1'),'utf8');for(const n of ['53-master-validation-p2','55-master-validation-p3','57-master-validation-p4','59-master-validation-p5','61-master-validation-p6','63-master-validation-p7','65-master-validation-p8'])assert.ok(s.includes(n),n)});
test('campaign runner only freezes after master gate ready path',()=>{const s=fs.readFileSync(path.join(root,'scripts/67-final-master-gate.ps1'),'utf8');assert.ok(s.indexOf('master-gate evaluate')<s.indexOf('freeze issue'))});
test('finalizer executes child processes without shell',()=>{const s=fs.readFileSync(finalizer,'utf8');assert.ok(s.includes('shell:false'))});
test('freeze certificate explicitly refuses perfect-security claim',()=>{const s=fs.readFileSync(finalizer,'utf8');assert.ok(s.includes('perfect_security_claimed:false'))});
test('final package certifier chains to P8',()=>{const s=fs.readFileSync(certifier,'utf8');assert.ok(s.includes('master-validation-p8'));assert.ok(s.includes('p8_certificate_valid'))});
test('final package certification does not claim target proof',()=>{const r=run(certifier,['certify','run','--root',root]);assert.equal(r.q.target_runtime_evidence,'REQUIRED_FOR_FREEZE');assert.equal(r.q.claims.freeze_requires_33_of_33_pass,true)});

test('Windows campaign scripts avoid Path.GetRelativePath for PowerShell 5.1 compatibility',()=>{
  for(const name of finalCampaignScripts){
    const src=fs.readFileSync(path.join(root,'scripts',name),'utf8');
    assert.equal(src.includes('[IO.Path]::GetRelativePath'),false,name);
  }
});
test('Windows campaign scripts carry the descendant-only relative-path compatibility helper',()=>{
  for(const name of finalCampaignScripts){
    const src=fs.readFileSync(path.join(root,'scripts',name),'utf8');
    assert.ok(src.includes('function Get-AleDevRelativePath'),name);
    assert.ok(src.includes('ALEDEVOS_PATH_OUTSIDE_ROOT'),name);
  }
});
test('runtime launcher explicitly uses Windows PowerShell with process-local ExecutionPolicy bypass',()=>{
  const src=fs.readFileSync(path.join(root,'2_COMPROBAR_RUNTIMES.bat'),'utf8');
  assert.match(src,/powershell\.exe\s+-NoLogo\s+-NoProfile\s+-ExecutionPolicy\s+Bypass/i);
});

