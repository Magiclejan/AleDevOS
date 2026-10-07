#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const command=process.argv[2]||'prepare';
const version=fs.readFileSync(path.join(root,'VERSION.txt'),'utf8').trim();
const stateDir=path.join(root,'.aledevos','state','release',version);

const EXCLUSIONS=[
  '.git/**',
  'node_modules/**',
  '.aledevos/**',
  '.aledev*/**',
  'MANIFEST.txt',
  'release/templates/package-tree-manifest.json',
  'release/templates/master-validation-package-baseline.json',
  'release/certifications/**'
];

const norm=p=>String(p).replaceAll('\\','/');
const shaBytes=b=>crypto.createHash('sha256').update(b).digest('hex');
const fileSha=p=>shaBytes(fs.readFileSync(p));
const write=(p,s)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s,'utf8')};
const writeJson=(p,o)=>write(p,JSON.stringify(o,null,2)+'\n');

function stable(v){
  if(Array.isArray(v))return v.map(stable);
  if(v&&typeof v==='object'){
    const out={};
    for(const k of Object.keys(v).sort()){
      if(!['master_evidence_sha256','master_report_sha256','master_certificate_sha256','baseline_sha256','manifest_sha256'].includes(k))out[k]=stable(v[k]);
    }
    return out;
  }
  return v;
}
const seal=o=>shaBytes(Buffer.from(JSON.stringify(stable(o)),'utf8'));

function run(exe,args,{cwd=root,timeout=120000,allow=false,input=null}={}){
  const r=spawnSync(exe,args,{cwd,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024,timeout,input});
  if(!allow&&r.status!==0)throw new Error('RELEASE_COMMAND_FAILED:'+exe+' '+args.join(' ')+' :: '+String(r.stderr||r.stdout||r.error||'').slice(0,1200));
  return r;
}
function git(args){return run('git',args)}
function tracked(){
  const r=git(['ls-files','-z']);
  return String(r.stdout||'').split('\0').filter(Boolean).map(norm).sort();
}
function excluded(rel){
  const r=norm(rel),top=r.split('/')[0];
  if(top==='.git'||top==='node_modules'||top==='.aledevos'||top.startsWith('.aledev'))return true;
  if(r==='MANIFEST.txt'||r==='release/templates/package-tree-manifest.json'||r==='release/templates/master-validation-package-baseline.json'||r.startsWith('release/certifications/'))return true;
  return false;
}
function assertTrackedFilesExist(files){
  const missing=files.filter(x=>!fs.existsSync(path.join(root,...x.split('/'))));
  if(missing.length)throw new Error('RELEASE_TRACKED_FILE_MISSING:'+missing.slice(0,10).join(','));
}
function buildInventory(){
  const files=tracked();
  assertTrackedFilesExist(files);
  write(path.join(root,'MANIFEST.txt'),files.join('\n')+'\n');

  const entries=[];
  for(const rel of files){
    if(excluded(rel))continue;
    const abs=path.join(root,...rel.split('/'));
    const st=fs.statSync(abs);
    if(!st.isFile())continue;
    entries.push({path:rel,sha256:fileSha(abs),size:st.size});
  }
  entries.sort((a,b)=>a.path.localeCompare(b.path));
  const treeSha=shaBytes(Buffer.from(JSON.stringify(entries),'utf8'));
  const manifest={
    schema_version:'1.0',
    phase:'ALEDEVOS_PACKAGE_TREE_INTEGRITY',
    algorithm:'SHA-256',
    exclusions:EXCLUSIONS,
    file_count:entries.length,
    entries,
    tree_sha256:treeSha,
    manifest_sha256:''
  };
  manifest.manifest_sha256=seal(manifest);
  const out=path.join(root,'release','templates','package-tree-manifest.json');
  writeJson(out,manifest);
  return {tracked_files:files.length,package_files:entries.length,tree_sha256:treeSha,manifest_sha256:manifest.manifest_sha256};
}

