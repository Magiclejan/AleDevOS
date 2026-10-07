import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const p4=path.join(root,'multimodel/extensions/fallback/model-fallback.mjs');
const p3=path.join(root,'multimodel/extensions/diversity/judge-diversity.mjs');
const p2=path.join(root,'multimodel/router/model-router.mjs');
const p1=path.join(root,'multimodel/engine/multimodel.mjs');
const run=(argv,cwd=root,script=p4)=>spawnSync(process.execPath,[script,...argv],{cwd,encoding:'utf8'});
const json=r=>JSON.parse(r.stdout||'{}');
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-mm-p4-'));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).filter(k=>!['decision_sha256','evidence_sha256','route_sha256','comparison_sha256'].includes(k)).sort().map(k=>[k,stable(v[k])])):v;
const hashObj=v=>crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const write=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));

function baseBinding(over={}){
 const b={schema_version:'1.0',binding_id:'binding-1',target_runtime:'fixture',slots:{
  primary:{provider_id:'openai',provider_family:'openai',model_id:'model-a',modalities:['text','image'],context_window_tokens:200000,cost_class:'standard',runtime_ready:true,runtime_evidence:{ok:true}},
  secondary:{provider_id:'anthropic',provider_family:'anthropic',model_id:'model-b',modalities:['text','image'],context_window_tokens:200000,cost_class:'standard',runtime_ready:true,runtime_evidence:{ok:true}}
 }};
 return Object.assign(b,over);
}
function baseRequest(over={}){return{schema_version:'1.0',task_id:'task-1',judge_role:'quality',required_modalities:['text'],estimated_context_tokens:10000,max_cost_class:'premium',selection_priority:'COST_THEN_CONTEXT',...over}}
function candidate(id='model-c',over={}){return{priority:1,provider_id:'google',provider_family:'google',model_id:id,modalities:['text','image'],context_window_tokens:300000,cost_class:'low',runtime_ready:true,runtime_evidence:{ok:true},...over}}
function basePlan(over={}){return{schema_version:'1.0',plan_id:'plan-1',task_id:'task-1',judge_role:'quality',target_slot:'primary',max_hops:2,candidates:[candidate()],...over}}
function baseTrigger(over={}){return{schema_version:'1.0',phase:'MULTIMODEL_P4_FALLBACK_TRIGGER',task_id:'task-1',judge_role:'quality',failed_slot:'primary',failure_code:'RUNTIME_UNAVAILABLE',failed_model:{provider_id:'openai',provider_family:'openai',model_id:'model-a'},previous_attempts:[],...over}}
function setup({binding=baseBinding(),request=baseRequest(),plan=basePlan(),trigger=baseTrigger(),route=true,diversity=false}={}){
 const d=tmp(), files={d,binding:path.join(d,'binding.json'),request:path.join(d,'request.json'),plan:path.join(d,'plan.json'),trigger:path.join(d,'trigger.json'),route:path.join(d,'route.json'),diversity:path.join(d,'diversity.json'),decision:path.join(d,'decision.json'),replacement:path.join(d,'binding2.json')};
 write(files.binding,binding);write(files.request,request);write(files.plan,plan);write(files.trigger,trigger);
 if(route){const rr=run(['route','decide','--binding',files.binding,'--request',files.request,'--out',files.route],d,p2);assert.equal(rr.status,0,rr.stdout+rr.stderr)}
 if(diversity){run(['pair','assess','--binding',files.binding,'--judge-role',request.judge_role,'--out',files.diversity],d,p3)}
 return files;
}
function resolve(x,extra=[]){return run(['fallback','resolve','--binding',x.binding,'--request',x.request,'--plan',x.plan,'--trigger',x.trigger,...(fs.existsSync(x.route)?['--route',x.route]:[]),...(fs.existsSync(x.diversity)?['--diversity',x.diversity]:[]),'--out',x.decision,...extra],x.d)}
function verify(x){return run(['fallback','verify','--decision',x.decision,'--binding',x.binding,'--request',x.request,'--plan',x.plan,'--trigger',x.trigger,...(fs.existsSync(x.route)?['--route',x.route]:[]),...(fs.existsSync(x.diversity)?['--diversity',x.diversity]:[])],x.d)}

