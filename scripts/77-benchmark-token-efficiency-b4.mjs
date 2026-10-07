#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseCodexJsonl,encodeWindowsTransportArg} from '../core/agent-runtime/agent-runtime.mjs';
import {startTaskTelemetry,emitAgentCallTelemetry,finishTaskTelemetry} from '../core/engine/telemetry-bridge.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const argv=process.argv.slice(2);
const take=(f,d=null)=>{const i=argv.indexOf(f);return i>=0&&i+1<argv.length?argv[i+1]:d};
const takeAll=f=>argv.flatMap((x,i)=>x===f&&i+1<argv.length?[argv[i+1]]:[]);
const runtimeProject=path.resolve(take('--project',''));
const repoProject=path.resolve(take('--repo-project',''));
const targetRel=String(take('--target-file','')).replaceAll('\\','/');
const model=take('--model',null);
const reasoningEffort=take('--reasoning-effort',null);
const timeoutMs=Math.max(10000,Math.min(900000,Number(take('--timeout-ms','180000'))||180000));
const runs=Math.max(0,Math.min(5,Number(take('--runs','1'))||0));
const priorReceiptArgs=takeAll('--prior-receipt');
const allowedReasoning=new Set(['none','minimal','low','medium','high','xhigh','max']);
if(reasoningEffort&&!allowedReasoning.has(reasoningEffort))throw new Error('B4_REASONING_EFFORT_INVALID:'+reasoningEffort);
if(!runtimeProject||!fs.existsSync(path.join(runtimeProject,'.aledevos','project.json')))throw new Error('B4_ALEDEVOS_RUNTIME_PROJECT_REQUIRED');
if(!fs.existsSync(path.join(runtimeProject,'.codex','config.toml')))throw new Error('B4_CODEX_ADAPTER_NOT_INSTALLED');
if(!repoProject||!fs.existsSync(repoProject))throw new Error('B4_REPO_PROJECT_REQUIRED');
if(!targetRel||targetRel.startsWith('/')||targetRel.includes('..'))throw new Error('B4_TARGET_FILE_INVALID');

