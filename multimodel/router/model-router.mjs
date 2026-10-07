#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const mmRoot=path.resolve(here,'..');
const packageRoot=path.resolve(mmRoot,'..');
const args=process.argv.slice(2),[group,cmd]=args;
const take=(f,d=null)=>{const i=args.indexOf(f);return i>=0&&i+1<args.length?args[i+1]:d};
const out=v=>process.stdout.write(JSON.stringify(v,null,2)+'\n');
const die=(status,code=2,extra={})=>{out({status,...extra});process.exit(code)};
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n')};
const hashFile=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).filter(k=>!['route_sha256','evidence_sha256'].includes(k)).sort().map(k=>[k,stable(v[k])])):v;
const hashObj=v=>crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const policy=()=>read(path.join(mmRoot,'policies/model-router-policy.json'));
const registry=()=>read(path.join(mmRoot,'registry/model-registry.json'));
const placeholder=x=>!x||/REQUIRED|UNBOUND|PRIMARY_MODEL_ID|SECOND_MODEL_ID|PROVIDER_ID/i.test(String(x));

function bindingVerify(file){
 const errors=[];if(!file||!fs.existsSync(file))return{status:'MODEL_BINDING_MISSING',valid:false,errors:['binding_missing']};let b;try{b=read(file)}catch{return{status:'MODEL_BINDING_INVALID',valid:false,errors:['binding_unreadable']}};
 if(b.schema_version!=='1.0')errors.push('schema_version_invalid');if(!b.binding_id)errors.push('binding_id_missing');if(!b.target_runtime)errors.push('target_runtime_missing');
 for(const slot of ['primary','secondary']){const x=b.slots?.[slot];if(!x){errors.push(`${slot}_slot_missing`);continue}for(const k of ['provider_id','model_id','provider_family','modalities','context_window_tokens','cost_class','runtime_ready'])if(x[k]===undefined||x[k]===null)errors.push(`${slot}_${k}_missing`);if(!Array.isArray(x.modalities)||!x.modalities.includes('text'))errors.push(`${slot}_text_capability_missing`);if(!Number.isInteger(x.context_window_tokens)||x.context_window_tokens<0)errors.push(`${slot}_context_invalid`);if(typeof x.runtime_ready!=='boolean')errors.push(`${slot}_runtime_ready_invalid`)}
 const a=b.slots?.primary,c=b.slots?.secondary;if(a&&c&&a.provider_id===c.provider_id&&a.model_id===c.model_id)errors.push('model_identity_not_distinct');
 return{status:errors.length?'MODEL_BINDING_INVALID':'MODEL_BINDING_VALID',valid:!errors.length,errors,binding:b};
}
function policyVerify(){
 const p=policy(),errors=[];if(p.schema_version!=='1.0')errors.push('schema_version_invalid');if(p.phase!=='MULTIMODEL_P2_MODEL_ROUTER')errors.push('phase_invalid');if(!Array.isArray(p.allowed_judge_roles)||p.allowed_judge_roles.length===0)errors.push('roles_invalid');if(!Array.isArray(p.required_base_modalities)||!p.required_base_modalities.includes('text'))errors.push('base_modalities_invalid');if(!Number.isInteger(p.context_safety_reserve_tokens)||p.context_safety_reserve_tokens<0)errors.push('context_reserve_invalid');if(!p.cost_classes||typeof p.cost_classes!=='object'||Object.keys(p.cost_classes).length===0)errors.push('cost_classes_invalid');if(!Array.isArray(p.selection_priorities)||!p.selection_priorities.includes(p.default_selection_priority))errors.push('selection_priority_invalid');if(p.rules?.route_only_explicit_bound_models!==true)errors.push('explicit_binding_rule_missing');if(p.rules?.runtime_ready_required!==true)errors.push('runtime_ready_rule_missing');if(p.rules?.adapter_identity_is_not_a_routing_input!==true)errors.push('adapter_independence_rule_missing');if(p.rules?.provider_diversity_enforced!==false)errors.push('diversity_premature');if(p.rules?.automatic_fallback_enabled!==false)errors.push('fallback_premature');return{status:errors.length?'MODEL_ROUTER_POLICY_INVALID':'MODEL_ROUTER_POLICY_VALID',valid:!errors.length,errors,policy:p};
}
function requestVerify(file){
 if(!file||!fs.existsSync(file))return{status:'MODEL_ROUTE_REQUEST_MISSING',valid:false,errors:['request_missing']};let r;try{r=read(file)}catch{return{status:'MODEL_ROUTE_REQUEST_INVALID',valid:false,errors:['request_unreadable']}};const p=policy(),errors=[];
 if(r.schema_version!=='1.0')errors.push('schema_version_invalid');if(!r.task_id)errors.push('task_id_missing');if(!p.allowed_judge_roles.includes(r.judge_role))errors.push('judge_role_invalid');if(!Number.isInteger(r.estimated_context_tokens)||r.estimated_context_tokens<0)errors.push('estimated_context_tokens_invalid');if(r.required_modalities!==undefined&&(!Array.isArray(r.required_modalities)||r.required_modalities.some(x=>typeof x!=='string'||!x)))errors.push('required_modalities_invalid');if(r.selection_priority!==undefined&&!p.selection_priorities.includes(r.selection_priority))errors.push('selection_priority_invalid');if(r.max_cost_class!==undefined&&p.cost_classes[r.max_cost_class]===undefined)errors.push('max_cost_class_invalid');
 const allowed=new Set(['schema_version','task_id','judge_role','required_modalities','estimated_context_tokens','max_cost_class','selection_priority']);for(const k of Object.keys(r))if(!allowed.has(k))errors.push(`unknown_field:${k}`);
 return{status:errors.length?'MODEL_ROUTE_REQUEST_INVALID':'MODEL_ROUTE_REQUEST_VALID',valid:!errors.length,errors,request:r};
}
function requiredModalities(req,p){return [...new Set([...(p.required_base_modalities||[]),...(req.required_modalities||[]),...((p.role_required_modalities||{})[req.judge_role]||[])])].sort()}
function snapshotSlot(slot,x){return{slot,provider_id:x.provider_id,model_id:x.model_id,provider_family:x.provider_family,modalities:[...(x.modalities||[])].sort(),context_window_tokens:x.context_window_tokens,cost_class:x.cost_class,runtime_ready:x.runtime_ready===true,runtime_evidence_sha256:x.runtime_evidence==null?null:crypto.createHash('sha256').update(JSON.stringify(stable(x.runtime_evidence))).digest('hex')}}
function evaluate(slot,x,req,p){
 const reasons=[],mods=requiredModalities(req,p),costRank=p.cost_classes[x.cost_class];
 if(placeholder(x.provider_id)||placeholder(x.model_id))reasons.push('MODEL_UNBOUND');
 if(x.runtime_ready!==true)reasons.push('RUNTIME_NOT_READY');
 for(const m of mods)if(!(x.modalities||[]).includes(m))reasons.push(`MODALITY_MISSING:${m}`);
 const requiredContext=req.estimated_context_tokens+p.context_safety_reserve_tokens;const headroom=Number.isInteger(x.context_window_tokens)?x.context_window_tokens-requiredContext:null;if(headroom===null||headroom<0)reasons.push('CONTEXT_WINDOW_INSUFFICIENT');
 if(costRank===undefined)reasons.push('COST_CLASS_UNKNOWN');
 const maxRank=req.max_cost_class===undefined?null:p.cost_classes[req.max_cost_class];if(maxRank!==null&&costRank!==undefined&&costRank>maxRank)reasons.push('COST_CEILING_EXCEEDED');
 return{...snapshotSlot(slot,x),eligible:reasons.length===0,reasons,required_modalities:mods,required_context_tokens:requiredContext,context_headroom_tokens:headroom,cost_rank:costRank??null};
}
function sortEligible(a,b,priority,p){
 const slotRank=s=>{const i=p.tie_break_slot_order.indexOf(s);return i<0?999:i};
 if(priority==='CONTEXT_THEN_COST'){if(b.context_headroom_tokens!==a.context_headroom_tokens)return b.context_headroom_tokens-a.context_headroom_tokens;if(a.cost_rank!==b.cost_rank)return a.cost_rank-b.cost_rank;return slotRank(a.slot)-slotRank(b.slot)}
 if(a.cost_rank!==b.cost_rank)return a.cost_rank-b.cost_rank;if(b.context_headroom_tokens!==a.context_headroom_tokens)return b.context_headroom_tokens-a.context_headroom_tokens;return slotRank(a.slot)-slotRank(b.slot);
}
function computeRoute(binding,req){
 const p=policy(),priority=req.selection_priority||p.default_selection_priority,candidates=['primary','secondary'].map(slot=>evaluate(slot,binding.slots[slot],req,p));const eligible=candidates.filter(x=>x.eligible).sort((a,b)=>sortEligible(a,b,priority,p));const selected=eligible.length?eligible[0]:null;
 return{priority,candidates,selected};
}
function routeDecide(bindingFile,requestFile,outFile){
 const pv=policyVerify();if(!pv.valid)die('MODEL_ROUTER_POLICY_INVALID',3,{errors:pv.errors});const bv=bindingVerify(bindingFile);if(!bv.valid)die(bv.status,3,{errors:bv.errors});const rv=requestVerify(requestFile);if(!rv.valid)die(rv.status,3,{errors:rv.errors});const p=pv.policy,req=rv.request,calc=computeRoute(bv.binding,req),status=calc.selected?'MODEL_ROUTE_SELECTED':'MODEL_ROUTE_BLOCKED';
 const d={schema_version:'1.0',phase:'MULTIMODEL_P2_MODEL_ROUTER',status,task_id:req.task_id,judge_role:req.judge_role,request:{...req,required_modalities:requiredModalities(req,p),selection_priority:calc.priority,max_cost_class:req.max_cost_class??null},request_source:{sha256:hashFile(requestFile)},binding:{binding_id:bv.binding.binding_id,target_runtime:bv.binding.target_runtime,sha256:hashFile(bindingFile),slots:{primary:snapshotSlot('primary',bv.binding.slots.primary),secondary:snapshotSlot('secondary',bv.binding.slots.secondary)}},policy:{sha256:hashFile(path.join(mmRoot,'policies/model-router-policy.json')),context_safety_reserve_tokens:p.context_safety_reserve_tokens},candidates:calc.candidates,selected:calc.selected?{slot:calc.selected.slot,provider_id:calc.selected.provider_id,provider_family:calc.selected.provider_family,model_id:calc.selected.model_id,modalities:calc.selected.modalities,context_window_tokens:calc.selected.context_window_tokens,context_headroom_tokens:calc.selected.context_headroom_tokens,cost_class:calc.selected.cost_class,cost_rank:calc.selected.cost_rank}:null,router_used:true,fallback_used:false,fallback_candidates:[],diversity_policy_used:false,provider_diversity_required:false,final_judge_decision:null,final_judge_decision_authority:'ALEDEVOS_DETERMINISTIC_GATE',created_at:new Date().toISOString(),route_sha256:''};d.route_sha256=hashObj(d);if(outFile)write(path.resolve(outFile),d);return d;
}
function routeVerify(file){
 if(!file||!fs.existsSync(file))return{status:'MODEL_ROUTE_DECISION_INVALID',valid:false,errors:['route_missing']};let d;try{d=read(file)}catch{return{status:'MODEL_ROUTE_DECISION_INVALID',valid:false,errors:['route_unreadable']}};const errors=[],p=policy();if(d.schema_version!=='1.0'||d.phase!=='MULTIMODEL_P2_MODEL_ROUTER')errors.push('phase_or_schema_invalid');if(!['MODEL_ROUTE_SELECTED','MODEL_ROUTE_BLOCKED'].includes(d.status))errors.push('status_invalid');if(d.router_used!==true)errors.push('router_flag_invalid');if(d.fallback_used!==false||!Array.isArray(d.fallback_candidates)||d.fallback_candidates.length!==0)errors.push('fallback_premature');if(d.diversity_policy_used!==false||d.provider_diversity_required!==false)errors.push('diversity_premature');if(d.final_judge_decision!==null||d.final_judge_decision_authority!=='ALEDEVOS_DETERMINISTIC_GATE')errors.push('judge_authority_invalid');if(d.route_sha256!==hashObj(d))errors.push('integrity_mismatch');
 const req=d.request||{},binding={slots:d.binding?.slots};if(binding.slots?.primary&&binding.slots?.secondary&&p.selection_priorities.includes(req.selection_priority)){const calc=computeRoute(binding,req),sel=calc.selected?`${calc.selected.slot}|${calc.selected.provider_id}|${calc.selected.model_id}`:null,actual=d.selected?`${d.selected.slot}|${d.selected.provider_id}|${d.selected.model_id}`:null;if(sel!==actual)errors.push('selection_not_deterministic');if((calc.selected?'MODEL_ROUTE_SELECTED':'MODEL_ROUTE_BLOCKED')!==d.status)errors.push('status_selection_mismatch');const expected=JSON.stringify(calc.candidates.map(x=>({slot:x.slot,eligible:x.eligible,reasons:x.reasons,context_headroom_tokens:x.context_headroom_tokens,cost_rank:x.cost_rank})));const actualC=JSON.stringify((d.candidates||[]).map(x=>({slot:x.slot,eligible:x.eligible,reasons:x.reasons,context_headroom_tokens:x.context_headroom_tokens,cost_rank:x.cost_rank})));if(expected!==actualC)errors.push('candidate_evaluation_drift')}else errors.push('route_snapshot_invalid');
 return{status:errors.length?'MODEL_ROUTE_DECISION_INVALID':'MODEL_ROUTE_DECISION_VALID',valid:!errors.length,errors,route:d};
}
function certificateInputPaths(){return['multimodel/router/model-router.mjs','multimodel/registry/model-registry.json','multimodel/policies/model-router-policy.json','multimodel/schemas/model-binding.schema.json','multimodel/schemas/model-route-request.schema.json','multimodel/schemas/model-route-decision.schema.json','multimodel/templates/model-route-request.example.json','release/certifications/multimodel-p1.json','scripts/05-install-into-project.ps1']}
function certificateInputs(){return certificateInputPaths().map(rel=>({path:rel,sha256:hashFile(path.join(packageRoot,rel))}))}
function certifyRun(outFile){const pv=policyVerify(),inputs=certificateInputs();const c={schema_version:'1.0',phase:'MULTIMODEL_P2',status:pv.valid?'MULTIMODEL_P2_PACKAGE_CERTIFIED':'MULTIMODEL_P2_PACKAGE_CERTIFICATION_FAILED',package_only:true,target_runtime_validation:'DEFERRED',claims:{deterministic_router:true,explicit_bound_models_only:true,runtime_readiness_filter:true,modality_filter:true,context_fit_filter:true,cost_ceiling_filter:true,adapter_independent:true,route_evidence_sealed:true,provider_diversity_not_enforced:true,automatic_fallback_not_implemented:true,final_judge_decision_unchanged:true},policy_status:pv.status,inputs,created_at:new Date().toISOString(),evidence_sha256:''};c.evidence_sha256=hashObj(c);if(outFile)write(path.resolve(outFile),c);return c}
function certifyVerify(file){if(!file||!fs.existsSync(file))return{status:'MULTIMODEL_P2_CERTIFICATE_INVALID',valid:false,errors:['certificate_missing']};let c;try{c=read(file)}catch{return{status:'MULTIMODEL_P2_CERTIFICATE_INVALID',valid:false,errors:['certificate_unreadable']}};const errors=[];if(c.phase!=='MULTIMODEL_P2')errors.push('phase_invalid');if(c.package_only!==true||c.target_runtime_validation!=='DEFERRED')errors.push('runtime_boundary_invalid');if(c.evidence_sha256!==hashObj(c))errors.push('certificate_integrity_mismatch');const current=new Map(certificateInputs().map(x=>[x.path,x.sha256]));for(const x of c.inputs||[])if(current.get(x.path)!==x.sha256)errors.push(`input_drift:${x.path}`);if((c.inputs||[]).length!==current.size)errors.push('input_set_drift');return{status:errors.length?'MULTIMODEL_P2_CERTIFICATE_STALE_OR_TAMPERED':'MULTIMODEL_P2_CERTIFICATE_VALID',valid:!errors.length,errors,certificate:c}}

if(group==='policy'&&cmd==='verify'){const r=policyVerify();out(r);process.exit(r.valid?0:3)}
if(group==='request'&&cmd==='verify'){const r=requestVerify(path.resolve(take('--request','')));out(r);process.exit(r.valid?0:3)}
if(group==='route'&&cmd==='decide'){const d=routeDecide(path.resolve(take('--binding','')),path.resolve(take('--request','')),take('--out'));out(d);process.exit(d.status==='MODEL_ROUTE_SELECTED'?0:5)}
if(group==='route'&&cmd==='verify'){const r=routeVerify(path.resolve(take('--route','')));out(r);process.exit(r.valid?0:3)}
if(group==='certify'&&cmd==='run'){const c=certifyRun(take('--out'));out(c);process.exit(c.status.endsWith('CERTIFIED')?0:4)}
if(group==='certify'&&cmd==='verify'){const r=certifyVerify(path.resolve(take('--certificate','')));out(r);process.exit(r.valid?0:4)}
die('MODEL_ROUTER_COMMAND_UNKNOWN',2,{usage:['policy verify','request verify --request <json>','route decide --binding <json> --request <json> [--out <json>]','route verify --route <json>','certify run --out <json>','certify verify --certificate <json>']});