// Policy contract.
test('P4 policy verifies',()=>assert.equal(run(['policy','verify']).status,0));
test('P4 policy phase is exact',()=>assert.equal(read(path.join(root,'multimodel/policies/model-fallback-policy.json')).phase,'MULTIMODEL_P4_MODEL_FALLBACK'));
test('fallback is bounded to two hops',()=>assert.equal(read(path.join(root,'multimodel/policies/model-fallback-policy.json')).max_fallback_hops,2));
test('explicit fallback plan is mandatory policy',()=>assert.equal(read(path.join(root,'multimodel/policies/model-fallback-policy.json')).rules.explicit_plan_only,true));
test('runtime readiness remains hard',()=>assert.equal(read(path.join(root,'multimodel/policies/model-fallback-policy.json')).rules.runtime_ready_required,true));
test('modalities remain hard',()=>assert.equal(read(path.join(root,'multimodel/policies/model-fallback-policy.json')).rules.required_modalities_are_hard_constraints,true));
test('context remains hard',()=>assert.equal(read(path.join(root,'multimodel/policies/model-fallback-policy.json')).rules.context_fit_is_hard_constraint,true));
test('cost remains hard',()=>assert.equal(read(path.join(root,'multimodel/policies/model-fallback-policy.json')).rules.cost_ceiling_is_hard_constraint,true));
test('diversity remains hard',()=>assert.equal(read(path.join(root,'multimodel/policies/model-fallback-policy.json')).rules.diversity_gate_is_hard_constraint,true));
test('provider discovery is disabled',()=>assert.equal(read(path.join(root,'multimodel/policies/model-fallback-policy.json')).rules.automatic_provider_discovery,false));
test('model discovery is disabled',()=>assert.equal(read(path.join(root,'multimodel/policies/model-fallback-policy.json')).rules.automatic_model_discovery,false));
test('adapter is never a fallback input',()=>assert.equal(read(path.join(root,'multimodel/policies/model-fallback-policy.json')).rules.adapter_identity_is_not_a_fallback_input,true));
test('Judge outcome shopping is disabled',()=>assert.equal(read(path.join(root,'multimodel/policies/model-fallback-policy.json')).rules.fallback_on_judge_outcome,false));
test('fresh P2 is mandatory after replacement',()=>assert.equal(read(path.join(root,'multimodel/policies/model-fallback-policy.json')).rules.replacement_requires_fresh_p2_route,true));
test('fresh P3 is mandatory after replacement',()=>assert.equal(read(path.join(root,'multimodel/policies/model-fallback-policy.json')).rules.replacement_requires_fresh_p3_diversity,true));