const TASK='B4-REAL-SOFTWARE-ENGINEERING-E2E',KEY='B4_REAL_SOFTWARE_ENGINEERING_E2E_V1';
const MARKER='// ALEDEVOS_B4_E2E_MARKER';
const EXT=new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx']);
const DIR=new Set(['.git','.aledevos','.codex','.claude','.agents','.opencode','node_modules','dist','build','coverage','.next','.cache','vendor','target','.venv','venv','__pycache__','.idea','.vscode']);
const BADNAME=[/^\.env(?:\.|$)/i,/\.pem$/i,/\.key$/i,/credentials?/i,/secrets?/i,/lock/i];
const SECRET=/(password|passwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|client[_-]?secret)\s*[:=]\s*(?:["'][^"']{4,}["']|[^\s#]{8,})|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{20,}\b|\bsk-[A-Za-z0-9]{20,}\b/i;
const MAXFILES=15,MAXBYTES=170*1024,MAXFILE=96*1024;
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const norm=p=>p.replaceAll('\\','/');
const safeNum=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
const ratio=(b,c)=>typeof b==='number'&&typeof c==='number'&&b>0?(b-c)/b:null;
const pct=v=>v===null?'n/a':(Math.round(v*10000)/100)+'%';
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n','utf8')};

function run(exe,args,cwd,{input=null,timeout=timeoutMs,allow=false}={}){
  const r=spawnSync(exe,args,{cwd,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024,timeout,input});
  if(!allow&&r.status!==0)throw new Error('B4_COMMAND_FAILED:'+exe+' '+args.join(' ')+' :: '+String(r.stderr||r.stdout||r.error||'').slice(0,500));
  return r;
}
let executionRepo=repoProject;
function git(args,cwd=executionRepo,opts={}){return run('git',args,cwd,opts)}
function gitText(args,cwd=executionRepo){return String(git(args,cwd).stdout||'').trim()}
function pathEq(a,b){
  const A=path.resolve(a),B=path.resolve(b);
  return process.platform==='win32'?A.toLowerCase()===B.toLowerCase():A===B;
}
function safeDigest(files){return sha(Buffer.from(files.map(x=>x.rel+'\0'+x.hash).join('\n'),'utf8'))}
function detectNativeGitRoot(){
  const r=run('git',['rev-parse','--show-toplevel'],repoProject,{allow:true});
  if(r.status!==0)return null;
  const top=String(r.stdout||'').trim();
  return top&&pathEq(top,repoProject)?path.resolve(top):null;
}
function safeFiles(){
  const out=[];
  function walk(dir){
    for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
      if(e.isSymbolicLink())continue;
      const p=path.join(dir,e.name);
      if(e.isDirectory()){if(!DIR.has(e.name))walk(p);continue}
      if(!e.isFile()||BADNAME.some(r=>r.test(e.name))||!EXT.has(path.extname(e.name).toLowerCase()))continue;
      const b=fs.readFileSync(p);if(!b.length||b.length>MAXFILE||b.includes(0))continue;
      const text=b.toString('utf8').replace(/^\uFEFF/,'');if(SECRET.test(text))continue;
      out.push({rel:norm(path.relative(repoProject,p)),text,bytes:b.length,hash:sha(b)});
    }
  }
  walk(repoProject);return out;
}
function selectCorpus(targetFile){
  const all=safeFiles();
  const target=all.find(x=>x.rel===targetRel);
  if(!target)throw new Error('B4_TARGET_NOT_SAFE_FOR_BENCHMARK');
  const files=[target];let bytes=target.bytes;
  for(const f of all){if(f.rel===targetRel||files.length>=MAXFILES)continue;if(bytes+f.bytes>MAXBYTES)continue;files.push(f);bytes+=f.bytes}
  if(files.length<5)throw new Error('B4_INSUFFICIENT_REAL_PROJECT_CORPUS');
  return {all,files,target,digest:safeDigest(files),source_digest:safeDigest(all)};
}
function anchorFor(text){
  const lines=text.split(/\r?\n/);
  const stem=path.basename(targetRel,path.extname(targetRel)).replace(/[^A-Za-z0-9_$]/g,'');
  const rx=/^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class)\s+[A-Za-z_$][\w$]*|^(?:export\s+)?const\s+[A-Za-z_$][\w$]*\s*=/;
  let candidates=[];
  for(let i=0;i<lines.length;i++){
    const raw=lines[i],trim=raw.trim();
    if(raw!==trim||!rx.test(trim)||trim.includes(MARKER))continue;
    candidates.push({line:trim,n:i+1,score:(stem&&trim.includes(stem)?100:0)+Math.min(20,trim.length)});
  }
  candidates.sort((a,b)=>b.score-a.score||a.n-b.n);
  if(!candidates.length)throw new Error('B4_NO_SAFE_TOP_LEVEL_DECLARATION_ANCHOR');
  return candidates[0];
}
function promptFor(label,context,anchor){
  return [
    'ALEDEVOS B4 REAL SOFTWARE-ENGINEERING E2E BENCHMARK.',
    'This is an isolated disposable git worktree. You MAY inspect and edit this worktree.',
    'Do not commit, do not install dependencies, do not use network, and do not modify any file except the one required by the task.',
    'USER GOAL: Add a non-functional maintenance marker immediately above the unique top-level declaration matching the supplied ANCHOR LINE.',
    'EXACT MARKER TO INSERT: '+MARKER,
    'ANCHOR LINE: '+anchor.line,
    'Do not alter the anchor line or any other content.',
    'When the edit is complete, reply exactly "B4_EDIT_DONE".',
    'PIPELINE: '+label,
    '',
    'PRECOMPUTED REPOSITORY CONTEXT:',
    context
  ].join('\n');
}
function codex(worktree,prompt){
  const args=['exec','--json','--skip-git-repo-check','--config','sandbox_mode=workspace-write','--config','approval_policy=never'];
  if(model)args.push('--model',model);
  if(reasoningEffort)args.push('--config','model_reasoning_effort='+reasoningEffort);
  args.push('-');
  let exe='codex',final=args;
  if(process.platform==='win32'){
    const launcher=path.join(root,'core','agent-runtime','windows-cli-launcher.ps1');
    const enc=['codex',...args].map(encodeWindowsTransportArg);
    exe='powershell.exe';final=['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',launcher,...enc];
  }
  const t=Date.now();
  const r=run(exe,final,worktree,{input:prompt,allow:true});
  r.ms=Date.now()-t;return r;
}
function answer(stdout){
  let out=null;
  for(const line of String(stdout||'').split(/\r?\n/)){
    let q;try{q=JSON.parse(line)}catch{continue}
    const it=q?.item;
    if(it&&String(it.type||'').toLowerCase()==='agent_message'&&typeof it.text==='string')out=it.text.trim();
    if(q?.type==='message'&&q?.role==='assistant'&&typeof q.content==='string')out=q.content.trim();
  }
  return out;
}
function verifyEdit(worktree,anchor){
  const names=String(git(['diff','--name-only'],worktree,{allow:true}).stdout||'').trim().split(/\r?\n/).filter(Boolean).map(norm);
  const num=String(git(['diff','--numstat','--',targetRel],worktree,{allow:true}).stdout||'').trim().split(/\s+/);
  const check=git(['diff','--check'],worktree,{allow:true});
  const text=fs.readFileSync(path.join(worktree,targetRel),'utf8').replace(/^\uFEFF/,'');
  const lines=text.split(/\r?\n/);
  let adjacency=0;
  for(let i=0;i<lines.length-1;i++)if(lines[i].trim()===MARKER&&lines[i+1].trim()===anchor.line)adjacency++;
  const markerCount=lines.filter(x=>x.trim()===MARKER).length;
  const added=Number(num[0]),deleted=Number(num[1]);
  const pass=names.length===1&&names[0]===targetRel&&added===1&&deleted===0&&check.status===0&&markerCount===1&&adjacency===1;
  return {pass,changed_files:names,added_lines:Number.isFinite(added)?added:null,deleted_lines:Number.isFinite(deleted)?deleted:null,diff_check_pass:check.status===0,marker_count:markerCount,anchor_adjacency:adjacency,diff_sha256:sha(Buffer.from(String(git(['diff','--binary'],worktree,{allow:true}).stdout||''),'utf8'))};
}
function addWorktree(base,tag,head){
  const wt=path.join(base,tag);
  git(['worktree','add','--detach',wt,head],executionRepo);
  return wt;
}
function cleanupWorktree(wt){
  if(!wt||!fs.existsSync(wt))return;
  git(['reset','--hard','HEAD'],wt,{allow:true});
  git(['clean','-fd'],wt,{allow:true});
  git(['worktree','remove',wt],executionRepo,{allow:true});
}

