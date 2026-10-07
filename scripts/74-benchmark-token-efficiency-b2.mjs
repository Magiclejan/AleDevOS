#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseCodexJsonl,encodeWindowsTransportArg} from '../core/agent-runtime/agent-runtime.mjs';
import {startTaskTelemetry,emitAgentCallTelemetry,finishTaskTelemetry} from '../core/engine/telemetry-bridge.mjs';
import {appendTelemetryEvent} from '../contextos/engine/telemetry.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const argv=process.argv.slice(2);
const take=(flag,def=null)=>{const i=argv.indexOf(flag);return i>=0&&i+1<argv.length?argv[i+1]:def};
const runs=Math.max(1,Math.min(5,Number(take('--runs','1'))||1));
const timeoutMs=Math.max(10000,Math.min(900000,Number(take('--timeout-ms','180000'))||180000));
const explicitModel=take('--model',null);
const projectArg=take('--project',null);
if(!projectArg)throw new Error('B2_PROJECT_REQUIRED: use --project <AleDevOS consumer project>');
const project=path.resolve(projectArg);
if(!fs.existsSync(path.join(project,'.aledevos','project.json')))throw new Error('B2_ALEDEVOS_PROJECT_NOT_FOUND:'+project);
if(!fs.existsSync(path.join(project,'.codex','config.toml')))throw new Error('B2_CODEX_ADAPTER_NOT_INSTALLED:'+project);

const contextPolicy=JSON.parse(fs.readFileSync(path.join(root,'contextos','policies','context-policy.json'),'utf8'));
const efficiencyPolicy=JSON.parse(fs.readFileSync(path.join(root,'efficiency','policies','efficiency-policy.json'),'utf8'));
const taskId='B2-MACRO-ORCHESTRATION';
const benchmarkKey='B2_MACRO_ORCHESTRATION_V1';
const expectedValue='2750';
const micro=efficiencyPolicy.profiles.MICRO;

function sha(v){return crypto.createHash('sha256').update(String(v)).digest('hex')}
function safeNumber(v){return typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null}
function ratio(base,cand){return typeof base==='number'&&typeof cand==='number'&&base>0?(base-cand)/base:null}
function pct(v){return v===null?null:Math.round(v*10000)/100}
function median(xs){const a=[...xs].sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function writeJson(p,v){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n','utf8')}
function estTokens(s){return Math.max(1,Math.ceil(String(s||'').length/4))}
function eventId(kind){return 'b2-'+String(kind).toLowerCase()+'-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex')}

function fixtureContext(){
  const relevant=[
    'FILE: config/runtime-settings.mjs',
    'export const REQUEST_TIMEOUT_MS = 12000;',
    'export const RETRY_BACKOFF_MS = 2750;',
    'export const MAX_RETRIES = 4;',
    'export const CIRCUIT_BREAKER_WINDOW_MS = 30000;'
  ].join('\n');
  const decoys=[];
  for(let i=1;i<=24;i++){
    const lines=[`FILE: src/domain-${String(i).padStart(2,'0')}.mjs`];
    for(let j=1;j<=28;j++)lines.push(`export const DOMAIN_${i}_SETTING_${j} = ${1000+i*37+j}; // unrelated deterministic fixture`);
    decoys.push(lines.join('\n'));
  }
  return {relevant,full:[relevant,...decoys].join('\n\n'),file_count:25};
}

function launcherArgs(executable,args){
  const launcher=path.join(root,'core','agent-runtime','windows-cli-launcher.ps1');
  const encoded=[executable,...args].map(encodeWindowsTransportArg);
  return ['powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',launcher,...encoded]];
}

function runCodex(prompt){
  const args=['exec','--json','--skip-git-repo-check'];
  if(explicitModel)args.push('--model',explicitModel);
  args.push('-');
  const [exe,finalArgs]=process.platform==='win32'?launcherArgs('codex',args):['codex',args];
  const started=Date.now();
  const result=spawnSync(exe,finalArgs,{cwd:project,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024,timeout:timeoutMs,input:prompt});
  result.aledevos_duration_ms=Math.max(0,Date.now()-started);
  return result;
}

