import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

function artifacts(e){return new Map((e.artifacts||[]).map(x=>[x.role,x]));}
function abs(root,a,helpers,errors,role){if(!a){errors.push(`artifact_missing:${role}`);return null}const p=helpers.relWithin(root,a.path);if(!p||!fs.existsSync(p)){errors.push(`artifact_path_invalid_or_missing:${role}`);return null}return p}
function runtime(root){const a=path.join(root,'.aledevos','efficiency','runtime','efficiency-governor.mjs');const b=path.join(root,'efficiency','engine','efficiency-governor.mjs');return fs.existsSync(a)?a:b}
function run(root,args){const r=spawnSync(process.execPath,[runtime(root),...args],{cwd:root,encoding:'utf8',windowsHide:true,shell:false});let obj=null;try{obj=JSON.parse((r.stdout||'').trim())}catch{}return{ok:r.status===0,status:r.status,obj,stdout:r.stdout||'',stderr:r.stderr||''}}
function receiptCheck(q,errors){if(q?.status!=='EFFICIENCY_PASS')errors.push('efficiency_receipt_not_pass');if(q?.quality?.preserved!==true)errors.push('quality_not_preserved');if(q?.project_manager_independence?.pass!==true)errors.push('project_manager_independence_not_pass');}

export async function validate({root,check,evidence,helpers}){
  const errors=[],details={},m=artifacts(evidence);
  if(!fs.existsSync(runtime(root))){errors.push('efficiency_runtime_missing');return{ok:false,errors,details}}
  if(check.id==='adaptive_execution_governor_real'){
    const plan=abs(root,m.get('efficiency_plan'),helpers,errors,'efficiency_plan');
    const task=abs(root,m.get('task_contract'),helpers,errors,'task_contract');
    const signals=abs(root,m.get('efficiency_signals'),helpers,errors,'efficiency_signals');
    if(plan&&task&&signals){const r=run(root,['plan','verify','--root',root,'--plan',plan,'--task',task,'--signals',signals]);if(!r.ok||r.obj?.valid!==true)errors.push(...(r.obj?.errors||['efficiency_plan_verify_failed']));else{details.profile=r.obj?.plan?.profile;details.agents=(r.obj?.plan?.agents||[]).map(x=>x.id);details.skills=r.obj?.plan?.skills||[];const forbidden=new Set(['CHOOSE_AGENT','CHOOSE_NEXT_STEP','MANUALLY_COORDINATE_WORKERS','MANUALLY_SELECT_SKILLS','MANUALLY_SELECT_TEST_ORDER','REPEAT_KNOWN_CONTEXT']);if((r.obj?.plan?.user_intervention_policy?.forbidden_operational_requests||[]).some(x=>!forbidden.has(x)))errors.push('project_manager_contract_drift')}}
  }else if(['context_token_efficiency_real','quality_preservation_real','user_project_manager_independence_real'].includes(check.id)){
    const receipt=abs(root,m.get('efficiency_benchmark_receipt'),helpers,errors,'efficiency_benchmark_receipt');
    const profile=abs(root,m.get('efficiency_benchmark_profile'),helpers,errors,'efficiency_benchmark_profile');
    if(receipt&&profile){const r=run(root,['benchmark','verify','--root',root,'--receipt',receipt,'--profile',profile]);if(!r.ok||r.obj?.valid!==true)errors.push(...(r.obj?.errors||['efficiency_benchmark_verify_failed']));else{const q=r.obj.receipt;receiptCheck(q,errors);details.profile=q.profile;details.metrics=q.metrics;details.quality=q.quality;details.project_manager_independence=q.project_manager_independence;if(check.id==='context_token_efficiency_real'){if(!(Number(q.metrics?.input_tokens?.reduction_ratio)>=0))errors.push('input_token_reduction_unproven')}if(check.id==='quality_preservation_real'&&q.quality?.preserved!==true)errors.push('quality_preservation_unproven');if(check.id==='user_project_manager_independence_real'){if(q.project_manager_independence?.operational_interventions!==0)errors.push('operational_user_interventions_nonzero')}}}
  }else errors.push('p7_validator_wrong_check');
  return{ok:errors.length===0,errors:[...new Set(errors)],details};
}
