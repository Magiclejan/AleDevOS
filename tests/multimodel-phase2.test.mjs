import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const router=path.join(root,'multimodel/router/model-router.mjs');
const p1=path.join(root,'multimodel/engine/multimodel.mjs');
const run=(args,cwd=root)=>spawnSync(process.execPath,[router,...args],{cwd,encoding:'utf8'});
const runP1=(args,cwd=root)=>spawnSync(process.execPath,[p1,...args],{cwd,encoding:'utf8'});
const json=r=>JSON.parse(r.stdout||'{}');
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-mm-p2-'));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).filter(k=>!['route_sha256','evidence_sha256'].includes(k)).sort().map(k=>[k,stable(v[k])])):v;
const hashObj=v=>crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
function setup(opts={}){
 const d=tmp();
 const primary={provider_id:'provider-a',model_id:'model-a',provider_family:opts.primaryFamily??'family-a',modalities:opts.primaryModalities??['text','image'],context_window_tokens:opts.primaryContext??131072,cost_class:opts.primaryCost??'local',runtime_ready:opts.primaryReady??true,runtime_evidence:'test://primary'};
 const secondary={provider_id:'provider-b',model_id:'model-b',provider_family:opts.secondaryFamily??'family-b',modalities:opts.secondaryModalities??['text','image'],context_window_tokens:opts.secondaryContext??262144,cost_class:opts.secondaryCost??'standard',runtime_ready:opts.secondaryReady??true,runtime_evidence:'test://secondary'};
 if(opts.primaryModel!==undefined)primary.model_id=opts.primaryModel;if(opts.secondaryModel!==undefined)secondary.model_id=opts.secondaryModel;if(opts.primaryProvider!==undefined)primary.provider_id=opts.primaryProvider;if(opts.secondaryProvider!==undefined)secondary.provider_id=opts.secondaryProvider;
 const binding={schema_version:'1.0',binding_id:'route-binding',target_runtime:opts.targetRuntime??'TEST_RUNTIME',slots:{primary,secondary}};
 const request={schema_version:'1.0',task_id:'TASK-ROUTE-1',judge_role:opts.role??'quality',required_modalities:opts.requiredModalities??['text'],estimated_context_tokens:opts.estimatedContext??32000,max_cost_class:opts.maxCost??'premium',selection_priority:opts.priority??'COST_THEN_CONTEXT'};
 const bindingFile=path.join(d,'binding.json'),requestFile=path.join(d,'request.json'),routeFile=path.join(d,'route.json');
 fs.writeFileSync(bindingFile,JSON.stringify(binding,null,2));fs.writeFileSync(requestFile,JSON.stringify(request,null,2));
 return{d,binding,request,bindingFile,requestFile,routeFile};
}
const decide=x=>run(['route','decide','--binding',x.bindingFile,'--request',x.requestFile,'--out',x.routeFile],x.d);

// Policy contract.
test('P2 router policy validates',()=>{const r=run(['policy','verify']);assert.equal(r.status,0);assert.equal(json(r).status,'MODEL_ROUTER_POLICY_VALID')});
test('router phase identity is P2',()=>assert.equal(JSON.parse(fs.readFileSync('multimodel/policies/model-router-policy.json')).phase,'MULTIMODEL_P2_MODEL_ROUTER'));
test('router requires runtime readiness',()=>assert.equal(JSON.parse(fs.readFileSync('multimodel/policies/model-router-policy.json')).rules.runtime_ready_required,true));
test('router uses explicit bound models only',()=>assert.equal(JSON.parse(fs.readFileSync('multimodel/policies/model-router-policy.json')).rules.route_only_explicit_bound_models,true));
test('adapter identity is forbidden as routing input',()=>assert.equal(JSON.parse(fs.readFileSync('multimodel/policies/model-router-policy.json')).rules.adapter_identity_is_not_a_routing_input,true));
test('provider diversity remains deferred to P3',()=>{const p=JSON.parse(fs.readFileSync('multimodel/policies/model-router-policy.json'));assert.equal(p.rules.provider_diversity_enforced,false);assert.equal(p.rules.provider_diversity_deferred_to,'MULTIMODEL_P3_JUDGE_DIVERSITY')});
test('automatic fallback remains deferred to P4',()=>{const p=JSON.parse(fs.readFileSync('multimodel/policies/model-router-policy.json'));assert.equal(p.rules.automatic_fallback_enabled,false);assert.equal(p.rules.fallback_deferred_to,'MULTIMODEL_P4_MODEL_FALLBACK')});
test('router preserves deterministic final Judge authority',()=>assert.equal(JSON.parse(fs.readFileSync('multimodel/policies/model-router-policy.json')).rules.final_judge_decision_authority,'ALEDEVOS_DETERMINISTIC_GATE'));
test('router has explicit context safety reserve',()=>assert.equal(JSON.parse(fs.readFileSync('multimodel/policies/model-router-policy.json')).context_safety_reserve_tokens,8192));
test('router supports deterministic cost and context priorities',()=>assert.deepEqual(JSON.parse(fs.readFileSync('multimodel/policies/model-router-policy.json')).selection_priorities,['COST_THEN_CONTEXT','CONTEXT_THEN_COST']));

