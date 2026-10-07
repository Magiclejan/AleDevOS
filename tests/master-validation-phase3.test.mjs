import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const src=path.resolve('.');
const validator=path.resolve('release/templates/master-validator-multimodel.mjs');
const engine=path.resolve('release/engine/v1-release.mjs');
const policy=path.resolve('release/policies/v1-release-policy.json');
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-master-p3-'));
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n','utf8');return p};
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const fsha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function stable(v,drop=[]){if(Array.isArray(v))return v.map(x=>stable(x,drop));if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())if(!drop.includes(k))o[k]=stable(v[k],drop);return o}return v}
const h=(v,drop=[])=>crypto.createHash('sha256').update(JSON.stringify(stable(v,drop))).digest('hex');
const receiptHash=q=>h(q,['receipt_sha256']);
const mmHash=q=>h(q,['decision_sha256','evidence_sha256','route_sha256','comparison_sha256']);
const run=(bin,args,cwd,env={})=>spawnSync(bin,args,{cwd,encoding:'utf8',env:{...process.env,...env}});
const jsonOut=r=>JSON.parse(r.stdout||'{}');

function installControl(r){
  fs.mkdirSync(path.join(r,'.aledevos','release','runtime'),{recursive:true});
  fs.mkdirSync(path.join(r,'.aledevos','release','policies'),{recursive:true});
  fs.mkdirSync(path.join(r,'.aledevos','release','templates'),{recursive:true});
  fs.copyFileSync(engine,path.join(r,'.aledevos','release','runtime','v1-release.mjs'));
  fs.copyFileSync(policy,path.join(r,'.aledevos','release','policies','v1-release-policy.json'));
  fs.copyFileSync(path.resolve('release/templates/master-validation-package-baseline.json'),path.join(r,'.aledevos','release','templates','master-validation-package-baseline.json'));
  fs.copyFileSync(validator,path.join(r,'.aledevos','release','templates','master-validator-multimodel.mjs'));
  write(path.join(r,'.aledevos','release','VERSION.txt'),'1.45.0-master-validation-p3\n');
  fs.cpSync(path.resolve('multimodel'),path.join(r,'.aledevos','multimodel'),{recursive:true});
}
function fakeBins(r,mode='pass'){
  const b=path.join(r,'bin');fs.mkdirSync(b,{recursive:true});
  for(const name of ['opencode','codex','claude','agy']){
    const p=path.join(b,name);
    const body=mode==='pass'?`#!/bin/sh
case "$*" in *--version*) echo '${name} 9.9.9'; exit 0;; esac
case "$1" in models) echo 'p1 s1 f1'; exit 0;; esac
marker=$(printf '%s' "$*" | grep -o 'ALEDEVOS_P3_\\(MODEL_OK\\|JUDGE_PASS\\)_[a-f0-9]*' | head -1)
if [ -n "$marker" ]; then echo "$marker"; exit 0; fi
echo bad >&2; exit 2
`:`#!/bin/sh
case "$*" in *--version*) echo '${name} 9.9.9'; exit 0;; esac
echo 'authentication required' >&2; exit 1
`;
    write(p,body);fs.chmodSync(p,0o755);
  }
  return{PATH:`${b}:${process.env.PATH}`};
}
function profile(over={}){
  const p={schema_version:'1.0',phase:'MASTER_VALIDATION_P3_TARGET_PROFILE',target_runtime:'test-target',task_id:'TASK_P3',judge_role:'quality',estimated_context_tokens:512,max_cost_class:'premium',selection_priority:'CONTEXT_THEN_COST',models:{
    primary:{adapter:'codex',provider_id:'openai',provider_family:'openai',model_id:'p1',invocation_model_id:'p1',modalities:['text'],context_window_tokens:32768,cost_class:'premium',metadata_source:'test'},
    secondary:{adapter:'claude-code',provider_id:'anthropic',provider_family:'anthropic',model_id:'s1',invocation_model_id:'s1',modalities:['text'],context_window_tokens:32768,cost_class:'premium',metadata_source:'test'},
    fallback_candidates:[{adapter:'antigravity',provider_id:'gateway-openai',provider_family:'openai',model_id:'f1',invocation_model_id:'f1',modalities:['text'],context_window_tokens:32768,cost_class:'standard',metadata_source:'test'}]
  }};
  return Object.assign(p,over);
}
function build(p=profile(),mode='pass'){
  const r=tmp();fs.cpSync(path.resolve('multimodel'),path.join(r,'multimodel'),{recursive:true});installControl(r);const env=fakeBins(r,mode);const pp=write(path.join(r,'profile.json'),p);const rp=path.join(r,'receipt.json');const x=run(process.execPath,[validator,'run','--root',r,'--profile',pp,'--out',rp],r,env);return{root:r,env,run:x,receipt:fs.existsSync(rp)?read(rp):null,receiptPath:rp};
}
const base=build();
assert.equal(base.run.status,0,base.run.stdout+base.run.stderr);
assert.deepEqual(base.receipt.checks,{primary_secondary_models_real:'PASS',model_router_real:'PASS',judge_diversity_real:'PASS',model_fallback_real:'PASS'});
function cloneBase(){const r=tmp();fs.cpSync(base.root,r,{recursive:true});return{root:r,receiptPath:path.join(r,'receipt.json')}}
function arts(r,id){const q=read(path.join(r,'receipt.json')),i=q.artifact_index,b=[{role:'multimodel_target_receipt',path:'receipt.json'}];if(id==='primary_secondary_models_real')return[...b,{role:'model_binding',path:i.model_binding}];if(id==='model_router_real')return[...b,{role:'model_binding',path:i.model_binding},{role:'route_request',path:i.route_request},{role:'route_decision',path:i.route_decision}];if(id==='judge_diversity_real')return[...b,{role:'model_binding',path:i.model_binding},{role:'primary_judge_evidence',path:i.primary_judge_evidence},{role:'secondary_judge_evidence',path:i.secondary_judge_evidence},{role:'judge_comparison',path:i.judge_comparison},{role:'diversity_decision',path:i.diversity_decision}];return[...b,{role:'fallback_weak_binding',path:i.fallback_weak_binding},{role:'fallback_route_request',path:i.fallback_route_request},{role:'fallback_blocked_diversity',path:i.fallback_blocked_diversity},{role:'fallback_plan',path:i.fallback_plan},{role:'fallback_trigger',path:i.fallback_trigger},{role:'fallback_decision',path:i.fallback_decision},{role:'fallback_replacement_binding',path:i.fallback_replacement_binding},{role:'fallback_fresh_route',path:i.fallback_fresh_route},{role:'fallback_fresh_diversity',path:i.fallback_fresh_diversity}];}
function seal(r,id,a=arts(r,id)){const inp=write(path.join(r,`${id}.input.json`),{schema_version:'1.0',check_id:id,status:'PASS',target:{machine:'test'},artifacts:a,claims:{},notes:[]});return run(process.execPath,[path.join(r,'.aledevos','release','runtime','v1-release.mjs'),'master-evidence','seal','--input',inp,'--project-root',r,'--out',path.join(r,`${id}.evidence.json`)],r)}
function rehashReceipt(r){const p=path.join(r,'receipt.json'),q=read(p);q.receipt_sha256=receiptHash(q);write(p,q);return q}
function syncReceiptArtifact(r,role,file){const rp=path.join(r,'receipt.json'),q=read(rp),a=q.artifacts.find(x=>x.role===role);if(a)a.sha256=fsha(file);q.receipt_sha256=receiptHash(q);write(rp,q)}

