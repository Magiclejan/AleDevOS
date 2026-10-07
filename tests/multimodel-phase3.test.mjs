import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const p3=path.join(root,'multimodel/extensions/diversity/judge-diversity.mjs');
const p1=path.join(root,'multimodel/engine/multimodel.mjs');
const p2=path.join(root,'multimodel/router/model-router.mjs');
const run=(args,cwd=root,exe=p3)=>spawnSync(process.execPath,[exe,...args],{cwd,encoding:'utf8'});
const json=r=>JSON.parse(r.stdout||'{}');
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-mm-p3-'));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).filter(k=>!['decision_sha256','evidence_sha256','comparison_sha256'].includes(k)).sort().map(k=>[k,stable(v[k])])):v;
const hashObj=v=>crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
function setup({primaryProvider='provider-a',secondaryProvider='provider-b',primaryFamily='family-a',secondaryFamily='family-b',primaryModel='model-a',secondaryModel='model-b',role='quality'}={}){
 const d=tmp();
 const binding={schema_version:'1.0',binding_id:'test-binding',target_runtime:'TEST_RUNTIME',slots:{
  primary:{provider_id:primaryProvider,model_id:primaryModel,provider_family:primaryFamily,modalities:['text','image'],context_window_tokens:131072,cost_class:'standard',runtime_ready:true,runtime_evidence:'test://primary'},
  secondary:{provider_id:secondaryProvider,model_id:secondaryModel,provider_family:secondaryFamily,modalities:['text','image'],context_window_tokens:262144,cost_class:'premium',runtime_ready:true,runtime_evidence:'test://secondary'}
 }};
 const bindingFile=path.join(d,'binding.json');fs.writeFileSync(bindingFile,JSON.stringify(binding,null,2));
 return{d,binding,bindingFile,role,decision:path.join(d,'diversity.json'),comparison:path.join(d,'comparison.json')};
}
const assess=(x,extra=[])=>run(['pair','assess','--binding',x.bindingFile,'--judge-role',x.role,'--out',x.decision,...extra],x.d);
function makeComparison(x,{state='AGREE',primaryProvider=x.binding.slots.primary.provider_id,primaryModel=x.binding.slots.primary.model_id,secondaryProvider=x.binding.slots.secondary.provider_id,secondaryModel=x.binding.slots.secondary.model_id,role=x.role}={}){
 const c={schema_version:'1.0',phase:'MULTIMODEL_P1_JUDGE_COMPARISON',task_id:'TASK-P3',judge_role:role,state,
  primary:{evidence_sha256:'a'.repeat(64),provider_id:primaryProvider,model_id:primaryModel,outcome:'PASS',score:95,runtime_ready:true},
  secondary:{evidence_sha256:'b'.repeat(64),provider_id:secondaryProvider,model_id:secondaryModel,outcome:'PASS',score:94,runtime_ready:true},
  same_input:true,same_rubric:true,same_outcome:true,score_delta:1,blocker_delta:0,provider_diverse:primaryProvider!==secondaryProvider,
  consensus_claimed:false,final_decision:null,final_decision_authority:'ALEDEVOS_DETERMINISTIC_GATE',router_used:false,fallback_used:false,created_at:new Date().toISOString(),comparison_sha256:''};
 c.comparison_sha256=hashObj(c);fs.writeFileSync(x.comparison,JSON.stringify(c,null,2));return c;
}