function extractAnswer(text){
  let answer=null;
  for(const line of String(text||'').split(/\r?\n/)){
    const s=line.trim();if(!s)continue;
    let row;try{row=JSON.parse(s)}catch{continue}
    const item=row?.item??null;
    if(item&&String(item.type||'').toLowerCase()==='agent_message'){
      const v=item.text??item.message??item.content;
      if(typeof v==='string')answer=v.trim();
      else if(Array.isArray(v)){const parts=v.map(x=>typeof x==='string'?x:(x?.text??x?.content??'')).filter(Boolean);if(parts.length)answer=parts.join('').trim()}
    }
    if(row?.type==='message'&&row?.role==='assistant'&&typeof row?.content==='string')answer=row.content.trim();
  }
  return answer;
}

function expectedFor(agent){return `B2_ROLE=${agent};BACKOFF_MS=${expectedValue};STATUS=PASS`}

function broadHandoff(prior,fixture,skills){
  return [
    'HANDOFF MODE: BROAD_REPEATED_STATE',
    'TASK: determine RETRY_BACKOFF_MS and preserve exact quality.',
    'ACCEPTANCE: every role must confirm the configured value.',
    'ACTIVE SKILLS: '+skills.join(','),
    'REPEATED CONTEXT:',
    fixture.full,
    'PRIOR ROLE RESULTS:',
    prior.map(x=>`${x.agent}:${x.status}:${x.answer_sha256}`).join('\n')||'none'
  ].join('\n');
}
function compactHandoff(prior){
  return [
    'HANDOFF MODE: COMPACT_DELTA',
    'task=B2-MACRO-ORCHESTRATION',
    'required=RETRY_BACKOFF_MS',
    'prior='+prior.map(x=>`${x.agent}:${x.status}`).join(','),
    'evidence_sha256='+sha(prior.map(x=>x.answer_sha256).join('|'))
  ].join('\n');
}

function promptFor({agent,context,label,skills,handoff}){
  return [
    'CONTROLLED ALEDEVOS B2 BENCHMARK.',
    'This is a synthetic benchmark, not a repository task. Do not access files, tools, network, or shell.',
    'Use only the supplied fixture context and handoff.',
    `ROLE: ${agent}`,
    `PIPELINE: ${label}`,
    'ACTIVE SKILL IDS: '+skills.join(','),
    'Your only job is to independently verify the configured retry backoff.',
    `QUALITY CONTRACT: Reply exactly "${expectedFor(agent)}" and nothing else.`,
    '',
    'FIXTURE CONTEXT:',
    context,
    '',
    'HANDOFF:',
    handoff||'none'
  ].join('\n');
}

function appendAux(runId,kind,agent,metrics,attributes={}){
  const ev={
    version:'1.0.0',
    event_id:eventId(kind),
    run_id:runId,
    task_id:taskId,
    timestamp:new Date().toISOString(),
    kind,
    source:{runtime:'codex',adapter:'codex',agent,model:explicitModel,provenance:kind==='CONTEXT_SAMPLE'?'REPORTED':'DERIVED'},
    metrics,
    attributes
  };
  return appendTelemetryEvent({cwd:project,policy:contextPolicy,event:ev});
}

function planCandidate(){
  const stamp=Date.now();
  const dir=path.join(root,'.aledevos','state','efficiency','benchmarks',`b2-plan-${stamp}`);
  fs.mkdirSync(dir,{recursive:true});
  const task={
    task_id:taskId,type:'BUGFIX',risk:'LOW',
    objective:'Confirm the configured retry backoff without unrelated work.',
    in_scope:['config/runtime-settings.mjs'],out_of_scope:['**/*'],
    acceptance_criteria:[{id:'AC1',text:'Configured retry backoff is identified exactly.'}]
  };
  const signalNames=['cross_domain','security_sensitive','database_affecting','external_integration','ui_affecting','visual_validation_required','unknown_requirements','migration_or_destructive','multi_machine','requires_research','knowledge_stale','repair_required'];
  const signals={schema_version:'1.0',domains:['backend'],signals:Object.fromEntries(signalNames.map(x=>[x,false]))};
  const tp=path.join(dir,'task.json'),sp=path.join(dir,'signals.json'),pp=path.join(dir,'plan.json');
  writeJson(tp,task);writeJson(sp,signals);
  const engine=path.join(root,'efficiency','engine','efficiency-governor.mjs');
  const r=spawnSync(process.execPath,[engine,'plan','create','--root',root,'--task',tp,'--signals',sp,'--out',pp],{cwd:root,encoding:'utf8',windowsHide:true});
  if(r.status!==0)throw new Error('B2_EFFICIENCY_PLAN_FAILED:'+(r.stderr||r.stdout||'').slice(0,500));
  const plan=JSON.parse(fs.readFileSync(pp,'utf8'));
  if(plan.profile!=='MICRO')throw new Error('B2_EXPECTED_MICRO_GOT:'+plan.profile);
  return {plan,dir};
}

