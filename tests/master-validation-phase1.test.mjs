import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const sourceRoot=path.resolve('.');
const sourceEngine=path.resolve('release/engine/v1-release.mjs');
const sourcePolicy=path.resolve('release/policies/v1-release-policy.json');
const sourceBaseline=path.resolve('release/templates/master-validation-package-baseline.json');
const sourceVersion=fs.readFileSync(path.join(sourceRoot,'VERSION.txt'),'utf8').trim();
const sourceTreeManifest=path.resolve('release/templates/package-tree-manifest.mjs');
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-master-p1-'));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n','utf8');return p};
const cp=(a,b)=>{fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(a,b)};
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())if(!['master_evidence_sha256','master_report_sha256','baseline_sha256'].includes(k))o[k]=stable(v[k]);return o}return v}
const sha=v=>crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const fileSha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function sealBaseline(b){b.baseline_sha256='';b.baseline_sha256=sha(b);return b}
function run(engine,root,args){return spawnSync(process.execPath,[engine,...args,'--project-root',root],{cwd:root,encoding:'utf8'})}
function out(r){return JSON.parse(r.stdout||'{}')}
function installedFixture(){
  const root=tmp();
  const rel=path.join(root,'.aledevos','release');
  cp(sourceEngine,path.join(rel,'runtime','v1-release.mjs'));
  cp(sourcePolicy,path.join(rel,'policies','v1-release-policy.json'));
  cp(sourceBaseline,path.join(rel,'templates','master-validation-package-baseline.json'));
  write(path.join(rel,'VERSION.txt'),sourceVersion+'\n');
  return {root,engine:path.join(rel,'runtime','v1-release.mjs'),rel};
}
function miniSourcePackage(){
  const root=tmp();
  cp(sourceEngine,path.join(root,'release','engine','v1-release.mjs'));
  cp(sourcePolicy,path.join(root,'release','policies','v1-release-policy.json'));
  write(path.join(root,'VERSION.txt'),'1.51.0-final-master-gate\n');
  fs.mkdirSync(path.join(root,'adapters'),{recursive:true});
  const input=write(path.join(root,'component.txt'),'stable\n');
  const cert={schema_version:'1.0',status:'MINI_CERTIFIED',inputs:[{path:'component.txt',sha256:fileSha(input)}],evidence_sha256:'a'.repeat(64)};
  write(path.join(root,'release','certifications','mini.json'),cert);
  write(path.join(root,'uxui','engine','uxui.mjs'),'// stable runtime outside mini certificate inputs\n');
  cp(sourceTreeManifest,path.join(root,'release','templates','package-tree-manifest.mjs'));
  const treePath=path.join(root,'release','templates','package-tree-manifest.json');
  const tr=spawnSync(process.execPath,[path.join(root,'release','templates','package-tree-manifest.mjs'),'generate','--root',root,'--out',treePath],{cwd:root,encoding:'utf8'});assert.equal(tr.status,0,tr.stdout+tr.stderr);
  const baseline=sealBaseline({schema_version:'1.0',phase:'MASTER_VALIDATION_P1_PACKAGE_BASELINE',package_version:'1.51.0-final-master-gate',deterministic_inventory:{tests_passed:1912,mjs_syntax_passed:119,json_parse_passed:265,toml_parse_passed:26,failures:0},certificate_count:1,certificates:[{id:'mini',path:'release/certifications/mini.json',status:'MINI_CERTIFIED',evidence_sha256:'a'.repeat(64)}],package_tree_manifest_sha256:fileSha(treePath),source_attestation:'test',baseline_sha256:''});
  write(path.join(root,'release','templates','master-validation-package-baseline.json'),baseline);
  return {root,engine:path.join(root,'release','engine','v1-release.mjs')};
}
function evidenceInput(root,id,status='BLOCKED',artifacts=[]){return write(path.join(root,'input.json'),{schema_version:'1.0',check_id:id,status,target:{machine:'test'},artifacts,claims:{},notes:[]})}
function goodRegression(root,overrides={}){const q={tests_passed:1941,mjs_syntax_passed:119,json_parse_passed:265,toml_parse_passed:26,failures:0,...overrides};write(path.join(root,'regression.json'),q);return evidenceInput(root,'deterministic_regression_current','PASS',[{role:'regression_summary',path:'regression.json'}])}

