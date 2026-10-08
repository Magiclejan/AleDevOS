import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {buildOperationalPlan,verifyOperationalReceipt,assessOperational} from '../certification/pro/engine/p37-operational.mjs';
const repo=path.resolve('.');
const policy=JSON.parse(fs.readFileSync('certification/pro/policies/p37-operational.json','utf8'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const now=Date.parse('2026-10-08T09:00:00.000Z'),observed='2026-10-08T08:00:00.000Z';
const commit='f'.repeat(40),roots=[];
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-p37-'));
 roots.push(root);
 const base=path.join(root,'.aledevos/state/certification/p37');
 fs.mkdirSync(base,{recursive:true});
 const target={kind:'skill',adapter:'opencode',id:'safe-edit',source_sha256:sha('trusted-skill'),
  required_cases:[...policy.cases.skill]};
 const save=id=>{
  const rel='.aledevos/state/certification/p37/'+id+'.json';
  const content=JSON.stringify({case_id:id,claimed_observation:'UNVERIFIED_TEST_FIXTURE'})+'\n';
  fs.writeFileSync(path.join(root,rel),content);
  return {evidence_path:rel,evidence_sha256:sha(content)};
 };
 const receipt={
  kind:target.kind,adapter:target.adapter,id:target.id,
  source_sha256:target.source_sha256,git_sha:commit,observed_at:observed,
  runtime:{provider_id:'local-adapter',model_id:'explicit-model',runtime_id:'actual-runtime',invocation_id:'external-invocation',invoked_externally:true},
  cases:target.required_cases.map((id,i)=>({id,status:'PASS',provenance:'REAL',observed_at:observed,
   ...save('case-'+i),exit_code:i===1?1:0})),
  verifier:{role:'verifier',reviewer_id:'independent-verifier',independent:true,status:'PASS',observed_at:observed,
   ...save('verifier')}
 };
 return {root,target,receipt,ctx:{root,policy,git_sha:commit,now}};
}
afterEach(()=>{for(const d of roots.splice(0))fs.rmSync(d,{recursive:true,force:true})});

test('P37 matrix binds every real Skill/agent projection to current source bytes and carries zero certificates',()=>{
 const p=buildOperationalPlan(repo);
 assert.equal(p.required_total,156);
 assert.deepEqual(p.breakdown,{skills:52,agents:100,workflows:4});
 assert.equal(p.pro_certified,0);
 assert.ok(p.targets.every(x=>x.status==='BLOCKED'&&/^[a-f0-9]{64}$/.test(x.source_sha256)));
 assert.equal(p.targets.filter(x=>x.id==='orchestrator'&&x.kind==='agent').length,4);
});

test('absent operational evidence blocks all 156 targets rather than extending P36 certification',()=>{
 const a=assessOperational(repo,{schema_version:'1.0',phase:'P37.0',git_sha:commit,receipts:[]},{revision:commit,policy,now});
 assert.equal(a.summary.required,156);
 assert.equal(a.summary.blocked,156);
 assert.equal(a.summary.pro_certified,0);
 assert.equal(a.status,'NOT_PRO_CERTIFIED');
});

test('even a complete purported real run is evidence-review required, never automatically PRO_CERTIFIED',()=>{
 const f=fixture();
 const v=verifyOperationalReceipt(f.target,f.receipt,f.ctx);
 assert.equal(v.status,'EVIDENCE_REVIEW_REQUIRED',JSON.stringify(v.issues));
 assert.equal(v.pro_certified,false);
});

test('fake/model-unknown provider and controlled provenance cannot certify',()=>{
 const f=fixture();f.receipt.runtime.provider_id='mock';
 f.receipt.cases[0].provenance='CONTROLLED';
 const v=verifyOperationalReceipt(f.target,f.receipt,f.ctx);
 assert.equal(v.status,'BLOCKED');
 assert.ok(v.issues.includes('CONTROLLED_PROVIDER_NOT_REAL'));
 assert.ok(v.issues.some(x=>x.startsWith('NON_REAL_CASE_EVIDENCE')));
});

test('tampered artifact SHA and missing immutable source pin are independently rejected',()=>{
 const f=fixture();f.receipt.source_sha256=sha('stale-source');
 fs.appendFileSync(path.join(f.root,f.receipt.cases[0].evidence_path),'TAMPER');
 const v=verifyOperationalReceipt(f.target,f.receipt,f.ctx);
 assert.equal(v.status,'BLOCKED');
 assert.ok(v.issues.includes('STALE_OR_WRONG_SOURCE_HASH'));
 assert.ok(v.issues.includes('ARTIFACT_HASH_MISMATCH'));
});

test('missing case, repeated ID and actual failure cannot count as complete',()=>{
 const f=fixture();
 f.receipt.cases[0].status='FAIL';
 f.receipt.cases[1].id=f.receipt.cases[0].id;
 const v=verifyOperationalReceipt(f.target,f.receipt,f.ctx);
 assert.equal(v.status,'FAILED');
 assert.ok(v.issues.some(x=>x.startsWith('OBSERVED_CASE_FAILURE')));
 assert.ok(v.issues.some(x=>x.startsWith('DUPLICATE_CASE')));
 assert.ok(v.issues.some(x=>x.startsWith('REQUIRED_CASE_MISSING')));
});

test('future timestamp, stale observation and commit drift are blocked',()=>{
 const f=fixture();f.receipt.git_sha='b'.repeat(40);
 f.receipt.observed_at='2026-10-01T09:00:00Z';
 f.receipt.verifier.observed_at='2026-10-09T08:00:00Z';
 const v=verifyOperationalReceipt(f.target,f.receipt,f.ctx);
 assert.equal(v.status,'BLOCKED');
 assert.ok(v.issues.includes('REVISION_UNPINNED_OR_STALE'));
 assert.ok(v.issues.includes('STALE_TIMESTAMP'));
 assert.ok(v.issues.includes('FUTURE_TIMESTAMP'));
});

test('metadata transcript fields and evidence-path escapes are rejected without reading external data',()=>{
 const f=fixture();f.receipt.raw_prompt='SECRET DO NOT COPY';
 f.receipt.cases[0].evidence_path='../outside.json';
 const v=verifyOperationalReceipt(f.target,f.receipt,f.ctx);
 assert.equal(v.status,'BLOCKED');
 assert.ok(v.issues.includes('RECEIPT:UNEXPECTED_FIELD:raw_prompt'));
 assert.ok(v.issues.includes('ARTIFACT_OUTSIDE_PROTECTED_EVIDENCE_ROOT'));
});

test('symlink to an external artifact is rejected even when byte hash matches',t=>{
 if(process.platform==='win32')return t.skip('Windows symlink rights vary; lexical traversal tested everywhere');
 const f=fixture();
 const ext=path.join(f.root,'external.json');
 fs.writeFileSync(ext,'{"secret":true}\n');
 const link=path.join(f.root,f.receipt.cases[0].evidence_path);
 fs.rmSync(link);fs.symlinkSync(ext,link);
 f.receipt.cases[0].evidence_sha256=sha(fs.readFileSync(ext));
 const v=verifyOperationalReceipt(f.target,f.receipt,f.ctx);
 assert.ok(v.issues.includes('ARTIFACT_SYMLINK_ESCAPE'));
});

test('malformed manifest, stale git SHA and duplicate target receipt fail closed',()=>{
 const f=fixture();
 assert.throws(()=>assessOperational(repo,{schema_version:'1.0',phase:'P37.0',git_sha:commit,receipts:{}},
   {revision:commit,policy,now}),/P37_MANIFEST_INVALID/);
 assert.throws(()=>assessOperational(repo,{schema_version:'1.0',phase:'P37.0',git_sha:'0'.repeat(40),receipts:[]},
   {revision:commit,policy,now}),/P37_MANIFEST_REVISION_STALE/);
 assert.throws(()=>assessOperational(repo,{schema_version:'1.0',phase:'P37.0',git_sha:commit,receipts:[f.receipt,f.receipt]},
   {revision:commit,policy,now}),/P37_DUPLICATE_RECEIPT/);
});

test('self-reviewing verifier and premature PRO_CERTIFIED claim are rejected',()=>{
 const f=fixture();f.receipt.verifier.reviewer_id=f.receipt.runtime.provider_id;
 f.receipt.status='PRO_CERTIFIED';
 const v=verifyOperationalReceipt(f.target,f.receipt,f.ctx);
 assert.equal(v.status,'BLOCKED');
 assert.ok(v.issues.includes('SELF_VERIFICATION_FORBIDDEN'));
 assert.ok(v.issues.includes('RECEIPT:UNEXPECTED_FIELD:status'));
});