// Request validation.
test('valid route request passes',()=>{const x=setup(),r=run(['request','verify','--request',x.requestFile],x.d);assert.equal(r.status,0);assert.equal(json(r).status,'MODEL_ROUTE_REQUEST_VALID')});
test('route request requires schema 1.0',()=>{const x=setup();x.request.schema_version='2.0';fs.writeFileSync(x.requestFile,JSON.stringify(x.request));const r=run(['request','verify','--request',x.requestFile],x.d);assert.equal(r.status,3);assert.ok(json(r).errors.includes('schema_version_invalid'))});
test('route request requires task id',()=>{const x=setup();delete x.request.task_id;fs.writeFileSync(x.requestFile,JSON.stringify(x.request));const r=run(['request','verify','--request',x.requestFile],x.d);assert.equal(r.status,3);assert.ok(json(r).errors.includes('task_id_missing'))});
test('unknown Judge role is rejected',()=>{const x=setup();x.request.judge_role='security-root';fs.writeFileSync(x.requestFile,JSON.stringify(x.request));assert.ok(json(run(['request','verify','--request',x.requestFile],x.d)).errors.includes('judge_role_invalid'))});
test('negative context estimate is rejected',()=>{const x=setup();x.request.estimated_context_tokens=-1;fs.writeFileSync(x.requestFile,JSON.stringify(x.request));assert.ok(json(run(['request','verify','--request',x.requestFile],x.d)).errors.includes('estimated_context_tokens_invalid'))});
test('invalid required modalities are rejected',()=>{const x=setup();x.request.required_modalities=['text',''];fs.writeFileSync(x.requestFile,JSON.stringify(x.request));assert.ok(json(run(['request','verify','--request',x.requestFile],x.d)).errors.includes('required_modalities_invalid'))});
test('invalid selection priority is rejected',()=>{const x=setup();x.request.selection_priority='MAGIC';fs.writeFileSync(x.requestFile,JSON.stringify(x.request));assert.ok(json(run(['request','verify','--request',x.requestFile],x.d)).errors.includes('selection_priority_invalid'))});
test('invalid max cost class is rejected',()=>{const x=setup();x.request.max_cost_class='ultra';fs.writeFileSync(x.requestFile,JSON.stringify(x.request));assert.ok(json(run(['request','verify','--request',x.requestFile],x.d)).errors.includes('max_cost_class_invalid'))});
test('adapter field is rejected rather than becoming a routing hint',()=>{const x=setup();x.request.adapter='codex';fs.writeFileSync(x.requestFile,JSON.stringify(x.request));const o=json(run(['request','verify','--request',x.requestFile],x.d));assert.ok(o.errors.includes('unknown_field:adapter'))});
test('provider preference field is rejected in P2',()=>{const x=setup();x.request.preferred_provider='family-b';fs.writeFileSync(x.requestFile,JSON.stringify(x.request));const o=json(run(['request','verify','--request',x.requestFile],x.d));assert.ok(o.errors.includes('unknown_field:preferred_provider'))});