test('master deterministic regression minimum matches the package baseline floor',()=>{const p=read(sourcePolicy).master_validation.minimums,b=read(sourceBaseline).deterministic_inventory;assert.equal(p.tests_passed,b.tests_passed);assert.equal(p.mjs_syntax_passed,b.mjs_syntax_passed);assert.equal(p.json_parse_passed,b.json_parse_passed);assert.equal(p.toml_parse_passed,b.toml_parse_passed);assert.equal(p.failures,b.failures)});
test('P1 master policy is valid and defines the current-stack matrix',()=>{const r=run(sourceEngine,sourceRoot,['master','policy']),o=out(r);assert.equal(r.status,0,r.stdout);assert.equal(o.status,'MASTER_VALIDATION_POLICY_VALID');assert.equal(o.check_count,33);assert.deepEqual(o.groups,['PACKAGE','ADAPTER_RUNTIME','MULTIMODEL','VISUAL_RUNTIME','ADVANCED_EXECUTION','RESILIENCE','SECURITY','END_TO_END','EFFICIENCY','SECURITY_RELIABILITY'])});
test('legacy eight-check gate is retained but cannot authorize final freeze',()=>{const q=read(sourcePolicy);assert.equal(q.required_checks.length,8);assert.equal(q.legacy_gate.retained,true);assert.equal(q.legacy_gate.authorizes_v1_freeze,false)});
test('master policy has unique check ids and acyclic declared dependencies',()=>{const q=read(sourcePolicy).master_validation;const ids=q.checks.map(x=>x.id);assert.equal(new Set(ids).size,ids.length);for(const c of q.checks)for(const d of c.depends_on)assert.ok(ids.includes(d))});
test('package certifications are the only automatic master check',()=>{const q=read(sourcePolicy).master_validation;assert.deepEqual(q.checks.filter(x=>x.automatic).map(x=>x.id),['package_certifications_current'])});
test('P1 built-in validators remain implemented as later phases extend the matrix',()=>{const r=run(sourceEngine,sourceRoot,['master','matrix']),o=out(r);assert.equal(r.status,0,r.stdout);for(const c of o.checks.filter(x=>x.validator_phase==='P1'))assert.equal(c.validator_implemented,true,c.id)});
test('source package baseline verifies all frozen package certificates',()=>{const r=run(sourceEngine,sourceRoot,['master','package']),o=out(r);assert.equal(r.status,0,r.stdout);assert.equal(o.status,'MASTER_PACKAGE_BASELINE_VALID');assert.equal(o.valid,true);assert.equal(o.source_mode,true);assert.equal(o.certificates.length,14);assert.ok(o.certificates.every(x=>x.status==='PASS'))});
test('master matrix is ready but target validators remain pending',()=>{const r=run(sourceEngine,sourceRoot,['master','matrix']),o=out(r);assert.equal(o.status,'MASTER_VALIDATION_MATRIX_READY');assert.equal(o.checks.find(x=>x.id==='package_certifications_current').status,'PASS');assert.equal(o.checks.find(x=>x.id==='opencode_runtime_security').status,'PENDING')});
test('fresh master gate is blocked, never ready, when target evidence is missing',()=>{const f=installedFixture(),r=run(f.engine,f.root,['master-gate','evaluate']),o=out(r);assert.equal(r.status,4,r.stdout);assert.equal(o.status,'V1_RELEASE_BLOCKED');assert.equal(o.summary.total,33);assert.equal(o.summary.passed,1);assert.equal(o.summary.blocked,32);assert.equal(o.legacy_gate_authorizes_v1_freeze,false)});
test('master gate report verifies when untouched',()=>{const f=installedFixture();let r=run(f.engine,f.root,['master-gate','evaluate']);const rp=path.join(f.root,out(r).path);r=run(f.engine,f.root,['master-gate','verify','--report',rp]);assert.equal(r.status,0,r.stdout);assert.equal(out(r).status,'MASTER_RELEASE_REPORT_VALID')});
test('master gate report tampering is detected',()=>{const f=installedFixture();let r=run(f.engine,f.root,['master-gate','evaluate']);const rp=path.join(f.root,out(r).path),q=read(rp);q.summary.total=999;write(rp,q);r=run(f.engine,f.root,['master-gate','verify','--report',rp]);assert.notEqual(r.status,0);assert.ok(out(r).errors.includes('report_integrity_mismatch'))});
test('unknown master evidence check is rejected',()=>{const f=installedFixture(),i=evidenceInput(f.root,'made_up','BLOCKED'),r=run(f.engine,f.root,['master-evidence','seal','--input',i]);assert.notEqual(r.status,0);assert.equal(out(r).status,'MASTER_EVIDENCE_CHECK_UNKNOWN')});
test('invalid master evidence status is rejected',()=>{const f=installedFixture(),i=evidenceInput(f.root,'opencode_runtime_security','MAYBE'),r=run(f.engine,f.root,['master-evidence','seal','--input',i]);assert.notEqual(r.status,0);assert.equal(out(r).status,'MASTER_EVIDENCE_STATUS_INVALID')});
test('master evidence rejects path traversal artifacts',()=>{const f=installedFixture(),i=evidenceInput(f.root,'opencode_runtime_security','BLOCKED',[{role:'x',path:'../escape'}]),r=run(f.engine,f.root,['master-evidence','seal','--input',i]);assert.notEqual(r.status,0);assert.equal(out(r).status,'MASTER_EVIDENCE_ARTIFACT_PATH_INVALID')});
test('master evidence rejects missing artifacts',()=>{const f=installedFixture(),i=evidenceInput(f.root,'opencode_runtime_security','BLOCKED',[{role:'x',path:'missing.txt'}]),r=run(f.engine,f.root,['master-evidence','seal','--input',i]);assert.notEqual(r.status,0);assert.equal(out(r).status,'MASTER_EVIDENCE_ARTIFACT_MISSING')});
test('BLOCKED evidence for a future validator can be sealed',()=>{const f=installedFixture(),i=evidenceInput(f.root,'opencode_runtime_security','BLOCKED'),r=run(f.engine,f.root,['master-evidence','seal','--input',i]);assert.equal(r.status,0,r.stdout);assert.equal(out(r).evidence.status,'BLOCKED')});
test('BLOCKED future evidence verifies',()=>{const f=installedFixture(),i=evidenceInput(f.root,'opencode_runtime_security','BLOCKED');let r=run(f.engine,f.root,['master-evidence','seal','--input',i]);const ep=path.join(f.root,out(r).path);r=run(f.engine,f.root,['master-evidence','verify','--evidence',ep]);assert.equal(r.status,0,r.stdout);assert.equal(out(r).status,'MASTER_EVIDENCE_VALID')});
for(const id of ['opencode_runtime_security','primary_secondary_models_real','playwright_chromium_real','worktree_worker_real','full_stack_real_project'])test(`PASS is impossible before validator exists in the P1 installed fixture: ${id}`,()=>{const f=installedFixture(),i=evidenceInput(f.root,id,'PASS'),r=run(f.engine,f.root,['master-evidence','seal','--input',i]);assert.notEqual(r.status,0);assert.equal(out(r).status,'MASTER_CHECK_VALIDATOR_NOT_IMPLEMENTED')});
test('deterministic regression exact current baseline can be sealed PASS',()=>{const f=installedFixture(),i=goodRegression(f.root),r=run(f.engine,f.root,['master-evidence','seal','--input',i]);assert.equal(r.status,0,r.stdout);assert.equal(out(r).evidence.validation.ok,true)});
for(const [name,over,err] of [['tests',{tests_passed:1925},'tests_passed_below_master_baseline'],['mjs',{mjs_syntax_passed:114},'mjs_syntax_passed_below_master_baseline'],['json',{json_parse_passed:259},'json_parse_passed_below_master_baseline'],['toml',{toml_parse_passed:25},'toml_parse_passed_below_master_baseline'],['failures',{failures:1},'regression_failures_nonzero']])test(`deterministic regression rejects ${name} baseline failure`,()=>{const f=installedFixture(),i=goodRegression(f.root,over),r=run(f.engine,f.root,['master-evidence','seal','--input',i]);assert.notEqual(r.status,0);assert.ok(out(r).errors.includes(err),r.stdout)});
test('sealed master evidence detects artifact drift',()=>{const f=installedFixture(),i=goodRegression(f.root);let r=run(f.engine,f.root,['master-evidence','seal','--input',i]);const ep=path.join(f.root,out(r).path);fs.appendFileSync(path.join(f.root,'regression.json'),' ');r=run(f.engine,f.root,['master-evidence','verify','--evidence',ep]);assert.notEqual(r.status,0);assert.ok(out(r).errors.includes('artifact_drift:regression_summary'))});
test('sealed master evidence detects self tampering',()=>{const f=installedFixture(),i=evidenceInput(f.root,'opencode_runtime_security','BLOCKED');let r=run(f.engine,f.root,['master-evidence','seal','--input',i]);const ep=path.join(f.root,out(r).path),q=read(ep);q.notes=['tamper'];write(ep,q);r=run(f.engine,f.root,['master-evidence','verify','--evidence',ep]);assert.notEqual(r.status,0);assert.ok(out(r).errors.includes('evidence_integrity_mismatch'))});
test('check contract drift is detected even if evidence body is otherwise intact',()=>{const f=installedFixture(),i=evidenceInput(f.root,'opencode_runtime_security','BLOCKED');let r=run(f.engine,f.root,['master-evidence','seal','--input',i]);const ep=path.join(f.root,out(r).path),q=read(ep);q.group='MULTIMODEL';q.master_evidence_sha256=sha(q);write(ep,q);r=run(f.engine,f.root,['master-evidence','verify','--evidence',ep]);assert.notEqual(r.status,0);assert.ok(out(r).errors.includes('check_contract_drift'))});
test('gate consumes a valid deterministic regression evidence but remains blocked on target proof',()=>{const f=installedFixture(),i=goodRegression(f.root);let r=run(f.engine,f.root,['master-evidence','seal','--input',i]);assert.equal(r.status,0,r.stdout);r=run(f.engine,f.root,['master-gate','evaluate']);const o=out(r);assert.equal(o.status,'V1_RELEASE_BLOCKED');assert.equal(o.required_checks.find(x=>x.id==='deterministic_regression_current').status,'PASS');assert.equal(o.summary.passed,2)});
test('BLOCKED target evidence remains BLOCKED in the master gate',()=>{const f=installedFixture(),i=evidenceInput(f.root,'opencode_runtime_security','BLOCKED');let r=run(f.engine,f.root,['master-evidence','seal','--input',i]);r=run(f.engine,f.root,['master-gate','evaluate']);assert.equal(out(r).required_checks.find(x=>x.id==='opencode_runtime_security').status,'BLOCKED')});
test('installed layout package baseline verifies without source certificates',()=>{const f=installedFixture(),r=run(f.engine,f.root,['master','package']),o=out(r);assert.equal(r.status,0,r.stdout);assert.equal(o.valid,true);assert.equal(o.source_mode,false)});
test('installed layout master matrix is usable',()=>{const f=installedFixture(),r=run(f.engine,f.root,['master','matrix']);assert.equal(r.status,0,r.stdout);assert.equal(out(r).status,'MASTER_VALIDATION_MATRIX_READY')});
test('installed baseline tampering is detected',()=>{const f=installedFixture(),bp=path.join(f.rel,'templates','master-validation-package-baseline.json'),q=read(bp);q.source_attestation='tampered';write(bp,q);const r=run(f.engine,f.root,['master','package']);assert.notEqual(r.status,0);assert.ok(out(r).errors.includes('baseline_integrity_mismatch'))});
test('installed baseline version mismatch is detected even with a valid re-seal',()=>{const f=installedFixture(),bp=path.join(f.rel,'templates','master-validation-package-baseline.json'),q=read(bp);q.package_version='9.9.9';q.baseline_sha256=sha(q);write(bp,q);const r=run(f.engine,f.root,['master','package']);assert.notEqual(r.status,0);assert.ok(out(r).errors.includes('baseline_package_version_mismatch'))});
test('source package tree integrity detects drift in an otherwise uncertified runtime file',()=>{const f=miniSourcePackage(),fp=path.join(f.root,'uxui','engine','uxui.mjs');fs.appendFileSync(fp,'// package-tree-drift-test\n');const r=run(f.engine,f.root,['master','package']),o=out(r);assert.notEqual(r.status,0);assert.ok(o.errors.includes('package_tree_sha256_drift')||o.errors.includes('package_tree_entries_drift'),r.stdout)});
test('source package detects certificate input drift',()=>{const f=miniSourcePackage();let r=run(f.engine,f.root,['master','package']);assert.equal(r.status,0,r.stdout);fs.writeFileSync(path.join(f.root,'component.txt'),'drift\n');r=run(f.engine,f.root,['master','package']);assert.notEqual(r.status,0);assert.ok(out(r).errors.some(x=>x.startsWith('certificate_input_drift:mini:')))});
test('source package detects certificate evidence drift against baseline',()=>{const f=miniSourcePackage(),cpth=path.join(f.root,'release','certifications','mini.json'),q=read(cpth);q.evidence_sha256='b'.repeat(64);write(cpth,q);const r=run(f.engine,f.root,['master','package']);assert.notEqual(r.status,0);assert.ok(out(r).errors.includes('certificate_evidence_drift:mini'))});
test('baseline certificate count mismatch is rejected',()=>{const f=installedFixture(),bp=path.join(f.rel,'templates','master-validation-package-baseline.json'),q=read(bp);q.certificate_count=999;q.baseline_sha256=sha(q);write(bp,q);const r=run(f.engine,f.root,['master','package']);assert.notEqual(r.status,0);assert.ok(out(r).errors.includes('certificate_count_mismatch'))});
test('master non-claims keep package promises bounded',()=>{const q=read(sourcePolicy).master_validation.non_claims;assert.equal(q.semantic_model_independence,true);assert.equal(q.physical_exactly_once_compute_under_partition,true);assert.equal(q.full_wcag_conformance,true);assert.equal(q.dynamic_motion_frame_quality,true)});
test('end-to-end check cannot pass before its declared dependency chain',()=>{const q=read(sourcePolicy).master_validation.checks.find(x=>x.id==='full_stack_real_project');assert.ok(q.depends_on.includes('cross_adapter_target_security'));assert.ok(q.depends_on.includes('model_fallback_real'));assert.ok(q.depends_on.includes('visual_repair_exhaustion_real'));assert.ok(q.depends_on.includes('crash_recovery_real'))});
test('validator extension discovery is forward-compatible as later modules arrive',()=>{const r=run(sourceEngine,sourceRoot,['master','matrix']),o=out(r);assert.equal(r.status,0,r.stdout);for(const c of o.checks){if(['PACKAGE_CERTIFICATES','DETERMINISTIC_REGRESSION'].includes(c.validator)){assert.equal(c.validator_implemented,true,c.id);continue}if(c.validator_implemented){const f='release/templates/master-validator-'+c.validator.toLowerCase().replaceAll('_','-')+'.mjs';assert.equal(fs.existsSync(path.join(sourceRoot,f)),true,f)}}});
test('old legacy gate commands still execute after Master Validation recovery',()=>{const f=installedFixture(),r=run(f.engine,f.root,['gate','evaluate']),o=out(r);assert.equal(r.status,4);assert.equal(o.status,'V1_RELEASE_BLOCKED');assert.equal(o.summary.total,8)});
test('master report groups expose current validation domains',()=>{const f=installedFixture(),r=run(f.engine,f.root,['master-gate','evaluate']),o=out(r);for(const g of ['PACKAGE','ADAPTER_RUNTIME','MULTIMODEL','VISUAL_RUNTIME','ADVANCED_EXECUTION','RESILIENCE','SECURITY','END_TO_END','EFFICIENCY','SECURITY_RELIABILITY'])assert.ok(o.groups[g])});

test('P1 self-test expected count matches the package certifier count',()=>{
  const self=fs.readFileSync('scripts/51-self-test-master-validation-phase1.ps1','utf8');
  const engine=fs.readFileSync('release/engine/v1-release.mjs','utf8');
  const m=engine.match(/deterministic_tests:(\d+),inputs,master_certificate_sha256/);
  assert.ok(m);
  assert.ok(self.includes(`$a.Pass -ne ${m[1]}`));
  assert.ok(self.includes(`expected ${m[1]}/${m[1]}`));
});