// Plan and trigger validation.
test('valid fallback plan passes',()=>{const x=setup();assert.equal(run(['plan','verify','--plan',x.plan],x.d).status,0)});
test('plan above two hops is invalid',()=>{const x=setup({plan:basePlan({max_hops:3})});assert.equal(run(['plan','verify','--plan',x.plan],x.d).status,3)});
test('plan duplicate model identities are invalid',()=>{const x=setup({plan:basePlan({candidates:[candidate(),candidate('model-c',{priority:2})]})});assert.ok(json(run(['plan','verify','--plan',x.plan],x.d)).errors.includes('candidate_1_duplicate_identity'))});
test('plan placeholder candidate is invalid',()=>{const x=setup({plan:basePlan({candidates:[candidate('MODEL_ID')]})});assert.equal(run(['plan','verify','--plan',x.plan],x.d).status,3)});
test('candidate without text is invalid at plan layer',()=>{const x=setup({plan:basePlan({candidates:[candidate('x',{modalities:['image']})]})});assert.equal(run(['plan','verify','--plan',x.plan],x.d).status,3)});
test('valid fallback trigger passes',()=>{const x=setup();assert.equal(run(['trigger','verify','--trigger',x.trigger],x.d).status,0)});
test('unknown failure code is invalid',()=>{const x=setup({trigger:baseTrigger({failure_code:'MAGIC_FAILURE'})});assert.equal(run(['trigger','verify','--trigger',x.trigger],x.d).status,3)});
test('Judge FAIL is non-fallbackable',()=>{const x=setup({trigger:baseTrigger({failure_code:'JUDGE_RESULT_FAIL'})});assert.ok(json(run(['trigger','verify','--trigger',x.trigger],x.d)).errors.includes('failure_code_not_fallbackable'))});
test('Judge disagreement is non-fallbackable',()=>{const x=setup({trigger:baseTrigger({failure_code:'JUDGE_DISAGREEMENT'})});assert.equal(run(['trigger','verify','--trigger',x.trigger],x.d).status,3)});
test('duplicate previous attempts are invalid',()=>{const a={provider_id:'x',provider_family:'x',model_id:'y'};const x=setup({trigger:baseTrigger({previous_attempts:[a,a]})});assert.ok(json(run(['trigger','verify','--trigger',x.trigger],x.d)).errors.includes('previous_attempt_duplicate'))});