// Phase contract and matrix.
test('P3 MULTIMODEL validator is implemented for exactly the four P3 checks',()=>{const o=jsonOut(run(process.execPath,[engine,'master','matrix'],src));const xs=o.checks.filter(x=>x.validator==='MULTIMODEL');assert.equal(xs.length,4);assert.ok(xs.every(x=>x.validator_implemented));assert.deepEqual(xs.map(x=>x.id),['primary_secondary_models_real','model_router_real','judge_diversity_real','model_fallback_real'])});
test('P3 remains compatible as P6 arrives',()=>{const o=jsonOut(run(process.execPath,[engine,'master','matrix'],src));for(const c of o.checks.filter(x=>['VISUAL_RUNTIME','ADVANCED_EXECUTION'].includes(x.validator)))assert.equal(c.validator_implemented,true,c.id);for(const c of o.checks.filter(x=>x.validator==='END_TO_END'))assert.equal(c.validator_implemented,true,c.id)});
test('P3 does not modify frozen Multi-Model engines during target validation',()=>{const s=fs.readFileSync(validator,'utf8');assert.ok(s.includes("runJson(mm.engine"));assert.ok(s.includes("runJson(mm.router"));assert.ok(s.includes("runJson(mm.diversity"));assert.ok(s.includes("runJson(mm.fallback"));assert.ok(!s.includes('automatic_model_discovery_used:true'))});

