#!/usr/bin/env node
// P37.0: provenance intake and evidence review *only*.
// Independent runtime observations and P37.3 authorization are mandatory for PRO_CERTIFIED.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
export const defaultRoot=path.resolve(here,'../../..');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const isSha=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
const isHexCommit=s=>typeof s==='string'&&/^[0-9a-f]{40}$/.test(s);
const within=(base,target)=>{const r=path.relative(base,target);return r!==''&&!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r)};
const roleFile=(adapter,id)=>({
 opencode:'.opencode/agents/'+id+'.md',
 codex:'.codex/agents/'+id+'.toml',
 'claude-code':'.claude/agents/'+id+'.md',
 antigravity:'.agents/agents/'+id+'.md'
})[adapter];
const skillPrefix={opencode:'.opencode/skills',codex:'.agents/skills',
 'claude-code':'.claude/skills',antigravity:'.agents/skills'};
const validId=id=>typeof id==='string'&&/^[a-z][a-z0-9-]{1,90}$/.test(id);

export function getRevision(root){
 const run=spawnSync('git',['-C',root,'rev-parse','--verify','HEAD'],{
  encoding:'utf8',timeout:10000,shell:false,windowsHide:true
 });
 const ref=(run.stdout||'').trim();
 if(run.status!==0||!isHexCommit(ref))throw Error('P37_GIT_HEAD_UNAVAILABLE');
 return ref;
}
export function buildOperationalPlan(root=defaultRoot,policy=null){
 root=path.resolve(root);
 const p=policy||read(path.join(root,'certification/pro/policies/p37-operational.json'));
 if(p.schema_version!=='1.0'||p.phase!=='ALEDEVOS_P37_OPERATIONAL')throw Error('P37_POLICY_INVALID');
 const q=read(path.join(root,p.component_matrix.skills_source));
 const roles=read(path.join(root,p.component_matrix.roles_source));
 if(q.scope.bundled_skills.length!==13||roles.roles.length!==25)throw Error('P37_SOURCE_MATRIX_COUNT_MISMATCH');
 const adapters=p.component_matrix.adapters;
 if(JSON.stringify(adapters)!==JSON.stringify(['opencode','codex','claude-code','antigravity']))throw Error('P37_ADAPTER_MATRIX_INVALID');
 const targets=[];
 for(const adapter of adapters){
  const registry=read(path.join(root,'skillsystem/bindings',adapter+'.json'));
  if(registry.adapter!==adapter||registry.bindings.length!==13)throw Error('P37_BINDINGS_MISSING:'+adapter);
  const ids=new Set();
  for(const skill of q.scope.bundled_skills){
   const b=registry.bindings.find(x=>x.skill_id===skill);
   if(!b||ids.has(skill))throw Error('P37_BINDING_MISSING_OR_DUPLICATE:'+adapter+':'+skill);
   ids.add(skill);
   const expected=skillPrefix[adapter]+'/'+skill+'/SKILL.md';
   if(b.path!==expected||!isSha(b.expected_sha256))throw Error('P37_BINDING_PATH_INVALID:'+adapter+':'+skill);
   const source='adapters/'+adapter+'/'+expected;
   const observed=sha(path.join(root,source));
   if(observed!==b.expected_sha256)throw Error('P37_SKILL_SOURCE_DRIFT:'+adapter+':'+skill);
   targets.push({kind:'skill',adapter,id:skill,source_path:source,source_sha256:observed,
    required_cases:p.cases.skill,status:'BLOCKED',reason:'NO_REAL_EXECUTION_RECEIPT'});
  }
  for(const role of roles.roles){
   if(!validId(role.id))throw Error('P37_ROLE_ID_INVALID');
   const source='adapters/'+adapter+'/'+roleFile(adapter,role.id);
   const observed=sha(path.join(root,source));
   targets.push({kind:'agent',adapter,id:role.id,source_path:source,source_sha256:observed,
    required_cases:p.cases.agent,status:'BLOCKED',reason:'NO_REAL_EXECUTION_RECEIPT'});
  }
  for(const id of p.component_matrix.workflow_ids){
   if(!validId(id))throw Error('P37_WORKFLOW_ID_INVALID');
   const source='certification/pro/workflows/p36-2-handoff-contract.json';
   targets.push({kind:'workflow',adapter,id,source_path:source,source_sha256:sha(path.join(root,source)),
    required_cases:p.cases.workflow,status:'BLOCKED',reason:'NO_REAL_EXECUTION_RECEIPT'});
  }
 }
 const keys=targets.map(x=>x.kind+':'+x.adapter+':'+x.id);
 if(targets.length!==p.component_matrix.expected_total||new Set(keys).size!==keys.length)throw Error('P37_TARGET_MATRIX_INVALID');
 return {schema_version:'1.0',phase:'P37.0',status:'PLAN_ONLY_NOT_EXECUTED',
  repository_root:root,required_total:targets.length,breakdown:{skills:52,agents:100,workflows:4},
  pro_certified:0,targets};
}
function shape(obj,keys,label){
 if(!obj||typeof obj!=='object'||Array.isArray(obj))return [label+':INVALID_OBJECT'];
 return Object.keys(obj).filter(k=>!keys.includes(k)).map(k=>label+':UNEXPECTED_FIELD:'+k);
}
function timeCheck(when,now,policy){
 const d=Date.parse(when);
 if(typeof when!=='string'||!Number.isFinite(d))return 'INVALID_TIMESTAMP';
 if(d>now+policy.max_future_skew_minutes*60000)return 'FUTURE_TIMESTAMP';
 if(now-d>policy.max_age_hours*3600000)return 'STALE_TIMESTAMP';
 return null;
}
function artifactCheck(root,relative,expected,policy){
 if(typeof relative!=='string'||!relative.startsWith('.aledevos/state/certification/p37/')||
    path.isAbsolute(relative)||relative.includes('\\')||relative.split('/').includes('..'))return 'ARTIFACT_OUTSIDE_PROTECTED_EVIDENCE_ROOT';
 const abs=path.resolve(root,relative);
 const state=path.resolve(root,'.aledevos/state/certification/p37');
 if(!within(state,abs))return 'ARTIFACT_OUTSIDE_PROTECTED_EVIDENCE_ROOT';
 if(!policy.approved_artifact_extensions.includes(path.extname(abs)))return 'ARTIFACT_EXTENSION_DENIED';
 if(!fs.existsSync(abs)||!fs.statSync(abs).isFile())return 'ARTIFACT_MISSING';
 if(!within(fs.realpathSync(state),fs.realpathSync(abs)))return 'ARTIFACT_SYMLINK_ESCAPE';
 if(!isSha(expected)||sha(abs)!==expected)return 'ARTIFACT_HASH_MISMATCH';
 return null;
}
// Receipt metadata is untrusted. A valid receipt is at most EVIDENCE_REVIEW_REQUIRED.
export function verifyOperationalReceipt(target,receipt,context){
 const errors=[],p=context.policy.provenance,now=context.now??Date.now(),root=path.resolve(context.root);
 const add=e=>{if(e&&!errors.includes(e))errors.push(e)};
 for(const e of shape(receipt,[
  'kind','adapter','id','source_sha256','git_sha','observed_at','runtime','cases','verifier'
 ],'RECEIPT'))add(e);
 if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)){
  return {status:'BLOCKED',issues:['RECEIPT_MISSING_OR_INVALID'],pro_certified:false};
 }
 for(const field of ['kind','adapter','id'])if(receipt[field]!==target[field])add('TARGET_IDENTITY_MISMATCH:'+field);
 if(receipt.source_sha256!==target.source_sha256)add('STALE_OR_WRONG_SOURCE_HASH');
 if(receipt.git_sha!==context.git_sha||!isHexCommit(receipt.git_sha))add('REVISION_UNPINNED_OR_STALE');
 add(timeCheck(receipt.observed_at,now,p));
 for(const e of shape(receipt.runtime,[
  'provider_id','model_id','runtime_id','invocation_id','invoked_externally'
 ],'RUNTIME'))add(e);
 const runtime=receipt.runtime||{};
 for(const k of ['provider_id','model_id','runtime_id','invocation_id'])
  if(typeof runtime[k]!=='string'||runtime[k].trim().length<3)add('REAL_PROVIDER_PROVENANCE_REQUIRED:'+k);
 if(runtime.invoked_externally!==true)add('REAL_RUNTIME_INVOCATION_REQUIRED');
 if(typeof runtime.provider_id==='string'&&/^(mock|fake|synthetic|unknown|test-only)$/i.test(runtime.provider_id))add('CONTROLLED_PROVIDER_NOT_REAL');
 if(!Array.isArray(receipt.cases))add('CASE_RECEIPTS_MISSING');
 else{
  if(receipt.cases.length!==target.required_cases.length)add('CASE_COUNT_MISMATCH');
  const seen=new Set();
  for(const item of receipt.cases){
   for(const e of shape(item,['id','status','provenance','observed_at','evidence_path','evidence_sha256','exit_code'],'CASE'))add(e);
   if(!item||typeof item!=='object')continue;
   if(!target.required_cases.includes(item.id))add('UNKNOWN_CASE:'+String(item.id));
   if(seen.has(item.id))add('DUPLICATE_CASE:'+String(item.id));seen.add(item.id);
   if(item.status!=='PASS')add(item.status==='FAIL'?'OBSERVED_CASE_FAILURE:'+item.id:'CASE_NOT_PASSED:'+item.id);
   if(item.provenance!=='REAL')add('NON_REAL_CASE_EVIDENCE:'+item.id);
   if(!Number.isInteger(item.exit_code))add('MISSING_EXIT_CODE:'+item.id);
   add(timeCheck(item.observed_at,now,p));
   add(artifactCheck(root,item.evidence_path,item.evidence_sha256,p));
  }
  for(const name of target.required_cases)if(!seen.has(name))add('REQUIRED_CASE_MISSING:'+name);
 }
 for(const e of shape(receipt.verifier,[
  'role','reviewer_id','independent','status','observed_at','evidence_path','evidence_sha256'
 ],'VERIFIER'))add(e);
 const verifier=receipt.verifier||{};
 if(verifier.role!=='verifier'||verifier.independent!==true||verifier.status!=='PASS'||
    typeof verifier.reviewer_id!=='string'||verifier.reviewer_id.length<3)add('INDEPENDENT_VERIFIER_REQUIRED');
 if(verifier.reviewer_id===runtime.provider_id||verifier.reviewer_id===runtime.invocation_id)add('SELF_VERIFICATION_FORBIDDEN');
 add(timeCheck(verifier.observed_at,now,p));
 add(artifactCheck(root,verifier.evidence_path,verifier.evidence_sha256,p));
 return {status:errors.some(x=>x.startsWith('OBSERVED_CASE_FAILURE'))?'FAILED':errors.length?'BLOCKED':'EVIDENCE_REVIEW_REQUIRED',
  issues:errors.filter(Boolean).sort(),pro_certified:false};
}
export function assessOperational(root,manifest,options={}){
 const plan=buildOperationalPlan(root,options.policy);
 const policy=options.policy||read(path.join(root,'certification/pro/policies/p37-operational.json'));
 if(!manifest||manifest.schema_version!=='1.0'||manifest.phase!=='P37.0'||
    !Array.isArray(manifest.receipts))throw Error('P37_MANIFEST_INVALID');
 const git_sha=options.revision||getRevision(root);
 if(!isHexCommit(git_sha)||manifest.git_sha!==git_sha)throw Error('P37_MANIFEST_REVISION_STALE');
 const all=new Map(),unexpected=[];
 for(const r of manifest.receipts){
  const key=r&&r.kind+':'+r.adapter+':'+r.id;
  if(all.has(key))throw Error('P37_DUPLICATE_RECEIPT:'+key);
  all.set(key,r);
 }
 const outputs=plan.targets.map(t=>{
  const key=t.kind+':'+t.adapter+':'+t.id;
  const receipt=all.get(key);all.delete(key);
  if(!receipt)return {...t,status:'BLOCKED',reason:'NO_REAL_EXECUTION_RECEIPT'};
  const verdict=verifyOperationalReceipt(t,receipt,{root,policy,git_sha,now:options.now});
  return {...t,status:verdict.status,reason:verdict.issues.join(';')||'INDEPENDENT_P37_3_REVIEW_REQUIRED'};
 });
 for(const key of all.keys())unexpected.push(key);
 if(unexpected.length)throw Error('P37_UNEXPECTED_RECEIPT_TARGET:'+unexpected.join(','));
 const summary={required:outputs.length,blocked:outputs.filter(x=>x.status==='BLOCKED').length,
  failed:outputs.filter(x=>x.status==='FAILED').length,
  evidence_review_required:outputs.filter(x=>x.status==='EVIDENCE_REVIEW_REQUIRED').length,
  pro_certified:0};
 return {schema_version:'1.0',phase:'P37.0',git_sha,status:'NOT_PRO_CERTIFIED',summary,
  nonclaim:'Review of JSON receipts cannot authenticate runtime execution by itself; P37.3 must independently observe and approve genuine runs. No automatic PRO_CERTIFIED.',targets:outputs};
}
const isEntrypoint=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isEntrypoint){
 const [cmd,...args]=process.argv.slice(2);
 const opt=k=>{const i=args.indexOf(k);return i===-1?null:args[i+1]};
 const root=path.resolve(opt('--root')||defaultRoot);
 try{
  if(cmd==='plan'){
   const p=buildOperationalPlan(root),revision=getRevision(root);
   const output={...p,git_sha:revision};
   console.log(JSON.stringify(output,null,2));
  }else if(cmd==='assess'){
   const file=opt('--manifest');
   if(!file)throw Error('P37_EVIDENCE_MANIFEST_REQUIRED');
   const evidenceRoot=path.resolve(root,'.aledevos/state/certification/p37');
   const abs=path.resolve(file);
   if(!within(evidenceRoot,abs)||!fs.existsSync(abs)||!within(fs.realpathSync(evidenceRoot),fs.realpathSync(abs)))throw Error('P37_MANIFEST_NOT_IN_PROTECTED_STATE');
   const output=assessOperational(root,read(abs));
   console.log(JSON.stringify(output,null,2));process.exit(4);
  }else{
   console.error('Usage: node certification/pro/engine/p37-operational.mjs plan --root . | assess --root . --manifest <path under .aledevos/state/certification/p37>');
   process.exit(2);
  }
 }catch(e){console.error('P37_OPERATIONAL_BLOCKED:'+e.message);process.exit(7)}
}