// Normal selection + hard constraints.
test('cross-family explicit candidate is selected',()=>{const x=setup(),r=resolve(x);assert.equal(r.status,0);assert.equal(json(r).selected.model_id,'model-c')});
test('candidate priority is deterministic',()=>{const x=setup({plan:basePlan({candidates:[candidate('slow',{priority:2}),candidate('first',{priority:1,cost_class:'premium'})]})});assert.equal(json(resolve(x)).selected.model_id,'first')});
test('cost breaks equal explicit priority',()=>{const x=setup({plan:basePlan({candidates:[candidate('expensive',{priority:1,cost_class:'premium'}),candidate('cheap',{priority:1,cost_class:'low'})]})});assert.equal(json(resolve(x)).selected.model_id,'cheap')});
test('context headroom breaks equal priority and cost',()=>{const x=setup({plan:basePlan({candidates:[candidate('small',{context_window_tokens:100000}),candidate('large',{context_window_tokens:400000})]})});assert.equal(json(resolve(x)).selected.model_id,'large')});
test('runtime-not-ready candidate is rejected',()=>{const x=setup({plan:basePlan({candidates:[candidate('x',{runtime_ready:false})]})});const o=json(resolve(x));assert.equal(o.status,'MODEL_FALLBACK_EXHAUSTED');assert.ok(o.candidates[0].reasons.includes('RUNTIME_NOT_READY'))});
test('missing required modality is rejected',()=>{const x=setup({request:baseRequest({required_modalities:['image']}),plan:basePlan({candidates:[candidate('x',{modalities:['text']})]})});assert.ok(json(resolve(x)).candidates[0].reasons.includes('MODALITY_MISSING:image'))});
test('visual Judge always requires image',()=>{const x=setup({request:baseRequest({judge_role:'visual'}),plan:basePlan({judge_role:'visual',candidates:[candidate('x',{modalities:['text']})]}),trigger:baseTrigger({judge_role:'visual'})});assert.ok(json(resolve(x)).candidates[0].reasons.includes('MODALITY_MISSING:image'))});
test('insufficient context is rejected',()=>{const x=setup({plan:basePlan({candidates:[candidate('x',{context_window_tokens:15000})]})});assert.ok(json(resolve(x)).candidates[0].reasons.includes('CONTEXT_WINDOW_INSUFFICIENT'))});
test('cost ceiling is preserved',()=>{const x=setup({request:baseRequest({max_cost_class:'standard'}),plan:basePlan({candidates:[candidate('x',{cost_class:'premium'})]})});assert.ok(json(resolve(x)).candidates[0].reasons.includes('COST_CEILING_EXCEEDED'))});
test('failed model cannot be immediately reselected',()=>{const x=setup({plan:basePlan({candidates:[candidate('model-a',{provider_id:'openai',provider_family:'openai'})]})});assert.ok(json(resolve(x)).candidates[0].reasons.includes('FAILED_MODEL_RESELECTED'))});
test('previously attempted candidate cannot repeat',()=>{const prev={provider_id:'google',provider_family:'google',model_id:'model-c'};const x=setup({trigger:baseTrigger({previous_attempts:[prev]})});assert.ok(json(resolve(x)).candidates[0].reasons.includes('MODEL_ALREADY_ATTEMPTED'))});
test('same-provider candidate fails diversity',()=>{const x=setup({plan:basePlan({candidates:[candidate('model-x',{provider_id:'anthropic',provider_family:'anthropic'})]})});assert.ok(json(resolve(x)).candidates[0].reasons.some(x=>x.startsWith('DIVERSITY_INSUFFICIENT')))});
test('same-family different-provider candidate fails diversity',()=>{const b=baseBinding();b.slots.secondary.provider_id='provider-a';b.slots.secondary.provider_family='family-z';const x=setup({binding:b,plan:basePlan({candidates:[candidate('x',{provider_id:'provider-b',provider_family:'family-z'})]})});assert.ok(json(resolve(x)).candidates[0].reasons.includes('DIVERSITY_INSUFFICIENT:CROSS_PROVIDER_SAME_FAMILY'))});
test('cross-family candidate passes diversity',()=>{const x=setup();assert.equal(json(resolve(x)).candidates[0].diversity_tier,'CROSS_FAMILY')});
test('second fallback hop is allowed',()=>{const prev={provider_id:'x',provider_family:'x',model_id:'old'};const x=setup({trigger:baseTrigger({previous_attempts:[prev]})});assert.equal(json(resolve(x)).fallback_hop,2)});
test('third fallback hop is exhausted before selection',()=>{const prev=[{provider_id:'x',provider_family:'x',model_id:'1'},{provider_id:'y',provider_family:'y',model_id:'2'}];const x=setup({trigger:baseTrigger({previous_attempts:prev})});const o=json(resolve(x));assert.equal(o.status,'MODEL_FALLBACK_EXHAUSTED');assert.equal(o.fallback_hop,3)});
test('plan may cap fallback at one hop',()=>{const prev=[{provider_id:'x',provider_family:'x',model_id:'1'}];const x=setup({plan:basePlan({max_hops:1}),trigger:baseTrigger({previous_attempts:prev})});assert.equal(json(resolve(x)).status,'MODEL_FALLBACK_EXHAUSTED')});