// Inventory and profile fail-closed semantics.
test('inventory is explicitly non-authoritative and makes no PASS claim',()=>{const r=tmp();const env=fakeBins(r);const outp=path.join(r,'inventory.json'),x=run(process.execPath,[validator,'inventory','--root',r,'--out',outp],r,env);assert.equal(x.status,0,x.stdout);const q=read(outp);assert.equal(q.status,'INVENTORY_ONLY_NO_PASS_CLAIM');assert.equal(q.claims.runtime_readiness_not_claimed,true);assert.equal(q.claims.context_limits_not_inferred,true)});
test('profile with placeholder identities is rejected',()=>{const p=profile();p.models.primary.model_id='CHANGE_ME_PRIMARY_MODEL';const b=build(p);assert.equal(b.run.status,7);assert.match(jsonOut(b.run).error,/placeholder/)});
test('profile with duplicate model identity is rejected',()=>{const p=profile();p.models.secondary.provider_id='openai';p.models.secondary.model_id='p1';const b=build(p);assert.equal(b.run.status,7);assert.match(jsonOut(b.run).error,/model_identity_duplicate/)});
test('profile with unknown adapter is rejected',()=>{const p=profile();p.models.primary.adapter='unknown';const b=build(p);assert.equal(b.run.status,7);assert.match(jsonOut(b.run).error,/adapter_unknown/)});
test('profile with context window <= safety reserve is rejected',()=>{const p=profile();p.models.primary.context_window_tokens=8192;const b=build(p);assert.equal(b.run.status,7);assert.match(jsonOut(b.run).error,/context_window_invalid/)});
test('missing authentication/runtime produces BLOCKED, never false PASS',()=>{const b=build(profile(),'fail');assert.equal(b.run.status,4,b.run.stdout);assert.equal(b.receipt.checks.primary_secondary_models_real,'BLOCKED');assert.equal(b.receipt.checks.model_router_real,'BLOCKED');assert.equal(b.receipt.checks.judge_diversity_real,'BLOCKED')});