// Policy contract.
test('P3 diversity policy is valid',()=>{const r=run(['policy','verify']);assert.equal(r.status,0);assert.equal(json(r).status,'JUDGE_DIVERSITY_POLICY_VALID')});
test('P3 declares exactly three ordered diversity tiers',()=>{const p=JSON.parse(fs.readFileSync('multimodel/policies/judge-diversity-policy.json'));assert.deepEqual(p.tiers,{DISTINCT_MODEL_SAME_PROVIDER:1,CROSS_PROVIDER_SAME_FAMILY:2,CROSS_FAMILY:3})});
test('all current Judge roles require CROSS_FAMILY',()=>{const p=JSON.parse(fs.readFileSync('multimodel/policies/judge-diversity-policy.json'));for(const r of p.allowed_judge_roles)assert.equal(p.minimum_tier_by_role[r],'CROSS_FAMILY')});
test('policy certifies declared provenance only',()=>assert.equal(JSON.parse(fs.readFileSync('multimodel/policies/judge-diversity-policy.json')).rules.declared_provenance_only,true));
test('policy does not claim semantic independence',()=>assert.equal(JSON.parse(fs.readFileSync('multimodel/policies/judge-diversity-policy.json')).rules.semantic_independence_claimed,false));
test('insufficient diversity blocks pair',()=>assert.equal(JSON.parse(fs.readFileSync('multimodel/policies/judge-diversity-policy.json')).rules.insufficient_diversity_blocks_pair,true));
test('P3 automatic replacement remains disabled',()=>assert.equal(JSON.parse(fs.readFileSync('multimodel/policies/judge-diversity-policy.json')).rules.automatic_model_replacement_enabled,false));
test('P3 automatic fallback remains disabled',()=>assert.equal(JSON.parse(fs.readFileSync('multimodel/policies/judge-diversity-policy.json')).rules.automatic_fallback_enabled,false));
test('fallback is explicitly deferred to P4',()=>assert.equal(JSON.parse(fs.readFileSync('multimodel/policies/judge-diversity-policy.json')).rules.fallback_deferred_to,'MULTIMODEL_P4_MODEL_FALLBACK'));
test('P3 cannot override router',()=>assert.equal(JSON.parse(fs.readFileSync('multimodel/policies/judge-diversity-policy.json')).rules.router_override_allowed,false));
test('final Judge decision stays with deterministic gate',()=>assert.equal(JSON.parse(fs.readFileSync('multimodel/policies/judge-diversity-policy.json')).rules.final_judge_decision_authority,'ALEDEVOS_DETERMINISTIC_GATE'));

// Classification + blocking.
test('cross-family pair passes diversity gate',()=>{const x=setup(),r=assess(x),o=json(r);assert.equal(r.status,0);assert.equal(o.status,'JUDGE_DIVERSITY_PASS');assert.equal(o.observed_tier,'CROSS_FAMILY');assert.equal(o.pair_allowed,true)});
test('different providers in same family are blocked',()=>{const x=setup({primaryFamily:'shared',secondaryFamily:'shared'}),r=assess(x),o=json(r);assert.equal(r.status,5);assert.equal(o.observed_tier,'CROSS_PROVIDER_SAME_FAMILY');assert.equal(o.status,'JUDGE_DIVERSITY_BLOCKED');assert.equal(o.pair_allowed,false)});
test('different models at same provider are blocked',()=>{const x=setup({secondaryProvider:'provider-a',secondaryFamily:'family-a'}),r=assess(x),o=json(r);assert.equal(r.status,5);assert.equal(o.observed_tier,'DISTINCT_MODEL_SAME_PROVIDER');assert.equal(o.pair_allowed,false)});
test('same provider and same model is invalid diversity',()=>{const x=setup({secondaryProvider:'provider-a',secondaryFamily:'family-a',secondaryModel:'model-a'}),r=assess(x),o=json(r);assert.equal(r.status,5);assert.equal(o.observed_tier,'INVALID_SAME_MODEL');assert.equal(o.observed_tier_rank,0)});
test('cross-family tier rank is 3',()=>{const x=setup(),o=json(assess(x));assert.equal(o.observed_tier_rank,3)});
test('same-family cross-provider tier rank is 2',()=>{const x=setup({primaryFamily:'shared',secondaryFamily:'shared'}),o=json(assess(x));assert.equal(o.observed_tier_rank,2)});
test('same-provider distinct-model tier rank is 1',()=>{const x=setup({secondaryProvider:'provider-a',secondaryFamily:'family-a'}),o=json(assess(x));assert.equal(o.observed_tier_rank,1)});
test('required tier rank is sealed into decision',()=>{const x=setup(),o=json(assess(x));assert.equal(o.required_tier,'CROSS_FAMILY');assert.equal(o.required_tier_rank,3)});
test('model distinct signal is true for valid cross-family pair',()=>{const x=setup(),o=json(assess(x));assert.equal(o.signals.model_identity_distinct,true)});
test('provider distinct signal reflects provenance',()=>{const x=setup({secondaryProvider:'provider-a',secondaryFamily:'family-a'}),o=json(assess(x));assert.equal(o.signals.provider_id_distinct,false)});
test('provider-family distinct signal reflects provenance',()=>{const x=setup(),o=json(assess(x));assert.equal(o.signals.provider_family_distinct,true)});
test('all supported Judge roles can be assessed',()=>{for(const role of ['requirements','regression','quality','uxui','visual']){const x=setup({role});const r=assess(x);assert.equal(r.status,0,role)}});
test('unknown Judge role is rejected',()=>{const x=setup({role:'security'}),r=assess(x);assert.equal(r.status,3);assert.equal(json(r).status,'JUDGE_ROLE_INVALID')});
test('unbound provider identity is rejected',()=>{const x=setup({secondaryProvider:'SECOND_PROVIDER_ID'}),r=assess(x);assert.equal(r.status,3);assert.ok(json(r).errors.includes('secondary_provider_id_unbound'))});
test('unbound model identity is rejected',()=>{const x=setup({secondaryModel:'SECOND_MODEL_ID'}),r=assess(x);assert.equal(r.status,3);assert.ok(json(r).errors.includes('secondary_model_id_unbound'))});
test('unbound family identity is rejected',()=>{const x=setup({secondaryFamily:'PROVIDER_ID_FAMILY'}),r=assess(x);assert.equal(r.status,3);assert.ok(json(r).errors.includes('secondary_provider_family_unbound'))});
test('missing binding fails closed',()=>{const x=setup();fs.rmSync(x.bindingFile);const r=assess(x);assert.equal(r.status,3);assert.equal(json(r).status,'MODEL_BINDING_MISSING')});