// Context provenance and upstream evidence.
test('runtime failure requires P2 route evidence',()=>{const x=setup({route:false});const r=resolve(x);assert.equal(r.status,3);assert.ok(json(r).errors.includes('route_evidence_required'))});
test('task mismatch fails closed',()=>{const x=setup({plan:basePlan({task_id:'other'})});assert.ok(json(resolve(x)).errors.includes('task_id_mismatch'))});
test('judge role mismatch fails closed',()=>{const x=setup({plan:basePlan({judge_role:'regression'})});assert.ok(json(resolve(x)).errors.includes('judge_role_mismatch'))});
test('target slot mismatch fails closed',()=>{const x=setup({plan:basePlan({target_slot:'secondary'})});assert.ok(json(resolve(x)).errors.includes('target_slot_mismatch'))});
test('failed model must match binding slot',()=>{const x=setup({trigger:baseTrigger({failed_model:{provider_id:'x',provider_family:'x',model_id:'z'}})});assert.ok(json(resolve(x)).errors.includes('failed_model_binding_mismatch'))});
test('route must point at failed routed model',()=>{const x=setup();const t=read(x.trigger);t.failed_slot='secondary';t.failed_model={provider_id:'anthropic',provider_family:'anthropic',model_id:'model-b'};write(x.trigger,t);const p=read(x.plan);p.target_slot='secondary';write(x.plan,p);const r=resolve(x);assert.ok(json(r).errors.includes('route_failed_model_mismatch'))});
test('tampered P2 route is rejected',()=>{const x=setup();const r=read(x.route);r.selected.model_id='tampered';write(x.route,r);assert.ok(json(resolve(x)).errors.includes('route:route_integrity_mismatch'))});
test('DIVERSITY_BLOCKED trigger requires P3 evidence',()=>{const x=setup({trigger:baseTrigger({failure_code:'DIVERSITY_BLOCKED'}),route:false});assert.ok(json(resolve(x)).errors.includes('diversity_evidence_required'))});
test('DIVERSITY_BLOCKED may replace a blocked same-family pair',()=>{const b=baseBinding();b.slots.primary={...b.slots.primary,provider_id:'provider-a',provider_family:'family-z'};b.slots.secondary={...b.slots.secondary,provider_id:'provider-b',provider_family:'family-z'};const t=baseTrigger({failure_code:'DIVERSITY_BLOCKED',failed_model:{provider_id:'provider-a',provider_family:'family-z',model_id:'model-a'}});const x=setup({binding:b,trigger:t,route:false,diversity:true});const o=json(resolve(x));assert.equal(o.status,'MODEL_FALLBACK_SELECTED');assert.equal(o.selected.provider_family,'google')});
test('DIVERSITY_BLOCKED refuses P3 PASS evidence',()=>{const x=setup({trigger:baseTrigger({failure_code:'DIVERSITY_BLOCKED'}),route:false,diversity:true});assert.ok(json(resolve(x)).errors.includes('diversity_trigger_mismatch'))});
test('fallback decision records no automatic discovery',()=>{const x=setup(),o=json(resolve(x));assert.equal(o.automatic_discovery_used,false);assert.equal(o.provider_search_used,false);assert.equal(o.model_search_used,false)});
test('fallback never writes final Judge verdict',()=>{const x=setup(),o=json(resolve(x));assert.equal(o.final_judge_decision,null);assert.equal(o.final_judge_decision_authority,'ALEDEVOS_DETERMINISTIC_GATE')});
test('selected replacement mandates fresh P2 and P3',()=>{const x=setup(),o=json(resolve(x));assert.equal(o.fresh_p2_route_required_after_replacement,true);assert.equal(o.fresh_p3_diversity_required_after_replacement,true)});