// Full target orchestration.
test('controlled active runtime bundle reaches all four P3 PASS checks',()=>{assert.deepEqual(base.receipt.checks,{primary_secondary_models_real:'PASS',model_router_real:'PASS',judge_diversity_real:'PASS',model_fallback_real:'PASS'})});
test('every actively proven model invocation records the exact --model selector',()=>{for(const q of Object.values(base.receipt.models)){const c=q.cli.commands.find(x=>x.kind==='active_model_invocation');const i=c.argv.indexOf('--model');assert.ok(i>=0,q.label);assert.equal(c.argv[i+1],q.invocation_model_id)}});
test('P3 target receipt preserves epistemic boundary and deterministic authority',()=>{assert.equal(base.receipt.claims.semantic_model_independence_claimed,false);assert.equal(base.receipt.claims.final_judge_decision_authority,'ALEDEVOS_DETERMINISTIC_GATE');assert.equal(base.receipt.claims.context_window_is_target_declared_metadata_not_independent_stress_benchmark,true)});
test('P3 fallback proof uses controlled DIVERSITY_BLOCKED topology, not judge-result shopping',()=>{const q=base.receipt;assert.ok(q.fallback.topology);assert.equal(q.claims.model_shopping_fallback_used,false);const d=read(path.join(base.root,q.artifact_index.fallback_decision));assert.equal(d.trigger.failure_code,'DIVERSITY_BLOCKED');assert.equal(d.fallback_hop,1)});
test('two real models can pass binding/router/diversity while fallback remains honestly BLOCKED',()=>{const p=profile();p.models.fallback_candidates=[];const b=build(p);assert.equal(b.receipt.checks.primary_secondary_models_real,'PASS');assert.equal(b.receipt.checks.model_router_real,'PASS');assert.equal(b.receipt.checks.judge_diversity_real,'PASS');assert.equal(b.receipt.checks.model_fallback_real,'BLOCKED');assert.match(b.receipt.fallback.blocked_reason,/three_model_topology/)});
test('three cross-family-only models cannot fake DIVERSITY_BLOCKED fallback evidence',()=>{const p=profile();p.models.fallback_candidates[0].provider_family='google';const b=build(p);assert.equal(b.receipt.checks.model_fallback_real,'BLOCKED');assert.match(b.receipt.fallback.blocked_reason,/three_model_topology/)});
test('same-family primary/secondary blocks Judge Diversity while model binding/router can remain real',()=>{const p=profile();p.models.secondary.provider_family='openai';const b=build(p);assert.equal(b.receipt.checks.primary_secondary_models_real,'PASS');assert.equal(b.receipt.checks.model_router_real,'PASS');assert.equal(b.receipt.checks.judge_diversity_real,'BLOCKED')});

// Positive Master evidence paths.
for(const id of ['primary_secondary_models_real','model_router_real','judge_diversity_real','model_fallback_real'])test(`${id} valid real-target bundle seals PASS through Master validator`,()=>{const f=cloneBase(),x=seal(f.root,id);assert.equal(x.status,0,x.stdout+x.stderr);assert.equal(jsonOut(x).evidence.validation.ok,true)});

// Receipt and model-proof sabotage.
test('receipt self-tamper is rejected even when Master rehashes the artifact',()=>{const f=cloneBase(),q=read(f.receiptPath);q.target.target_runtime='tampered';write(f.receiptPath,q);const x=seal(f.root,'primary_secondary_models_real');assert.notEqual(x.status,0);assert.ok(jsonOut(x).errors.includes('receipt_integrity_mismatch'))});
test('receipt internal artifact drift is rejected',()=>{const f=cloneBase(),q=read(f.receiptPath),a=q.artifacts.find(x=>x.role==='model_binding');fs.appendFileSync(path.join(f.root,a.path),'\n');const x=seal(f.root,'primary_secondary_models_real');assert.notEqual(x.status,0);assert.ok(jsonOut(x).errors.includes('receipt_artifact_drift:model_binding'))});
test('primary runtime readiness cannot be changed to false and re-sealed into PASS',()=>{const f=cloneBase(),q=read(f.receiptPath);q.models.primary.runtime_ready=false;q.receipt_sha256=receiptHash(q);write(f.receiptPath,q);const x=seal(f.root,'primary_secondary_models_real');assert.notEqual(x.status,0);assert.ok(jsonOut(x).errors.includes('primary_runtime_not_proven'))});
test('explicit model selector proof is mandatory',()=>{const f=cloneBase(),q=read(f.receiptPath);q.models.primary.active_invocation.explicit_model_selector=false;q.receipt_sha256=receiptHash(q);write(f.receiptPath,q);const x=seal(f.root,'primary_secondary_models_real');assert.notEqual(x.status,0);assert.ok(jsonOut(x).errors.includes('primary_runtime_not_proven'))});
test('context metadata below safety floor cannot become real-model PASS',()=>{const f=cloneBase(),q=read(f.receiptPath);q.models.primary.context_window_tokens=1024;q.receipt_sha256=receiptHash(q);write(f.receiptPath,q);const x=seal(f.root,'primary_secondary_models_real');assert.notEqual(x.status,0);assert.ok(jsonOut(x).errors.includes('primary_context_metadata_invalid'))});
test('placeholder provider family cannot become PASS through rehashing',()=>{const f=cloneBase(),q=read(f.receiptPath);q.models.primary.provider_family='CHANGE_ME';q.receipt_sha256=receiptHash(q);write(f.receiptPath,q);const x=seal(f.root,'primary_secondary_models_real');assert.notEqual(x.status,0);assert.ok(jsonOut(x).errors.includes('primary_identity_placeholder'))});
test('binding identity drift from active runtime receipt is rejected',()=>{const f=cloneBase(),q=read(f.receiptPath),bp=path.join(f.root,q.artifact_index.model_binding),b=read(bp);b.slots.primary.model_id='other-real-looking-model';write(bp,b);syncReceiptArtifact(f.root,'model_binding',bp);const x=seal(f.root,'primary_secondary_models_real');assert.notEqual(x.status,0);assert.ok(jsonOut(x).errors.includes('binding_model_identity_mismatch'))});

