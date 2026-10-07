#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  parseCodexJsonl,
  encodeWindowsTransportArg
} from '../core/agent-runtime/agent-runtime.mjs';
import {
  startTaskTelemetry,
  emitAgentCallTelemetry,
  finishTaskTelemetry
} from '../core/engine/telemetry-bridge.mjs';
import {compareTelemetrySummaries} from '../contextos/engine/telemetry.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const argv=process.argv.slice(2);
const take=(flag,def=null)=>{const i=argv.indexOf(flag);return i>=0&&i+1<argv.length?argv[i+1]:def};
const has=flag=>argv.includes(flag);
const runs=Math.max(1,Math.min(9,Number(take('--runs','1'))||1));
const timeoutMs=Math.max(10000,Math.min(900000,Number(take('--timeout-ms','180000'))||180000));
const explicitModel=take('--model',null);
const projectArg=take('--project',null);
if(!projectArg)throw new Error('B1_PROJECT_REQUIRED: use --project <AleDevOS consumer project>');
const project=path.resolve(projectArg);
if(!fs.existsSync(path.join(project,'.aledevos','project.json')))throw new Error('B1_ALEDEVOS_PROJECT_NOT_FOUND:'+project);
if(!fs.existsSync(path.join(project,'.codex','config.toml')))throw new Error('B1_CODEX_ADAPTER_NOT_INSTALLED:'+project);
const benchmarkKey='B1_CONTEXT_PRUNING_V1';
const taskId='B1-CONTEXT-PRUNING';
const expected='RETRY_BACKOFF_MS=2750';
const policy=JSON.parse(fs.readFileSync(path.join(root,'efficiency','policies','efficiency-policy.json'),'utf8'));
const micro=policy.profiles.MICRO;
const inputTarget=Number(micro.input_token_reduction_target);
const totalTarget=Number(micro.total_token_reduction_target);