// Deterministic eligibility + routing.
test('cost-first selects cheapest eligible model',()=>{const x=setup(),o=json(decide(x));assert.equal(o.selected.slot,'primary');assert.equal(o.selected.cost_class,'local')});
test('context-first selects model with larger headroom',()=>{const x=setup({priority:'CONTEXT_THEN_COST'}),o=json(decide(x));assert.equal(o.selected.slot,'secondary')});
test('equal cost uses larger context headroom as tie break',()=>{const x=setup({primaryCost:'standard',secondaryCost:'standard'}),o=json(decide(x));assert.equal(o.selected.slot,'secondary')});
test('exact tie uses stable primary slot order',()=>{const x=setup({primaryCost:'standard',secondaryCost:'standard',primaryContext:262144,secondaryContext:262144}),o=json(decide(x));assert.equal(o.selected.slot,'primary')});
test('unready cheaper model is ineligible',()=>{const x=setup({primaryReady:false}),o=json(decide(x));assert.equal(o.selected.slot,'secondary');assert.ok(o.candidates[0].reasons.includes('RUNTIME_NOT_READY'))});
test('all unready models block routing',()=>{const x=setup({primaryReady:false,secondaryReady:false}),r=decide(x);assert.equal(r.status,5);assert.equal(json(r).status,'MODEL_ROUTE_BLOCKED')});
test('placeholder model id is ineligible',()=>{const x=setup({primaryModel:'PRIMARY_MODEL_ID'}),o=json(decide(x));assert.equal(o.selected.slot,'secondary');assert.ok(o.candidates[0].reasons.includes('MODEL_UNBOUND'))});
test('both placeholder models block routing',()=>{const x=setup({primaryModel:'PRIMARY_MODEL_ID',secondaryModel:'SECOND_MODEL_ID'}),r=decide(x);assert.equal(r.status,5);assert.equal(json(r).selected,null)});
test('visual routing automatically requires image modality',()=>{const x=setup({role:'visual',primaryModalities:['text'],secondaryModalities:['text','image']}),o=json(decide(x));assert.equal(o.selected.slot,'secondary');assert.ok(o.request.required_modalities.includes('image'))});
test('visual routing blocks when no image model exists',()=>{const x=setup({role:'visual',primaryModalities:['text'],secondaryModalities:['text']}),r=decide(x);assert.equal(r.status,5);assert.equal(json(r).status,'MODEL_ROUTE_BLOCKED')});
test('explicit additional modality is a hard constraint',()=>{const x=setup({requiredModalities:['text','audio'],primaryModalities:['text'],secondaryModalities:['text','audio']}),o=json(decide(x));assert.equal(o.selected.slot,'secondary')});
test('context-insufficient cheaper model is skipped',()=>{const x=setup({primaryContext:40000,estimatedContext:35000}),o=json(decide(x));assert.equal(o.selected.slot,'secondary');assert.ok(o.candidates[0].reasons.includes('CONTEXT_WINDOW_INSUFFICIENT'))});
test('all context-insufficient models block routing',()=>{const x=setup({primaryContext:40000,secondaryContext:42000,estimatedContext:35000}),r=decide(x);assert.equal(r.status,5);assert.equal(json(r).status,'MODEL_ROUTE_BLOCKED')});
test('context safety reserve is actually applied',()=>{const x=setup({primaryContext:40000,estimatedContext:32000}),o=json(decide(x));assert.equal(o.candidates[0].required_context_tokens,40192);assert.ok(o.candidates[0].reasons.includes('CONTEXT_WINDOW_INSUFFICIENT'))});
test('cost ceiling excludes too-expensive model',()=>{const x=setup({primaryReady:false,secondaryCost:'premium',maxCost:'standard'}),r=decide(x);assert.equal(r.status,5);assert.ok(json(r).candidates[1].reasons.includes('COST_CEILING_EXCEEDED'))});
test('unknown cost class is not silently ranked',()=>{const x=setup({primaryCost:'mystery'}),o=json(decide(x));assert.equal(o.selected.slot,'secondary');assert.ok(o.candidates[0].reasons.includes('COST_CLASS_UNKNOWN'))});
test('local ceiling routes only local/free candidates',()=>{const x=setup({maxCost:'local'}),o=json(decide(x));assert.equal(o.selected.slot,'primary');assert.ok(o.candidates[1].reasons.includes('COST_CEILING_EXCEEDED'))});
test('same provider family does not trigger diversity policy in P2',()=>{const x=setup({primaryFamily:'same',secondaryFamily:'same',priority:'CONTEXT_THEN_COST'}),o=json(decide(x));assert.equal(o.selected.slot,'secondary');assert.equal(o.diversity_policy_used,false)});
test('target runtime label does not affect model choice',()=>{const a=setup({targetRuntime:'OPENCODE'}),b=setup({targetRuntime:'CLAUDE_CODE'});assert.equal(json(decide(a)).selected.model_id,json(decide(b)).selected.model_id)});
test('route decision carries selected provider and model provenance',()=>{const x=setup(),o=json(decide(x));assert.equal(o.selected.provider_id,'provider-a');assert.equal(o.selected.model_id,'model-a')});
test('route decision has no fallback chain in P2',()=>{const x=setup(),o=json(decide(x));assert.equal(o.fallback_used,false);assert.deepEqual(o.fallback_candidates,[])});
test('route decision does not set final Judge decision',()=>{const x=setup(),o=json(decide(x));assert.equal(o.final_judge_decision,null);assert.equal(o.final_judge_decision_authority,'ALEDEVOS_DETERMINISTIC_GATE')});
test('route evidence seals request binding and policy hashes',()=>{const x=setup(),o=json(decide(x));assert.match(o.request_source.sha256,/^[a-f0-9]{64}$/);assert.match(o.binding.sha256,/^[a-f0-9]{64}$/);assert.match(o.policy.sha256,/^[a-f0-9]{64}$/);assert.match(o.route_sha256,/^[a-f0-9]{64}$/)});