// Decision verification and anti-tamper.
test('fresh fallback decision verifies with sources',()=>{const x=setup();resolve(x);assert.equal(verify(x).status,0)});
test('decision hash tamper is detected',()=>{const x=setup();resolve(x);const o=read(x.decision);o.fallback_used=false;write(x.decision,o);assert.ok(json(verify(x)).errors.includes('integrity_mismatch'))});
test('rehashed provider discovery injection is rejected',()=>{const x=setup();resolve(x);const o=read(x.decision);o.provider_search_used=true;o.decision_sha256=hashObj(o);write(x.decision,o);assert.ok(json(verify(x)).errors.includes('discovery_boundary_invalid'))});
test('rehashed final Judge decision injection is rejected',()=>{const x=setup();resolve(x);const o=read(x.decision);o.final_judge_decision='PASS';o.decision_sha256=hashObj(o);write(x.decision,o);assert.ok(json(verify(x)).errors.includes('judge_authority_invalid'))});
test('rehashed selected candidate drift is detected from sources',()=>{const x=setup();resolve(x);const o=read(x.decision);o.selected.model_id='fake';o.decision_sha256=hashObj(o);write(x.decision,o);assert.ok(json(verify(x)).errors.includes('selected_candidate_drift'))});
test('rehashed candidate evaluation drift is detected',()=>{const x=setup();resolve(x);const o=read(x.decision);o.candidates[0].eligible=false;o.decision_sha256=hashObj(o);write(x.decision,o);assert.ok(json(verify(x)).errors.includes('candidate_evaluation_drift'))});
test('binding source drift is detected',()=>{const x=setup();resolve(x);const b=read(x.binding);b.slots.secondary.model_id='changed';write(x.binding,b);assert.ok(json(verify(x)).errors.includes('binding_hash_drift'))});
test('request source drift is detected',()=>{const x=setup();resolve(x);const r=read(x.request);r.estimated_context_tokens++;write(x.request,r);assert.ok(json(verify(x)).errors.includes('request_hash_drift'))});
test('plan source drift is detected',()=>{const x=setup();resolve(x);const p=read(x.plan);p.candidates[0].priority=9;write(x.plan,p);assert.ok(json(verify(x)).errors.includes('plan_hash_drift'))});
test('trigger source drift is detected',()=>{const x=setup();resolve(x);const t=read(x.trigger);t.failure_code='RATE_LIMITED';write(x.trigger,t);assert.ok(json(verify(x)).errors.includes('trigger_hash_drift'))});
test('route source drift is detected',()=>{const x=setup();resolve(x);fs.appendFileSync(x.route,' ');assert.ok(json(verify(x)).errors.includes('route_hash_drift'))});
test('third-hop decision is invalid even if rehashed',()=>{const x=setup();resolve(x);const o=read(x.decision);o.fallback_hop=3;o.decision_sha256=hashObj(o);write(x.decision,o);assert.ok(json(run(['fallback','verify','--decision',x.decision],x.d)).errors.includes('fallback_hop_invalid'))});

// Replacement and forced revalidation.
test('selected fallback can produce derived binding',()=>{const x=setup();resolve(x);const r=run(['replacement','apply','--binding',x.binding,'--decision',x.decision,'--out',x.replacement],x.d);assert.equal(r.status,0);assert.equal(read(x.replacement).slots.primary.model_id,'model-c')});
test('derived binding carries fallback provenance',()=>{const x=setup();resolve(x);run(['replacement','apply','--binding',x.binding,'--decision',x.decision,'--out',x.replacement],x.d);assert.equal(read(x.replacement).fallback_provenance.fallback_hop,1)});
test('replacement fails on source binding drift',()=>{const x=setup();resolve(x);const b=read(x.binding);b.binding_id='changed';write(x.binding,b);assert.equal(run(['replacement','apply','--binding',x.binding,'--decision',x.decision,'--out',x.replacement],x.d).status,5)});
test('exhausted fallback cannot be applied',()=>{const x=setup({plan:basePlan({candidates:[candidate('x',{runtime_ready:false})]})});resolve(x);assert.equal(run(['replacement','apply','--binding',x.binding,'--decision',x.decision,'--out',x.replacement],x.d).status,5)});
test('old P3 diversity evidence becomes stale against replaced binding',()=>{const x=setup({diversity:true});resolve(x);run(['replacement','apply','--binding',x.binding,'--decision',x.decision,'--out',x.replacement],x.d);const r=run(['pair','verify','--decision',x.diversity,'--binding',x.replacement],x.d,p3);assert.notEqual(r.status,0)});
test('old P2 route binding hash differs after replacement',()=>{const x=setup();resolve(x);run(['replacement','apply','--binding',x.binding,'--decision',x.decision,'--out',x.replacement],x.d);assert.notEqual(read(x.route).binding.sha256,crypto.createHash('sha256').update(fs.readFileSync(x.replacement)).digest('hex'))});

