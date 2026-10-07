import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const SELF=fileURLToPath(import.meta.url);
function codexPermissionArgs(profile){
  const profiles={
    aledevos_readonly:'permissions.aledevos_readonly={description="AleDevOS read-only specialist",filesystem={":root"="deny",":minimal"="read",":workspace_roots"={"."="read"}},network={enabled=false,allow_local_binding=false}}',
    aledevos_writer:'permissions.aledevos_writer={description="AleDevOS product writer",filesystem={":root"="deny",":minimal"="read",":workspace_roots"={"."="write",".aledevos"="read",".codex"="read",".agents"="read","AGENTS.md"="read","AGENTS.override.md"="read",".git"="read"}},network={enabled=false,allow_local_binding=false}}'
  };
  const def=profiles[profile];if(!def)throw new Error(`codex_permission_profile_unknown:${profile}`);
  return ['-c',def,'-c',`default_permissions="${profile}"`];
}
const ADAPTERS={
  opencode:{binary:'opencode',versionArgs:['--version'],invoke:(m,p)=>['run','--standalone','--model',m,'--format','json',p]},
  codex:{binary:'codex',versionArgs:['--version'],invoke:(m,p)=>['--ask-for-approval','never','exec','--model',m,...codexPermissionArgs('aledevos_readonly'),'--json',p]},
  'claude-code':{binary:'claude',versionArgs:['--version'],invoke:(m,p)=>['-p','--model',m,'--permission-mode','dontAsk','--output-format','json','--max-turns','1',p]},
  antigravity:{binary:'agy',versionArgs:['--version'],invoke:(m,p)=>['--model',m,'-p',p,'--output-format','json','--print-timeout','2m','--sandbox']}
};
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const norm=p=>String(p||'').replaceAll('\\','/').replace(/^\.\//,'');
const fsha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())if(k!=='probe_sha256')o[k]=stable(v[k]);return o}return v}
const sha=v=>crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const rel=(root,p)=>norm(path.relative(root,p));
const fp=()=>crypto.createHash('sha256').update([os.platform(),os.arch(),os.release(),process.version,os.hostname()].join('|')).digest('hex');
function runtime(root,name){const installed=path.join(root,'.aledevos','security-reliability','runtime',name);const source=path.join(root,'security-reliability','engine',name);return fs.existsSync(installed)?installed:source}
function runNode(root,file,args){const r=spawnSync(process.execPath,[file,...args],{cwd:root,encoding:'utf8',windowsHide:true,shell:false,timeout:300000});let q=null;try{q=JSON.parse((r.stdout||'').trim())}catch{}return{ok:r.status===0,status:r.status,q,stdout:r.stdout||'',stderr:r.stderr||''}}
function art(e,role,helpers,root,errors){const a=(e.artifacts||[]).find(x=>x.role===role);if(!a){errors.push(`artifact_missing:${role}`);return null}const p=helpers.relWithin(root,a.path);if(!p||!fs.existsSync(p)){errors.push(`artifact_path_invalid_or_missing:${role}`);return null}return p}
function recordValid(root,p){return runNode(root,runtime(root,'reliability-registry.mjs'),['record','verify','--root',root,'--path',p])}
function probeVerify(root,p,errors){let q=null;try{q=read(p)}catch{errors.push('security_reviewer_probe_unreadable');return null}if(q.probe_sha256!==sha(q))errors.push('security_reviewer_probe_integrity_mismatch');if(q.phase!=='SECURITY_RELIABILITY_P8_REVIEWER_PROBE'||q.status!=='SECURITY_REVIEWER_PROBE_PASS'||q.marker_observed!==true||q.finding_observed!==true||q.explicit_model_selector!==true)errors.push('security_reviewer_probe_not_pass');const role=path.join(root,q.role_path||'');if(!fs.existsSync(role)||fsha(role)!==q.role_sha256)errors.push('security_reviewer_role_drift');return q}
export async function validate({root,check,evidence,helpers}){
 const errors=[],details={},sec=runtime(root,'security-assurance.mjs');if(!fs.existsSync(sec)){errors.push('security_reliability_runtime_missing');return{ok:false,errors,details}}
 if(check.id==='security_native_scan_real'){
   const p=art(evidence,'security_native_scan',helpers,root,errors);if(p){const r=runNode(root,sec,['scan','verify','--root',root,'--receipt',p]);if(!r.ok||r.q?.valid!==true||r.q?.receipt?.status!=='SECURITY_NATIVE_SCAN_COMPLETE')errors.push(...(r.q?.errors||['security_native_scan_verify_failed']));else details.summary=r.q.receipt.summary}
 }else if(check.id==='security_reviewer_real'){
   const review=art(evidence,'security_review_receipt',helpers,root,errors),probe=art(evidence,'security_reviewer_probe',helpers,root,errors);if(review){const r=runNode(root,sec,['review','verify','--root',root,'--receipt',review]);if(!r.ok||r.q?.valid!==true||r.q?.review?.status!=='SECURITY_REVIEW_PASS')errors.push(...(r.q?.errors||['security_review_verify_failed']));else details.review={provider_id:r.q.review.provider_id,model_id:r.q.review.model_id,findings:r.q.review.findings?.length||0}}if(probe)details.probe=probeVerify(root,probe,errors)
 }else if(check.id==='dependency_security_scan_real'){
   const receipt=art(evidence,'external_security_scan',helpers,root,errors),profile=art(evidence,'external_security_profile',helpers,root,errors);if(receipt&&profile){const r=runNode(root,sec,['external','verify','--root',root,'--receipt',receipt,'--profile',profile]);if(!r.ok||r.q?.valid!==true||r.q?.receipt?.status!=='EXTERNAL_SECURITY_SCAN_PASS'||r.q?.receipt?.dependency_scan_satisfied!==true)errors.push(...(r.q?.errors||['external_security_scan_verify_failed']));else details.runs=r.q.receipt.runs}
 }else if(check.id==='bug_regression_registry_real'){
   const p=art(evidence,'bug_record',helpers,root,errors);if(p){const r=recordValid(root,p);if(!r.ok||r.q?.valid!==true)errors.push(...(r.q?.errors||['bug_record_invalid']));else{const b=r.q.record;if(b.record_type!=='BUG'||b.status!=='VERIFIED'||!b.regression_test||b.regression_verified!==true)errors.push('bug_regression_not_verified');details.bug_id=b.id}}
 }else if(check.id==='incident_vulnerability_registry_real'){
   const v=art(evidence,'vulnerability_record',helpers,root,errors),i=art(evidence,'incident_record',helpers,root,errors);for(const [n,p,t] of [['vulnerability',v,'VULNERABILITY'],['incident',i,'INCIDENT']])if(p){const r=recordValid(root,p);if(!r.ok||r.q?.valid!==true)errors.push(`${n}_record_invalid`);else{const q=r.q.record;if(q.record_type!==t)errors.push(`${n}_record_type_invalid`);if(['CRITICAL','HIGH'].includes(q.severity)&&!['VERIFIED','CLOSED','MITIGATED','ACCEPTED_RISK'].includes(q.status))errors.push(`${n}_severe_open`)}}
 }else if(check.id==='test_health_real'){
   const p=art(evidence,'test_health_summary',helpers,root,errors);if(p){const r=runNode(root,sec,['test-health','verify','--root',root,'--summary',p]);if(!r.ok||r.q?.valid!==true||r.q?.summary?.status!=='TEST_HEALTH_PASS')errors.push(...(r.q?.errors||['test_health_verify_failed']));else details.tests=r.q.summary}
 }else if(check.id==='security_reliability_assurance_real'){
   const receipt=art(evidence,'security_assurance_receipt',helpers,root,errors),profile=art(evidence,'security_assurance_profile',helpers,root,errors);if(receipt&&profile){const r=runNode(root,sec,['gate','verify','--root',root,'--receipt',receipt,'--profile',profile]);if(!r.ok||r.q?.valid!==true||r.q?.gate?.status!=='SECURITY_RELIABILITY_PASS')errors.push(...(r.q?.errors||['security_reliability_gate_verify_failed']));else details.registry_summary=r.q.gate.registry_summary}
 }else errors.push('p8_validator_wrong_check');
 return{ok:errors.length===0,errors:[...new Set(errors)],details};
}