function copySafeFilesToSnapshot(files,dest){
  for(const f of files){
    const out=path.join(dest,...f.rel.split('/'));
    fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.copyFileSync(path.join(repoProject,...f.rel.split('/')),out);
  }
}
function prepareExecutionRepository(temp,corpus){
  const nativeRoot=detectNativeGitRoot();
  if(nativeRoot){
    executionRepo=nativeRoot;
    const dirtyTarget=String(run('git',['status','--porcelain=v1','--',targetRel],executionRepo,{allow:true}).stdout||'').trim();
    if(dirtyTarget)throw new Error('B4_TARGET_FILE_DIRTY');
    const statusBefore=String(run('git',['status','--porcelain=v1','--untracked-files=all'],executionRepo,{allow:true}).stdout||'');
    return {mode:'NATIVE_GIT',head:gitText(['rev-parse','HEAD'],executionRepo),status_hash:sha(Buffer.from(statusBefore,'utf8')),source_digest:corpus.source_digest};
  }
  const snap=path.join(temp,'source-snapshot');
  fs.mkdirSync(snap,{recursive:true});
  copySafeFilesToSnapshot(corpus.all,snap);
  executionRepo=snap;
  run('git',['init'],executionRepo);
  run('git',['config','user.name','AleDevOS B4 Benchmark'],executionRepo);
  run('git',['config','user.email','benchmark@localhost'],executionRepo);
  run('git',['add','--','.'],executionRepo);
  run('git',['commit','-m','B4 ephemeral source snapshot'],executionRepo);
  return {mode:'EPHEMERAL_GIT_SNAPSHOT',head:gitText(['rev-parse','HEAD'],executionRepo),status_hash:null,source_digest:corpus.source_digest};
}
function verifySourceUntouched(source){
  const currentFiles=safeFiles();
  const digest=safeDigest(currentFiles);
  if(digest!==source.source_digest)return false;
  if(source.mode==='NATIVE_GIT'){
    const head=String(run('git',['rev-parse','HEAD'],repoProject,{allow:true}).stdout||'').trim();
    const status=String(run('git',['status','--porcelain=v1','--untracked-files=all'],repoProject,{allow:true}).stdout||'');
    return head===source.head&&sha(Buffer.from(status,'utf8'))===source.status_hash;
  }
  return true;
}

