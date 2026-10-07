#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseCodexJsonl,encodeWindowsTransportArg} from '../core/agent-runtime/agent-runtime.mjs';
import {startTaskTelemetry,emitAgentCallTelemetry,finishTaskTelemetry} from '../core/engine/telemetry-bridge.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const a=process.argv.slice(2);
const take=(f,d=null)=>{const i=a.indexOf(f);return i>=0&&i+1<a.length?a[i+1]:d};
const project=path.resolve(take('--project',''));
const corpusProject=path.resolve(take('--corpus-project',project));
const timeoutMs=Math.max(10000,Number(take('--timeout-ms','180000'))||180000);
const runs=Math.max(1,Math.min(5,Number(take('--runs','1'))||1));
const priorReceiptArg=take('--prior-receipt',null);
const model=take('--model',null);
if(!project||!fs.existsSync(path.join(project,'.aledevos','project.json')))throw new Error('B3_ALEDEVOS_PROJECT_REQUIRED');
if(!fs.existsSync(path.join(project,'.codex','config.toml')))throw new Error('B3_CODEX_ADAPTER_NOT_INSTALLED');
if(!fs.existsSync(corpusProject)||!fs.statSync(corpusProject).isDirectory())throw new Error('B3_CORPUS_PROJECT_NOT_FOUND:'+corpusProject);

