#!/usr/bin/env node
// P37.3 is an independent, read-only evidence review. It may sign off the
// evidence package, but it must never turn observations into PRO_CERTIFIED.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {defaultRoot, getRevision} from './p37-operational.mjs';
import {sourceTarget, lfSha256} from './p37-skills.mjs';

const SKILLS=['backend-change','database-change','diff-review','frontend-change',
  'implementation-plan','regression-analysis','repair-loop','repo-map','requirements-check',
  'safe-edit','security-check','task-contract','test-strategy'];
const CASES=['activated_on_correct_request','rejected_out_of_scope_request','executed_real_task',
  'scoped_permissions_enforced','failure_and_recovery','independent_verification'];
const FORBIDDEN=new Set(['raw_prompt','transcript','conversation','api_key','secret','password',
  'authorization_header','model_thoughts','private_key']);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const stateDir=root=>path.join(root,'.aledevos','state','certification','p37');
const receiptRoot=root=>path.join(stateDir(root),'skills','codex');
const walk=(dir,out=[])=>{
  if(!fs.existsSync(dir))return out;
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,item.name);
    if(item.isDirectory())walk(p,out);
    else if(item.isFile()&&item.name.endsWith('.json'))out.push(p);
  }
  return out;
};
const hasForbiddenKey=(value,trail='')=>{
  if(!value||typeof value!=='object')return null;
  for(const [key,child] of Object.entries(value)){
    if(FORBIDDEN.has(key))return trail?trail+'.'+key:key;
    const hit=hasForbiddenKey(child,trail?trail+'.'+key:key);
    if(hit)return hit;
  }
  return null;
};
const expectedKey=(skill,caseId)=>skill+'::'+caseId;
const issue=(code,detail)=>({code,detail});

export function reviewP37_3(root=defaultRoot,{write=false,reviewer='p37.3-independent-verifier'}={}){
  const revision=getRevision(root), files=walk(receiptRoot(root)), issues=[], receipts=[];
  const byCase=new Map();
  for(const file of files){
    let receipt;
    try{receipt=read(file);}catch{issues.push(issue('RECEIPT_JSON_INVALID',file));continue;}
    receipts.push({file,receipt});
    const key=expectedKey(receipt.skill,receipt.case_id);
    if(receipt.adapter!=='codex'||!SKILLS.includes(receipt.skill)||!CASES.includes(receipt.case_id))
      issues.push(issue('RECEIPT_MATRIX_ID_INVALID',file));
    else if(!byCase.has(key))byCase.set(key,{file,receipt});
  }
  for(const skill of SKILLS)for(const caseId of CASES)
    if(!byCase.has(expectedKey(skill,caseId)))issues.push(issue('MISSING_SCENARIO',expectedKey(skill,caseId)));

  const profilePath=path.join(root,'adapters','codex','runtime-profile.json');
  const profileSha=fs.existsSync(profilePath)?sha(fs.readFileSync(profilePath)):null;
  for(const {file,receipt} of receipts){
    const prefix=file;
    const forbidden=hasForbiddenKey(receipt);
    if(forbidden)issues.push(issue('FORBIDDEN_EVIDENCE_FIELD',prefix+':'+forbidden));
    if(receipt.git_sha!==revision)issues.push(issue('STALE_GIT_SHA',prefix));
    if(receipt.phase!=='P37.1'||receipt.schema_version!=='1.0')issues.push(issue('RECEIPT_SCHEMA_INVALID',prefix));
    if(receipt.profile_sha256!==profileSha)issues.push(issue('RUNTIME_PROFILE_HASH_MISMATCH',prefix));
    if(!receipt.source_sha256||!SKILLS.includes(receipt.skill))issues.push(issue('SOURCE_PROVENANCE_MISSING',prefix));
    else {
      try{
        const target=sourceTarget(root,'codex',receipt.skill);
        const source=path.join(root,'adapters','codex','.agents','skills',receipt.skill,'SKILL.md');
        if(receipt.source_sha256!==target.source_sha256||!fs.existsSync(source)||lfSha256(source)!==receipt.source_sha256)
          issues.push(issue('SKILL_SOURCE_HASH_MISMATCH',prefix));
      }catch{issues.push(issue('SKILL_SOURCE_NOT_RESOLVABLE',prefix));}
    }
    const runtime=receipt.runtime||{}, provenance=receipt.model_provenance||{};
    if(!runtime.invocation_id||!runtime.provider_declared||!runtime.transport_process_spawn_observed)
      issues.push(issue('RUNTIME_INVOCATION_PROVENANCE_MISSING',prefix));
    if(provenance.requested_model_flag_verified!==true||provenance.requested_reasoning_effort!=='low'||
       provenance.requested_reasoning_effort_verified!==true)
      issues.push(issue('MODEL_OR_REASONING_NOT_PINNED',prefix));
    if(receipt.status!=='EVIDENCE_REVIEW_REQUIRED')issues.push(issue('OBSERVATION_NOT_ELIGIBLE',prefix+':'+String(receipt.status)));
    if(!Array.isArray(receipt.issues)||receipt.issues.length)issues.push(issue('RECEIPT_HAS_RUNTIME_ISSUES',prefix));
    const c=receipt.case_id;
    if(!['activated_on_correct_request','rejected_out_of_scope_request'].includes(c)){
      const e=receipt.execution_evidence||{}, route=receipt.route_progress||{};
      if(e.task_contracts<1||e.task_states<1)issues.push(issue('TASK_EVIDENCE_MISSING',prefix));
      if(e.route_receipts<1||route.route_status!=='ROUTE_READY'||route.route_integrity_verified!==true)
        issues.push(issue('ROUTE_EVIDENCE_INVALID',prefix));
    }
    if(c==='independent_verification'&&(!receipt.verifier_id_declared||receipt.verifier_id_declared===runtime.provider_declared))
      issues.push(issue('INDEPENDENT_VERIFIER_ID_INVALID',prefix));
  }
  const manifest=receipts.map(({file})=>({path:path.relative(root,file).replaceAll(path.sep,'/'),sha256:sha(fs.readFileSync(file))})).sort((a,b)=>a.path.localeCompare(b.path));
  const report={schema_version:'1.0',phase:'P37.3',reviewer,reviewed_at:new Date().toISOString(),git_sha:revision,
    adapter:'codex',required_scenarios:SKILLS.length*CASES.length,receipt_count:receipts.length,
    complete_matrix:byCase.size===SKILLS.length*CASES.length,manifest_sha256:sha(JSON.stringify(manifest)),
    receipt_manifest:manifest,issues,independent_signoff:issues.length===0?'P37_3_SIGNOFF_PASS':'P37_3_SIGNOFF_FAIL',
    pro_certified:false,provider_model_identity_observed:false,
    note:'This review authenticates bounded local evidence only; it does not certify the product.'};
  if(write){const out=path.join(stateDir(root),'p37.3-independent-signoff.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');report.output_file=out;}
  return report;
}

export async function main(args=process.argv.slice(2),root=defaultRoot){
  if(args[0]!=='review')throw Error('P37_3_USAGE: review [--write] [--reviewer <id>]');
  const reviewer=args.includes('--reviewer')?args[args.indexOf('--reviewer')+1]:'p37.3-independent-verifier';
  return reviewP37_3(root,{write:args.includes('--write'),reviewer});
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url))){
  try{console.log(JSON.stringify(await main(),null,2));process.exitCode=0;}catch(error){console.error(String(error.message||error));process.exitCode=2;}
}
