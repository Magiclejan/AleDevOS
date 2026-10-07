#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=fs.readFileSync(path.join(root,'VERSION.txt'),'utf8').trim();
if(version!=='1.52.0')throw new Error('RELEASE_CLOSURE_VERSION_MISMATCH:'+version);

const prep=path.join(root,'scripts','78-release-closure-prepare.mjs');
const stateDir=path.join(root,'.aledevos','state','release',version);
const reportPath=path.join(stateDir,'package-recertification.json');

function run(exe,args,{allow=false,timeout=300000}={}){
  const r=spawnSync(exe,args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024,timeout});
  if(!allow&&r.status!==0){
    process.stdout.write(String(r.stdout||''));
    process.stderr.write(String(r.stderr||''));
    throw new Error('RELEASE_CLOSURE_PHASE2_COMMAND_FAILED:'+exe+' '+args.join(' '));
  }
  return r;
}
function node(rel,args=[],opts={}){
  return run(process.execPath,[rel,...args],opts);
}
function nodeStreaming(rel,args=[],{timeout=300000}={}){
  const r=spawnSync(process.execPath,[rel,...args],{
    cwd:root,
    stdio:'inherit',
    windowsHide:true,
    timeout
  });
  if(r.status!==0){
    throw new Error('RELEASE_CLOSURE_STREAMED_COMMAND_FAILED:'+rel+' '+args.join(' '));
  }
  return r;
}
function parseJsonOutput(r,label){
  const text=String(r.stdout||'').trim();
  const start=text.lastIndexOf('\n{')>=0?text.lastIndexOf('\n{')+1:text.indexOf('{');
  if(start<0)throw new Error('RELEASE_CLOSURE_JSON_OUTPUT_MISSING:'+label);
  try{return JSON.parse(text.slice(start));}
  catch(e){throw new Error('RELEASE_CLOSURE_JSON_OUTPUT_INVALID:'+label+':'+e.message);}
}
function assertCleanStart(){
  const r=run('git',['status','--porcelain=v1','--untracked-files=all'],{allow:true,timeout:30000});
  if(r.status!==0)throw new Error('RELEASE_GIT_STATUS_FAILED');
  const dirty=String(r.stdout||'').trim();
  if(dirty)throw new Error('RELEASE_CLOSURE_REQUIRES_CLEAN_WORKTREE:\n'+dirty);
}
function step(id,fn,steps){
  process.stdout.write('\n=== '+id+' ===\n');
  const started=Date.now();
  const value=fn();
  steps.push({id,status:'PASS',duration_ms:Date.now()-started});
  return value;
}
function cert({id,script,out,rootArg=true,verifyRootArg=rootArg}){
  const runArgs=['certify','run'];
  if(rootArg)runArgs.push('--root','.');
  runArgs.push('--out',out);
  const rr=node(script,runArgs);
  const ro=parseJsonOutput(rr,id+':run');
  if(!String(ro.status||'').endsWith('CERTIFIED'))throw new Error('RELEASE_CERTIFICATION_NOT_CERTIFIED:'+id+':'+String(ro.status));

  const verifyArgs=['certify','verify'];
  if(verifyRootArg)verifyArgs.push('--root','.');
  verifyArgs.push('--certificate',out);
  const vr=node(script,verifyArgs);
  const vo=parseJsonOutput(vr,id+':verify');
  const verifyPass=vo.valid===true||String(vo.status||'').endsWith('_VALID');
  if(!verifyPass)throw new Error('RELEASE_CERTIFICATION_VERIFY_FAILED:'+id+':'+JSON.stringify(vo.errors||vo.status||[]));
  return {id,status:ro.status,evidence_sha256:ro.evidence_sha256||null,verify_status:vo.status||null};
}
function certNoRoot({id,script,out}){
  return cert({id,script,out,rootArg:false,verifyRootArg:false});
}
function writeReport(obj){
  fs.mkdirSync(path.dirname(reportPath),{recursive:true});
  fs.writeFileSync(reportPath,JSON.stringify(obj,null,2)+'\n','utf8');
}
function currentStatus(){
  return String(run('git',['status','--porcelain=v1','--untracked-files=all'],{allow:true,timeout:30000}).stdout||'')
    .split(/\r?\n/).filter(Boolean);
}