// Certification, phase isolation, installation and schemas.
test('P4 package certificate can be generated',()=>{const d=tmp(),f=path.join(d,'cert.json'),r=run(['certify','run','--out',f]);assert.equal(r.status,0);assert.equal(json(r).status,'MULTIMODEL_P4_PACKAGE_CERTIFIED')});
test('fresh P4 certificate verifies',()=>{const d=tmp(),f=path.join(d,'cert.json');run(['certify','run','--out',f]);assert.equal(run(['certify','verify','--certificate',f]).status,0)});
test('P4 certificate explicitly defers target runtime validation',()=>{const d=tmp(),f=path.join(d,'cert.json');run(['certify','run','--out',f]);const c=read(f);assert.equal(c.package_only,true);assert.equal(c.target_runtime_validation,'DEFERRED')});
test('P4 certificate paths are portable',()=>{const d=tmp(),f=path.join(d,'cert.json');run(['certify','run','--out',f]);for(const x of read(f).inputs)assert.equal(path.isAbsolute(x.path),false)});
test('P4 certificate tamper is detected',()=>{const d=tmp(),f=path.join(d,'cert.json');run(['certify','run','--out',f]);const c=read(f);c.claims.max_two_fallback_hops=false;write(f,c);assert.equal(run(['certify','verify','--certificate',f]).status,4)});
test('P4 policy drift invalidates certificate',()=>{const d=tmp(),f=path.join(d,'cert.json'),policy=path.join(root,'multimodel/policies/model-fallback-policy.json'),bak=fs.readFileSync(policy);run(['certify','run','--out',f]);try{fs.appendFileSync(policy,' ');assert.equal(run(['certify','verify','--certificate',f]).status,4)}finally{fs.writeFileSync(policy,bak)}});
test('P1 certificate remains valid after P4',()=>assert.equal(run(['certify','verify','--certificate','release/certifications/multimodel-p1.json'],root,p1).status,0));
test('P2 certificate remains valid after P4',()=>assert.equal(run(['certify','verify','--certificate','release/certifications/multimodel-p2.json'],root,p2).status,0));
test('P3 certificate remains valid after P4',()=>assert.equal(run(['certify','verify','--certificate','release/certifications/multimodel-p3.json'],root,p3).status,0));
test('P2 remains fallback-disabled inside its own phase',()=>assert.equal(read(path.join(root,'multimodel/policies/model-router-policy.json')).rules.automatic_fallback_enabled,false));
test('P3 remains fallback-disabled inside its own phase',()=>assert.equal(read(path.join(root,'multimodel/policies/judge-diversity-policy.json')).rules.automatic_fallback_enabled,false));
test('installer already projects fallback extension without P4 installer edits',()=>{const s=fs.readFileSync(path.join(root,'scripts/05-install-into-project.ps1'),'utf8');assert.match(s,/multimodel\\extensions/);assert.match(s,/Get-ChildItem \$mmExt -Recurse -File/)});
test('installed fallback extension executes',()=>{const x=setup(),mm=path.join(x.d,'.aledevos/multimodel');fs.mkdirSync(path.join(mm,'extensions/fallback'),{recursive:true});for(const dir of ['policies','schemas','templates'])fs.cpSync(path.join(root,'multimodel',dir),path.join(mm,dir),{recursive:true});fs.copyFileSync(p4,path.join(mm,'extensions/fallback/model-fallback.mjs'));const r=spawnSync(process.execPath,[path.join(mm,'extensions/fallback/model-fallback.mjs'),'policy','verify'],{cwd:x.d,encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr)});
test('P4 source contains no adapter names',()=>{const s=fs.readFileSync(p4,'utf8').toLowerCase();for(const n of ['opencode','codex','claude code','antigravity','gemini'])assert.equal(s.includes(n),false)});
test('fallback schemas parse',()=>{for(const f of ['model-fallback-plan.schema.json','model-fallback-trigger.schema.json','model-fallback-decision.schema.json'])assert.doesNotThrow(()=>read(path.join(root,'multimodel/schemas',f)))});
test('fallback templates parse',()=>{for(const f of ['model-fallback-plan.example.json','model-fallback-trigger.example.json'])assert.doesNotThrow(()=>read(path.join(root,'multimodel/templates',f)))});