// Router sabotage.
test('router proof must be selected and re-verifiable by frozen P2',()=>{const f=cloneBase(),q=read(f.receiptPath),rp=path.join(f.root,q.artifact_index.route_decision),d=read(rp);d.selected.model_id='tampered';d.route_sha256=mmHash(d);write(rp,d);syncReceiptArtifact(f.root,'route_decision',rp);const x=seal(f.root,'model_router_real');assert.notEqual(x.status,0);assert.ok(jsonOut(x).errors.includes('frozen_route_verification_failed'))});
test('router proof must stay bound to the exact request hash',()=>{const f=cloneBase(),q=read(f.receiptPath),rp=path.join(f.root,q.artifact_index.route_request);const req=read(rp);req.estimated_context_tokens+=1;write(rp,req);syncReceiptArtifact(f.root,'route_request',rp);const x=seal(f.root,'model_router_real');assert.notEqual(x.status,0);assert.ok(jsonOut(x).errors.includes('route_request_hash_mismatch'))});
test('router evidence cannot omit route decision artifact',()=>{const f=cloneBase(),a=arts(f.root,'model_router_real').filter(x=>x.role!=='route_decision'),x=seal(f.root,'model_router_real',a);assert.notEqual(x.status,0);assert.ok(jsonOut(x).errors.includes('artifact_missing:route_decision'))});

// Judge diversity sabotage.
test('Judge Diversity requires CROSS_FAMILY and frozen P3 verification',()=>{const f=cloneBase(),q=read(f.receiptPath),dp=path.join(f.root,q.artifact_index.diversity_decision),d=read(dp);d.observed_tier='DISTINCT_MODEL_SAME_PROVIDER';d.decision_sha256=mmHash(d);write(dp,d);syncReceiptArtifact(f.root,'diversity_decision',dp);const x=seal(f.root,'judge_diversity_real');assert.notEqual(x.status,0);const e=jsonOut(x).errors;assert.ok(e.includes('frozen_diversity_verification_failed')||e.includes('cross_family_diversity_not_proven'))});
test('Judge pair must be complete over the same input and rubric',()=>{const f=cloneBase(),q=read(f.receiptPath),cp=path.join(f.root,q.artifact_index.judge_comparison),c=read(cp);c.state='INCOMPLETE';c.comparison_sha256=mmHash(c);write(cp,c);syncReceiptArtifact(f.root,'judge_comparison',cp);const x=seal(f.root,'judge_diversity_real');assert.notEqual(x.status,0);const e=jsonOut(x).errors;assert.ok(e.includes('judge_pair_not_complete_same_evidence')||e.includes('frozen_diversity_verification_failed'))});
test('real Judge runtime invocations are required beyond sealed model evidence',()=>{const f=cloneBase(),q=read(f.receiptPath);q.judge_invocations.secondary.runtime_ready=false;q.receipt_sha256=receiptHash(q);write(f.receiptPath,q);const x=seal(f.root,'judge_diversity_real');assert.notEqual(x.status,0);assert.ok(jsonOut(x).errors.includes('real_judge_invocations_not_proven'))});

