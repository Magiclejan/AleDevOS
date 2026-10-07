import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const runtime=path.resolve('release/engine/v1-release.mjs');
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-v1-release-'));
const w=(root,rel,content='')=>{const fp=path.join(root,rel);fs.mkdirSync(path.dirname(fp),{recursive:true});fs.writeFileSync(fp,content,'utf8');return fp};
const run=(cwd,args=[])=>spawnSync(process.execPath,[runtime,...args,'--project-root',cwd],{cwd,encoding:'utf8'});
const jout=r=>JSON.parse(r.stdout||'{}');
function copy(src,dst){fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(path.resolve(src),dst)}
function adapterProject(){
  const p=tmp();
  copy('adapters/opencode/opencode.json',path.join(p,'opencode.json'));
  for(const n of ['visual-judge','visual-repair-controller','visual-capture-runner','visual-runtime-audit-runner'])copy(`adapters/opencode/.opencode/agents/${n}.md`,path.join(p,'.opencode','agents',`${n}.md`));
  return p;
}
function evidenceInput(p,id,status='BLOCKED',artifacts=[]){const fp=path.join(p,`${id}-input.json`);fs.writeFileSync(fp,JSON.stringify({schema_version:'1.0',check_id:id,status,target:{adapter:'opencode',runtime:'test'},artifacts,claims:{},notes:[]},null,2));return fp}

test('V1 release policy requires the complete fail-closed target evidence set',()=>{
  const q=JSON.parse(fs.readFileSync(path.resolve('release/policies/v1-release-policy.json'),'utf8'));
  assert.deepEqual(q.required_checks.map(x=>x.id),['real_playwright_capture','real_runtime_audit','native_image_visual_judge','visual_fail_repair_pass','visual_two_repair_exhaustion','full_stack_real_project','security_permissions_target','deterministic_regression']);
  assert.equal(q.fail_closed,true);assert.equal(q.allow_missing_required_evidence,false);assert.equal(q.allow_test_provider_for_target_evidence,false);
});

test('release gate blocks when required target evidence is missing',()=>{
  const p=adapterProject();const r=run(p,['gate','evaluate']);const o=jout(r);
  assert.equal(r.status,4);assert.equal(o.status,'V1_RELEASE_BLOCKED');assert.equal(o.summary.total,8);assert.equal(o.summary.passed,0);assert.equal(o.summary.blocked,8);
});

test('unknown evidence check cannot be sealed',()=>{
  const p=adapterProject(),i=w(p,'unknown.json',JSON.stringify({check_id:'made_up',status:'PASS',artifacts:[]}));const r=run(p,['evidence','seal','--input',i]);
  assert.notEqual(r.status,0);assert.equal(jout(r).status,'EVIDENCE_CHECK_UNKNOWN');
});

test('explicit BLOCKED evidence may be sealed but can never make release ready',()=>{
  const p=adapterProject(),i=evidenceInput(p,'native_image_visual_judge','BLOCKED');let r=run(p,['evidence','seal','--input',i]);assert.equal(r.status,0,r.stdout);
  r=run(p,['gate','evaluate']);const o=jout(r);assert.equal(o.status,'V1_RELEASE_BLOCKED');assert.equal(o.required_checks.find(x=>x.id==='native_image_visual_judge').status,'BLOCKED');
});

test('deterministic regression evidence enforces frozen minimum counts and zero failures',()=>{
  const p=adapterProject();w(p,'regression-summary.json',JSON.stringify({tests_passed:600,failures:0,mjs_syntax_passed:53,json_parse_passed:124}));const i=evidenceInput(p,'deterministic_regression','PASS',[{role:'regression_summary',path:'regression-summary.json'}]);
  const r=run(p,['evidence','seal','--input',i]);assert.equal(r.status,0,r.stdout);assert.equal(jout(r).evidence.validation.ok,true);
});

test('deterministic regression evidence below frozen baseline is rejected',()=>{
  const p=adapterProject();w(p,'regression-summary.json',JSON.stringify({tests_passed:599,failures:0,mjs_syntax_passed:53,json_parse_passed:124}));const i=evidenceInput(p,'deterministic_regression','PASS',[{role:'regression_summary',path:'regression-summary.json'}]);
  const r=run(p,['evidence','seal','--input',i]);assert.notEqual(r.status,0);assert.ok(jout(r).errors.includes('regression_test_count_below_frozen_baseline'));
});

test('sealed evidence detects referenced artifact drift',()=>{
  const p=adapterProject();w(p,'regression-summary.json',JSON.stringify({tests_passed:600,failures:0,mjs_syntax_passed:53,json_parse_passed:124}));const i=evidenceInput(p,'deterministic_regression','PASS',[{role:'regression_summary',path:'regression-summary.json'}]);let r=run(p,['evidence','seal','--input',i]);assert.equal(r.status,0,r.stdout);const ep=path.join(p,jout(r).path);fs.appendFileSync(path.join(p,'regression-summary.json'),' ');r=run(p,['evidence','verify','--evidence',ep]);assert.notEqual(r.status,0);assert.ok(jout(r).errors.includes('artifact_drift:regression_summary'));
});