function safeDiagnostic(raw){
  let text=[raw?.stderr,raw?.stdout].filter(Boolean).join('\n');
  text=String(text||'')
    .replace(/[A-Za-z]:[\\/][^\r\n"' ]+/g,'<PATH>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/ig,'<ID>');
  return text
    .split(/\r?\n/)
    .map(x=>x.trim())
    .filter(Boolean)
    .slice(0,4)
    .join(' | ')
    .replace(/[^A-Za-z0-9 <>._:/=+\-]/g,'_')
    .slice(0,600)||null;
}
function telemetry(label,raw,verification,prompt){
  const parsed=parseCodexJsonl(raw.stdout||'');
  const exit=Number.isInteger(raw.status)?raw.status:(raw.error?.code==='ETIMEDOUT'?124:127);
  const responseOk=exit===0&&answer(raw.stdout||'')==='B4_EDIT_DONE';
  const quality=responseOk&&verification.pass;
  const start=startTaskTelemetry({cwd:runtimeProject,taskId:TASK,adapter:'codex',benchmarkKey:KEY,model:parsed.model||model||null,profile:label});
  if(!start.ok)throw new Error('B4_TELEMETRY_START_FAILED');
  const ev=emitAgentCallTelemetry({cwd:runtimeProject,runId:start.run_id,taskId:TASK,runtime:'codex',adapter:'codex',agent:'orchestrator',model:parsed.model||model||null,
    metrics:{input_tokens:parsed.input_tokens??null,output_tokens:parsed.output_tokens??null,context_tokens:null,duration_ms:raw.ms,generation_ms:null,tool_calls:parsed.tool_calls??0,files_read:parsed.files_read??0,bytes_read:null},
    attributes:{benchmark_leg:label,call_status:exit===0?'COMPLETED':'FAILED',exit_code:exit,usage_source:parsed.usage_source??'unavailable',quality_exact_match:quality,response_contract_pass:responseOk,diff_contract_pass:verification.pass,raw_prompt_stored:false,raw_completion_stored:false,prompt_sha256:sha(Buffer.from(prompt,'utf8'))}});
  if(!ev.ok)throw new Error('B4_AGENT_TELEMETRY_FAILED');
  const fin=finishTaskTelemetry({cwd:runtimeProject,runId:start.run_id,taskId:TASK,adapter:'codex',finalState:quality?'PASS':'FAILED'});
  if(!fin.ok)throw new Error('B4_TELEMETRY_FINALIZE_FAILED');
  const diagnostic=(exit!==0||!responseOk||!verification.pass)?safeDiagnostic(raw):null;
  return {exit,responseOk,quality,parsed,summary:fin.summary,verified:fin.verification?.valid===true,run_id:start.run_id,diagnostic};
}

function loadPriorPairs({corpus,anchor}){
  if(!priorReceiptArgs.length)return [];
  const accepted=[],seen=new Set();

  for(const priorReceiptArg of priorReceiptArgs){
    const base=path.resolve(runtimeProject),rp=path.resolve(runtimeProject,priorReceiptArg);
    if(rp!==base&&!rp.startsWith(base+path.sep))throw new Error('B4_PRIOR_RECEIPT_OUTSIDE_RUNTIME_PROJECT');
    if(!fs.existsSync(rp))throw new Error('B4_PRIOR_RECEIPT_NOT_FOUND:'+rp);
    const q=JSON.parse(fs.readFileSync(rp,'utf8'));
    if(q?.schema_version!=='1.0'||q?.benchmark!=='B4_REAL_SOFTWARE_ENGINEERING_E2E'||q?.benchmark_key!==KEY)throw new Error('B4_PRIOR_RECEIPT_INCOMPATIBLE');

    const copy=structuredClone(q),h=copy?.integrity?.payload_sha256??null;
    delete copy.integrity;
    if(!h||sha(Buffer.from(JSON.stringify(copy),'utf8'))!==h)throw new Error('B4_PRIOR_RECEIPT_INTEGRITY_INVALID');
    if((q?.model??null)!==(model??null))throw new Error('B4_PRIOR_RECEIPT_MODEL_MISMATCH');
    if((q?.reasoning_effort??null)!==(reasoningEffort??null))throw new Error('B4_PRIOR_RECEIPT_REASONING_MISMATCH');
    if(q?.repository?.source_digest!==corpus.source_digest||q?.repository?.corpus_digest!==corpus.digest)throw new Error('B4_PRIOR_RECEIPT_SOURCE_DRIFT');
    if(q?.task?.target_file_sha256!==corpus.target.hash||q?.task?.anchor_sha256!==sha(Buffer.from(anchor.line,'utf8')))throw new Error('B4_PRIOR_RECEIPT_TARGET_DRIFT');
    if(q?.sandbox!=='workspace-write'||q?.approval_policy!=='never')throw new Error('B4_PRIOR_RECEIPT_RUNTIME_POLICY_MISMATCH');
    if(q.status==='B4_FAIL')throw new Error('B4_PRIOR_RECEIPT_NOT_REUSABLE:'+q.status);

    const legacySingle=!Array.isArray(q.pairs)&&q.pair;
    const xs=Array.isArray(q.pairs)?q.pairs:(q.pair?[q.pair]:[]);
    if(!xs.length)throw new Error('B4_PRIOR_RECEIPT_HAS_NO_PAIR');

    for(let i=0;i<xs.length;i++){
      const x=structuredClone(xs[i]);
      const bin=safeNum(x?.baseline?.input_tokens),bt=safeNum(x?.baseline?.total_tokens);
      const cin=safeNum(x?.candidate?.input_tokens),ct=safeNum(x?.candidate?.total_tokens);
      const inputReduction=Number.isFinite(x?.input_reduction_ratio)?x.input_reduction_ratio:ratio(bin,cin);
      const totalReduction=Number.isFinite(x?.total_reduction_ratio)?x.total_reduction_ratio:ratio(bt,ct);

      let quality=typeof x?.quality_preserved==='boolean'?x.quality_preserved:null;
      if(quality===null&&typeof x?.baseline?.quality==='boolean'&&typeof x?.candidate?.quality==='boolean')quality=x.baseline.quality&&x.candidate.quality;
      if(quality===null&&legacySingle&&typeof q?.result?.quality_preserved==='boolean')quality=q.result.quality_preserved;

      let telemetry=typeof x?.telemetry_verified==='boolean'?x.telemetry_verified:null;
      if(telemetry===null&&typeof x?.baseline?.telemetry_verified==='boolean'&&typeof x?.candidate?.telemetry_verified==='boolean')telemetry=x.baseline.telemetry_verified&&x.candidate.telemetry_verified;
      if(telemetry===null&&legacySingle&&typeof q?.result?.telemetry_verified==='boolean')telemetry=q.result.telemetry_verified;

      let identical=typeof x?.identical_diff==='boolean'?x.identical_diff:null;
      const bd=x?.baseline?.edit?.diff_sha256,cd=x?.candidate?.edit?.diff_sha256;
      if(identical===null&&bd&&cd)identical=bd===cd;
      if(identical===null&&legacySingle&&typeof q?.result?.identical_diff==='boolean')identical=q.result.identical_diff;

      const key=[x?.baseline?.run_id??'',x?.candidate?.run_id??''].join('|');
      const reusable=key!=='|'&&inputReduction!==null&&totalReduction!==null&&quality===true&&telemetry===true&&identical===true;
      if(!reusable)continue;
      if(seen.has(key))continue;
      seen.add(key);
      accepted.push({
        ...x,
        run:accepted.length+1,
        input_reduction_ratio:inputReduction,
        total_reduction_ratio:totalReduction,
        quality_preserved:true,
        telemetry_verified:true,
        identical_diff:true,
        reused:true
      });
    }
  }

  if(!accepted.length)throw new Error('B4_PRIOR_RECEIPTS_HAVE_NO_REUSABLE_PAIRS');
  return accepted;
}

if(runs===0&&!priorReceiptArgs.length)throw new Error('B4_RUNS_ZERO_REQUIRES_PRIOR_RECEIPT');
const corpus=selectCorpus();
const anchor=anchorFor(corpus.target.text);
const broad=corpus.files.map(f=>'FILE: '+f.rel+'\n'+f.text).join('\n\n---\n\n');
const targeted=['TARGET FILE: '+targetRel,'TARGET SHA256: '+corpus.target.hash,'FILE CONTENT:',corpus.target.text].join('\n');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-b4-e2e-'));
let baselineWt=null,candidateWt=null,source=null;
try{
  source=prepareExecutionRepository(temp,corpus);

  console.log('\nB4 real software-engineering task');
  console.log('  source mode          : '+source.mode);
  console.log('  execution HEAD       : '+source.head);
  console.log('  safe eligible files : '+corpus.all.length);
  console.log('  baseline files      : '+corpus.files.length);
  console.log('  candidate files     : 1');
  console.log('  target file         : '+targetRel);
  console.log('  anchor content      : NOT STORED');
  console.log('  source folder       : READ_ONLY');
  console.log('  model               : '+(model||'DEFAULT_UNREPORTED'));
  console.log('  reasoning effort    : '+(reasoningEffort||'DEFAULT_UNREPORTED'));
  console.log('  sandbox             : workspace-write');
  console.log('  approvals           : never');

  const bp=promptFor('REAL_PROJECT_BROAD_CONTEXT',broad,anchor);
  const cp=promptFor('ALEDEVOS_TARGETED_CONTEXT',targeted,anchor);
  const reused=loadPriorPairs({corpus,anchor});
  const pairs=[...reused];

  for(let i=1;i<=runs;i++){
    const pairNumber=reused.length+i,totalRuns=reused.length+runs;
    baselineWt=addWorktree(temp,'baseline-'+pairNumber,source.head);
    candidateWt=addWorktree(temp,'candidate-'+pairNumber,source.head);

    console.log('\n[B4 '+pairNumber+'/'+totalRuns+'] real software-engineering pair');
    let br,bv,bt,cr,cv,ct;
    if(pairNumber%2===1){
      console.log('  Baseline first');
      br=codex(baselineWt,bp); bv=verifyEdit(baselineWt,anchor); bt=telemetry('REAL_PROJECT_BROAD_CONTEXT',br,bv,bp);
      cr=codex(candidateWt,cp); cv=verifyEdit(candidateWt,anchor); ct=telemetry('ALEDEVOS_TARGETED_CONTEXT',cr,cv,cp);
    }else{
      console.log('  Candidate first (order balancing)');
      cr=codex(candidateWt,cp); cv=verifyEdit(candidateWt,anchor); ct=telemetry('ALEDEVOS_TARGETED_CONTEXT',cr,cv,cp);
      br=codex(baselineWt,bp); bv=verifyEdit(baselineWt,anchor); bt=telemetry('REAL_PROJECT_BROAD_CONTEXT',br,bv,bp);
    }
    console.log('  baseline edit='+(bv.pass?'PASS':'FAIL')+' response='+(bt.responseOk?'PASS':'FAIL')+' input='+(bt.summary?.totals?.input_tokens??'null')+' tools='+(bt.summary?.totals?.tool_calls??'null'));
    if(bt.diagnostic)console.log('  baseline diagnostic='+bt.diagnostic);
    console.log('  candidate edit='+(cv.pass?'PASS':'FAIL')+' response='+(ct.responseOk?'PASS':'FAIL')+' input='+(ct.summary?.totals?.input_tokens??'null')+' tools='+(ct.summary?.totals?.tool_calls??'null'));
    if(ct.diagnostic)console.log('  candidate diagnostic='+ct.diagnostic);

    const bin=safeNum(bt.summary?.totals?.input_tokens),bout=safeNum(bt.summary?.totals?.output_tokens);
    const cin=safeNum(ct.summary?.totals?.input_tokens),cout=safeNum(ct.summary?.totals?.output_tokens);
    const btotal=bin!==null&&bout!==null?bin+bout:null,ctotal=cin!==null&&cout!==null?cin+cout:null;
    const rin=ratio(bin,cin),rt=ratio(btotal,ctotal);
    const sameDiff=bv.diff_sha256===cv.diff_sha256;
    const pair={
      run:pairNumber,
      baseline:{run_id:bt.run_id,input_tokens:bin,total_tokens:btotal,tool_calls:bt.summary?.totals?.tool_calls??null,files_read:bt.summary?.totals?.files_read??null,diagnostic:bt.diagnostic,quality:bt.quality,telemetry_verified:bt.verified,edit:bv},
      candidate:{run_id:ct.run_id,input_tokens:cin,total_tokens:ctotal,tool_calls:ct.summary?.totals?.tool_calls??null,files_read:ct.summary?.totals?.files_read??null,diagnostic:ct.diagnostic,quality:ct.quality,telemetry_verified:ct.verified,edit:cv},
      input_reduction_ratio:rin,total_reduction_ratio:rt,identical_diff:sameDiff,
      quality_preserved:bt.quality&&ct.quality,telemetry_verified:bt.verified&&ct.verified,reused:false
    };
    pairs.push(pair);
    console.log('  input saving='+pct(rin)+' | total saving='+pct(rt)+' | identical diff='+sameDiff);

    cleanupWorktree(baselineWt);baselineWt=null;
    cleanupWorktree(candidateWt);candidateWt=null;
  }

  const med=xs=>{const a=[...xs].sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};
  const inputRatios=pairs.map(x=>x.input_reduction_ratio??ratio(x.baseline?.input_tokens,x.candidate?.input_tokens)).filter(Number.isFinite);
  const totalRatios=pairs.map(x=>x.total_reduction_ratio??ratio(x.baseline?.total_tokens,x.candidate?.total_tokens)).filter(Number.isFinite);
  const rin=med(inputRatios),rt=med(totalRatios);
  const quality=pairs.every(x=>(x.quality_preserved??(x.baseline?.quality&&x.candidate?.quality))===true);
  const telem=pairs.every(x=>(x.telemetry_verified??(x.baseline?.telemetry_verified&&x.candidate?.telemetry_verified))===true);
  const sameDiff=pairs.every(x=>(x.identical_diff??(x.baseline?.edit?.diff_sha256===x.candidate?.edit?.diff_sha256))===true);
  const sourceUntouched=verifySourceUntouched(source);
  const measured=inputRatios.length===pairs.length&&totalRatios.length===pairs.length;
  let status='B4_PASS',reasons=[];
  if(!telem||!measured){status='B4_INCOMPARABLE';reasons.push('MEASUREMENT_INCOMPLETE')}
  else if(!quality||!sameDiff){status='B4_FAIL';reasons.push('QUALITY_OR_DIFF_NOT_PRESERVED')}
  else if(!sourceUntouched){status='B4_FAIL';reasons.push('SOURCE_REPOSITORY_MUTATED')}
  const validationLevel=pairs.length>=3&&status==='B4_PASS'?'VALIDATED':'PRELIMINARY';

  const receipt={schema_version:'1.0',benchmark:'B4_REAL_SOFTWARE_ENGINEERING_E2E',benchmark_key:KEY,status,validation_level:validationLevel,
    scope:'REAL_PROJECT_ISOLATED_EDIT_E2E',
    claim_boundary:'Measures one deterministic non-functional edit on real project code in isolated worktrees. Non-Git source folders are first frozen into an ephemeral Git snapshot without modifying the source. It validates locate/edit/diff verification efficiency, not arbitrary feature-development quality or a universal savings percentage.',
    runtime:'codex',model:model||null,reasoning_effort:reasoningEffort||null,sandbox:'workspace-write',approval_policy:'never',model_comparability:model?'EXPLICIT_SAME_MODEL':'DEFAULT_MODEL_UNREPORTED',reasoning_comparability:reasoningEffort?'EXPLICIT_SAME_REASONING_EFFORT':'DEFAULT_REASONING_UNREPORTED',
    repository:{absolute_path_stored:false,source_mode:source.mode,execution_head:source.head,source_untouched:sourceUntouched,source_digest:source.source_digest,corpus_digest:corpus.digest,safe_eligible_files:corpus.all.length,baseline_files:corpus.files.length,candidate_files:1},
    task:{target_file_sha256:corpus.target.hash,target_path_stored:false,anchor_sha256:sha(Buffer.from(anchor.line,'utf8')),anchor_content_stored:false,marker:MARKER,expected_diff_added_lines:1,expected_diff_deleted_lines:0},
    runs:pairs.length,reused_prior_pairs:reused.length,prior_receipts_merged:priorReceiptArgs.length,newly_executed_pairs:runs,
    result:{median_input_reduction_pct:rin===null?null:Math.round(rin*10000)/100,median_total_reduction_pct:rt===null?null:Math.round(rt*10000)/100,quality_preserved:quality,identical_diff:sameDiff,telemetry_verified:telem,source_repository_untouched:sourceUntouched},
    pairs,
    reasons};
  receipt.integrity={algorithm:'sha256',payload_sha256:sha(Buffer.from(JSON.stringify(receipt),'utf8'))};
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const out=path.join(runtimeProject,'.aledevos','state','efficiency','benchmarks','b4-real-software-engineering-'+stamp+'.json');
  write(out,receipt);

  console.log('\n============================================================');
  console.log(' ALEDEVOS B4 - REAL SOFTWARE-ENGINEERING E2E');
  console.log('============================================================');
  console.log('Status                    : '+status);
  console.log('Validation                : '+validationLevel);
  console.log('Runs total                : '+pairs.length);
  console.log('Prior pairs reused        : '+reused.length);
  console.log('Prior receipts merged     : '+priorReceiptArgs.length);
  console.log('New pairs executed        : '+runs);
  console.log('Input saving median       : '+pct(rin));
  console.log('Total saving median       : '+pct(rt));
  console.log('Identical verified diff   : '+sameDiff);
  console.log('Quality preserved         : '+quality);
  console.log('Telemetry verified        : '+telem);
  console.log('Source repository intact  : '+sourceUntouched);
  console.log('Model                     : '+(model||'DEFAULT_UNREPORTED'));
  console.log('Reasoning effort          : '+(reasoningEffort||'DEFAULT_UNREPORTED'));
  console.log('Receipt                   : '+norm(path.relative(runtimeProject,out)));
  if(reasons.length)console.log('Reasons                   : '+reasons.join(', '));
  console.log('\n'+status);
  process.exitCode=status==='B4_PASS'?0:status==='B4_INCOMPARABLE'?5:7;
} finally {
  cleanupWorktree(baselineWt);
  cleanupWorktree(candidateWt);
  try{fs.rmSync(temp,{recursive:true,force:true})}catch{}
  if(executionRepo&&fs.existsSync(executionRepo))git(['worktree','prune'],executionRepo,{allow:true});
}
