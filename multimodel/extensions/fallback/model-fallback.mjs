#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const mmRoot=path.resolve(here,'../..');
const packageRoot=path.resolve(mmRoot,'..');
const args=process.argv.slice(2),[group,cmd]=args;
const take=(f,d=null)=>{const i=args.indexOf(f);return i>=0&&i+1<args.length?args[i+1]:d};
const out=v=>process.stdout.write(JSON.stringify(v,null,2)+'\n');
const die=(status,code=2,extra={})=>{out({status,...extra});process.exit(code)};
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n')};
const hashFile=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).filter(k=>!['decision_sha256','evidence_sha256','route_sha256','comparison_sha256'].includes(k)).sort().map(k=>[k,stable(v[k])])):v;
const hashObj=v=>crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const fallbackPolicy=()=>read(path.join(mmRoot,'policies/model-fallback-policy.json'));
const routerPolicy=()=>read(path.join(mmRoot,'policies/model-router-policy.json'));
const diversityPolicy=()=>read(path.join(mmRoot,'policies/judge-diversity-policy.json'));
const ident=x=>`${x?.provider_id??''}::${x?.model_id??''}`;
const placeholder=v=>!v||/REQUIRED|UNBOUND|MODEL_ID|PROVIDER_ID|EXAMPLE_ONLY/i.test(String(v));
const slotSnapshot=(slot,x)=>({slot,provider_id:x.provider_id,model_id:x.model_id,provider_family:x.provider_family,modalities:[...(x.modalities||[])].sort(),context_window_tokens:x.context_window_tokens,cost_class:x.cost_class,runtime_ready:x.runtime_ready===true,runtime_evidence_sha256:x.runtime_evidence==null?null:crypto.createHash('sha256').update(JSON.stringify(stable(x.runtime_evidence))).digest('hex')});