async function runLeg({label,agents,skills,context,handoffMode,fixture}){
  const started=startTaskTelemetry({cwd:project,taskId,adapter:'codex',benchmarkKey,model:explicitModel,profile:label});
  if(!started.ok)throw new Error('B2_TELEMETRY_START_FAILED:'+(started.error||'unknown'));
  const prior=[];const calls=[];
  for(let i=0;i<agents.length;i++){
    const agent=agents[i];
    let handoff='';
    if(i>0){
      handoff=handoffMode==='BROAD'?broadHandoff(prior,fixture,skills):compactHandoff(prior);
      appendAux(started.run_id,'HANDOFF',agents[i-1],{estimated_tokens:estTokens(handoff)},{handoff_mode:handoffMode,raw_handoff_stored:false,handoff_sha256:sha(handoff)});
    }
    const prompt=promptFor({agent,context,label,skills,handoff});
    const raw=runCodex(prompt);
    const parsed=parseCodexJsonl(raw.stdout||'');
    const exitCode=Number.isInteger(raw.status)?raw.status:(raw.error?.code==='ETIMEDOUT'?124:127);
    const callStatus=exitCode===0?'COMPLETED':raw.error?.code==='ETIMEDOUT'?'TIMED_OUT':'FAILED';
    const answer=extractAnswer(raw.stdout||'');
    const quality=callStatus==='COMPLETED'&&answer===expectedFor(agent);
    const metrics={
      input_tokens:parsed.input_tokens??null,output_tokens:parsed.output_tokens??null,context_tokens:null,
      duration_ms:safeNumber(raw.aledevos_duration_ms),generation_ms:null,
      tool_calls:parsed.tool_calls??0,files_read:parsed.files_read??0,bytes_read:null
    };
    const ev=emitAgentCallTelemetry({
      cwd:project,runId:started.run_id,taskId,runtime:'codex',adapter:'codex',agent,model:parsed.model||explicitModel||null,
      metrics,
      attributes:{benchmark_leg:label,call_status:callStatus,exit_code:exitCode,usage_source:parsed.usage_source??'unavailable',quality_exact_match:quality,raw_prompt_stored:false,raw_completion_stored:false,prompt_sha256:sha(prompt)}
    });
    if(!ev.ok)throw new Error('B2_AGENT_TELEMETRY_FAILED:'+(ev.error||'unknown'));
    if(safeNumber(parsed.input_tokens)!==null)appendAux(started.run_id,'CONTEXT_SAMPLE',agent,{context_tokens:parsed.input_tokens,pressure_band:'NORMAL'},{source:'runtime_reported_input_tokens'});
    calls.push({agent,exit_code:exitCode,status:callStatus,input_tokens:parsed.input_tokens??null,output_tokens:parsed.output_tokens??null,quality,model:parsed.model||explicitModel||null});
    prior.push({agent,status:quality?'PASS':'FAIL',answer_sha256:sha(answer||'')});
    process.stdout.write(`    ${agent}: exit=${exitCode} input=${parsed.input_tokens??'null'} output=${parsed.output_tokens??'null'} quality=${quality?'PASS':'FAIL'}\n`);
  }
  const quality=calls.every(x=>x.quality);
  const fin=finishTaskTelemetry({cwd:project,runId:started.run_id,taskId,adapter:'codex',finalState:quality?'PASS':'FAILED'});
  if(!fin.ok)throw new Error('B2_TELEMETRY_FINALIZE_FAILED:'+(fin.error||'unknown'));
  return {label,agents,skills,calls,quality,summary:fin.summary,verification:fin.verification,run_id:started.run_id};
}

const {plan}=planCandidate();
const order=['orchestrator','researcher','architect','auditor','editor-backend','builder','verifier','judge-requirements','judge-regression','judge-quality'];
const candidateSet=new Set(plan.agents.map(x=>x.id));
const candidateAgents=[...order.filter(x=>candidateSet.has(x)),...plan.agents.map(x=>x.id).filter(x=>!order.includes(x))];
const baselineAgents=['orchestrator','researcher','architect','auditor','editor-backend','verifier','judge-requirements','judge-regression','judge-quality'];
const candidateSkills=[...plan.skills];
const baselineSkills=[...new Set([...candidateSkills,...(efficiencyPolicy.skill_activation.STANDARD_plus||[])])];
const fixture=fixtureContext();