function command(name,args,cwd,timeout=240000){const r=spawnSync(name,args,{cwd,encoding:'utf8',windowsHide:true,shell:false,timeout,env:{...process.env}});return{ok:r.status===0,status:r.status,stdout:r.stdout||'',stderr:r.stderr||'',error:r.error?.message||null,argv:[name,...args]}}
function selector(argv,model){const i=argv.indexOf('--model');return i>=0&&argv[i+1]===model}
function reviewerRole(root,adapter){const map={opencode:'adapters/opencode/.opencode/agents/security-reviewer.md',codex:'adapters/codex/.codex/agents/security-reviewer.toml','claude-code':'adapters/claude-code/.claude/agents/security-reviewer.md',antigravity:'adapters/antigravity/.agents/agents/security-reviewer.md'};return path.join(root,map[adapter]||'')}
function probe(root,spec,outPath){const d=ADAPTERS[spec.adapter];if(!d)throw new Error('reviewer_adapter_unknown');const role=reviewerRole(root,spec.adapter);if(!fs.existsSync(role))throw new Error('security_reviewer_role_missing');const version=command(d.binary,d.versionArgs,root,30000),token=crypto.randomBytes(8).toString('hex'),marker=`ALEDEVOS_P8_SECURITY_${token}`;const prompt=`AleDevOS P8 Security Reviewer probe. Review this code only: const cmd = userInput; require('child_process').exec(cmd); Identify the vulnerability class. Return JSON containing marker ${marker} and finding COMMAND_INJECTION. Do not use tools.`;let inv={ok:false,status:null,stdout:'',stderr:'',argv:[d.binary],error:'cli_not_ready'};if(version.ok)inv=command(d.binary,d.invoke(spec.invocation_model_id,prompt),root);const text=`${inv.stdout}\n${inv.stderr}`;const q={schema_version:'1.0',phase:'SECURITY_RELIABILITY_P8_REVIEWER_PROBE',status:inv.ok&&text.includes(marker)&&text.includes('COMMAND_INJECTION')&&selector(inv.argv,spec.invocation_model_id)?'SECURITY_REVIEWER_PROBE_PASS':'SECURITY_REVIEWER_PROBE_BLOCKED',adapter:spec.adapter,provider_id:spec.provider_id,model_id:spec.model_id,invocation_model_id:spec.invocation_model_id,target_fingerprint_sha256:fp(),role_path:rel(root,role),role_sha256:fsha(role),explicit_model_selector:selector(inv.argv,spec.invocation_model_id),marker_observed:text.includes(marker),finding_observed:text.includes('COMMAND_INJECTION'),exit_code:inv.status,stdout_sha256:crypto.createHash('sha256').update(inv.stdout||'').digest('hex'),stderr_sha256:crypto.createHash('sha256').update(inv.stderr||'').digest('hex'),observed_at:new Date().toISOString(),probe_sha256:''};q.probe_sha256=sha(q);if(outPath){fs.mkdirSync(path.dirname(outPath),{recursive:true});fs.writeFileSync(outPath,JSON.stringify(q,null,2)+'\n')}return q}
async function cli(){const a=process.argv.slice(2),c=a[0],take=(f,d=null)=>{const i=a.indexOf(f);return i>=0&&i+1<a.length?a[i+1]:d},root=path.resolve(take('--root',process.cwd()));try{if(c==='inventory'){const roles=['opencode','codex','claude-code','antigravity'].map(x=>({adapter:x,role_present:fs.existsSync(reviewerRole(root,x)),binary:ADAPTERS[x].binary}));console.log(JSON.stringify({status:'SECURITY_RELIABILITY_P8_INVENTORY',roles},null,2));process.exit(0)}if(c==='probe'){const p=read(path.resolve(take('--profile'))),q=probe(root,p.reviewer,path.resolve(take('--out')));console.log(JSON.stringify(q,null,2));process.exit(q.status.endsWith('_PASS')?0:4)}console.log(JSON.stringify({status:'SECURITY_RELIABILITY_P8_VALIDATOR_COMMAND_UNKNOWN'},null,2));process.exit(2)}catch(e){console.log(JSON.stringify({status:'SECURITY_RELIABILITY_P8_VALIDATOR_FAILED',error:e.message},null,2));process.exit(7)}}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(SELF))await cli();