// Fallback sabotage.
test('fallback decision is verified against exact weak binding/request/plan/trigger/diversity sources',()=>{const f=cloneBase(),q=read(f.receiptPath),tp=path.join(f.root,q.artifact_index.fallback_trigger),t=read(tp);t.task_id='drift';write(tp,t);syncReceiptArtifact(f.root,'fallback_trigger',tp);const x=seal(f.root,'model_fallback_real');assert.notEqual(x.status,0);assert.ok(jsonOut(x).errors.includes('frozen_fallback_verification_failed'))});
test('fallback hop cannot exceed hard maximum even after decision rehash',()=>{const f=cloneBase(),q=read(f.receiptPath),dp=path.join(f.root,q.artifact_index.fallback_decision),d=read(dp);d.fallback_hop=3;d.decision_sha256=mmHash(d);write(dp,d);syncReceiptArtifact(f.root,'fallback_decision',dp);const x=seal(f.root,'model_fallback_real');assert.notEqual(x.status,0);const e=jsonOut(x).errors;assert.ok(e.includes('frozen_fallback_verification_failed')||e.includes('fallback_selection_contract_invalid'))});
test('fallback requires fresh P2 route after replacement',()=>{const f=cloneBase(),a=arts(f.root,'model_fallback_real').filter(x=>x.role!=='fallback_fresh_route'),x=seal(f.root,'model_fallback_real',a);assert.notEqual(x.status,0);assert.ok(jsonOut(x).errors.includes('artifact_missing:fallback_fresh_route'))});
test('fallback requires fresh CROSS_FAMILY P3 evidence after replacement',()=>{const f=cloneBase(),q=read(f.receiptPath),dp=path.join(f.root,q.artifact_index.fallback_fresh_diversity),d=read(dp);d.status='JUDGE_DIVERSITY_BLOCKED';d.pair_allowed=false;d.observed_tier='DISTINCT_MODEL_SAME_PROVIDER';d.decision_sha256=mmHash(d);write(dp,d);syncReceiptArtifact(f.root,'fallback_fresh_diversity',dp);const x=seal(f.root,'model_fallback_real');assert.notEqual(x.status,0);assert.ok(jsonOut(x).errors.includes('fresh_p3_diversity_not_verified'))});
test('fallback controlled weak pair must genuinely be same-family',()=>{const f=cloneBase(),q=read(f.receiptPath),bp=path.join(f.root,q.artifact_index.fallback_weak_binding),b=read(bp);b.slots.secondary.provider_family='other-family';write(bp,b);syncReceiptArtifact(f.root,'fallback_weak_binding',bp);const x=seal(f.root,'model_fallback_real');assert.notEqual(x.status,0);const e=jsonOut(x).errors;assert.ok(e.includes('blocked_diversity_verification_failed')||e.includes('frozen_fallback_verification_failed')||e.includes('fallback_weak_pair_not_same_family'))});

test('P3 schemas, target profile template and Windows orchestrator are packaged',()=>{for(const p of ['release/schemas/master-multimodel-target-profile.schema.json','release/schemas/master-multimodel-target-receipt.schema.json','release/templates/MASTER_MULTIMODEL_TARGET_PROFILE.example.json','release/templates/MASTER_MULTIMODEL_TARGET_RECEIPT.example.json','scripts/55-master-validation-p3-target-multimodel.ps1'])assert.ok(fs.existsSync(p),p)});
test('P3 target script supports inventory-only discovery before any binding claim',()=>{const s=fs.readFileSync('scripts/55-master-validation-p3-target-multimodel.ps1','utf8');assert.ok(s.includes('InventoryOnly'));assert.ok(s.includes(' inventory '));assert.ok(s.includes('master-evidence seal'))});