const steps=[];
const certs=[];
try{
  assertCleanStart();

  step('1_INVENTORY',()=>{
    const r=node('scripts/78-release-closure-prepare.mjs',['inventory']);
    const o=parseJsonOutput(r,'inventory');
    if(o.status!=='RELEASE_CLOSURE_INVENTORY_PREPARED')throw new Error('RELEASE_INVENTORY_NOT_PREPARED');
    console.log(JSON.stringify(o,null,2));
  },steps);

  step('2_ADAPTER_CERTIFICATES',()=>{
    certs.push(cert({id:'opencode-portability-p2',script:'adapters/opencode/certification/opencode-certifier.mjs',out:'release/certifications/opencode-portability-p2.json'}));
    certs.push(cert({id:'codex-portability-p3',script:'adapters/codex/certification/codex-certifier.mjs',out:'release/certifications/codex-portability-p3.json'}));
    certs.push(cert({id:'claude-code-portability-p4',script:'adapters/claude-code/certification/claude-code-certifier.mjs',out:'release/certifications/claude-code-portability-p4.json'}));
    certs.push(cert({id:'antigravity-portability-p5',script:'adapters/antigravity/certification/antigravity-certifier.mjs',out:'release/certifications/antigravity-portability-p5.json'}));
    certs.push(cert({id:'cross-adapter-portability-p6',script:'portability/conformance/conformance.mjs',out:'release/certifications/cross-adapter-portability-p6.json'}));
  },steps);

  step('3_MULTIMODEL_CERTIFICATES',()=>{
    certs.push(certNoRoot({id:'multimodel-p1',script:'multimodel/engine/multimodel.mjs',out:'release/certifications/multimodel-p1.json'}));
    certs.push(certNoRoot({id:'multimodel-p2',script:'multimodel/router/model-router.mjs',out:'release/certifications/multimodel-p2.json'}));
    certs.push(certNoRoot({id:'multimodel-p3',script:'multimodel/extensions/diversity/judge-diversity.mjs',out:'release/certifications/multimodel-p3.json'}));
    certs.push(certNoRoot({id:'multimodel-p4',script:'multimodel/extensions/fallback/model-fallback.mjs',out:'release/certifications/multimodel-p4.json'}));
  },steps);

  step('4_ADVANCED_EXECUTION_CERTIFICATES',()=>{
    certs.push(certNoRoot({id:'advanced-execution-p1',script:'advanced-execution/worktrees/worktree-manager.mjs',out:'release/certifications/advanced-execution-p1.json'}));
    certs.push(certNoRoot({id:'advanced-execution-p2',script:'advanced-execution/workers/worker-manager.mjs',out:'release/certifications/advanced-execution-p2.json'}));
    certs.push(certNoRoot({id:'advanced-execution-p3',script:'advanced-execution/concurrency/concurrency-manager.mjs',out:'release/certifications/advanced-execution-p3.json'}));
    certs.push(certNoRoot({id:'advanced-execution-p4',script:'advanced-execution/dispatcher/dispatcher-manager.mjs',out:'release/certifications/advanced-execution-p4.json'}));
    certs.push(certNoRoot({id:'advanced-execution-p5',script:'advanced-execution/multimachine/multimachine-manager.mjs',out:'release/certifications/advanced-execution-p5.json'}));
  },steps);

  if(certs.length!==14)throw new Error('RELEASE_CERTIFICATE_COUNT_UNEXPECTED:'+certs.length);

  const bootstrapBaseline=step('5_BOOTSTRAP_PACKAGE_BASELINE',()=>{
    const r=node('scripts/78-release-closure-prepare.mjs',['bootstrap-baseline']);
    const o=parseJsonOutput(r,'bootstrap-baseline');
    if(o.status!=='RELEASE_CLOSURE_BOOTSTRAP_BASELINE_READY'||o.package_version!==version||o.certificate_count!==14||o.bootstrap!==true)throw new Error('RELEASE_BOOTSTRAP_BASELINE_INVALID');
    console.log(JSON.stringify(o,null,2));
    return o;
  },steps);

  step('6_BOOTSTRAP_MASTER_P1_CERTIFICATE',()=>{
    const out='release/certifications/master-validation-p1.json';
    const r=node('release/engine/v1-release.mjs',['master','certify','--project-root','.','--out',out]);
    const o=parseJsonOutput(r,'bootstrap-master-p1-certify');
    if(o.status!=='MASTER_VALIDATION_P1_PACKAGE_CERTIFIED')throw new Error('RELEASE_BOOTSTRAP_MASTER_P1_CERTIFY_FAILED:'+String(o.status));
    const v=node('release/engine/v1-release.mjs',['master','verify-certificate','--project-root','.','--certificate',out]);
    const vo=parseJsonOutput(v,'bootstrap-master-p1-verify');
    if(vo.valid!==true)throw new Error('RELEASE_BOOTSTRAP_MASTER_P1_VERIFY_FAILED:'+JSON.stringify(vo.errors||[]));
  },steps);

  const regression=step('7_FULL_DETERMINISTIC_REGRESSION',()=>{
    nodeStreaming('scripts/78-release-closure-prepare.mjs',['regression'],{timeout:3600000});
    const summaryPath=path.join(stateDir,'deterministic-regression-summary.json');
    if(!fs.existsSync(summaryPath))throw new Error('RELEASE_REGRESSION_SUMMARY_MISSING_AFTER_RUN');
    const summary=JSON.parse(fs.readFileSync(summaryPath,'utf8').replace(/^\uFEFF/,''));
    if(summary.release_candidate!==version||summary.failures!==0||summary.skipped!==0||summary.tests_passed!==summary.tests_total){
      throw new Error('RELEASE_REGRESSION_NOT_PASS');
    }
    const o={status:'RELEASE_CLOSURE_REGRESSION_PASS',...summary,path:path.relative(root,summaryPath).replaceAll('\\','/')};
    console.log(JSON.stringify(o,null,2));
    return o;
  },steps);

  const baseline=step('8_REBUILD_FINAL_PACKAGE_BASELINE',()=>{
    const r=node('scripts/78-release-closure-prepare.mjs',['baseline']);
    const o=parseJsonOutput(r,'baseline');
    if(o.status!=='RELEASE_CLOSURE_BASELINE_REBUILT'||o.package_version!==version||o.certificate_count!==14||o.bootstrap!==false||!o.measured_regression)throw new Error('RELEASE_BASELINE_REBUILD_INVALID');
    console.log(JSON.stringify(o,null,2));
    return o;
  },steps);

  step('9_VERIFY_PACKAGE_BASELINE',()=>{
    const r=node('release/engine/v1-release.mjs',['master','package','--project-root','.']);
    const o=parseJsonOutput(r,'master-package');
    if(o.valid!==true||o.package_version!==version)throw new Error('RELEASE_MASTER_PACKAGE_INVALID:'+JSON.stringify(o.errors||[]));
    console.log(JSON.stringify({status:o.status,valid:o.valid,package_version:o.package_version},null,2));
  },steps);

  const masterP1=step('10_REISSUE_FINAL_MASTER_P1_CERTIFICATE',()=>{
    const out='release/certifications/master-validation-p1.json';
    const r=node('release/engine/v1-release.mjs',['master','certify','--project-root','.','--out',out]);
    const o=parseJsonOutput(r,'master-p1-certify');
    if(o.status!=='MASTER_VALIDATION_P1_PACKAGE_CERTIFIED')throw new Error('RELEASE_MASTER_P1_CERTIFY_FAILED:'+String(o.status));
    const v=node('release/engine/v1-release.mjs',['master','verify-certificate','--project-root','.','--certificate',out]);
    const vo=parseJsonOutput(v,'master-p1-verify');
    if(vo.valid!==true)throw new Error('RELEASE_MASTER_P1_VERIFY_FAILED:'+JSON.stringify(vo.errors||[]));
    return {status:o.status,master_certificate_sha256:o.master_certificate_sha256||null};
  },steps);

  const report={
    schema_version:'1.0',
    phase:'ALEDEVOS_V1_52_RELEASE_CLOSURE_PACKAGE_RECERTIFICATION',
    status:'RELEASE_CLOSURE_PHASE2_PASS',
    package_version:version,
    regression:{
      tests_passed:regression.tests_passed,
      tests_total:regression.tests_total,
      failures:regression.failures,
      skipped:regression.skipped,
      mjs_syntax_passed:regression.mjs_syntax_passed,
      json_parse_passed:regression.json_parse_passed,
      toml_parse_passed:regression.toml_parse_passed
    },
    package_certificates:certs,
    bootstrap_baseline:bootstrapBaseline,
    baseline,
    master_p1:masterP1,
    steps,
    tracked_changes:currentStatus(),
    created_at:new Date().toISOString()
  };
  writeReport(report);

  console.log('\n============================================================');
  console.log(' ALEDEVOS v1.52.0 - RELEASE CLOSURE PHASE 2');
  console.log('============================================================');
  console.log('Status                    : RELEASE_CLOSURE_PHASE2_PASS');
  console.log('Tests                     : '+regression.tests_passed+'/'+regression.tests_total);
  console.log('MJS syntax                : '+regression.mjs_syntax_passed);
  console.log('JSON parse                : '+regression.json_parse_passed);
  console.log('TOML parse                : '+regression.toml_parse_passed);
  console.log('Package certificates      : '+certs.length+'/14');
  console.log('Package baseline          : VALID');
  console.log('Master P1 certificate     : VALID');
  console.log('Report                     : '+path.relative(root,reportPath).replaceAll('\\','/'));
  console.log('\nRELEASE_CLOSURE_PHASE2_PASS');
}catch(e){
  const report={
    schema_version:'1.0',
    phase:'ALEDEVOS_V1_52_RELEASE_CLOSURE_PACKAGE_RECERTIFICATION',
    status:'RELEASE_CLOSURE_PHASE2_FAILED',
    package_version:version,
    completed_steps:steps,
    package_certificates:certs,
    error:e?.message||String(e),
    tracked_changes:currentStatus(),
    created_at:new Date().toISOString()
  };
  writeReport(report);
  console.error('\nRELEASE_CLOSURE_PHASE2_FAILED');
  console.error(e?.stack||e);
  process.exit(1);
}