// Route verification and tamper resistance.
test('fresh route verifies',()=>{const x=setup();assert.equal(decide(x).status,0);const r=run(['route','verify','--route',x.routeFile],x.d);assert.equal(r.status,0);assert.equal(json(r).status,'MODEL_ROUTE_DECISION_VALID')});
test('route hash tamper is detected',()=>{const x=setup();decide(x);const o=JSON.parse(fs.readFileSync(x.routeFile));o.selected.model_id='tampered';fs.writeFileSync(x.routeFile,JSON.stringify(o));const r=run(['route','verify','--route',x.routeFile],x.d);assert.ok(json(r).errors.includes('integrity_mismatch'))});
test('rehashed wrong selection still fails deterministic verification',()=>{const x=setup();decide(x);const o=JSON.parse(fs.readFileSync(x.routeFile));o.selected={...o.selected,slot:'secondary',provider_id:'provider-b',model_id:'model-b'};o.route_sha256=hashObj(o);fs.writeFileSync(x.routeFile,JSON.stringify(o));const r=run(['route','verify','--route',x.routeFile],x.d);assert.ok(json(r).errors.includes('selection_not_deterministic'))});
test('rehashed candidate drift is detected',()=>{const x=setup();decide(x);const o=JSON.parse(fs.readFileSync(x.routeFile));o.candidates[0].eligible=false;o.candidates[0].reasons=['FAKE'];o.route_sha256=hashObj(o);fs.writeFileSync(x.routeFile,JSON.stringify(o));const r=run(['route','verify','--route',x.routeFile],x.d);assert.ok(json(r).errors.includes('candidate_evaluation_drift'))});
test('fallback activation is rejected even with a rehashed route',()=>{const x=setup();decide(x);const o=JSON.parse(fs.readFileSync(x.routeFile));o.fallback_used=true;o.route_sha256=hashObj(o);fs.writeFileSync(x.routeFile,JSON.stringify(o));assert.ok(json(run(['route','verify','--route',x.routeFile],x.d)).errors.includes('fallback_premature'))});
test('diversity activation is rejected even with a rehashed route',()=>{const x=setup();decide(x);const o=JSON.parse(fs.readFileSync(x.routeFile));o.diversity_policy_used=true;o.route_sha256=hashObj(o);fs.writeFileSync(x.routeFile,JSON.stringify(o));assert.ok(json(run(['route','verify','--route',x.routeFile],x.d)).errors.includes('diversity_premature'))});
test('router cannot claim final Judge verdict',()=>{const x=setup();decide(x);const o=JSON.parse(fs.readFileSync(x.routeFile));o.final_judge_decision='PASS';o.route_sha256=hashObj(o);fs.writeFileSync(x.routeFile,JSON.stringify(o));assert.ok(json(run(['route','verify','--route',x.routeFile],x.d)).errors.includes('judge_authority_invalid'))});
test('route phase tamper is rejected',()=>{const x=setup();decide(x);const o=JSON.parse(fs.readFileSync(x.routeFile));o.phase='MULTIMODEL_P3';o.route_sha256=hashObj(o);fs.writeFileSync(x.routeFile,JSON.stringify(o));assert.ok(json(run(['route','verify','--route',x.routeFile],x.d)).errors.includes('phase_or_schema_invalid'))});