function sha(s){return crypto.createHash('sha256').update(String(s)).digest('hex')}
function median(xs){const a=[...xs].sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function ratio(base,cand){return typeof base==='number'&&typeof cand==='number'&&base>0?(base-cand)/base:null}
function pct(x){return x===null?null:Math.round(x*10000)/100}
function safeNumber(v){return typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null}
function writeJson(p,v){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n','utf8')}

function fixtureContext(){
  const relevant=[
    'FILE: config/runtime-settings.mjs',
    'export const REQUEST_TIMEOUT_MS = 12000;',
    'export const RETRY_BACKOFF_MS = 2750;',
    'export const MAX_RETRIES = 4;',
    'export const CIRCUIT_BREAKER_WINDOW_MS = 30000;',
    ''
  ].join('\n');

  const decoys=[];
  for(let i=1;i<=24;i++){
    const lines=[`FILE: src/domain-${String(i).padStart(2,'0')}.mjs`];
    for(let j=1;j<=28;j++){
      lines.push(`export const DOMAIN_${i}_SETTING_${j} = ${1000+i*37+j}; // unrelated deterministic fixture`);
    }
    decoys.push(lines.join('\n'));
  }
  return {relevant,full:[relevant,...decoys].join('\n\n'),file_count:25};
}

function promptFor(context,label,fileCount){
  return [
    'TASK: Determine the configured retry backoff in milliseconds.',
    `QUALITY CONTRACT: Reply exactly "${expected}" and nothing else.`,
    'Do not use tools. Use only the supplied CONTEXT.',
    `CONTEXT MODE: ${label}`,
    `CONTEXT FILES: ${fileCount}`,
    '',
    'CONTEXT',
    context
  ].join('\n');
}

function launcherArgs(executable,args){
  const launcher=path.join(root,'core','agent-runtime','windows-cli-launcher.ps1');
  const encoded=[executable,...args].map(encodeWindowsTransportArg);
  return ['powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',launcher,...encoded]];
}

function runCodex(cwd,prompt){
  const args=['exec','--json','--skip-git-repo-check'];
  if(explicitModel)args.push('--model',explicitModel);
  // Codex supports "-" as the prompt source. Keep large benchmark context off
  // argv so Windows/Base64 transport limits cannot invalidate the comparison.
  args.push('-');
  const [exe,finalArgs]=process.platform==='win32'?launcherArgs('codex',args):['codex',args];
  const started=Date.now();
  const result=spawnSync(exe,finalArgs,{
    cwd,
    encoding:'utf8',
    windowsHide:true,
    maxBuffer:32*1024*1024,
    timeout:timeoutMs,
    input:prompt
  });
  result.aledevos_duration_ms=Math.max(0,Date.now()-started);
  return result;
}

function extractAnswer(text){
  let answer=null;
  for(const line of String(text||'').split(/\r?\n/)){
    const s=line.trim(); if(!s)continue;
    let row; try{row=JSON.parse(s)}catch{continue}
    const item=row?.item??null;
    if(item&&String(item.type||'').toLowerCase()==='agent_message'){
      const v=item.text??item.message??item.content;
      if(typeof v==='string')answer=v.trim();
      else if(Array.isArray(v)){
        const parts=v.map(x=>typeof x==='string'?x:(x?.text??x?.content??'')).filter(Boolean);
        if(parts.length)answer=parts.join('').trim();
      }
    }
    if(row?.type==='message'&&row?.role==='assistant'&&typeof row?.content==='string')answer=row.content.trim();
  }
  return answer;
}

function safeDiag(result){
  const stderr=String(result.stderr||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,3).join(' | ');
  return stderr.replace(/[^A-Za-z0-9 ._:/-]/g,'_').slice(0,300)||null;
}

function emitMeasuredRun({cwd,label,prompt,result}){
  const parsed=parseCodexJsonl(result.stdout||'');
  const exitCode=Number.isInteger(result.status)?result.status:(result.error?.code==='ETIMEDOUT'?124:127);
  const callStatus=exitCode===0?'COMPLETED':result.error?.code==='ETIMEDOUT'?'TIMED_OUT':'FAILED';
  const answer=extractAnswer(result.stdout||'');
  const quality=callStatus==='COMPLETED'&&answer===expected;
  const model=parsed.model||explicitModel||null;
  const started=startTaskTelemetry({cwd,taskId,adapter:'codex',benchmarkKey,model,profile:label});
  if(!started.ok)throw new Error(`TELEMETRY_START_FAILED:${started.error||'unknown'}`);
  const metrics={
    input_tokens:parsed.input_tokens??null,
    output_tokens:parsed.output_tokens??null,
    context_tokens:null,
    duration_ms:safeNumber(result.aledevos_duration_ms),
    generation_ms:null,
    tool_calls:parsed.tool_calls??0,
    files_read:parsed.files_read??0,
    bytes_read:null
  };
  const ev=emitAgentCallTelemetry({
    cwd,runId:started.run_id,taskId,runtime:'codex',adapter:'codex',agent:'orchestrator',model,
    metrics,
    attributes:{
      call_status:callStatus,
      exit_code:exitCode,
      usage_status:(metrics.input_tokens!==null||metrics.output_tokens!==null)?'REPORTED':'UNAVAILABLE',
      usage_source:parsed.usage_source??'unavailable',
      benchmark_leg:label,
      raw_prompt_stored:false,
      raw_completion_stored:false,
      prompt_sha256:sha(prompt),
      quality_exact_match:quality
    }
  });
  if(!ev.ok)throw new Error(`TELEMETRY_AGENT_CALL_FAILED:${ev.error||'unknown'}`);
  const fin=finishTaskTelemetry({cwd,runId:started.run_id,taskId,adapter:'codex',finalState:quality?'PASS':'FAILED'});
  if(!fin.ok)throw new Error(`TELEMETRY_FINALIZE_FAILED:${fin.error||'unknown'}`);
  return {parsed,exitCode,callStatus,answer,quality,model,summary:fin.summary,verification:fin.verification,runId:started.run_id,diagnostic:safeDiag(result)};
}

const fixture=fixtureContext();
const baselinePrompt=promptFor(fixture.full,'BASELINE_FULL_CONTEXT',fixture.file_count);
const candidatePrompt=promptFor(fixture.relevant,'ALEDEVOS_RELEVANT_CONTEXT',1);
const pairs=[];

try{
  for(let i=1;i<=runs;i++){
    process.stdout.write(`\n[B1 ${i}/${runs}] Baseline full-context call...\n`);
    const bRaw=runCodex(project,baselinePrompt);
    const baseline=emitMeasuredRun({cwd:project,label:'BASELINE_FULL_CONTEXT',prompt:baselinePrompt,result:bRaw});

    process.stdout.write(`[B1 ${i}/${runs}] Candidate relevant-context call...\n`);
    const cRaw=runCodex(project,candidatePrompt);
    const candidate=emitMeasuredRun({cwd:project,label:'ALEDEVOS_RELEVANT_CONTEXT',prompt:candidatePrompt,result:cRaw});

    const cmp=compareTelemetrySummaries({baseline:baseline.summary,candidate:candidate.summary});
    const bin=safeNumber(baseline.summary?.totals?.input_tokens);
    const bout=safeNumber(baseline.summary?.totals?.output_tokens);
    const cin=safeNumber(candidate.summary?.totals?.input_tokens);
    const cout=safeNumber(candidate.summary?.totals?.output_tokens);
    const btotal=bin!==null&&bout!==null?bin+bout:null;
    const ctotal=cin!==null&&cout!==null?cin+cout:null;
    const inputReduction=ratio(bin,cin);
    const totalReduction=ratio(btotal,ctotal);
    pairs.push({
      run:i,
      baseline:{run_id:baseline.runId,exit_code:baseline.exitCode,call_status:baseline.callStatus,usage_source:baseline.parsed.usage_source??null,input_tokens:bin,output_tokens:bout,total_tokens:btotal,quality:baseline.quality,model:baseline.model,telemetry_verified:baseline.verification?.valid===true,diagnostic:baseline.diagnostic},
      candidate:{run_id:candidate.runId,exit_code:candidate.exitCode,call_status:candidate.callStatus,usage_source:candidate.parsed.usage_source??null,input_tokens:cin,output_tokens:cout,total_tokens:ctotal,quality:candidate.quality,model:candidate.model,telemetry_verified:candidate.verification?.valid===true,diagnostic:candidate.diagnostic},
      input_reduction_ratio:inputReduction,
      total_reduction_ratio:totalReduction,
      telemetry_comparable:cmp.comparable===true
    });
    process.stdout.write(`  baseline exit=${baseline.exitCode} status=${baseline.callStatus} usage=${baseline.parsed.usage_source??'unavailable'} input=${bin ?? 'null'} total=${btotal ?? 'null'} quality=${baseline.quality?'PASS':'FAIL'}\n`);
    if(baseline.diagnostic)process.stdout.write(`  baseline diagnostic=${baseline.diagnostic}\n`);
    process.stdout.write(`  candidate exit=${candidate.exitCode} status=${candidate.callStatus} usage=${candidate.parsed.usage_source??'unavailable'} input=${cin ?? 'null'} total=${ctotal ?? 'null'} quality=${candidate.quality?'PASS':'FAIL'}\n`);
    if(candidate.diagnostic)process.stdout.write(`  candidate diagnostic=${candidate.diagnostic}\n`);
    process.stdout.write(`  input saving=${inputReduction===null?'n/a':pct(inputReduction)+'%'} | total saving=${totalReduction===null?'n/a':pct(totalReduction)+'%'}\n`);
  }

  const inputRatios=pairs.map(x=>x.input_reduction_ratio).filter(x=>typeof x==='number');
  const totalRatios=pairs.map(x=>x.total_reduction_ratio).filter(x=>typeof x==='number');
  const medInput=median(inputRatios),medTotal=median(totalRatios);
  const runtimePass=pairs.every(x=>x.baseline.exit_code===0&&x.candidate.exit_code===0);
  const qualityPass=pairs.every(x=>x.baseline.quality&&x.candidate.quality);
  const telemetryPass=pairs.every(x=>x.baseline.telemetry_verified&&x.candidate.telemetry_verified&&x.telemetry_comparable);
  const measured=inputRatios.length===runs&&totalRatios.length===runs;
  const targetPass=measured&&medInput>=inputTarget&&medTotal>=totalTarget;

  let status='B1_PASS';
  const reasons=[];
  if(!runtimePass){status='B1_INCOMPARABLE';reasons.push('RUNTIME_CALL_NOT_COMPLETED')}
  else if(!telemetryPass||!measured){status='B1_INCOMPARABLE';reasons.push('TELEMETRY_OR_TOKEN_MEASUREMENT_INCOMPLETE')}
  else if(!qualityPass){status='B1_FAIL';reasons.push('QUALITY_NOT_PRESERVED')}
  else if(!targetPass){status='B1_BELOW_TARGET';if(medInput<inputTarget)reasons.push('INPUT_TOKEN_REDUCTION_BELOW_MICRO_TARGET');if(medTotal<totalTarget)reasons.push('TOTAL_TOKEN_REDUCTION_BELOW_MICRO_TARGET')}

  const modelValues=[...new Set(pairs.flatMap(x=>[x.baseline.model,x.candidate.model]).filter(Boolean))];
  const modelComparability=modelValues.length===1?'EXPLICIT_OR_REPORTED_SAME_MODEL':modelValues.length===0?'SAME_CODEX_RUNTIME_DEFAULT_MODEL_UNREPORTED':'MODEL_IDENTITY_MISMATCH';
  if(modelValues.length>1){status='B1_INCOMPARABLE';reasons.push('MODEL_IDENTITY_MISMATCH')}

  const receipt={
    schema_version:'1.0',
    benchmark:'B1_CONTEXT_PRUNING',
    benchmark_key:benchmarkKey,
    status,
    scope:'CONTROLLED_CONTEXT_EFFICIENCY_ONLY',
    claim_boundary:'This benchmark measures full-context versus relevant-context token usage. It is not a universal AleDevOS savings percentage and is not the P7 Master efficiency gate.',
    runtime:'codex',
    model:explicitModel||modelValues[0]||null,
    model_comparability:modelComparability,
    runs,
    context:{
      baseline_files:fixture.file_count,
      candidate_files:1,
      baseline_context_sha256:sha(fixture.full),
      candidate_context_sha256:sha(fixture.relevant),
      prompt_transport:'STDIN',
      prompts_persisted:false,
      completions_persisted:false
    },
    quality:{
      expected_answer_sha256:sha(expected),
      exact_match_required:true,
      preserved:qualityPass
    },
    targets:{
      micro_input_token_reduction_ratio:inputTarget,
      micro_total_token_reduction_ratio:totalTarget
    },
    result:{
      median_input_reduction_ratio:medInput,
      median_input_reduction_pct:pct(medInput),
      median_total_reduction_ratio:medTotal,
      median_total_reduction_pct:pct(medTotal),
      target_pass:targetPass
    },
    pairs,
    reasons
  };
  receipt.integrity={algorithm:'sha256',payload_sha256:sha(JSON.stringify(receipt))};

  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const out=path.join(project,'.aledevos','state','efficiency','benchmarks',`b1-context-pruning-${stamp}.json`);
  writeJson(out,receipt);

  process.stdout.write('\n============================================================\n');
  process.stdout.write(' ALEDEVOS B1 - CONTROLLED CONTEXT EFFICIENCY\n');
  process.stdout.write('============================================================\n');
  process.stdout.write(`Status              : ${status}\n`);
  process.stdout.write(`Runs                : ${runs}\n`);
  process.stdout.write(`Input saving median : ${medInput===null?'n/a':pct(medInput)+'%'}\n`);
  process.stdout.write(`Total saving median : ${medTotal===null?'n/a':pct(medTotal)+'%'}\n`);
  process.stdout.write(`MICRO input target  : ${Math.round(inputTarget*100)}%\n`);
  process.stdout.write(`MICRO total target  : ${Math.round(totalTarget*100)}%\n`);
  process.stdout.write(`Quality preserved   : ${qualityPass}\n`);
  process.stdout.write(`Telemetry verified  : ${telemetryPass}\n`);
  process.stdout.write(`Model comparability : ${modelComparability}\n`);
  process.stdout.write(`Project             : ${project}\n`);
  process.stdout.write(`Receipt             : ${path.relative(project,out).replaceAll('\\','/')}\n`);
  if(reasons.length)process.stdout.write(`Reasons             : ${reasons.join(', ')}\n`);
  process.stdout.write('\n');
  process.stdout.write(status+'\n');

  process.exitCode=status==='B1_PASS'?0:status==='B1_BELOW_TARGET'?4:status==='B1_INCOMPARABLE'?5:7;
} finally {
}