// P1 comparison integration.
test('valid P1 comparison can be qualified by P3',()=>{const x=setup();makeComparison(x);const r=assess(x,['--comparison',x.comparison]),o=json(r);assert.equal(r.status,0);assert.equal(o.comparison.state,'AGREE');assert.match(o.comparison.sha256,/^[a-f0-9]{64}$/)});
test('P3 accepts DISAGREE comparison without deciding outcome',()=>{const x=setup();makeComparison(x,{state:'DISAGREE'});const o=json(assess(x,['--comparison',x.comparison]));assert.equal(o.comparison.state,'DISAGREE');assert.equal(o.final_judge_decision,null)});
test('P3 accepts INCOMPLETE comparison as provenance evidence only',()=>{const x=setup();makeComparison(x,{state:'INCOMPLETE'});const o=json(assess(x,['--comparison',x.comparison]));assert.equal(o.comparison.state,'INCOMPLETE');assert.equal(o.pair_allowed,true)});
test('comparison role mismatch is rejected',()=>{const x=setup({role:'quality'});makeComparison(x,{role:'uxui'});const r=assess(x,['--comparison',x.comparison]);assert.equal(r.status,3);assert.ok(json(r).errors.includes('comparison_role_mismatch'))});
test('comparison primary identity mismatch is rejected',()=>{const x=setup();makeComparison(x,{primaryModel:'other'});const r=assess(x,['--comparison',x.comparison]);assert.ok(json(r).errors.includes('comparison_primary_binding_mismatch'))});
test('comparison secondary identity mismatch is rejected',()=>{const x=setup();makeComparison(x,{secondaryProvider:'other'});const r=assess(x,['--comparison',x.comparison]);assert.ok(json(r).errors.includes('comparison_secondary_binding_mismatch'))});
test('tampered P1 comparison is rejected',()=>{const x=setup();const c=makeComparison(x);c.state='DISAGREE';fs.writeFileSync(x.comparison,JSON.stringify(c));const r=assess(x,['--comparison',x.comparison]);assert.equal(r.status,3);assert.ok(json(r).errors.includes('comparison_integrity_mismatch'))});
test('P3 never claims P1 consensus',()=>{const x=setup();makeComparison(x);const o=json(assess(x,['--comparison',x.comparison]));assert.equal(o.final_judge_decision,null);assert.equal(o.final_judge_decision_authority,'ALEDEVOS_DETERMINISTIC_GATE')});