// Certification + phase isolation + installation.
test('P2 package certificate can be generated',()=>{const d=tmp(),f=path.join(d,'cert.json'),r=run(['certify','run','--out',f]);assert.equal(r.status,0);assert.equal(json(r).status,'MULTIMODEL_P2_PACKAGE_CERTIFIED')});
test('fresh P2 package certificate verifies',()=>{const d=tmp(),f=path.join(d,'cert.json');run(['certify','run','--out',f]);const r=run(['certify','verify','--certificate',f]);assert.equal(r.status,0);assert.equal(json(r).status,'MULTIMODEL_P2_CERTIFICATE_VALID')});
test('P2 certificate explicitly defers target runtime validation',()=>{const d=tmp(),f=path.join(d,'cert.json');run(['certify','run','--out',f]);const o=JSON.parse(fs.readFileSync(f));assert.equal(o.package_only,true);assert.equal(o.target_runtime_validation,'DEFERRED')});
test('P2 certificate paths are root-relative and portable',()=>{const d=tmp(),f=path.join(d,'cert.json');run(['certify','run','--out',f]);for(const x of JSON.parse(fs.readFileSync(f)).inputs){assert.equal(path.isAbsolute(x.path),false);assert.equal(x.path.includes('..'),false)}});
test('P2 certificate tamper is detected',()=>{const d=tmp(),f=path.join(d,'cert.json');run(['certify','run','--out',f]);const o=JSON.parse(fs.readFileSync(f));o.claims.automatic_fallback_not_implemented=false;fs.writeFileSync(f,JSON.stringify(o));const r=run(['certify','verify','--certificate',f]);assert.equal(r.status,4);assert.ok(json(r).errors.includes('certificate_integrity_mismatch'))});
test('router policy drift invalidates P2 certificate',()=>{const d=tmp(),f=path.join(d,'cert.json'),p='multimodel/policies/model-router-policy.json',bak=fs.readFileSync(p);run(['certify','run','--out',f]);try{fs.appendFileSync(p,'\n ');const r=run(['certify','verify','--certificate',f]);assert.equal(r.status,4);assert.ok(json(r).errors.some(x=>x.includes('model-router-policy.json')))}finally{fs.writeFileSync(p,bak)}});
test('P1 certificate remains valid after P2 implementation',()=>{const r=runP1(['certify','verify','--certificate','release/certifications/multimodel-p1.json']);assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(json(r).status,'MULTIMODEL_P1_CERTIFICATE_VALID')});
test('P1 engine still reports router_used false in P1 comparison',()=>{const s=fs.readFileSync('multimodel/engine/multimodel.mjs','utf8');assert.match(s,/router_used:false/)});
test('installer projects P2 router runtime',()=>assert.match(fs.readFileSync('scripts/05-install-into-project.ps1','utf8'),/model-router\.mjs/i));
test('installer projects all Multi-Model policies including P2',()=>{const s=fs.readFileSync('scripts/05-install-into-project.ps1','utf8');assert.match(s,/multimodel\\policies/i);assert.match(s,/Get-ChildItem/)});
test('installer creates P2 route state directory',()=>assert.match(fs.readFileSync('scripts/05-install-into-project.ps1','utf8'),/state\\multimodel\\phase2\\routes/i));
test('installed router layout executes same deterministic route',()=>{
 const x=setup(),mm=path.join(x.d,'.aledevos/multimodel');fs.mkdirSync(path.join(mm,'router'),{recursive:true});for(const dir of ['registry','policies','schemas','templates'])fs.cpSync(path.join(root,'multimodel',dir),path.join(mm,dir),{recursive:true});fs.copyFileSync(router,path.join(mm,'router/model-router.mjs'));
 const r=spawnSync(process.execPath,[path.join(mm,'router/model-router.mjs'),'route','decide','--binding',x.bindingFile,'--request',x.requestFile],{cwd:x.d,encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(JSON.parse(r.stdout).selected.model_id,'model-a');
});
test('P2 router source contains no adapter-specific runtime names',()=>{const s=fs.readFileSync('multimodel/router/model-router.mjs','utf8').toLowerCase();for(const n of ['opencode','codex','claude code','antigravity'])assert.equal(s.includes(n),false)});
test('P2 docs boundary forbids diversity and fallback',()=>{const p=JSON.parse(fs.readFileSync('multimodel/policies/model-router-policy.json'));assert.equal(p.rules.provider_diversity_enforced,false);assert.equal(p.rules.automatic_fallback_enabled,false)});
