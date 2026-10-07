#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const releaseRoot = path.resolve(here, '..');
const packageRoot = path.resolve(releaseRoot, '..');
const args = process.argv.slice(2);
const [group, cmd] = args;
const HASH=/^[a-f0-9]{64}$/;

function take(flag,fallback=null){const i=args.indexOf(flag);return i>=0&&i+1<args.length?args[i+1]:fallback}
function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''))}
function writeJson(p,v){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n','utf8')}
function norm(p){return String(p||'').replaceAll('\\','/').replace(/^\.\//,'')}
function inside(root,p){const rr=path.resolve(root)+path.sep,aa=path.resolve(p);return aa===path.resolve(root)||aa.startsWith(rr)}
function rel(root,p){return norm(path.relative(root,p))}
function fileSha(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())if(k!=='freeze_certificate_sha256')o[k]=stable(v[k]);return o}return v}
function sha(v){return crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex')}
function sealValid(v){return !!v&&HASH.test(String(v.freeze_certificate_sha256||''))&&v.freeze_certificate_sha256===sha(v)}
function packageVersion(root){for(const p of [path.join(root,'VERSION.txt'),path.join(root,'.aledevos','release','VERSION.txt'),path.join(packageRoot,'VERSION.txt')])if(fs.existsSync(p))return fs.readFileSync(p,'utf8').trim();return null}
function releaseEngine(root){const installed=path.join(root,'.aledevos','release','runtime','v1-release.mjs');return fs.existsSync(installed)?installed:path.join(packageRoot,'release','engine','v1-release.mjs')}
function finalCertifier(root){const installed=path.join(root,'.aledevos','release','templates','final-master-gate-certifier.mjs');return fs.existsSync(installed)?installed:path.join(packageRoot,'release','templates','final-master-gate-certifier.mjs')}
function runNode(file,argv,cwd){const r=spawnSync(process.execPath,[file,...argv],{cwd,encoding:'utf8',windowsHide:true,shell:false});let q=null;try{q=JSON.parse(r.stdout||'{}')}catch{}return{status:r.status,stdout:r.stdout||'',stderr:r.stderr||'',obj:q}}

export function assessFreezePreconditions(report, expectedCheckIds = null){
  const errors=[];
  if(!report||typeof report!=='object')return{ok:false,errors:['report_invalid']};
  if(report.phase!=='ALEDEVOS_V1_MASTER_VALIDATION_GATE')errors.push('report_phase_invalid');
  if(report.status!=='V1_RELEASE_READY')errors.push(`report_not_ready:${report.status||'missing'}`);
  const s=report.summary||{};
  if(Number(s.total)!==33)errors.push('summary_total_not_33');
  if(Number(s.passed)!==33)errors.push('summary_passed_not_33');
  if(Number(s.blocked)!==0)errors.push('summary_blocked_nonzero');
  if(Number(s.failed)!==0)errors.push('summary_failed_nonzero');
  const rows=Array.isArray(report.required_checks)?report.required_checks:[];
  if(rows.length!==33)errors.push('required_checks_count_not_33');
  const ids=rows.map(x=>x?.id).filter(Boolean),unique=new Set(ids);
  if(unique.size!==ids.length)errors.push('duplicate_check_id');
  for(const r of rows){if(r?.status!=='PASS')errors.push(`check_not_pass:${r?.id||'unknown'}:${r?.status||'missing'}`);if(r?.id!=='package_certifications_current'&&!HASH.test(String(r?.evidence_sha256||'')))errors.push(`evidence_sha_missing:${r?.id||'unknown'}`)}
  if(expectedCheckIds){const exp=[...expectedCheckIds].sort(),got=[...ids].sort();if(JSON.stringify(exp)!==JSON.stringify(got))errors.push('check_set_drift')}
  if(report.legacy_gate_authorizes_v1_freeze!==false)errors.push('legacy_gate_freeze_authority_invalid');
  return{ok:errors.length===0,errors};
}

function policyCheckIds(root){const p=readJson(path.join(root,'release','policies','v1-release-policy.json'));return (p.master_validation?.checks||[]).map(x=>x.id)}
function verifyMasterReport(root,reportPath){const engine=releaseEngine(root);return runNode(engine,['master-gate','verify','--project-root',root,'--report',reportPath],root)}
function evaluateMaster(root,outPath){const engine=releaseEngine(root);return runNode(engine,['master-gate','evaluate','--project-root',root,'--out',outPath],root)}
function verifyFinalPackage(root){const certifier=finalCertifier(root);const cert=path.join(root,'release','certifications','final-master-gate.json');return runNode(certifier,['certify','verify','--root',root,'--certificate',cert],root)}
function evidenceRoot(report){const rows=(report.required_checks||[]).map(r=>({id:r.id,status:r.status,evidence_sha256:r.evidence_sha256||null})).sort((a,b)=>a.id.localeCompare(b.id));return crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex')}

function inventory(root){
  const tmp=path.join(root,'.aledevos','state','release','master','reports','.final-inventory.json');
  const ev=evaluateMaster(root,tmp);try{fs.rmSync(tmp,{force:true})}catch{}
  const report=ev.obj||{};const pre=assessFreezePreconditions(report,policyCheckIds(root));
  return{schema_version:'1.0',phase:'ALEDEVOS_V1_FINAL_MASTER_GATE',status:pre.ok?'FINAL_MASTER_GATE_READY_TO_FREEZE':'FINAL_MASTER_GATE_NOT_READY',package_version:packageVersion(root),master_status:report.status||null,summary:report.summary||null,preconditions:pre,claims:{inventory_only:true,freeze_certificate_issued:false}};
}
function issue(root,reportPath,outPath){
  const rp=path.resolve(reportPath);if(!inside(root,rp)||!fs.existsSync(rp))throw new Error('master_report_missing_or_external');
  const mv=verifyMasterReport(root,rp);if(mv.status!==0||mv.obj?.valid!==true)throw new Error(`master_report_invalid:${(mv.obj?.errors||[]).join(',')}`);
  const report=mv.obj.report;
  const pre=assessFreezePreconditions(report,policyCheckIds(root));if(!pre.ok)throw new Error(`freeze_preconditions_failed:${pre.errors.join(',')}`);
  const pc=verifyFinalPackage(root);if(pc.status!==0||pc.obj?.valid!==true)throw new Error('final_package_certificate_invalid');
  const finalCert=readJson(path.join(root,'release','certifications','final-master-gate.json'));
  const p8=readJson(path.join(root,'release','certifications','master-validation-p8.json'));
  const cert={schema_version:'1.0',phase:'ALEDEVOS_V1_FINAL_MASTER_GATE',status:'ALEDEVOS_V1_FROZEN',release_state:'V1_RELEASE_READY',package_version:packageVersion(root),master_report_path:rel(root,rp),master_report_sha256:report.master_report_sha256,master_policy_sha256:report.master_policy_sha256,package_baseline_sha256:report.package_baseline_sha256,summary:report.summary,required_check_count:33,evidence_root_sha256:evidenceRoot(report),final_package_certificate_sha256:finalCert.final_master_gate_certificate_sha256,p8_package_certificate_sha256:p8.master_p8_certificate_sha256,claims:{all_33_master_checks_pass:true,blocked_checks:0,failed_checks:0,legacy_gate_authority:false,final_freeze_authority:'FINAL_MASTER_GATE',target_evidence_reverified:true,package_chain_reverified:true,perfect_security_claimed:false},frozen_at:new Date().toISOString(),freeze_certificate_sha256:''};
  cert.freeze_certificate_sha256=sha(cert);writeJson(outPath,cert);return cert;
}
function verifyFreeze(root,certPath){
  const errors=[];let cert;try{cert=readJson(certPath)}catch{return{status:'ALEDEVOS_V1_FREEZE_CERTIFICATE_INVALID',valid:false,errors:['certificate_unreadable']}};
  if(!sealValid(cert))errors.push('freeze_certificate_integrity_mismatch');
  if(cert.status!=='ALEDEVOS_V1_FROZEN'||cert.release_state!=='V1_RELEASE_READY')errors.push('freeze_state_invalid');
  if(cert.package_version!==packageVersion(root))errors.push('freeze_package_version_drift');
  const rp=path.resolve(root,cert.master_report_path||'');if(!inside(root,rp)||!fs.existsSync(rp))errors.push('master_report_missing');
  let report=null;
  if(!errors.includes('master_report_missing')){const mv=verifyMasterReport(root,rp);if(mv.status!==0||mv.obj?.valid!==true)errors.push('master_report_invalid');else report=mv.obj.report}
  if(report){const pre=assessFreezePreconditions(report,policyCheckIds(root));errors.push(...pre.errors.map(x=>`precondition:${x}`));if(report.master_report_sha256!==cert.master_report_sha256)errors.push('master_report_sha_drift');if(report.master_policy_sha256!==cert.master_policy_sha256)errors.push('master_policy_sha_drift');if(report.package_baseline_sha256!==cert.package_baseline_sha256)errors.push('package_baseline_sha_drift');if(evidenceRoot(report)!==cert.evidence_root_sha256)errors.push('evidence_root_drift')}
  const pc=verifyFinalPackage(root);if(pc.status!==0||pc.obj?.valid!==true)errors.push('final_package_certificate_invalid');else if(pc.obj.saved_sha256!==cert.final_package_certificate_sha256)errors.push('final_package_certificate_drift');
  const p8p=path.join(root,'release','certifications','master-validation-p8.json');if(!fs.existsSync(p8p))errors.push('p8_certificate_missing');else{const p8=readJson(p8p);if(p8.master_p8_certificate_sha256!==cert.p8_package_certificate_sha256)errors.push('p8_certificate_drift')}
  return{status:errors.length?'ALEDEVOS_V1_FREEZE_CERTIFICATE_INVALID':'ALEDEVOS_V1_FREEZE_CERTIFICATE_VALID',valid:errors.length===0,errors,certificate:cert};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root=path.resolve(take('--root',packageRoot));
  try{
    if(group==='inventory'){console.log(JSON.stringify(inventory(root),null,2));process.exit(0)}
    if(group==='freeze'&&cmd==='issue'){const report=take('--report',path.join(root,'.aledevos','state','release','master','reports','latest.json')),outp=path.resolve(take('--out',path.join(root,'.aledevos','state','release','final','v1-freeze-certificate.json')));const q=issue(root,report,outp);console.log(JSON.stringify({status:'ALEDEVOS_V1_FREEZE_CERTIFICATE_ISSUED',path:rel(root,outp),certificate:q},null,2));process.exit(0)}
    if(group==='freeze'&&cmd==='verify'){const p=take('--certificate');if(!p)throw new Error('freeze_certificate_required');const q=verifyFreeze(root,path.resolve(p));console.log(JSON.stringify(q,null,2));process.exit(q.valid?0:4)}
    console.log(JSON.stringify({status:'FINAL_MASTER_GATE_COMMAND_UNKNOWN',usage:['inventory --root <root>','freeze issue --root <root> --report <report> --out <certificate>','freeze verify --root <root> --certificate <certificate>']},null,2));process.exit(2)
  }catch(e){console.log(JSON.stringify({status:'FINAL_MASTER_GATE_BLOCKED',error:e?.message||String(e)},null,2));process.exit(4)}
}