const pairResults=[];
for(let i=1;i<=runs;i++){
  process.stdout.write(`\n[B2 ${i}/${runs}] Controlled broad pipeline vs P7 MICRO pipeline\n`);
  let baseline,candidate;
  if(i%2===0){
    process.stdout.write('  Candidate first (order balancing)\n');
    candidate=await runLeg({label:'P7_MICRO_RELEVANT_CONTEXT',agents:candidateAgents,skills:candidateSkills,context:fixture.relevant,handoffMode:'COMPACT',fixture});
    baseline=await runLeg({label:'BROAD_FULL_CONTEXT_BASELINE',agents:baselineAgents,skills:baselineSkills,context:fixture.full,handoffMode:'BROAD',fixture});
  }else{
    baseline=await runLeg({label:'BROAD_FULL_CONTEXT_BASELINE',agents:baselineAgents,skills:baselineSkills,context:fixture.full,handoffMode:'BROAD',fixture});
    candidate=await runLeg({label:'P7_MICRO_RELEVANT_CONTEXT',agents:candidateAgents,skills:candidateSkills,context:fixture.relevant,handoffMode:'COMPACT',fixture});
  }

  const b=baseline.summary,c=candidate.summary;
  const bin=safeNumber(b?.totals?.input_tokens),bout=safeNumber(b?.totals?.output_tokens);
  const cin=safeNumber(c?.totals?.input_tokens),cout=safeNumber(c?.totals?.output_tokens);
  const btotal=bin!==null&&bout!==null?bin+bout:null,ctotal=cin!==null&&cout!==null?cin+cout:null;
  const inputReduction=ratio(bin,cin),totalReduction=ratio(btotal,ctotal);
  const callReduction=ratio(baselineAgents.length,candidateAgents.length);
  const handoffReduction=ratio(safeNumber(b?.totals?.handoff_tokens),safeNumber(c?.totals?.handoff_tokens));
  const activeAgentReduction=ratio(Object.keys(b?.agents||{}).length,Object.keys(c?.agents||{}).length);
  const quality=baseline.quality&&candidate.quality;
  const verified=baseline.verification?.valid===true&&candidate.verification?.valid===true;
  pairResults.push({
    run:i,
    baseline:{run_id:baseline.run_id,input_tokens:bin,output_tokens:bout,total_tokens:btotal,model_calls:baselineAgents.length,active_agents:Object.keys(b?.agents||{}).length,handoff_tokens:b?.totals?.handoff_tokens??null,quality:baseline.quality,telemetry_verified:baseline.verification?.valid===true},
    candidate:{run_id:candidate.run_id,input_tokens:cin,output_tokens:cout,total_tokens:ctotal,model_calls:candidateAgents.length,active_agents:Object.keys(c?.agents||{}).length,handoff_tokens:c?.totals?.handoff_tokens??null,quality:candidate.quality,telemetry_verified:candidate.verification?.valid===true},
    input_reduction_ratio:inputReduction,total_reduction_ratio:totalReduction,model_call_reduction_ratio:callReduction,active_agent_reduction_ratio:activeAgentReduction,handoff_reduction_ratio:handoffReduction,quality_preserved:quality,telemetry_verified:verified
  });
  process.stdout.write(`  input saving=${pct(inputReduction)}% | total saving=${pct(totalReduction)}% | model-call saving=${pct(callReduction)}% | handoff saving=${pct(handoffReduction)}%\n`);
}

const medInput=median(pairResults.map(x=>x.input_reduction_ratio).filter(Number.isFinite));
const medTotal=median(pairResults.map(x=>x.total_reduction_ratio).filter(Number.isFinite));
const medCalls=median(pairResults.map(x=>x.model_call_reduction_ratio).filter(Number.isFinite));
const medAgents=median(pairResults.map(x=>x.active_agent_reduction_ratio).filter(Number.isFinite));
const medHandoff=median(pairResults.map(x=>x.handoff_reduction_ratio).filter(Number.isFinite));
const qualityPass=pairResults.every(x=>x.quality_preserved);
const telemetryPass=pairResults.every(x=>x.telemetry_verified);
const measured=[medInput,medTotal,medCalls,medAgents].every(Number.isFinite);
const targetPass=measured&&medInput>=Number(micro.input_token_reduction_target)&&medTotal>=Number(micro.total_token_reduction_target);
let status='B2_PASS';const reasons=[];
if(!qualityPass){status='B2_FAIL';reasons.push('QUALITY_NOT_PRESERVED')}
else if(!telemetryPass||!measured){status='B2_INCOMPARABLE';reasons.push('MEASUREMENT_INCOMPLETE')}
else if(!targetPass){status='B2_BELOW_TARGET';if(medInput<Number(micro.input_token_reduction_target))reasons.push('INPUT_TOKEN_REDUCTION_BELOW_MICRO_TARGET');if(medTotal<Number(micro.total_token_reduction_target))reasons.push('TOTAL_TOKEN_REDUCTION_BELOW_MICRO_TARGET')}