function tapSummary(text,file){
  const get=name=>{
    const m=String(text).match(new RegExp('^# '+name+' (\\d+)\\s*$','m'));
    if(!m)throw new Error('RELEASE_TAP_SUMMARY_MISSING:'+file+':'+name);
    return Number(m[1]);
  };
  return {tests:get('tests'),pass:get('pass'),fail:get('fail'),skipped:(String(text).match(/^# skipped (\d+)\s*$/m)?.[1]??'0')*1};
}
function findPythonToml(){
  const candidates=process.platform==='win32'
    ? [['py',['-3']],['python',[]],['python3',[]]]
    : [['python3',[]],['python',[]]];
  for(const [exe,prefix] of candidates){
    const r=run(exe,[...prefix,'-c','import tomllib; print("OK")'],{allow:true,timeout:10000});
    if(r.status===0&&String(r.stdout).includes('OK'))return {exe,prefix};
  }
  return null;
}
function validateToml(files){
  if(!files.length)return 0;
  const py=findPythonToml();
  if(!py)throw new Error('RELEASE_TOML_VALIDATOR_UNAVAILABLE: Python 3.11+ with tomllib is required for release closure');
  const code='import sys,tomllib; f=open(sys.argv[1],"rb"); tomllib.load(f); f.close()';
  let count=0;
  for(const rel of files){
    const abs=path.join(root,...rel.split('/'));
    const r=run(py.exe,[...py.prefix,'-c',code,abs],{allow:true,timeout:15000});
    if(r.status!==0)throw new Error('RELEASE_TOML_PARSE_FAILED:'+rel+' :: '+String(r.stderr||r.stdout).slice(0,500));
    count++;
  }
  return count;
}
function runRegression(){
  const files=tracked();
  const testFiles=files.filter(x=>/^tests\/.*\.test\.mjs$/i.test(x));
  let tests=0,pass=0,fail=0,skipped=0;
  for(const rel of testFiles){
    process.stdout.write('TEST '+rel+' ... ');
    const requestedTimeout=Number(process.env.ALEDEVOS_TEST_FILE_TIMEOUT_MS||120000);
    const heavyAdvancedExecution=/^tests\/advanced-execution-phase[2-5]\.test\.mjs$/i.test(rel);
    const timeoutMs=heavyAdvancedExecution?Math.max(requestedTimeout,600000):requestedTimeout;
    const started=Date.now();
    const r=run(process.execPath,['--test','--test-reporter=tap',rel],{allow:true,timeout:timeoutMs});
    const elapsed=Date.now()-started;
    if(r.stdout)process.stdout.write(r.stdout.includes('\n')?'':'');
    if(r.status!==0){
      const timedOut=r.error?.code==='ETIMEDOUT';
      process.stdout.write((timedOut?'TIMEOUT':'FAIL')+' ('+elapsed+'ms / '+timeoutMs+'ms)\n');
      process.stderr.write(String(r.stdout||'')+String(r.stderr||''));
      throw new Error((timedOut?'RELEASE_TEST_FILE_TIMEOUT:':'RELEASE_TEST_FILE_FAILED:')+rel+':'+elapsed+'ms/'+timeoutMs+'ms');
    }
    const t=tapSummary(r.stdout,rel);
    tests+=t.tests;pass+=t.pass;fail+=t.fail;skipped+=t.skipped;
    process.stdout.write(t.pass+'/'+t.tests+' PASS ('+elapsed+'ms)\n');
  }
  if(fail!==0||skipped!==0||pass!==tests)throw new Error('RELEASE_TEST_SUITE_NOT_CLEAN');

  const mjs=files.filter(x=>x.endsWith('.mjs'));
  for(const rel of mjs)run(process.execPath,['--check',rel],{timeout:30000});

  const json=files.filter(x=>x.endsWith('.json'));
  for(const rel of json){
    try{JSON.parse(fs.readFileSync(path.join(root,...rel.split('/')),'utf8').replace(/^\uFEFF/,''));}
    catch(e){throw new Error('RELEASE_JSON_PARSE_FAILED:'+rel+':'+e.message);}
  }

  const toml=files.filter(x=>x.endsWith('.toml'));
  const tomlPassed=validateToml(toml);

  const summary={
    schema_version:'1.0',
    release_candidate:version,
    tests_passed:pass,
    tests_total:tests,
    failures:fail,
    skipped,
    test_files:testFiles.length,
    mjs_syntax_passed:mjs.length,
    json_parse_passed:json.length,
    toml_parse_passed:tomlPassed,
    generated_at:new Date().toISOString()
  };
  const out=path.join(stateDir,'deterministic-regression-summary.json');
  writeJson(out,summary);
  return {...summary,path:norm(path.relative(root,out))};
}

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));}
function baselineFloor(){
  const p=readJson(path.join(root,'release','policies','v1-release-policy.json'));
  const m=p?.master_validation?.minimums;
  if(!m)throw new Error('RELEASE_MASTER_MINIMUMS_MISSING');
  return {
    tests_passed:Number(m.tests_passed),
    mjs_syntax_passed:Number(m.mjs_syntax_passed),
    json_parse_passed:Number(m.json_parse_passed),
    toml_parse_passed:Number(m.toml_parse_passed),
    failures:Number(m.failures||0)
  };
}
function currentCertificateInventory(){
  const baselinePath=path.join(root,'release','templates','master-validation-package-baseline.json');
  const old=readJson(baselinePath);
  const certs=[];
  for(const d of old.certificates||[]){
    const p=path.join(root,...String(d.path).split('/'));
    if(!fs.existsSync(p))throw new Error('RELEASE_CERTIFICATE_MISSING:'+d.id);
    const q=readJson(p);
    if(!q.status||!q.evidence_sha256)throw new Error('RELEASE_CERTIFICATE_NOT_SEALED:'+d.id);
    certs.push({id:d.id,path:d.path,status:q.status,evidence_sha256:q.evidence_sha256,...(d.input_base?{input_base:d.input_base}:{})});
  }
  if(certs.length!==14)throw new Error('RELEASE_CERTIFICATE_INVENTORY_COUNT_INVALID:'+certs.length);
  return certs;
}
function writeBaseline({regression=null,bootstrap=false}={}){
  if(regression){
    if(regression.release_candidate!==version||regression.failures!==0||regression.skipped!==0||regression.tests_passed!==regression.tests_total)throw new Error('RELEASE_REGRESSION_SUMMARY_NOT_CLEAN');
  }
  const certs=currentCertificateInventory();
  const treePath=path.join(root,'release','templates','package-tree-manifest.json');
  if(!fs.existsSync(treePath))throw new Error('RELEASE_PACKAGE_TREE_REQUIRED');
  const tree=readJson(treePath);
  if(tree.manifest_sha256!==seal(tree))throw new Error('RELEASE_PACKAGE_TREE_SEAL_INVALID');
  const floor=baselineFloor();
  const measured=regression?{
    tests_passed:regression.tests_passed,
    tests_total:regression.tests_total,
    test_files:regression.test_files,
    mjs_syntax_passed:regression.mjs_syntax_passed,
    json_parse_passed:regression.json_parse_passed,
    toml_parse_passed:regression.toml_parse_passed,
    failures:regression.failures,
    skipped:regression.skipped,
    generated_at:regression.generated_at
  }:null;
  const baseline={
    schema_version:'1.0',
    phase:'MASTER_VALIDATION_P1_PACKAGE_BASELINE',
    package_version:version,
    deterministic_inventory:floor,
    measured_regression:measured,
    certificate_count:certs.length,
    certificates:certs,
    source_attestation:bootstrap
      ? 'Bootstrap baseline for v1.52.0 closure self-validation. Deterministic inventory remains the frozen Master Gate floor; measured regression is attached only after a clean full regression.'
      : 'v1.52.0 package baseline regenerated from the current source tree and current sealed package certificates. Deterministic inventory is the frozen Master Gate floor; measured_regression records the clean current full-regression measurement.',
    baseline_sha256:'',
    package_tree_manifest_sha256:fileSha(treePath)
  };
  baseline.baseline_sha256=seal(baseline);
  const baselinePath=path.join(root,'release','templates','master-validation-package-baseline.json');
  writeJson(baselinePath,baseline);
  return {
    package_version:version,
    certificate_count:certs.length,
    deterministic_inventory:floor,
    measured_regression:measured,
    bootstrap,
    baseline_sha256:baseline.baseline_sha256,
    package_tree_manifest_sha256:baseline.package_tree_manifest_sha256
  };
}
function bootstrapBaseline(){
  return writeBaseline({bootstrap:true});
}
function rebuildBaseline(){
  const summaryPath=path.join(stateDir,'deterministic-regression-summary.json');
  if(!fs.existsSync(summaryPath))throw new Error('RELEASE_REGRESSION_SUMMARY_REQUIRED:'+norm(path.relative(root,summaryPath)));
  return writeBaseline({regression:readJson(summaryPath),bootstrap:false});
}