function policyVerify(){
 const p=fallbackPolicy(),errors=[];
 if(p.schema_version!=='1.0'||p.phase!=='MULTIMODEL_P4_MODEL_FALLBACK')errors.push('phase_or_schema_invalid');
 if(!Array.isArray(p.allowed_judge_roles)||!p.allowed_judge_roles.length)errors.push('roles_invalid');
 if(!Number.isInteger(p.max_fallback_hops)||p.max_fallback_hops<1||p.max_fallback_hops>2)errors.push('max_hops_invalid');
 if(!Array.isArray(p.allowed_failure_codes)||!p.allowed_failure_codes.length)errors.push('allowed_failure_codes_invalid');
 if(!Array.isArray(p.non_fallbackable_failure_codes))errors.push('non_fallbackable_codes_invalid');
 const r=p.rules||{};
 for(const k of ['explicit_plan_only','runtime_ready_required','required_modalities_are_hard_constraints','context_fit_is_hard_constraint','cost_ceiling_is_hard_constraint','diversity_gate_is_hard_constraint','failed_model_cannot_be_reselected','previously_attempted_models_cannot_repeat','fallback_hops_are_bounded','replacement_requires_fresh_p2_route','replacement_requires_fresh_p3_diversity'])if(r[k]!==true)errors.push(`rule_missing:${k}`);
 for(const k of ['automatic_provider_discovery','automatic_model_discovery','adapter_identity_is_not_a_fallback_input','fallback_on_judge_outcome'])if(k==='adapter_identity_is_not_a_fallback_input'?r[k]!==true:r[k]!==false)errors.push(`rule_invalid:${k}`);
 if(r.final_judge_decision_authority!=='ALEDEVOS_DETERMINISTIC_GATE')errors.push('authority_invalid');
 return{status:errors.length?'MODEL_FALLBACK_POLICY_INVALID':'MODEL_FALLBACK_POLICY_VALID',valid:!errors.length,errors,policy:p};
}
function bindingRead(file){
 const errors=[];if(!file||!fs.existsSync(file))return{valid:false,status:'MODEL_BINDING_MISSING',errors:['binding_missing']};let b;try{b=read(file)}catch{return{valid:false,status:'MODEL_BINDING_INVALID',errors:['binding_unreadable']}};
 if(b.schema_version!=='1.0')errors.push('schema_version_invalid');
 for(const slot of ['primary','secondary']){const x=b.slots?.[slot];if(!x){errors.push(`${slot}_slot_missing`);continue}for(const k of ['provider_id','provider_family','model_id','modalities','context_window_tokens','cost_class','runtime_ready'])if(x[k]===undefined||x[k]===null)errors.push(`${slot}_${k}_missing`)}
 return{valid:!errors.length,status:errors.length?'MODEL_BINDING_INVALID':'MODEL_BINDING_VALID',errors,binding:b};
}
function requestRead(file){
 if(!file||!fs.existsSync(file))return{valid:false,errors:['request_missing']};let r;try{r=read(file)}catch{return{valid:false,errors:['request_unreadable']}};const p=routerPolicy(),errors=[];
 if(r.schema_version!=='1.0'||!r.task_id||!p.allowed_judge_roles.includes(r.judge_role))errors.push('request_identity_invalid');
 if(!Number.isInteger(r.estimated_context_tokens)||r.estimated_context_tokens<0)errors.push('estimated_context_tokens_invalid');
 if(r.max_cost_class!==undefined&&p.cost_classes[r.max_cost_class]===undefined)errors.push('max_cost_class_invalid');
 return{valid:!errors.length,errors,request:r};
}
function planRead(file){
 if(!file||!fs.existsSync(file))return{valid:false,errors:['plan_missing']};let p;try{p=read(file)}catch{return{valid:false,errors:['plan_unreadable']}};const pol=fallbackPolicy(),errors=[];
 if(p.schema_version!=='1.0'||!p.plan_id||!p.task_id||!pol.allowed_judge_roles.includes(p.judge_role)||!['primary','secondary'].includes(p.target_slot))errors.push('plan_identity_invalid');
 if(!Number.isInteger(p.max_hops)||p.max_hops<0||p.max_hops>pol.max_fallback_hops)errors.push('plan_max_hops_invalid');
 if(!Array.isArray(p.candidates)||!p.candidates.length)errors.push('candidates_missing');
 const seen=new Set();for(const [i,x] of (p.candidates||[]).entries()){for(const k of ['priority','provider_id','provider_family','model_id','modalities','context_window_tokens','cost_class','runtime_ready'])if(x[k]===undefined||x[k]===null)errors.push(`candidate_${i}_${k}_missing`);if(!Number.isInteger(x.priority)||x.priority<0)errors.push(`candidate_${i}_priority_invalid`);if(placeholder(x.provider_id)||placeholder(x.model_id)||placeholder(x.provider_family))errors.push(`candidate_${i}_unbound`);if(!Array.isArray(x.modalities)||!x.modalities.includes('text'))errors.push(`candidate_${i}_modalities_invalid`);if(!Number.isInteger(x.context_window_tokens)||x.context_window_tokens<0)errors.push(`candidate_${i}_context_invalid`);const id=ident(x);if(seen.has(id))errors.push(`candidate_${i}_duplicate_identity`);seen.add(id)}
 return{valid:!errors.length,errors,plan:p};
}
function triggerRead(file){
 if(!file||!fs.existsSync(file))return{valid:false,errors:['trigger_missing']};let t;try{t=read(file)}catch{return{valid:false,errors:['trigger_unreadable']}};const p=fallbackPolicy(),errors=[];
 if(t.schema_version!=='1.0'||t.phase!=='MULTIMODEL_P4_FALLBACK_TRIGGER'||!t.task_id||!p.allowed_judge_roles.includes(t.judge_role)||!['primary','secondary'].includes(t.failed_slot))errors.push('trigger_identity_invalid');
 if(!p.allowed_failure_codes.includes(t.failure_code))errors.push(p.non_fallbackable_failure_codes.includes(t.failure_code)?'failure_code_not_fallbackable':'failure_code_invalid');
 if(!t.failed_model||placeholder(t.failed_model.provider_id)||placeholder(t.failed_model.model_id)||placeholder(t.failed_model.provider_family))errors.push('failed_model_invalid');
 if(!Array.isArray(t.previous_attempts))errors.push('previous_attempts_invalid');else{const seen=new Set();for(const [i,x] of t.previous_attempts.entries()){if(!x||placeholder(x.provider_id)||placeholder(x.model_id))errors.push(`previous_attempt_${i}_invalid`);const id=ident(x);if(seen.has(id))errors.push('previous_attempt_duplicate');seen.add(id)}}
 return{valid:!errors.length,errors,trigger:t};
}
function routeRead(file){
 if(!file)return{valid:true,route:null};if(!fs.existsSync(file))return{valid:false,errors:['route_missing']};let r;try{r=read(file)}catch{return{valid:false,errors:['route_unreadable']}};const errors=[];
 if(r.schema_version!=='1.0'||r.phase!=='MULTIMODEL_P2_MODEL_ROUTER')errors.push('route_phase_invalid');if(r.route_sha256!==hashObj(r))errors.push('route_integrity_mismatch');if(r.fallback_used!==false)errors.push('route_fallback_boundary_invalid');return{valid:!errors.length,errors,route:r};
}
function diversityRead(file){
 if(!file)return{valid:true,decision:null};if(!fs.existsSync(file))return{valid:false,errors:['diversity_missing']};let d;try{d=read(file)}catch{return{valid:false,errors:['diversity_unreadable']}};const errors=[];
 if(d.schema_version!=='1.0'||d.phase!=='MULTIMODEL_P3_JUDGE_DIVERSITY')errors.push('diversity_phase_invalid');if(d.decision_sha256!==hashObj(d))errors.push('diversity_integrity_mismatch');if(d.fallback_used!==false)errors.push('diversity_fallback_boundary_invalid');return{valid:!errors.length,errors,decision:d};
}
function requiredModalities(req){const p=routerPolicy();return[...new Set([...(p.required_base_modalities||[]),...(req.required_modalities||[]),...((p.role_required_modalities||{})[req.judge_role]||[])])].sort()}
function diversityTier(a,b){if(ident(a)===ident(b))return'INVALID_SAME_MODEL';if(a.provider_family!==b.provider_family)return'CROSS_FAMILY';if(a.provider_id!==b.provider_id)return'CROSS_PROVIDER_SAME_FAMILY';return'DISTINCT_MODEL_SAME_PROVIDER'}
function evaluateCandidate(x,ctx){
 const rp=routerPolicy(),dp=diversityPolicy(),reasons=[],mods=requiredModalities(ctx.request),costRank=rp.cost_classes[x.cost_class],maxRank=ctx.request.max_cost_class===undefined?null:rp.cost_classes[ctx.request.max_cost_class],requiredContext=ctx.request.estimated_context_tokens+rp.context_safety_reserve_tokens,headroom=x.context_window_tokens-requiredContext,id=ident(x),tier=diversityTier(x,ctx.partner),requiredTier=dp.minimum_tier_by_role[ctx.request.judge_role],tierPass=(dp.tiers[tier]??0)>=(dp.tiers[requiredTier]??999);
 if(x.runtime_ready!==true)reasons.push('RUNTIME_NOT_READY');for(const m of mods)if(!(x.modalities||[]).includes(m))reasons.push(`MODALITY_MISSING:${m}`);if(headroom<0)reasons.push('CONTEXT_WINDOW_INSUFFICIENT');if(costRank===undefined)reasons.push('COST_CLASS_UNKNOWN');if(maxRank!==null&&costRank!==undefined&&costRank>maxRank)reasons.push('COST_CEILING_EXCEEDED');if(id===ident(ctx.failed))reasons.push('FAILED_MODEL_RESELECTED');if(ctx.previous.has(id))reasons.push('MODEL_ALREADY_ATTEMPTED');if(!tierPass)reasons.push(`DIVERSITY_INSUFFICIENT:${tier}`);
 return{priority:x.priority,provider_id:x.provider_id,provider_family:x.provider_family,model_id:x.model_id,modalities:[...(x.modalities||[])].sort(),context_window_tokens:x.context_window_tokens,context_headroom_tokens:headroom,cost_class:x.cost_class,cost_rank:costRank??null,runtime_ready:x.runtime_ready===true,diversity_tier:tier,required_diversity_tier:requiredTier,eligible:reasons.length===0,reasons};
}
function sortCandidates(a,b){if(a.priority!==b.priority)return a.priority-b.priority;if(a.cost_rank!==b.cost_rank)return (a.cost_rank??999)-(b.cost_rank??999);if(b.context_headroom_tokens!==a.context_headroom_tokens)return b.context_headroom_tokens-a.context_headroom_tokens;return `${a.provider_id}/${a.model_id}`.localeCompare(`${b.provider_id}/${b.model_id}`)}
function resolveFiles({bindingFile,requestFile,planFile,triggerFile,routeFile=null,diversityFile=null,outFile=null}){
 const pv=policyVerify();if(!pv.valid)die(pv.status,3,{errors:pv.errors});const bv=bindingRead(bindingFile),rv=requestRead(requestFile),fv=planRead(planFile),tv=triggerRead(triggerFile),qv=routeRead(routeFile),dv=diversityRead(diversityFile);
 const invalid=[];for(const [name,v] of [['binding',bv],['request',rv],['plan',fv],['trigger',tv],['route',qv],['diversity',dv]])if(!v.valid)invalid.push(...v.errors.map(e=>`${name}:${e}`));if(invalid.length)die('MODEL_FALLBACK_INPUT_INVALID',3,{errors:invalid});
 const b=bv.binding,r=rv.request,p=fv.plan,t=tv.trigger;
 const errors=[];if(p.task_id!==r.task_id||t.task_id!==r.task_id)errors.push('task_id_mismatch');if(p.judge_role!==r.judge_role||t.judge_role!==r.judge_role)errors.push('judge_role_mismatch');if(p.target_slot!==t.failed_slot)errors.push('target_slot_mismatch');const current=b.slots[t.failed_slot],partner=b.slots[t.failed_slot==='primary'?'secondary':'primary'];if(ident(current)!==ident(t.failed_model)||current.provider_family!==t.failed_model.provider_family)errors.push('failed_model_binding_mismatch');
 if(t.failure_code!=='DIVERSITY_BLOCKED'&&!qv.route)errors.push('route_evidence_required');
 if(qv.route&&t.failure_code!=='DIVERSITY_BLOCKED'){if(qv.route.task_id!==r.task_id||qv.route.judge_role!==r.judge_role)errors.push('route_request_mismatch');if(qv.route.request_source?.sha256!==hashFile(requestFile))errors.push('route_request_hash_mismatch');if(qv.route.binding?.sha256!==hashFile(bindingFile))errors.push('route_binding_hash_mismatch');if(!qv.route.selected)errors.push('route_has_no_selected_model');else if(`${qv.route.selected.slot}`!==t.failed_slot||ident(qv.route.selected)!==ident(t.failed_model))errors.push('route_failed_model_mismatch')}
 if(t.failure_code==='DIVERSITY_BLOCKED'){if(!dv.decision)errors.push('diversity_evidence_required');else if(dv.decision.status!=='JUDGE_DIVERSITY_BLOCKED'||dv.decision.judge_role!==r.judge_role)errors.push('diversity_trigger_mismatch')}
 if(errors.length)die('MODEL_FALLBACK_CONTEXT_INVALID',3,{errors});
 const previous=new Set((t.previous_attempts||[]).map(ident));previous.add(ident(t.failed_model));const hop=(t.previous_attempts||[]).length+1,maxHops=Math.min(p.max_hops,pv.policy.max_fallback_hops);
 const candidates=p.candidates.map(x=>evaluateCandidate(x,{request:r,failed:t.failed_model,partner,previous})).sort(sortCandidates);const selected=hop<=maxHops?candidates.find(x=>x.eligible)||null:null;const status=selected?'MODEL_FALLBACK_SELECTED':'MODEL_FALLBACK_EXHAUSTED';
 const d={schema_version:'1.0',phase:'MULTIMODEL_P4_MODEL_FALLBACK',status,task_id:r.task_id,judge_role:r.judge_role,target_slot:t.failed_slot,fallback_used:true,fallback_hop:hop,max_fallback_hops:maxHops,trigger:{failure_code:t.failure_code,failed_model:{provider_id:t.failed_model.provider_id,provider_family:t.failed_model.provider_family,model_id:t.failed_model.model_id},previous_attempts:t.previous_attempts,sha256:hashFile(triggerFile)},request:{sha256:hashFile(requestFile),required_modalities:requiredModalities(r),estimated_context_tokens:r.estimated_context_tokens,max_cost_class:r.max_cost_class??null},binding:{binding_id:b.binding_id??null,target_runtime:b.target_runtime??null,sha256:hashFile(bindingFile),partner:slotSnapshot(t.failed_slot==='primary'?'secondary':'primary',partner)},plan:{plan_id:p.plan_id,sha256:hashFile(planFile),candidate_count:p.candidates.length},route:qv.route?{sha256:hashFile(routeFile),route_sha256:qv.route.route_sha256}:null,diversity:dv.decision?{sha256:hashFile(diversityFile),decision_sha256:dv.decision.decision_sha256,status:dv.decision.status}:null,candidates,selected:selected?{provider_id:selected.provider_id,provider_family:selected.provider_family,model_id:selected.model_id,modalities:selected.modalities,context_window_tokens:selected.context_window_tokens,context_headroom_tokens:selected.context_headroom_tokens,cost_class:selected.cost_class,cost_rank:selected.cost_rank,diversity_tier:selected.diversity_tier}:null,automatic_discovery_used:false,provider_search_used:false,model_search_used:false,adapter_hint_used:false,fresh_p2_route_required_after_replacement:selected!==null,fresh_p3_diversity_required_after_replacement:selected!==null,final_judge_decision:null,final_judge_decision_authority:'ALEDEVOS_DETERMINISTIC_GATE',created_at:new Date().toISOString(),decision_sha256:''};d.decision_sha256=hashObj(d);if(outFile)write(path.resolve(outFile),d);return d;
}
function verifyDecision(file,sources={}){
 if(!file||!fs.existsSync(file))return{status:'MODEL_FALLBACK_DECISION_INVALID',valid:false,errors:['decision_missing']};let d;try{d=read(file)}catch{return{status:'MODEL_FALLBACK_DECISION_INVALID',valid:false,errors:['decision_unreadable']}};const errors=[],p=fallbackPolicy();if(d.schema_version!=='1.0'||d.phase!=='MULTIMODEL_P4_MODEL_FALLBACK')errors.push('phase_or_schema_invalid');if(!['MODEL_FALLBACK_SELECTED','MODEL_FALLBACK_EXHAUSTED'].includes(d.status))errors.push('status_invalid');if(d.decision_sha256!==hashObj(d))errors.push('integrity_mismatch');if(d.fallback_used!==true)errors.push('fallback_flag_invalid');if(!Number.isInteger(d.fallback_hop)||d.fallback_hop<1||d.fallback_hop>p.max_fallback_hops)errors.push('fallback_hop_invalid');if(d.automatic_discovery_used!==false||d.provider_search_used!==false||d.model_search_used!==false||d.adapter_hint_used!==false)errors.push('discovery_boundary_invalid');if(d.final_judge_decision!==null||d.final_judge_decision_authority!=='ALEDEVOS_DETERMINISTIC_GATE')errors.push('judge_authority_invalid');if(d.status==='MODEL_FALLBACK_SELECTED'){if(!d.selected)errors.push('selected_missing');if(d.fresh_p2_route_required_after_replacement!==true||d.fresh_p3_diversity_required_after_replacement!==true)errors.push('fresh_revalidation_missing')}else if(d.selected!==null)errors.push('exhausted_selected_invalid');
 const requiredSources=['bindingFile','requestFile','planFile','triggerFile'];
 if(requiredSources.some(k=>sources[k])){
   for(const k of requiredSources)if(!sources[k]||!fs.existsSync(sources[k]))errors.push(`source_missing:${k}`);
   if(!errors.some(e=>e.startsWith('source_missing:'))){
     if(d.binding?.sha256!==hashFile(sources.bindingFile))errors.push('binding_hash_drift');
     if(d.request?.sha256!==hashFile(sources.requestFile))errors.push('request_hash_drift');
     if(d.plan?.sha256!==hashFile(sources.planFile))errors.push('plan_hash_drift');
     if(d.trigger?.sha256!==hashFile(sources.triggerFile))errors.push('trigger_hash_drift');
     if(d.route){if(!sources.routeFile||!fs.existsSync(sources.routeFile))errors.push('route_source_missing');else if(d.route.sha256!==hashFile(sources.routeFile))errors.push('route_hash_drift')}
     if(d.diversity){if(!sources.diversityFile||!fs.existsSync(sources.diversityFile))errors.push('diversity_source_missing');else if(d.diversity.sha256!==hashFile(sources.diversityFile))errors.push('diversity_hash_drift')}
     const bv=bindingRead(sources.bindingFile),rv=requestRead(sources.requestFile),fv=planRead(sources.planFile),tv=triggerRead(sources.triggerFile);
     if(bv.valid&&rv.valid&&fv.valid&&tv.valid){
       const b=bv.binding,r=rv.request,pl=fv.plan,t=tv.trigger,current=b.slots[t.failed_slot],partner=b.slots[t.failed_slot==='primary'?'secondary':'primary'];
       const previous=new Set((t.previous_attempts||[]).map(ident));previous.add(ident(t.failed_model));const hop=(t.previous_attempts||[]).length+1,maxHops=Math.min(pl.max_hops,p.max_fallback_hops);
       const candidates=pl.candidates.map(x=>evaluateCandidate(x,{request:r,failed:t.failed_model,partner,previous})).sort(sortCandidates);const selected=hop<=maxHops?candidates.find(x=>x.eligible)||null:null;const expectedStatus=selected?'MODEL_FALLBACK_SELECTED':'MODEL_FALLBACK_EXHAUSTED';
       if(d.fallback_hop!==hop||d.max_fallback_hops!==maxHops)errors.push('fallback_bound_drift');
       if(d.status!==expectedStatus)errors.push('fallback_status_drift');
       if(JSON.stringify(d.candidates)!==JSON.stringify(candidates))errors.push('candidate_evaluation_drift');
       const expectedSelected=selected?{provider_id:selected.provider_id,provider_family:selected.provider_family,model_id:selected.model_id,modalities:selected.modalities,context_window_tokens:selected.context_window_tokens,context_headroom_tokens:selected.context_headroom_tokens,cost_class:selected.cost_class,cost_rank:selected.cost_rank,diversity_tier:selected.diversity_tier}:null;
       if(JSON.stringify(d.selected)!==JSON.stringify(expectedSelected))errors.push('selected_candidate_drift');
       if(d.target_slot!==t.failed_slot||d.task_id!==r.task_id||d.judge_role!==r.judge_role||ident(current)!==ident(t.failed_model))errors.push('source_context_drift');
     }
   }
 }
 return{status:errors.length?'MODEL_FALLBACK_DECISION_INVALID':'MODEL_FALLBACK_DECISION_VALID',valid:!errors.length,errors,decision:d};
}
function applyReplacement(bindingFile,decisionFile,outFile){
 const bv=bindingRead(bindingFile),vv=verifyDecision(decisionFile);if(!bv.valid||!vv.valid)die('MODEL_FALLBACK_APPLY_INVALID',3,{errors:[...(bv.errors||[]),...(vv.errors||[])]});const d=vv.decision;if(d.status!=='MODEL_FALLBACK_SELECTED'||!d.selected)die('MODEL_FALLBACK_APPLY_BLOCKED',5,{reason:'no_selected_replacement'});if(d.binding?.sha256!==hashFile(bindingFile))die('MODEL_FALLBACK_APPLY_BLOCKED',5,{reason:'binding_drift'});const b=JSON.parse(JSON.stringify(bv.binding));b.slots[d.target_slot]={...b.slots[d.target_slot],provider_id:d.selected.provider_id,provider_family:d.selected.provider_family,model_id:d.selected.model_id,modalities:d.selected.modalities,context_window_tokens:d.selected.context_window_tokens,cost_class:d.selected.cost_class,runtime_ready:true,runtime_evidence:{source:'MULTIMODEL_P4_FALLBACK',fallback_decision_sha256:d.decision_sha256}};b.fallback_provenance={parent_binding_sha256:hashFile(bindingFile),fallback_decision_sha256:d.decision_sha256,replaced_slot:d.target_slot,fallback_hop:d.fallback_hop};if(outFile)write(path.resolve(outFile),b);return{status:'MODEL_FALLBACK_REPLACEMENT_APPLIED',binding:b,binding_sha256:hashObj(b),fresh_p2_route_required:true,fresh_p3_diversity_required:true};
}
function certificateInputPaths(){return['multimodel/extensions/fallback/model-fallback.mjs','multimodel/policies/model-fallback-policy.json','multimodel/policies/model-router-policy.json','multimodel/policies/judge-diversity-policy.json','multimodel/schemas/model-fallback-plan.schema.json','multimodel/schemas/model-fallback-trigger.schema.json','multimodel/schemas/model-fallback-decision.schema.json','multimodel/templates/model-fallback-plan.example.json','multimodel/templates/model-fallback-trigger.example.json','release/certifications/multimodel-p1.json','release/certifications/multimodel-p2.json','release/certifications/multimodel-p3.json']}
function certificateInputs(){return certificateInputPaths().map(rel=>({path:rel,sha256:hashFile(path.join(packageRoot,rel))}))}
function certifyRun(outFile){const pv=policyVerify(),inputs=certificateInputs();const c={schema_version:'1.0',phase:'MULTIMODEL_P4',status:pv.valid?'MULTIMODEL_P4_PACKAGE_CERTIFIED':'MULTIMODEL_P4_PACKAGE_CERTIFICATION_FAILED',package_only:true,target_runtime_validation:'DEFERRED',claims:{explicit_fallback_plans_only:true,max_two_fallback_hops:true,no_automatic_provider_or_model_discovery:true,no_fallback_on_judge_outcome:true,p2_hard_constraints_preserved:true,p3_diversity_preserved:true,no_repeat_models:true,replacement_requires_fresh_p2_and_p3:true,final_judge_decision_unchanged:true},policy_status:pv.status,inputs,created_at:new Date().toISOString(),evidence_sha256:''};c.evidence_sha256=hashObj(c);if(outFile)write(path.resolve(outFile),c);return c}
function certifyVerify(file){if(!file||!fs.existsSync(file))return{status:'MULTIMODEL_P4_CERTIFICATE_INVALID',valid:false,errors:['certificate_missing']};let c;try{c=read(file)}catch{return{status:'MULTIMODEL_P4_CERTIFICATE_INVALID',valid:false,errors:['certificate_unreadable']}};const errors=[];if(c.phase!=='MULTIMODEL_P4')errors.push('phase_invalid');if(c.package_only!==true||c.target_runtime_validation!=='DEFERRED')errors.push('runtime_boundary_invalid');if(c.evidence_sha256!==hashObj(c))errors.push('certificate_integrity_mismatch');const current=new Map(certificateInputs().map(x=>[x.path,x.sha256]));for(const x of c.inputs||[])if(current.get(x.path)!==x.sha256)errors.push(`input_drift:${x.path}`);if((c.inputs||[]).length!==current.size)errors.push('input_set_drift');return{status:errors.length?'MULTIMODEL_P4_CERTIFICATE_STALE_OR_TAMPERED':'MULTIMODEL_P4_CERTIFICATE_VALID',valid:!errors.length,errors,certificate:c}}