const models=[...new Set(pairResults.flatMap(x=>[]))];
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const receipt={
  schema_version:'1.0',
  benchmark:'B2_MACRO_ORCHESTRATION',
  benchmark_key:benchmarkKey,
  status,
  scope:'CONTROLLED_COMBINED_EFFICIENCY',
  claim_boundary:'B2 compares a controlled broad/full-context pipeline with the real P7 MICRO agent plan plus relevant context and compact handoffs. It is not a universal AleDevOS savings percentage and does not prove native subagent implementation overhead for every adapter.',
  runtime:'codex',
  model:explicitModel,
  model_comparability:explicitModel?'EXPLICIT_SAME_MODEL':'SAME_CODEX_RUNTIME_DEFAULT_MODEL_UNREPORTED',
  runs,
  plan:{profile:plan.profile,complexity_score:plan.complexity_score,payload_sha256:plan.integrity?.payload_sha256??null},
  activation:{
    baseline_agents:baselineAgents,candidate_agents:candidateAgents,
    baseline_skills:baselineSkills,candidate_skills:candidateSkills
  },
  context:{baseline_files:fixture.file_count,candidate_files:1,baseline_context_sha256:sha(fixture.full),candidate_context_sha256:sha(fixture.relevant),prompt_transport:'STDIN',raw_prompts_persisted:false,raw_completions_persisted:false},
  targets:{micro_input_token_reduction_ratio:Number(micro.input_token_reduction_target),micro_total_token_reduction_ratio:Number(micro.total_token_reduction_target)},
  result:{median_input_reduction_pct:pct(medInput),median_total_reduction_pct:pct(medTotal),median_model_call_reduction_pct:pct(medCalls),median_active_agent_reduction_pct:pct(medAgents),median_handoff_reduction_pct:pct(medHandoff),quality_preserved:qualityPass,telemetry_verified:telemetryPass,target_pass:targetPass},
  pairs:pairResults,
  reasons
};
receipt.integrity={algorithm:'sha256',payload_sha256:sha(JSON.stringify(receipt))};
const out=path.join(project,'.aledevos','state','efficiency','benchmarks',`b2-macro-orchestration-${stamp}.json`);
writeJson(out,receipt);

process.stdout.write('\n============================================================\n');
process.stdout.write(' ALEDEVOS B2 - CONTROLLED MACRO-ORCHESTRATION EFFICIENCY\n');
process.stdout.write('============================================================\n');
process.stdout.write(`Status                    : ${status}\n`);
process.stdout.write(`Runs                      : ${runs}\n`);
process.stdout.write(`P7 profile                : ${plan.profile}\n`);
process.stdout.write(`Baseline agents           : ${baselineAgents.length}\n`);
process.stdout.write(`Candidate agents          : ${candidateAgents.length}\n`);
process.stdout.write(`Baseline skill IDs        : ${baselineSkills.length}\n`);
process.stdout.write(`Candidate skill IDs       : ${candidateSkills.length}\n`);
process.stdout.write(`Input saving median       : ${pct(medInput)}%\n`);
process.stdout.write(`Total saving median       : ${pct(medTotal)}%\n`);
process.stdout.write(`Model-call saving median  : ${pct(medCalls)}%\n`);
process.stdout.write(`Active-agent saving       : ${pct(medAgents)}%\n`);
process.stdout.write(`Handoff saving median     : ${pct(medHandoff)}%\n`);
process.stdout.write(`Quality preserved         : ${qualityPass}\n`);
process.stdout.write(`Telemetry verified        : ${telemetryPass}\n`);
process.stdout.write(`Model comparability       : ${receipt.model_comparability}\n`);
process.stdout.write(`Receipt                   : ${path.relative(project,out).replaceAll('\\','/')}\n`);
if(reasons.length)process.stdout.write(`Reasons                   : ${reasons.join(', ')}\n`);
process.stdout.write('\n'+status+'\n');
process.exitCode=status==='B2_PASS'?0:status==='B2_BELOW_TARGET'?4:status==='B2_INCOMPARABLE'?5:7;