// Decision evidence + tamper resistance.
test('fresh P3 decision verifies',()=>{const x=setup();assess(x);const r=run(['pair','verify','--decision',x.decision,'--binding',x.bindingFile],x.d);assert.equal(r.status,0);assert.equal(json(r).status,'JUDGE_DIVERSITY_DECISION_VALID')});
test('fresh decision with comparison verifies against both sources',()=>{const x=setup();makeComparison(x);assess(x,['--comparison',x.comparison]);const r=run(['pair','verify','--decision',x.decision,'--binding',x.bindingFile,'--comparison',x.comparison],x.d);assert.equal(r.status,0)});
test('decision hash tamper is detected',()=>{const x=setup();assess(x);const o=JSON.parse(fs.readFileSync(x.decision));o.pair_allowed=false;fs.writeFileSync(x.decision,JSON.stringify(o));const r=run(['pair','verify','--decision',x.decision],x.d);assert.ok(json(r).errors.includes('integrity_mismatch'))});
test('rehashed false diversity tier is detected',()=>{const x=setup();assess(x);const o=JSON.parse(fs.readFileSync(x.decision));o.observed_tier='CROSS_PROVIDER_SAME_FAMILY';o.observed_tier_rank=2;o.decision_sha256=hashObj(o);fs.writeFileSync(x.decision,JSON.stringify(o));const r=run(['pair','verify','--decision',x.decision],x.d);assert.ok(json(r).errors.includes('observed_tier_drift'))});
test('rehashed pair allowance drift is detected',()=>{const x=setup();assess(x);const o=JSON.parse(fs.readFileSync(x.decision));o.pair_allowed=false;o.status='JUDGE_DIVERSITY_BLOCKED';o.decision_sha256=hashObj(o);fs.writeFileSync(x.decision,JSON.stringify(o));const r=run(['pair','verify','--decision',x.decision],x.d);assert.ok(json(r).errors.includes('diversity_decision_drift'))});
test('rehashed signal drift is detected',()=>{const x=setup();assess(x);const o=JSON.parse(fs.readFileSync(x.decision));o.signals.provider_family_distinct=false;o.decision_sha256=hashObj(o);fs.writeFileSync(x.decision,JSON.stringify(o));const r=run(['pair','verify','--decision',x.decision],x.d);assert.ok(json(r).errors.includes('signal_drift'))});
test('fallback activation is rejected',()=>{const x=setup();assess(x);const o=JSON.parse(fs.readFileSync(x.decision));o.fallback_used=true;o.decision_sha256=hashObj(o);fs.writeFileSync(x.decision,JSON.stringify(o));assert.ok(json(run(['pair','verify','--decision',x.decision],x.d)).errors.includes('fallback_premature'))});
test('replacement model is rejected in P3',()=>{const x=setup();assess(x);const o=JSON.parse(fs.readFileSync(x.decision));o.replacement_model={model_id:'x'};o.decision_sha256=hashObj(o);fs.writeFileSync(x.decision,JSON.stringify(o));assert.ok(json(run(['pair','verify','--decision',x.decision],x.d)).errors.includes('fallback_premature'))});
test('router override is rejected in P3',()=>{const x=setup();assess(x);const o=JSON.parse(fs.readFileSync(x.decision));o.router_override=true;o.decision_sha256=hashObj(o);fs.writeFileSync(x.decision,JSON.stringify(o));assert.ok(json(run(['pair','verify','--decision',x.decision],x.d)).errors.includes('phase_boundary_invalid'))});
test('final Judge decision injection is rejected',()=>{const x=setup();assess(x);const o=JSON.parse(fs.readFileSync(x.decision));o.final_judge_decision='PASS';o.decision_sha256=hashObj(o);fs.writeFileSync(x.decision,JSON.stringify(o));assert.ok(json(run(['pair','verify','--decision',x.decision],x.d)).errors.includes('judge_authority_invalid'))});
test('semantic independence overclaim is rejected',()=>{const x=setup();assess(x);const o=JSON.parse(fs.readFileSync(x.decision));o.semantic_independence_claimed=true;o.decision_sha256=hashObj(o);fs.writeFileSync(x.decision,JSON.stringify(o));assert.ok(json(run(['pair','verify','--decision',x.decision],x.d)).errors.includes('provenance_boundary_invalid'))});
test('binding drift is detected when source binding changes',()=>{const x=setup();assess(x);const b=JSON.parse(fs.readFileSync(x.bindingFile));b.slots.secondary.model_id='model-c';fs.writeFileSync(x.bindingFile,JSON.stringify(b));const r=run(['pair','verify','--decision',x.decision,'--binding',x.bindingFile],x.d);assert.ok(json(r).errors.some(e=>e.includes('binding_')))});
test('comparison drift is detected when comparison changes',()=>{const x=setup();makeComparison(x);assess(x,['--comparison',x.comparison]);const c=JSON.parse(fs.readFileSync(x.comparison));c.created_at='changed';c.comparison_sha256=hashObj(c);fs.writeFileSync(x.comparison,JSON.stringify(c));const r=run(['pair','verify','--decision',x.decision,'--comparison',x.comparison],x.d);assert.ok(json(r).errors.includes('comparison_hash_drift'))});