if(group==='policy'&&cmd==='verify'){const r=policyVerify();out(r);process.exit(r.valid?0:3)}
if(group==='plan'&&cmd==='verify'){const r=planRead(path.resolve(take('--plan','')));out({status:r.valid?'MODEL_FALLBACK_PLAN_VALID':'MODEL_FALLBACK_PLAN_INVALID',...r});process.exit(r.valid?0:3)}
if(group==='trigger'&&cmd==='verify'){const r=triggerRead(path.resolve(take('--trigger','')));out({status:r.valid?'MODEL_FALLBACK_TRIGGER_VALID':'MODEL_FALLBACK_TRIGGER_INVALID',...r});process.exit(r.valid?0:3)}
if(group==='fallback'&&cmd==='resolve'){const d=resolveFiles({bindingFile:path.resolve(take('--binding','')),requestFile:path.resolve(take('--request','')),planFile:path.resolve(take('--plan','')),triggerFile:path.resolve(take('--trigger','')),routeFile:take('--route')?path.resolve(take('--route')):null,diversityFile:take('--diversity')?path.resolve(take('--diversity')):null,outFile:take('--out')});out(d);process.exit(d.status==='MODEL_FALLBACK_SELECTED'?0:5)}
if(group==='fallback'&&cmd==='verify'){const r=verifyDecision(path.resolve(take('--decision','')),{bindingFile:take('--binding')?path.resolve(take('--binding')):null,requestFile:take('--request')?path.resolve(take('--request')):null,planFile:take('--plan')?path.resolve(take('--plan')):null,triggerFile:take('--trigger')?path.resolve(take('--trigger')):null,routeFile:take('--route')?path.resolve(take('--route')):null,diversityFile:take('--diversity')?path.resolve(take('--diversity')):null});out(r);process.exit(r.valid?0:3)}
if(group==='replacement'&&cmd==='apply'){const r=applyReplacement(path.resolve(take('--binding','')),path.resolve(take('--decision','')),take('--out'));out(r);process.exit(0)}
if(group==='certify'&&cmd==='run'){const c=certifyRun(take('--out'));out(c);process.exit(c.status.endsWith('CERTIFIED')?0:4)}
if(group==='certify'&&cmd==='verify'){const r=certifyVerify(path.resolve(take('--certificate','')));out(r);process.exit(r.valid?0:4)}
die('MODEL_FALLBACK_COMMAND_UNKNOWN',2,{usage:['policy verify','plan verify --plan <json>','trigger verify --trigger <json>','fallback resolve --binding <json> --request <json> --plan <json> --trigger <json> [--route <p2.json>] [--diversity <p3.json>] [--out <json>]','fallback verify --decision <json> [--binding <json> --request <json> --plan <json> --trigger <json> --route <json> --diversity <json>]','replacement apply --binding <json> --decision <json> --out <json>','certify run --out <json>','certify verify --certificate <json>']});
