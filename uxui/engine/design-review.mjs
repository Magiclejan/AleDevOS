#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const distRoot=path.resolve(here,'..');
const args=process.argv.slice(2);const [group,cmd]=args;
function take(flag,fallback=null){const i=args.indexOf(flag);return i>=0&&i+1<args.length?args[i+1]:fallback}
function fail(status,code=1,obj=null){process.stdout.write(JSON.stringify(obj||{status},null,2)+'\n');process.exit(code)}
function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''))}
function writeJson(p,v){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n','utf8')}
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())if(!['integrity_sha256','decision_sha256','report_sha256','judge_sha256','review_sha256','index_sha256','record_sha256','contract_sha256'].includes(k))o[k]=stable(v[k]);return o}return v}
function sha(v){return crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(stable(v))).digest('hex')}
function fileSha(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}
function policy(){return readJson(path.join(distRoot,'policies','uxui-policy.json'))}
function rootOf(p){const r=path.resolve(p||process.cwd());if(!fs.existsSync(r)||!fs.statSync(r).isDirectory())fail('PROJECT_ROOT_INVALID',70);return r}
function norm(p){return String(p||'').replaceAll('\\','/').replace(/^\.\//,'')}
function inside(root,p){const rr=path.resolve(root)+path.sep,aa=path.resolve(p);return aa===path.resolve(root)||aa.startsWith(rr)}
function finding(rule,severity,message,file=null){return {rule_id:rule,severity,message,file}}
function exceptionSet(e){return new Set((e.exceptions||[]).filter(x=>x&&x.rule_id&&x.approval_ref&&String(x.reason||'').trim().length>=8).map(x=>String(x.rule_id)))}
function designPaths(root){return {manifest:path.join(root,'.aledevos','design','design-context.json'),registry:path.join(root,'.aledevos','design','component-registry.json')}}
function validInternal(o,field){return typeof o?.[field]==='string'&&o[field]===sha(o)}
function loadState(root){
  const p=designPaths(root),errors=[];let manifest=null,registry=null;
  if(!fs.existsSync(p.manifest))errors.push('design_context_missing');else{try{manifest=readJson(p.manifest);if(!validInternal(manifest,'integrity_sha256'))errors.push('design_context_integrity_mismatch')}catch{errors.push('design_context_unreadable')}}
  if(!fs.existsSync(p.registry))errors.push('component_registry_missing');else{try{registry=readJson(p.registry);if(!validInternal(registry,'integrity_sha256'))errors.push('component_registry_integrity_mismatch')}catch{errors.push('component_registry_unreadable')}}
  if(manifest&&registry){const sec=manifest.sections?.component_registry;if(!sec)errors.push('component_registry_section_missing');else if(sec.artifact_sha256&&sec.artifact_sha256!==fileSha(p.registry))errors.push('design_context_component_registry_drift')}
  if(registry){const ids=new Set(),paths=new Set();for(const c of registry.components||[]){if(ids.has(c.component_id))errors.push(`duplicate_component_id:${c.component_id}`);ids.add(c.component_id);const cp=norm(c.canonical_path);if(paths.has(cp))errors.push(`duplicate_canonical_path:${cp}`);paths.add(cp);const abs=path.join(root,cp);if(!inside(root,abs)||!fs.existsSync(abs))errors.push(`canonical_source_missing:${c.component_id}`);else if(c.source_sha256!==fileSha(abs))errors.push(`canonical_source_drift:${c.component_id}`)}}
  return {paths:p,manifest,registry,errors};
}

function verifyPhase6Evidence(root,evidence){
  const relp=norm(evidence.phase6_review_path||'');
  if(!relp)return {present:false,valid:false,errors:['phase6_review_missing'],dimensions:null};
  const rp=path.resolve(root,relp);const errors=[];
  if(!inside(root,rp)||!fs.existsSync(rp))return {present:true,valid:false,errors:['phase6_review_missing_or_external'],dimensions:null};
  let r;try{r=readJson(rp)}catch{return {present:true,valid:false,errors:['phase6_review_unreadable'],dimensions:null}}
  if(!validInternal(r,'review_sha256'))errors.push('phase6_review_integrity_mismatch');
  if(String(r.task_id||'')!==String(evidence.task_id||''))errors.push('phase6_review_task_mismatch');
  if(r.status!=='UI_STANDARDS_PASS')errors.push('phase6_review_not_pass');
  const droot=path.join(root,'.aledevos','design');
  const linked=[['accessibility_policy_sha256',path.join(droot,'accessibility-policy.json')],['responsive_policy_sha256',path.join(droot,'responsive-policy.json')],['states_catalog_sha256',path.join(droot,'ui-states.json')],['adr_index_sha256',path.join(droot,'ui-decisions.index.json')],['design_context_sha256',path.join(droot,'design-context.json')]];
  for(const [k,p] of linked)if(fs.existsSync(p)&&r[k]!==fileSha(p))errors.push(`${k.replace('_sha256','')}_drift_since_phase6_review`);
  for(const sh of r.source_hashes||[]){const abs=path.join(root,norm(sh.path));if(!inside(root,abs)||!fs.existsSync(abs)||fileSha(abs)!==sh.sha256)errors.push(`phase6_source_drift:${sh.path}`)}
  return {present:true,valid:errors.length===0,errors,dimensions:r.dimensions||null,review_sha256:r.review_sha256,path:relp};
}
function isUiFile(rp){return ['.tsx','.jsx','.vue','.svelte','.css','.scss','.sass','.less','.html','.swift','.dart'].includes(path.extname(rp).toLowerCase())}
function isReusablePath(rp){const parts=norm(rp).toLowerCase().split('/');return parts.some(x=>['components','component','ui','design-system','design_system'].includes(x))&&['.tsx','.jsx','.vue','.svelte','.swift','.dart'].includes(path.extname(rp).toLowerCase())}
function isPageLocal(rp){const parts=norm(rp).toLowerCase().split('/');return parts.some(x=>['pages','screens','views','routes'].includes(x))}
function canonicalByPath(registry,rp){return (registry?.components||[]).find(c=>norm(c.canonical_path)===norm(rp))||null}
function loadDecision(root,item,registry){
  const dp=path.resolve(root,item.decision_path||'');if(!inside(root,dp)||!fs.existsSync(dp))return {valid:false,error:'reuse_decision_missing'};
  let d;try{d=readJson(dp)}catch{return {valid:false,error:'reuse_decision_unreadable'}}
  if(!validInternal(d,'decision_sha256'))return {valid:false,error:'reuse_decision_integrity_mismatch'};
  if(d.registry_integrity_sha256!==registry.integrity_sha256)return {valid:false,error:'reuse_decision_registry_drift'};
  return {valid:true,decision:d};
}
function hardcodedColors(abs,maxBytes){
  const st=fs.statSync(abs);if(st.size>maxBytes)return [];
  const lines=fs.readFileSync(abs,'utf8').split(/\r?\n/),hits=[];
  const re=/(#[0-9a-fA-F]{3,8}\b|\brgba?\s*\([^)]*\)|\bhsla?\s*\([^)]*\))/g;
  lines.forEach((line,i)=>{if(/^\s*--[\w-]+\s*:/.test(line))return;let m;while((m=re.exec(line)))hits.push({line:i+1,value:m[1]})});return hits;
}
function review(root,evidencePath){
  const pol=policy().phase4,st=loadState(root),blockers=[],warnings=[];const evidence=readJson(evidencePath),exceptions=exceptionSet(evidence);
  for(const er of st.errors)blockers.push(finding('DESIGN_SYSTEM_INTEGRITY','BLOCKER',er));
  const changed=[...new Set((evidence.changed_files||[]).map(norm))];
  if(changed.length>pol.guardian.max_changed_files)blockers.push(finding('CHANGESET_LIMIT','BLOCKER','changed_file_limit_exceeded'));
  const missing=[];for(const rp of changed){const abs=path.join(root,rp);if(!inside(root,abs)||!fs.existsSync(abs))missing.push(rp)}
  if(missing.length)for(const rp of missing)blockers.push(finding('CHANGE_EVIDENCE','BLOCKER','changed_file_missing_or_external',rp));
  const decisionItems=new Map((evidence.reuse_decisions||[]).map(x=>[norm(x.path),x]));let decisionValid=true;
  if(st.registry){
    for(const rp of changed.filter(isReusablePath)){
      const c=canonicalByPath(st.registry,rp),item=decisionItems.get(rp);
      if(!item){decisionValid=false;blockers.push(finding('REUSE_BEFORE_CREATE','BLOCKER','reuse_decision_required',rp));continue}
      const vd=loadDecision(root,item,st.registry);if(!vd.valid){decisionValid=false;blockers.push(finding('REUSE_BEFORE_CREATE','BLOCKER',vd.error,rp));continue}
      const d=vd.decision;
      if(d.status!=='APPROVED'){decisionValid=false;blockers.push(finding('REUSE_BEFORE_CREATE','BLOCKER',`decision_not_approved:${d.action}`,rp));continue}
      if(c&&d.action!=='EXTEND_CANONICAL'){decisionValid=false;blockers.push(finding('CANONICAL_COMPONENT_CHANGE','BLOCKER','canonical_component_change_requires_EXTEND_CANONICAL',rp))}
      if(!c&&d.action!=='CREATE_NEW_JUSTIFIED'){decisionValid=false;blockers.push(finding('REUSE_BEFORE_CREATE','BLOCKER','new_reusable_component_requires_CREATE_NEW_JUSTIFIED',rp))}
      if(isPageLocal(rp)&&d.action!=='CREATE_NEW_JUSTIFIED'){decisionValid=false;blockers.push(finding('LOCAL_COMPONENT_FORK','BLOCKER','page_local_reusable_fork_not_allowed',rp))}
    }
  }
  let tokenGuard=true;const tokenPresent=['tokens','color_system'].some(k=>st.manifest?.sections?.[k]?.status==='PRESENT');
  if(tokenPresent){for(const rp of changed.filter(isUiFile)){const abs=path.join(root,rp);if(!fs.existsSync(abs)||rp.startsWith('.aledevos/'))continue;for(const hit of hardcodedColors(abs,pol.guardian.full_file_scan_max_bytes)){if(exceptions.has('HARDCODED_COLOR'))warnings.push(finding('HARDCODED_COLOR','WARNING',`approved_exception:${hit.value}@${hit.line}`,rp));else{tokenGuard=false;blockers.push(finding('HARDCODED_COLOR','BLOCKER',`canonical_color_or_tokens_present:${hit.value}@${hit.line}`,rp))}}}}
  const p6=verifyPhase6Evidence(root,evidence);const phase6Required=String(evidence.schema_version||'1.0')==='1.1'&&!!evidence.visual_task;
  if(phase6Required&&!p6.present)blockers.push(finding('PHASE6_REVIEW','BLOCKER','phase6_review_required'));
  if(p6.present&&!p6.valid)for(const er of p6.errors)blockers.push(finding('PHASE6_REVIEW','BLOCKER',er));
  const p6dim=(k)=>p6.valid?(p6.dimensions?.[k]||'UNVERIFIED'):(evidence[k]?.status||'UNVERIFIED');
  const checks={design_context_valid:!st.errors.some(x=>x.startsWith('design_context')),component_registry_valid:!st.errors.some(x=>x.includes('component_')||x.includes('canonical_')),changed_files_valid:missing.length===0,reuse_decisions_valid:decisionValid,token_guard_pass:tokenGuard,responsive_status:p6dim('responsive'),accessibility_status:p6dim('accessibility'),states_status:p6dim('states'),phase6_review_valid:p6.valid,phase6_review_sha256:p6.review_sha256||null};
  if(evidence.visual_task){for(const k of ['responsive','accessibility','states'])if(checks[`${k}_status`]==='UNVERIFIED')warnings.push(finding(`EVIDENCE_${k.toUpperCase()}`,'WARNING',`${k}_evidence_unverified`))}
  const report={schema_version:'1.0',task_id:String(evidence.task_id||''),status:blockers.length?'GUARDIAN_BLOCKED':'GUARDIAN_PASS',blockers,warnings,checks,evidence_sha256:fileSha(evidencePath),design_context_sha256:fs.existsSync(st.paths.manifest)?fileSha(st.paths.manifest):'0'.repeat(64),component_registry_sha256:fs.existsSync(st.paths.registry)?fileSha(st.paths.registry):'0'.repeat(64),report_sha256:''};report.report_sha256=sha(report);return report;
}
function verifyGuardian(root,r){const st=loadState(root),errors=[];if(!validInternal(r,'report_sha256'))errors.push('guardian_report_integrity_mismatch');if(fs.existsSync(st.paths.manifest)&&r.design_context_sha256!==fileSha(st.paths.manifest))errors.push('design_context_drift_since_guardian');if(fs.existsSync(st.paths.registry)&&r.component_registry_sha256!==fileSha(st.paths.registry))errors.push('component_registry_drift_since_guardian');return {valid:errors.length===0,errors,status:r.status,blockers:(r.blockers||[]).length}}
function judge(root,evidencePath,guardianPath){
  const pol=policy().phase4.judge,e=readJson(evidencePath),g=readJson(guardianPath),vg=verifyGuardian(root,g);if(!vg.valid)fail('GUARDIAN_REPORT_INVALID',75,{status:'GUARDIAN_REPORT_INVALID',errors:vg.errors});
  const w=pol.weights,dims={};dims.design_system_compliance=g.status==='GUARDIAN_PASS'?w.design_system_compliance:0;dims.component_reuse=g.checks?.reuse_decisions_valid?w.component_reuse:0;
  const stat=(k)=>String(e.schema_version||'1.0')==='1.1'?(g.checks?.[`${k}_status`]||'UNVERIFIED'):(e[k]?.status||'UNVERIFIED');dims.responsive_readiness=['VERIFIED','NOT_APPLICABLE'].includes(stat('responsive'))?w.responsive_readiness:0;dims.accessibility_readiness=['VERIFIED','NOT_APPLICABLE'].includes(stat('accessibility'))?w.accessibility_readiness:0;dims.states_and_interaction=['VERIFIED','NOT_APPLICABLE'].includes(stat('states'))?w.states_and_interaction:0;
  const unverified=[];if(e.visual_task)for(const k of pol.required_evidence_for_visual_task)if(stat(k)==='UNVERIFIED')unverified.push(k);
  const blockers=(g.blockers||[]).map(x=>x.rule_id);const score=Object.values(dims).reduce((a,b)=>a+b,0);const verdict=score>=pol.threshold&&(!pol.blockers_must_be_zero||blockers.length===0)&&(!pol.critical_unverified_must_be_zero||unverified.length===0)?'PASS':'FAIL';
  const out={schema_version:'1.0',task_id:String(e.task_id||''),score,verdict,dimensions:dims,blockers,unverified,guardian_report_sha256:g.report_sha256,judge_sha256:''};out.judge_sha256=sha(out);return out;
}
function verifyJudge(j,g){const errors=[];if(!validInternal(j,'judge_sha256'))errors.push('judge_report_integrity_mismatch');if(j.guardian_report_sha256!==g.report_sha256)errors.push('guardian_report_drift_since_judge');return {valid:errors.length===0,errors,score:j.score,verdict:j.verdict}}
function usage(){console.error('design-review.mjs guardian review|verify OR judge score|verify')}
if(group==='guardian'&&cmd==='review'){
  const root=rootOf(take('--project-root')),ep=take('--evidence');if(!ep||!fs.existsSync(ep))fail('UI_CHANGE_EVIDENCE_REQUIRED',71);const o=review(root,path.resolve(ep)),out=take('--out');if(out)writeJson(path.resolve(out),o);process.stdout.write(JSON.stringify(o,null,2)+'\n');if(o.status!=='GUARDIAN_PASS')process.exit(72);
}else if(group==='guardian'&&cmd==='verify'){
  const root=rootOf(take('--project-root')),rp=take('--report');if(!rp||!fs.existsSync(rp))fail('GUARDIAN_REPORT_REQUIRED',73);const o=verifyGuardian(root,readJson(path.resolve(rp)));process.stdout.write(JSON.stringify(o,null,2)+'\n');if(!o.valid)process.exit(74);
}else if(group==='judge'&&cmd==='score'){
  const root=rootOf(take('--project-root')),ep=take('--evidence'),gp=take('--guardian');if(!ep||!gp||!fs.existsSync(ep)||!fs.existsSync(gp))fail('JUDGE_EVIDENCE_REQUIRED',76);const o=judge(root,path.resolve(ep),path.resolve(gp)),out=take('--out');if(out)writeJson(path.resolve(out),o);process.stdout.write(JSON.stringify(o,null,2)+'\n');if(o.verdict!=='PASS')process.exit(77);
}else if(group==='judge'&&cmd==='verify'){
  const jp=take('--report'),gp=take('--guardian');if(!jp||!gp||!fs.existsSync(jp)||!fs.existsSync(gp))fail('JUDGE_REPORT_REQUIRED',78);const o=verifyJudge(readJson(path.resolve(jp)),readJson(path.resolve(gp)));process.stdout.write(JSON.stringify(o,null,2)+'\n');if(!o.valid)process.exit(79);
}else{usage();process.exit(2)}