test('sealed evidence itself is tamper evident',()=>{
  const p=adapterProject(),i=evidenceInput(p,'native_image_visual_judge','BLOCKED');let r=run(p,['evidence','seal','--input',i]);const ep=path.join(p,jout(r).path),q=JSON.parse(fs.readFileSync(ep));q.notes=['tampered'];fs.writeFileSync(ep,JSON.stringify(q));r=run(p,['evidence','verify','--evidence',ep]);assert.notEqual(r.status,0);assert.ok(jout(r).errors.includes('evidence_integrity_mismatch'));
});

test('target security inspection passes canonical OpenCode deny policy',()=>{
  const p=adapterProject(),r=run(p,['security','inspect']);assert.equal(r.status,0,r.stdout);assert.equal(jout(r).status,'SECURITY_PERMISSIONS_PASS');
});

test('target security inspection blocks if a dangerous Git deny disappears',()=>{
  const p=adapterProject(),fp=path.join(p,'opencode.json'),q=JSON.parse(fs.readFileSync(fp));q.experimental.policies=q.experimental.policies.filter(x=>x.resource!=='shell:git reset --hard *');fs.writeFileSync(fp,JSON.stringify(q));const r=run(p,['security','inspect']);assert.equal(r.status,4);assert.ok(jout(r).errors.includes('dangerous_deny_missing:shell:git reset --hard *'));
});

test('preflight truthfully blocks when Visual Judge capability is unresolved',()=>{
  const p=adapterProject(),r=run(p,['system','preflight']),o=jout(r);
  assert.equal(r.status,4);
  assert.equal(o.status,'TARGET_RUNTIME_BLOCKED');
  assert.equal(o.checks.native_image_visual_judge.status,'BLOCKED');
  assert.equal(o.checks.native_image_visual_judge.reason,'visual_judge_model_unresolved');
  assert.deepEqual(o.checks.native_image_visual_judge.declared_input,[]);
});

test('preflight image capability is derived from generic runtime declaration',()=>{
  const p=adapterProject(),fp=path.join(p,'opencode.json'),q=JSON.parse(fs.readFileSync(fp));
  q.model='fixture/vision';
  q.providers={fixture:{models:{vision:{capabilities:{input:['text','image']}}}}};
  fs.writeFileSync(fp,JSON.stringify(q,null,2));
  const r=run(p,['system','preflight']),o=jout(r);
  assert.equal(o.checks.native_image_visual_judge.status,'PASS');
});
test('release report is sealed and report tampering is detected',()=>{
  const p=adapterProject();let r=run(p,['gate','evaluate']);const rp=path.join(p,jout(r).path);r=run(p,['gate','verify','--report',rp]);assert.equal(r.status,0,r.stdout);const q=JSON.parse(fs.readFileSync(rp));q.summary.total=999;fs.writeFileSync(rp,JSON.stringify(q));r=run(p,['gate','verify','--report',rp]);assert.notEqual(r.status,0);assert.ok(jout(r).errors.includes('report_integrity_mismatch'));
});

test('target release evidence rejects controlled browser-provider provenance by construction',()=>{
  const br=fs.readFileSync(path.resolve('visualqa/engine/browser-runner.mjs'),'utf8');const au=fs.readFileSync(path.resolve('visualqa/engine/runtime-audit.mjs'),'utf8');const rel=fs.readFileSync(runtime,'utf8');
  assert.match(br,/CONTROLLED_TEST_PROVIDER/);assert.match(br,/ADAPTER_PROVIDER/);assert.match(au,/CONTROLLED_TEST_PROVIDER/);assert.match(rel,/controlled_test_provider_not_allowed/);
});

test('V1 release validator is read-only to product and Orchestrator can delegate it',()=>{
  const a=fs.readFileSync(path.resolve('adapters/opencode/.opencode/agents/v1-release-validator.md'),'utf8');const o=fs.readFileSync(path.resolve('adapters/opencode/.opencode/agents/orchestrator.md'),'utf8');assert.match(a,/action: edit[\s\S]*resource: "\*"[\s\S]*effect: deny/);assert.match(a,/\.aledevos\/state\/release\/v1\/\*\*/);assert.match(o,/resource: "v1-release-validator"/);
});

test('installer deploys release runtime, policy, schemas, version and state roots',()=>{
  const s=fs.readFileSync(path.resolve('scripts/05-install-into-project.ps1'),'utf8');assert.match(s,/release\\engine\\v1-release\.mjs/);assert.match(s,/release\\policies\\v1-release-policy\.json/);assert.match(s,/state\\release\\v1\\evidence/);assert.match(s,/Join-Path \$rel 'VERSION\.txt'/);
});