// Certification + phase isolation + install layout.
test('P3 package certificate can be generated',()=>{const d=tmp(),f=path.join(d,'cert.json'),r=run(['certify','run','--out',f]);assert.equal(r.status,0);assert.equal(json(r).status,'MULTIMODEL_P3_PACKAGE_CERTIFIED')});
test('fresh P3 package certificate verifies',()=>{const d=tmp(),f=path.join(d,'cert.json');run(['certify','run','--out',f]);const r=run(['certify','verify','--certificate',f]);assert.equal(r.status,0);assert.equal(json(r).status,'MULTIMODEL_P3_CERTIFICATE_VALID')});
test('P3 certificate explicitly defers target runtime validation',()=>{const d=tmp(),f=path.join(d,'cert.json');run(['certify','run','--out',f]);const o=JSON.parse(fs.readFileSync(f));assert.equal(o.package_only,true);assert.equal(o.target_runtime_validation,'DEFERRED')});
test('P3 certificate uses root-relative portable paths',()=>{const d=tmp(),f=path.join(d,'cert.json');run(['certify','run','--out',f]);for(const x of JSON.parse(fs.readFileSync(f)).inputs){assert.equal(path.isAbsolute(x.path),false);assert.equal(x.path.includes('..'),false)}});
test('P3 certificate tamper is detected',()=>{const d=tmp(),f=path.join(d,'cert.json');run(['certify','run','--out',f]);const o=JSON.parse(fs.readFileSync(f));o.claims.semantic_independence_not_claimed=false;fs.writeFileSync(f,JSON.stringify(o));const r=run(['certify','verify','--certificate',f]);assert.ok(json(r).errors.includes('certificate_integrity_mismatch'))});
test('P3 policy drift invalidates P3 certificate',()=>{const d=tmp(),f=path.join(d,'cert.json'),p='multimodel/policies/judge-diversity-policy.json',bak=fs.readFileSync(p);run(['certify','run','--out',f]);try{fs.appendFileSync(p,'\n ');const r=run(['certify','verify','--certificate',f]);assert.ok(json(r).errors.some(x=>x.includes('judge-diversity-policy.json')))}finally{fs.writeFileSync(p,bak)}});
test('P1 certificate remains valid after P3',()=>{const r=run(['certify','verify','--certificate','release/certifications/multimodel-p1.json'],root,p1);assert.equal(r.status,0,r.stdout+r.stderr)});
test('refreshed P2 certificate remains valid after shared installer extension hook',()=>{const r=run(['certify','verify','--certificate','release/certifications/multimodel-p2.json'],root,p2);assert.equal(r.status,0,r.stdout+r.stderr)});
test('P2 router remains diversity-disabled',()=>{const p=JSON.parse(fs.readFileSync('multimodel/policies/model-router-policy.json'));assert.equal(p.rules.provider_diversity_enforced,false)});
test('P1 registry still says diversity deferred to P3',()=>assert.equal(JSON.parse(fs.readFileSync('multimodel/registry/model-registry.json')).rules.provider_diversity_deferred_to,'MULTIMODEL_P3_JUDGE_DIVERSITY'));
test('installer projects Multi-Model forward extensions recursively',()=>{const s=fs.readFileSync('scripts/05-install-into-project.ps1','utf8');assert.match(s,/multimodel\\extensions/i);assert.match(s,/Get-ChildItem \$mmExt -Recurse -File/)});
test('installer creates P3 diversity state directory',()=>assert.match(fs.readFileSync('scripts/05-install-into-project.ps1','utf8'),/state\\multimodel\\phase3\\diversity/i));
test('installed extension layout executes same cross-family decision',()=>{const x=setup(),mm=path.join(x.d,'.aledevos/multimodel');fs.mkdirSync(path.join(mm,'extensions/diversity'),{recursive:true});for(const dir of ['policies','schemas','templates'])fs.cpSync(path.join(root,'multimodel',dir),path.join(mm,dir),{recursive:true});fs.copyFileSync(p3,path.join(mm,'extensions/diversity/judge-diversity.mjs'));const r=spawnSync(process.execPath,[path.join(mm,'extensions/diversity/judge-diversity.mjs'),'pair','assess','--binding',x.bindingFile,'--judge-role','quality'],{cwd:x.d,encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(JSON.parse(r.stdout).observed_tier,'CROSS_FAMILY')});
test('P3 source contains no adapter-specific runtime names',()=>{const s=fs.readFileSync(p3,'utf8').toLowerCase();for(const n of ['opencode','codex','claude code','antigravity'])assert.equal(s.includes(n),false)});
test('P3 decision schema exists and parses',()=>assert.doesNotThrow(()=>JSON.parse(fs.readFileSync('multimodel/schemas/judge-diversity-decision.schema.json'))));
test('P3 example makes no PASS claim',()=>{const e=JSON.parse(fs.readFileSync('multimodel/templates/judge-diversity-decision.example.json'));assert.equal(e.status,'JUDGE_DIVERSITY_BLOCKED');assert.equal(e.final_judge_decision,null)});