function status(){
  const result={version};
  const manifest=path.join(root,'MANIFEST.txt');
  result.manifest_present=fs.existsSync(manifest);
  const tree=path.join(root,'release','templates','package-tree-manifest.json');
  result.package_tree_present=fs.existsSync(tree);
  result.regression_summary_present=fs.existsSync(path.join(stateDir,'deterministic-regression-summary.json'));
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
}

try{
  if(command==='prepare'||command==='inventory'){
    const r=buildInventory();
    console.log(JSON.stringify({status:'RELEASE_CLOSURE_INVENTORY_PREPARED',version,...r},null,2));
  }else if(command==='regression'){
    const r=runRegression();
    console.log(JSON.stringify({status:'RELEASE_CLOSURE_REGRESSION_PASS',...r},null,2));
  }else if(command==='bootstrap-baseline'){
    const r=bootstrapBaseline();
    console.log(JSON.stringify({status:'RELEASE_CLOSURE_BOOTSTRAP_BASELINE_READY',...r},null,2));
  }else if(command==='baseline'){
    const r=rebuildBaseline();
    console.log(JSON.stringify({status:'RELEASE_CLOSURE_BASELINE_REBUILT',...r},null,2));
  }else if(command==='status'){
    status();
  }else{
    throw new Error('RELEASE_CLOSURE_COMMAND_UNKNOWN:'+command);
  }
}catch(e){
  console.error(JSON.stringify({status:'RELEASE_CLOSURE_FAILED',version,message:e?.message||String(e)},null,2));
  process.exit(1);
}
