#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {decodePng,encodePng} from './png-codec.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const distRoot=path.resolve(here,'..');
const browserRunner=path.join(here,'browser-runner.mjs');
const args=process.argv.slice(2); const [group,cmd]=args;
const HASH=/^[a-f0-9]{64}$/;
function take(flag,fallback=null){const i=args.indexOf(flag);return i>=0&&i+1<args.length?args[i+1]:fallback}
function out(v){process.stdout.write(JSON.stringify(v,null,2)+'\n')}
function die(status,code=1,obj=null){out(obj||{status});process.exit(code)}
function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''))}
function writeJson(p,v){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n','utf8')}
function stable(v,exclude=new Set()){
  if(Array.isArray(v))return v.map(x=>stable(x,exclude));
  if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())if(!exclude.has(k))o[k]=stable(v[k],exclude);return o}
  return v;
}
function shaObject(v,exclude){return crypto.createHash('sha256').update(JSON.stringify(stable(v,new Set(exclude)))).digest('hex')}
function fileSha(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}
function norm(p){return String(p||'').replaceAll('\\','/').replace(/^\.\//,'')}
function rootOf(v){const r=path.resolve(v||process.cwd());if(!fs.existsSync(r)||!fs.statSync(r).isDirectory())die('PROJECT_ROOT_INVALID',90);return r}
function inside(root,p){const rr=path.resolve(root),aa=path.resolve(p);return aa===rr||aa.startsWith(rr+path.sep)}
function rel(root,p){return norm(path.relative(root,path.resolve(p)))}
function safeRel(root,v){if(!v||path.isAbsolute(v)||norm(v).split('/').includes('..'))return null;const a=path.resolve(root,v);return inside(root,a)?a:null}
function policy(){return readJson(path.join(distRoot,'policies','visualqa-policy.json')).phase3}
function idOk(v,re){return typeof v==='string'&&new RegExp(re).test(v)}
function p2Verify(root,receiptPath){
  const r=spawnSync(process.execPath,[browserRunner,'run','verify','--project-root',root,'--receipt',receiptPath],{cwd:root,encoding:'utf8'});
  let o={};try{o=JSON.parse(r.stdout||'{}')}catch{}
  return {ok:r.status===0&&o.valid===true,obj:o,status:r.status};
}
function baselineManifestPath(root,input){
  const p=policy();
  if(idOk(input,p.baseline_id_pattern))return path.join(root,p.baselines_root,input,'manifest.json');
  const abs=path.resolve(input); if(!inside(path.join(root,p.baselines_root),abs))return null; return abs;
}
function validateTolerance(id,p){return typeof id==='string'&&Object.prototype.hasOwnProperty.call(p.tolerance_profiles,id)}
function contractKey(c){return JSON.stringify({case_id:c.case_id,route:c.route,state:c.state,viewport:{width:c.viewport?.width??null,height:c.viewport?.height??null}})}

function verifyBaseline(root,input){
  const mp=baselineManifestPath(root,input); const errors=[];
  if(!mp||!fs.existsSync(mp)||!fs.statSync(mp).isFile())return {status:'VISUAL_BASELINE_INVALID',valid:false,errors:['baseline_manifest_missing_or_external']};
  let m;try{m=readJson(mp)}catch{return {status:'VISUAL_BASELINE_INVALID',valid:false,errors:['baseline_manifest_unreadable']}}
  const p=policy();
  if(m.schema_version!=='1.0'||m.phase!=='VISUAL_QA_P3_BASELINE')errors.push('baseline_schema_invalid');
  if(!idOk(m.baseline_id,p.baseline_id_pattern))errors.push('baseline_id_invalid');
  if(!idOk(m.approval_ref,p.approval_ref_pattern))errors.push('approval_ref_invalid');
  if(!validateTolerance(m.tolerance_profile,p))errors.push('tolerance_profile_invalid');
  if(!HASH.test(m.manifest_sha256||'')||m.manifest_sha256!==shaObject(m,['manifest_sha256']))errors.push('baseline_integrity_mismatch');
  const dir=path.dirname(mp); if(path.basename(dir)!==m.baseline_id)errors.push('baseline_directory_mismatch');
  const cases=Array.isArray(m.cases)?m.cases:[]; if(!cases.length)errors.push('baseline_cases_missing');
  const seen=new Set();
  for(const c of cases){
    if(seen.has(c.case_id))errors.push(`baseline_duplicate_case:${c.case_id}`);seen.add(c.case_id);
    const a=safeRel(root,c.baseline_path);
    if(!a||!inside(dir,a)||!fs.existsSync(a))errors.push(`baseline_file_missing:${c.case_id}`);
    else{
      if(fileSha(a)!==c.sha256)errors.push(`baseline_file_drift:${c.case_id}`);
      try{const im=decodePng(a);if(im.width!==c.image_width||im.height!==c.image_height)errors.push(`baseline_dimensions_drift:${c.case_id}`)}catch(e){errors.push(`baseline_png_invalid:${c.case_id}:${e.code||'decode'}`)}
    }
  }
  if(m.supersedes){
    const sp=baselineManifestPath(root,m.supersedes.baseline_id||'');
    if(!sp||!fs.existsSync(sp))errors.push('superseded_baseline_missing');
    else if(fileSha(sp)!==m.supersedes.manifest_file_sha256)errors.push('superseded_baseline_drift');
  }
  return {status:errors.length?'VISUAL_BASELINE_INVALID':'VISUAL_BASELINE_VALID',valid:errors.length===0,errors,manifest:m,manifest_path:rel(root,mp),manifest_file_sha256:fileSha(mp)};
}

function approveBaseline(root,receiptPath,baselineId,approvalRef,toleranceId,supersedesId){
  const p=policy();
  if(!idOk(baselineId,p.baseline_id_pattern))die('BASELINE_ID_INVALID',101);
  if(!idOk(approvalRef,p.approval_ref_pattern))die('BASELINE_APPROVAL_REQUIRED',102);
  const tid=toleranceId||p.default_tolerance_profile; if(!validateTolerance(tid,p))die('TOLERANCE_PROFILE_INVALID',103);
  const recAbs=path.resolve(receiptPath); if(!inside(root,recAbs)||!fs.existsSync(recAbs))die('PHASE2_RECEIPT_PATH_INVALID',104);
  const vr=p2Verify(root,recAbs); if(!vr.ok)die('PHASE2_RECEIPT_INVALID',105,{status:'PHASE2_RECEIPT_INVALID',errors:vr.obj?.errors||[]});
  const receipt=vr.obj.receipt;
  const finalDir=path.join(root,p.baselines_root,baselineId); if(fs.existsSync(finalDir))die('BASELINE_IMMUTABLE_EXISTS',106);
  let supersedes=null;
  if(supersedesId){
    const sv=verifyBaseline(root,supersedesId); if(!sv.valid)die('SUPERSEDED_BASELINE_INVALID',107,{status:'SUPERSEDED_BASELINE_INVALID',errors:sv.errors});
    supersedes={baseline_id:sv.manifest.baseline_id,manifest_path:sv.manifest_path,manifest_file_sha256:sv.manifest_file_sha256};
    const a=[...(sv.manifest.cases||[])].map(x=>x.case_id).sort(),b=[...(receipt.captures||[])].map(x=>x.case_id).sort();
    if(JSON.stringify(a)!==JSON.stringify(b))die('SUPERSEDE_CASE_SET_MISMATCH',108);
  }
  const rootBase=path.join(root,p.baselines_root);fs.mkdirSync(rootBase,{recursive:true});
  const staging=path.join(rootBase,`.staging-${baselineId}-${process.pid}-${Date.now()}`);fs.mkdirSync(path.join(staging,'cases'),{recursive:true});
  try{
    const cases=[];
    for(const c of receipt.captures||[]){
      const src=safeRel(root,c.screenshot_path);if(!src||!fs.existsSync(src))throw Object.assign(new Error('CAPTURE_MISSING'),{code:`CAPTURE_MISSING:${c.case_id}`});
      const image=decodePng(src);const dst=path.join(staging,'cases',`${c.case_id}.png`);fs.copyFileSync(src,dst);
      cases.push({case_id:c.case_id,route:c.route,state:c.state,viewport:{width:c.viewport?.width??null,height:c.viewport?.height??null},image_width:image.width,image_height:image.height,baseline_path:norm(path.join(p.baselines_root,baselineId,'cases',`${c.case_id}.png`)),sha256:fileSha(dst),bytes:fs.statSync(dst).size});
    }
    cases.sort((a,b)=>a.case_id.localeCompare(b.case_id));
    const m={schema_version:'1.0',phase:'VISUAL_QA_P3_BASELINE',baseline_id:baselineId,status:'APPROVED',approval_ref:approvalRef,tolerance_profile:tid,created_at:new Date().toISOString(),origin:{phase2_receipt_path:rel(root,recAbs),phase2_receipt_file_sha256:fileSha(recAbs),task_id:receipt.task_id,plan_sha256:receipt.plan_sha256},supersedes,cases,claims:{human_or_external_approval_recorded:true,visual_regression_verified:false,visual_quality_verified:false},manifest_sha256:''};
    m.manifest_sha256=shaObject(m,['manifest_sha256']);writeJson(path.join(staging,'manifest.json'),m);fs.renameSync(staging,finalDir);
    const v=verifyBaseline(root,baselineId);if(!v.valid)throw Object.assign(new Error('BASELINE_POST_VERIFY_FAILED'),{code:'BASELINE_POST_VERIFY_FAILED'});
    return {status:'VISUAL_BASELINE_APPROVED',manifest_path:v.manifest_path,manifest:v.manifest};
  }catch(e){fs.rmSync(staging,{recursive:true,force:true});if(fs.existsSync(finalDir))fs.rmSync(finalDir,{recursive:true,force:true});die(e.code||'BASELINE_APPROVAL_FAILED',109)}
}

function diffImages(base,current,profile){
  if(base.width!==current.width||base.height!==current.height)return {dimension_mismatch:true,total_pixels:null,different_pixels:null,diff_ratio:null,max_channel_delta:null,mean_abs_delta:null,pass:false,diff_rgba:null};
  const n=base.width*base.height;let changed=0,maxd=0,sum=0,minX=base.width,minY=base.height,maxX=-1,maxY=-1;const diff=Buffer.alloc(n*4);
  for(let i=0;i<n;i++){
    let pxMax=0;
    for(let ch=0;ch<4;ch++){const d=Math.abs(base.rgba[i*4+ch]-current.rgba[i*4+ch]);sum+=d;if(d>pxMax)pxMax=d;if(d>maxd)maxd=d;}
    if(pxMax>profile.channel_threshold){changed++;const x=i%base.width,y=Math.floor(i/base.width);if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;diff[i*4]=255;diff[i*4+1]=0;diff[i*4+2]=0;diff[i*4+3]=255;}
    else {diff[i*4]=0;diff[i*4+1]=0;diff[i*4+2]=0;diff[i*4+3]=0;}
  }
  const ratio=changed/n,mean=sum/(n*4);
  return {dimension_mismatch:false,total_pixels:n,different_pixels:changed,diff_ratio:ratio,max_channel_delta:maxd,mean_abs_delta:mean,changed_bounds:changed?{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1}:null,pass:ratio<=profile.max_diff_ratio&&mean<=profile.max_mean_abs_delta,diff_rgba:diff};
}
function contractMismatch(b,c){return b.route!==c.route||b.state!==c.state||Number(b.viewport?.width)!==Number(c.viewport?.width)||Number(b.viewport?.height??0)!==Number(c.viewport?.height??0)}
function compareCore(root,receipt,baseline,writeDiffs,runKey){
  const p=policy(),profile=p.tolerance_profiles[baseline.tolerance_profile];const bc=new Map(baseline.cases.map(x=>[x.case_id,x])),cc=new Map((receipt.captures||[]).map(x=>[x.case_id,x]));
  const bIds=[...bc.keys()].sort(),cIds=[...cc.keys()].sort(),blockers=[];
  if(p.require_exact_case_set&&JSON.stringify(bIds)!==JSON.stringify(cIds))blockers.push('case_set_mismatch');
  for(const id of bIds){const c=cc.get(id);if(c&&p.require_contract_match&&contractMismatch(bc.get(id),c))blockers.push(`case_contract_drift:${id}`)}
  if(blockers.length)return {blockers,cases:[],summary:{total_cases:bIds.length,passed:0,failed:0},all_pass:false};
  const results=[];let passCount=0,failCount=0;
  for(const id of bIds){
    const b=bc.get(id),c=cc.get(id),bp=safeRel(root,b.baseline_path),cp=safeRel(root,c.screenshot_path);if(!bp||!cp)throw Object.assign(new Error('CASE_PATH_INVALID'),{code:`CASE_PATH_INVALID:${id}`});
    const bi=decodePng(bp),ci=decodePng(cp),m=diffImages(bi,ci,profile);let diff_path=null,diff_sha256=null;
    if(writeDiffs&&p.write_diff_for_changed_cases&&!m.dimension_mismatch&&m.different_pixels>0){const dp=path.join(root,p.diffs_root,runKey,`${id}.diff.png`);fs.mkdirSync(path.dirname(dp),{recursive:true});fs.writeFileSync(dp,encodePng({width:bi.width,height:bi.height,rgba:m.diff_rgba}));diff_path=rel(root,dp);diff_sha256=fileSha(dp)}
    const metrics={dimension_mismatch:m.dimension_mismatch,baseline_dimensions:{width:bi.width,height:bi.height},current_dimensions:{width:ci.width,height:ci.height},total_pixels:m.total_pixels,different_pixels:m.different_pixels,diff_ratio:m.diff_ratio,max_channel_delta:m.max_channel_delta,mean_abs_delta:m.mean_abs_delta,changed_bounds:m.changed_bounds??null};
    const status=m.pass?'PASS':'FAIL'; if(m.pass)passCount++;else failCount++;
    results.push({case_id:id,status,route:b.route,state:b.state,viewport:b.viewport,baseline_path:b.baseline_path,baseline_sha256:b.sha256,current_path:c.screenshot_path,current_sha256:c.sha256,tolerance_profile:baseline.tolerance_profile,metrics,diff_path,diff_sha256});
  }
  return {blockers:[],cases:results,summary:{total_cases:results.length,passed:passCount,failed:failCount},all_pass:failCount===0};
}

function runCompare(root,receiptPath,baselineInput,outPath){
  const p=policy(),recAbs=path.resolve(receiptPath);if(!inside(root,recAbs)||!fs.existsSync(recAbs))die('PHASE2_RECEIPT_PATH_INVALID',120);
  const rv=p2Verify(root,recAbs);if(!rv.ok)die('PHASE2_RECEIPT_INVALID',121,{status:'PHASE2_RECEIPT_INVALID',errors:rv.obj?.errors||[]});
  const bv=verifyBaseline(root,baselineInput);if(!bv.valid)die('VISUAL_BASELINE_INVALID',122,{status:'VISUAL_BASELINE_INVALID',errors:bv.errors});
  let core;try{core=compareCore(root,rv.obj.receipt,bv.manifest,true,`${rv.obj.receipt.task_id}--${bv.manifest.baseline_id}`)}catch(e){die(e.code||'VISUAL_COMPARE_FAILED',123)}
  const blocked=core.blockers.length>0,status=blocked?'VISUAL_REGRESSION_BLOCKED':core.all_pass?'VISUAL_REGRESSION_PASS':'VISUAL_REGRESSION_FAIL';
  const report={schema_version:'1.0',phase:'VISUAL_QA_P3',task_id:rv.obj.receipt.task_id,status,claims:{visual_regression_verified:!blocked,visual_quality_verified:false,rendered_layout_verified:false,rendered_accessibility_verified:false},phase2_receipt_path:rel(root,recAbs),phase2_receipt_file_sha256:fileSha(recAbs),baseline_manifest_path:bv.manifest_path,baseline_manifest_file_sha256:bv.manifest_file_sha256,tolerance_profile:bv.manifest.tolerance_profile,tolerance:p.tolerance_profiles[bv.manifest.tolerance_profile],blockers:core.blockers,cases:core.cases,summary:core.summary,report_sha256:''};
  report.report_sha256=shaObject(report,['report_sha256']);const outp=outPath?path.resolve(outPath):path.join(root,p.reports_root,`${report.task_id}--${bv.manifest.baseline_id}.json`);if(!inside(root,outp))die('REPORT_OUTPUT_PATH_INVALID',124);writeJson(outp,report);
  return {status,path:rel(root,outp),report,exit:status==='VISUAL_REGRESSION_PASS'?0:status==='VISUAL_REGRESSION_FAIL'?3:4};
}

function verifyReport(root,reportPath){
  const errors=[];const abs=path.resolve(reportPath);if(!inside(root,abs)||!fs.existsSync(abs))return {status:'VISUAL_REGRESSION_REPORT_INVALID',valid:false,errors:['report_missing_or_external']};let r;try{r=readJson(abs)}catch{return {status:'VISUAL_REGRESSION_REPORT_INVALID',valid:false,errors:['report_unreadable']}}
  if(!HASH.test(r.report_sha256||'')||r.report_sha256!==shaObject(r,['report_sha256']))errors.push('report_integrity_mismatch');
  const rec=safeRel(root,r.phase2_receipt_path);let receipt=null;if(!rec||!fs.existsSync(rec))errors.push('phase2_receipt_missing');else{if(fileSha(rec)!==r.phase2_receipt_file_sha256)errors.push('phase2_receipt_drift');const rv=p2Verify(root,rec);if(!rv.ok)errors.push('phase2_receipt_invalid');else receipt=rv.obj.receipt}
  const bv=verifyBaseline(root,path.resolve(root,r.baseline_manifest_path||''));if(!bv.valid)errors.push('baseline_invalid');else if(bv.manifest_file_sha256!==r.baseline_manifest_file_sha256)errors.push('baseline_manifest_drift');
  if(receipt&&bv.valid){
    const pol=policy(),expectedTolerance=pol.tolerance_profiles[bv.manifest.tolerance_profile];
    if(r.tolerance_profile!==bv.manifest.tolerance_profile)errors.push('tolerance_profile_mismatch');
    if(JSON.stringify(r.tolerance)!==JSON.stringify(expectedTolerance))errors.push('tolerance_policy_mismatch');
    let c;try{c=compareCore(root,receipt,bv.manifest,false,`${receipt.task_id}--${bv.manifest.baseline_id}`)}catch(e){errors.push(e.code||'comparison_recompute_failed');c=null}
    if(c){
      const expectedStatus=c.blockers.length?'VISUAL_REGRESSION_BLOCKED':c.all_pass?'VISUAL_REGRESSION_PASS':'VISUAL_REGRESSION_FAIL';
      if(expectedStatus!==r.status)errors.push('report_status_mismatch');
      if(JSON.stringify(c.blockers)!==JSON.stringify(r.blockers||[]))errors.push('report_blockers_mismatch');
      const actual=new Map((r.cases||[]).map(x=>[x.case_id,x]));
      if(actual.size!==c.cases.length)errors.push('report_case_count_mismatch');
      const baseMap=new Map((bv.manifest.cases||[]).map(x=>[x.case_id,x]));
      const currentMap=new Map((receipt.captures||[]).map(x=>[x.case_id,x]));
      for(const e of c.cases){
        const a=actual.get(e.case_id);
        if(!a||a.status!==e.status||JSON.stringify(a.metrics)!==JSON.stringify(e.metrics))errors.push(`report_case_metrics_mismatch:${e.case_id}`);
        if(a?.diff_path){
          const dp=safeRel(root,a.diff_path);
          if(!dp||!fs.existsSync(dp)||fileSha(dp)!==a.diff_sha256)errors.push(`diff_artifact_drift:${e.case_id}`);
          else{
            try{
              const bi=decodePng(safeRel(root,baseMap.get(e.case_id).baseline_path));
              const ci=decodePng(safeRel(root,currentMap.get(e.case_id).screenshot_path));
              const dm=diffImages(bi,ci,expectedTolerance);
              if(dm.dimension_mismatch||!dm.diff_rgba||dm.different_pixels===0)errors.push(`diff_artifact_unexpected:${e.case_id}`);
              else{
                const expectedDiffSha=crypto.createHash('sha256').update(encodePng({width:bi.width,height:bi.height,rgba:dm.diff_rgba})).digest('hex');
                if(expectedDiffSha!==a.diff_sha256)errors.push(`diff_artifact_content_mismatch:${e.case_id}`);
              }
            }catch{errors.push(`diff_artifact_recompute_failed:${e.case_id}`)}
          }
        } else if(!e.metrics.dimension_mismatch&&e.metrics.different_pixels>0&&pol.write_diff_for_changed_cases){
          errors.push(`diff_artifact_missing:${e.case_id}`);
        }
      }
      if(r.claims?.visual_regression_verified!==(!c.blockers.length))errors.push('regression_claim_mismatch');
    }
  }
  if(r.claims?.visual_quality_verified!==false)errors.push('visual_quality_claim_forbidden');if(r.claims?.rendered_layout_verified!==false)errors.push('rendered_layout_claim_forbidden');if(r.claims?.rendered_accessibility_verified!==false)errors.push('rendered_accessibility_claim_forbidden');
  return {status:errors.length?'VISUAL_REGRESSION_REPORT_INVALID':'VISUAL_REGRESSION_REPORT_VALID',valid:errors.length===0,errors,report:r,path:rel(root,abs)};
}

const root=rootOf(take('--project-root',process.cwd()));
const forbiddenToleranceFlags=['--channel-threshold','--max-diff-ratio','--max-mean-abs-delta'];
if(forbiddenToleranceFlags.some(f=>args.includes(f))) die('ARBITRARY_TOLERANCE_FORBIDDEN',2);
try{
  if(group==='baseline'&&cmd==='approve'){
    const receipt=take('--receipt'),id=take('--baseline-id'),approval=take('--approval-ref');if(!receipt||!id||!approval)die('BASELINE_APPROVE_ARGUMENTS_REQUIRED',2);
    const r=approveBaseline(root,receipt,id,approval,take('--tolerance-profile'),take('--supersedes'));out(r);process.exit(0);
  }
  if(group==='baseline'&&cmd==='verify'){
    const b=take('--baseline');if(!b)die('BASELINE_REQUIRED',2);const r=verifyBaseline(root,b);out(r);process.exit(r.valid?0:3);
  }
  if(group==='compare'&&cmd==='run'){
    const receipt=take('--receipt'),baseline=take('--baseline');if(!receipt||!baseline)die('COMPARE_ARGUMENTS_REQUIRED',2);const r=runCompare(root,receipt,baseline,take('--out'));out({status:r.status,path:r.path,report:r.report});process.exit(r.exit);
  }
  if(group==='compare'&&cmd==='verify'){
    const report=take('--report');if(!report)die('REPORT_REQUIRED',2);const r=verifyReport(root,report);out(r);process.exit(r.valid?0:3);
  }
  die('VISUAL_REGRESSION_COMMAND_UNKNOWN',2,{usage:['baseline approve --receipt <p2-receipt> --baseline-id <id> --approval-ref <ref> [--tolerance-profile <id>] [--supersedes <baseline-id>]','baseline verify --baseline <id|manifest>','compare run --receipt <p2-receipt> --baseline <id|manifest> [--out <json>]','compare verify --report <json>']});
}catch(e){die(e?.code||'VISUAL_REGRESSION_FAILED',199)}