const policy=JSON.parse(fs.readFileSync(path.join(root,'efficiency','policies','efficiency-policy.json'),'utf8'));
const targetIn=Number(policy.profiles.MICRO.input_token_reduction_target);
const targetTotal=Number(policy.profiles.MICRO.total_token_reduction_target);
const TASK='B3-REAL-PROJECT-RETRIEVAL',KEY='B3_REAL_PROJECT_RETRIEVAL_V1';
const EXT=new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.py','.ps1','.psm1','.json','.toml','.yaml','.yml','.md','.css','.scss','.html','.sql','.sh','.bat','.cmd','.java','.go','.rs','.cs','.cpp','.c','.h','.hpp']);
const DIR=new Set(['.git','.aledevos','.codex','.claude','.agents','.opencode','node_modules','dist','build','coverage','.next','.cache','vendor','target','.venv','venv','__pycache__','.idea','.vscode']);
const BADNAME=[/^\.env(?:\.|$)/i,/\.pem$/i,/\.key$/i,/\.p12$/i,/\.pfx$/i,/^id_rsa/i,/^id_ed25519/i,/credentials?/i,/secrets?/i,/lock/i,/^auth\.json$/i,/^\.npmrc$/i,/^\.pypirc$/i];
const SECRET=/(password|passwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|client[_-]?secret)\s*[:=]\s*(?:["'][^"']{4,}["']|[^\s#]{8,})|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{20,}\b|\bsk-[A-Za-z0-9]{20,}\b/i;
const MAXFILE=96*1024,MAXFILES=20,MAXBYTES=160*1024,MINFILES=5;

const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const norm=p=>p.replaceAll('\\','/');
const safeNum=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
const ratio=(b,c)=>typeof b==='number'&&typeof c==='number'&&b>0?(b-c)/b:null;
const pct=v=>v===null?'n/a':(Math.round(v*10000)/100)+'%';
const median=xs=>{const a=[...xs].sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n','utf8')};

function walk(dir,out=[]){
  for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((x,y)=>x.name.localeCompare(y.name))){
    if(e.isSymbolicLink())continue;
    const p=path.join(dir,e.name);
    if(e.isDirectory()){if(!DIR.has(e.name))walk(p,out);continue}
    if(!e.isFile()||BADNAME.some(r=>r.test(e.name))||!EXT.has(path.extname(e.name).toLowerCase()))continue;
    const st=fs.statSync(p);if(!st.size||st.size>MAXFILE)continue;
    const b=fs.readFileSync(p);if(b.includes(0))continue;
    const text=b.toString('utf8').replace(/^\uFEFF/,'');if(SECRET.test(text))continue;
    out.push({rel:norm(path.relative(corpusProject,p)),text,bytes:b.length,hash:sha(b)});
  }
  return out;
}
function good(line){
  const s=line.trim();
  return s.length>=24&&s.length<=180&&/[A-Za-z]{6}/.test(s)&&!SECRET.test(s)&&!/^https?:\/\//i.test(s)&&!/^(\s|[{}[\]();,.'"])+$/.test(s);
}
function corpus(){
  const eligible=walk(corpusProject),files=[];let bytes=0;
  for(const f of eligible){if(files.length>=MAXFILES)break;if(bytes+f.bytes>MAXBYTES)continue;files.push(f);bytes+=f.bytes}
  if(files.length<MINFILES)throw Object.assign(new Error('B3_INSUFFICIENT_REAL_PROJECT_CORPUS: eligible='+eligible.length+' selected='+files.length+' required='+MINFILES),{blocked:true});
  const count=new Map();
  for(const f of files)for(const l of new Set(f.text.split(/\r?\n/).map(x=>x.trim()).filter(good)))count.set(l,(count.get(l)||0)+1);
  let pick=null;
  for(const f of files){
    const ls=f.text.split(/\r?\n/);
    for(let i=0;i<ls.length;i++){
      const l=ls[i].trim();if(!good(l)||count.get(l)!==1)continue;
      const score=(/\b(export|const|let|function|class|def|interface|type|enum)\b/.test(l)?10:0)+Math.min(4,Math.floor(l.length/40));
      if(!pick||score>pick.score)pick={f,line:l,n:i+1,score,lines:ls};
    }
  }
  if(!pick)throw Object.assign(new Error('B3_NO_SAFE_UNIQUE_REAL_MARKER'),{blocked:true});
  const snippet=pick.lines.slice(Math.max(0,pick.n-3),Math.min(pick.lines.length,pick.n+2)).join('\n');
  return {eligible,files,pick,snippet,digest:sha(Buffer.from(files.map(f=>f.rel+'\0'+f.hash).join('\n'),'utf8'))};
}
function priorPairs(c,targetHash){
  if(!priorReceiptArg)return [];
  const base=path.resolve(project),rp=path.resolve(project,priorReceiptArg);
  if(rp!==base&&!rp.startsWith(base+path.sep))throw new Error('B3_PRIOR_RECEIPT_OUTSIDE_RUNTIME_PROJECT');
  if(!fs.existsSync(rp))throw new Error('B3_PRIOR_RECEIPT_NOT_FOUND:'+rp);
  const q=JSON.parse(fs.readFileSync(rp,'utf8'));
  if(q?.schema_version!=='1.0'||q?.benchmark!=='B3_REAL_PROJECT_RETRIEVAL'||q?.benchmark_key!==KEY)throw new Error('B3_PRIOR_RECEIPT_INCOMPATIBLE');
  const copy=structuredClone(q),h=copy?.integrity?.payload_sha256??null;delete copy.integrity;
  if(!h||sha(Buffer.from(JSON.stringify(copy),'utf8'))!==h)throw new Error('B3_PRIOR_RECEIPT_INTEGRITY_INVALID');
  if(q?.project?.corpus_digest!==c.digest)throw new Error('B3_PRIOR_RECEIPT_CORPUS_DRIFT');
  if(q?.target?.file!==c.pick.f.rel||q?.target?.line_sha256!==targetHash)throw new Error('B3_PRIOR_RECEIPT_TARGET_DRIFT');
  if(q.status==='B3_FAIL'||q.status==='B3_INCOMPARABLE')throw new Error('B3_PRIOR_RECEIPT_NOT_REUSABLE:'+q.status);
  const xs=Array.isArray(q.pairs)?q.pairs:(q.pair?[q.pair]:[]);
  if(!xs.length)throw new Error('B3_PRIOR_RECEIPT_HAS_NO_PAIR');
  return xs.map((x,i)=>({...x,run:x.run??(i+1),reused:true}));
}
function launch(prompt){
  const args=['exec','--json','--skip-git-repo-check'];if(model)args.push('--model',model);args.push('-');
  let exe='codex',final=args;
  if(process.platform==='win32'){
    const launcher=path.join(root,'core','agent-runtime','windows-cli-launcher.ps1');
    const enc=['codex',...args].map(encodeWindowsTransportArg);
    exe='powershell.exe';final=['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',launcher,...enc];
  }
  const t=Date.now(),r=spawnSync(exe,final,{cwd:project,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024,timeout:timeoutMs,input:prompt});
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
function runLeg(label,prompt,expected,filesRead,bytesRead){
  const start=startTaskTelemetry({cwd:project,taskId:TASK,adapter:'codex',benchmarkKey:KEY,model,profile:label});
  if(!start.ok)throw new Error('B3_TELEMETRY_START_FAILED');
  const raw=launch(prompt),parsed=parseCodexJsonl(raw.stdout||'');
  const exit=Number.isInteger(raw.status)?raw.status:(raw.error?.code==='ETIMEDOUT'?124:127);
  const ok=exit===0&&answer(raw.stdout||'')===expected;
  const ev=emitAgentCallTelemetry({cwd:project,runId:start.run_id,taskId:TASK,runtime:'codex',adapter:'codex',agent:'orchestrator',model:parsed.model||model||null,
    metrics:{input_tokens:parsed.input_tokens??null,output_tokens:parsed.output_tokens??null,context_tokens:null,duration_ms:raw.ms,generation_ms:null,tool_calls:parsed.tool_calls??0,files_read:filesRead,bytes_read:bytesRead},
    attributes:{benchmark_leg:label,call_status:exit===0?'COMPLETED':'FAILED',exit_code:exit,usage_source:parsed.usage_source??'unavailable',quality_exact_match:ok,raw_prompt_stored:false,raw_completion_stored:false,prompt_sha256:sha(Buffer.from(prompt,'utf8')),metric_scope:'repository_context_supplied_to_model'}});
  if(!ev.ok)throw new Error('B3_AGENT_TELEMETRY_FAILED');
  const fin=finishTaskTelemetry({cwd:project,runId:start.run_id,taskId:TASK,adapter:'codex',finalState:ok?'PASS':'FAILED'});
  if(!fin.ok)throw new Error('B3_TELEMETRY_FINALIZE_FAILED');
  return {exit,ok,parsed,summary:fin.summary,verified:fin.verification?.valid===true,run:start.run_id};
}

let c;
try{c=corpus()}catch(e){
  if(e.blocked){console.log('B3_BLOCKED\n'+e.message);process.exit(5)}throw e;
}
const targetLine=c.pick.line,targetHash=sha(Buffer.from(targetLine,'utf8')),expected='B3_FILE='+c.pick.f.rel+';STATUS=PASS';
const broad=c.files.map(f=>'FILE: '+f.rel+'\n'+f.text).join('\n\n---\n\n');
const targeted=['DETERMINISTIC REPOSITORY RETRIEVAL RESULT','FILE: '+c.pick.f.rel,'LINE: '+c.pick.n,'MATCH_SHA256: '+targetHash,'TARGETED EXCERPT:',c.snippet].join('\n');
const prompt=(label,ctx,n)=>[
  'ALEDEVOS B3 REAL-PROJECT READ-ONLY BENCHMARK.',
  'Do not use tools, shell, network, repository access, or prior knowledge.',
  'Use only the supplied repository context.',
  'CONTEXT_MODE: '+label,
  'CONTEXT_FILES_SUPPLIED: '+n,
  'TARGET SOURCE LINE: '+targetLine,
  'TASK: Identify which supplied repository file contains TARGET SOURCE LINE exactly.',
  'QUALITY CONTRACT: Reply exactly "'+expected+'" and nothing else.',
  '',
  'REPOSITORY CONTEXT:',
  ctx
].join('\n');

const bbytes=Buffer.byteLength(broad,'utf8'),cbytes=Buffer.byteLength(targeted,'utf8');
console.log('\nB3 real corpus');
console.log('  runtime project      : '+project);
console.log('  corpus project       : '+corpusProject);
console.log('  eligible safe files : '+c.eligible.length);
console.log('  baseline files      : '+c.files.length);
console.log('  baseline bytes      : '+bbytes);
console.log('  candidate files     : 1');
console.log('  candidate bytes     : '+cbytes);
console.log('  corpus digest       : '+c.digest.slice(0,16)+'...');
console.log('  target file         : '+c.pick.f.rel);
console.log('  target line content : NOT STORED');

const reused=priorPairs(c,targetHash);
const pairs=[...reused];
for(let i=1;i<=runs;i++){
  const pairNumber=reused.length+i,totalTargetRuns=reused.length+runs;
  console.log('\n[B3 '+pairNumber+'/'+totalTargetRuns+'] real repository pair');
  let base,cand;
  if(pairNumber%2===1){
    base=runLeg('REAL_PROJECT_BROAD_CONTEXT',prompt('REAL_PROJECT_BROAD_CONTEXT',broad,c.files.length),expected,c.files.length,bbytes);
    cand=runLeg('ALEDEVOS_TARGETED_RETRIEVAL',prompt('ALEDEVOS_TARGETED_RETRIEVAL',targeted,1),expected,1,cbytes);
  }else{
    console.log('  Candidate first (order balancing)');
    cand=runLeg('ALEDEVOS_TARGETED_RETRIEVAL',prompt('ALEDEVOS_TARGETED_RETRIEVAL',targeted,1),expected,1,cbytes);
    base=runLeg('REAL_PROJECT_BROAD_CONTEXT',prompt('REAL_PROJECT_BROAD_CONTEXT',broad,c.files.length),expected,c.files.length,bbytes);
  }
  const bin=safeNum(base.summary?.totals?.input_tokens),bout=safeNum(base.summary?.totals?.output_tokens);
  const cin=safeNum(cand.summary?.totals?.input_tokens),cout=safeNum(cand.summary?.totals?.output_tokens);
  const bt=bin!==null&&bout!==null?bin+bout:null,ct=cin!==null&&cout!==null?cin+cout:null;
  const rin=ratio(bin,cin),rt=ratio(bt,ct),rf=ratio(c.files.length,1),rb=ratio(bbytes,cbytes);
  const quality=base.ok&&cand.ok,telemetry=base.verified&&cand.verified;
  const pair={
    run:pairNumber,
    baseline:{run_id:base.run,input_tokens:bin,total_tokens:bt,files_supplied:c.files.length,context_bytes:bbytes,quality:base.ok,telemetry_verified:base.verified},
    candidate:{run_id:cand.run,input_tokens:cin,total_tokens:ct,files_supplied:1,context_bytes:cbytes,quality:cand.ok,telemetry_verified:cand.verified},
    input_reduction_ratio:rin,total_reduction_ratio:rt,file_reduction_ratio:rf,context_byte_reduction_ratio:rb,
    quality_preserved:quality,telemetry_verified:telemetry,reused:false
  };
  pairs.push(pair);
  console.log('  input saving='+pct(rin)+' | total saving='+pct(rt)+' | file-context saving='+pct(rf)+' | byte saving='+pct(rb));
}
const inputRatios=pairs.map(x=>x.input_reduction_ratio??ratio(x.baseline?.input_tokens,x.candidate?.input_tokens)).filter(Number.isFinite);
const totalRatios=pairs.map(x=>x.total_reduction_ratio??ratio(x.baseline?.total_tokens,x.candidate?.total_tokens)).filter(Number.isFinite);
const fileRatios=pairs.map(x=>x.file_reduction_ratio??ratio(x.baseline?.files_supplied,x.candidate?.files_supplied)).filter(Number.isFinite);
const byteRatios=pairs.map(x=>x.context_byte_reduction_ratio??ratio(x.baseline?.context_bytes,x.candidate?.context_bytes)).filter(Number.isFinite);
const rin=median(inputRatios),rt=median(totalRatios),rf=median(fileRatios),rb=median(byteRatios);
const quality=pairs.every(x=>(x.quality_preserved??(x.baseline?.quality&&x.candidate?.quality))===true);
const telemetry=pairs.every(x=>(x.telemetry_verified??(x.baseline?.telemetry_verified&&x.candidate?.telemetry_verified))!==false);
const measured=inputRatios.length===pairs.length&&totalRatios.length===pairs.length;
let status='B3_PASS',reasons=[];
if(!telemetry||!measured){status='B3_INCOMPARABLE';reasons.push('MEASUREMENT_INCOMPLETE')}
else if(!quality){status='B3_FAIL';reasons.push('QUALITY_NOT_PRESERVED')}
else if(rin<targetIn||rt<targetTotal){status='B3_BELOW_TARGET';if(rin<targetIn)reasons.push('INPUT_TARGET');if(rt<targetTotal)reasons.push('TOTAL_TARGET')}
const validationLevel=pairs.length>=3&&status==='B3_PASS'?'VALIDATED':'PRELIMINARY';

const receipt={schema_version:'1.0',benchmark:'B3_REAL_PROJECT_RETRIEVAL',benchmark_key:KEY,status,validation_level:validationLevel,scope:'REAL_PROJECT_READ_ONLY_RETRIEVAL',
  claim_boundary:'Measures broad real-project context versus deterministic targeted retrieval on one frozen safe corpus. Setup scanning is excluded from agent file-read metrics. Does not measure code-edit quality or establish a universal savings percentage.',
  runtime:'codex',model:model||null,model_comparability:model?'EXPLICIT_SAME_MODEL':'SAME_CODEX_RUNTIME_DEFAULT_MODEL_UNREPORTED',
  project:{runtime_path_stored:false,corpus_path_stored:false,runtime_equals_corpus:path.resolve(project)===path.resolve(corpusProject),eligible_safe_files:c.eligible.length,baseline_files:c.files.length,corpus_digest:c.digest,baseline_context_bytes:bbytes,candidate_context_bytes:cbytes},
  target:{file:c.pick.f.rel,line_number:c.pick.n,line_sha256:targetHash,line_content_stored:false},
  runs:pairs.length,reused_prior_pairs:reused.length,newly_executed_pairs:runs,
  result:{median_input_reduction_pct:rin===null?null:Math.round(rin*10000)/100,median_total_reduction_pct:rt===null?null:Math.round(rt*10000)/100,median_file_reduction_pct:rf===null?null:Math.round(rf*10000)/100,median_context_byte_reduction_pct:rb===null?null:Math.round(rb*10000)/100,quality_preserved:quality,telemetry_verified:telemetry,target_pass:status==='B3_PASS'},
  pairs,
  reasons};
receipt.integrity={algorithm:'sha256',payload_sha256:sha(Buffer.from(JSON.stringify(receipt),'utf8'))};
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const out=path.join(project,'.aledevos','state','efficiency','benchmarks','b3-real-project-retrieval-'+stamp+'.json');write(out,receipt);

console.log('\n============================================================');
console.log(' ALEDEVOS B3 - REAL PROJECT REPOSITORY EFFICIENCY');
console.log('============================================================');
console.log('Status                    : '+status);
console.log('Validation                : '+validationLevel);
console.log('Runs total                : '+pairs.length);
console.log('Prior pairs reused        : '+reused.length);
console.log('New pairs executed        : '+runs);
console.log('Baseline real files       : '+c.files.length);
console.log('Candidate relevant files  : 1');
console.log('Input saving median       : '+pct(rin));
console.log('Total saving median       : '+pct(rt));
console.log('File-context reduction    : '+pct(rf));
console.log('Context-byte reduction    : '+pct(rb));
console.log('Quality preserved         : '+quality);
console.log('Telemetry verified        : '+telemetry);
console.log('Model comparability       : '+receipt.model_comparability);
console.log('Receipt                   : '+norm(path.relative(project,out)));
if(reasons.length)console.log('Reasons                   : '+reasons.join(', '));
console.log('\n'+status);
process.exitCode=status==='B3_PASS'?0:status==='B3_BELOW_TARGET'?4:status==='B3_INCOMPARABLE'?5:7;
