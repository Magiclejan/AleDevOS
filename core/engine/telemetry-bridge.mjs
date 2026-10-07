import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const installedTelemetryPath=path.resolve(here,'../contextos/runtime/telemetry.mjs');
const sourceTelemetryPath=path.resolve(here,'../../contextos/engine/telemetry.mjs');
const telemetryPath=fs.existsSync(installedTelemetryPath)?installedTelemetryPath:sourceTelemetryPath;
if(!fs.existsSync(telemetryPath))throw new Error(`TELEMETRY_RUNTIME_NOT_FOUND:${telemetryPath}`);
const sourceMode=telemetryPath===sourceTelemetryPath;
const policyPath=sourceMode
  ? path.resolve(here,'../../contextos/policies/context-policy.json')
  : path.resolve(here,'../contextos/policies/context-policy.json');

const {
  startTelemetryRun,
  appendTelemetryEvent,
  aggregateTelemetryRun,
  verifyTelemetryRun
}=await import(pathToFileURL(telemetryPath).href);

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''))}
function loadPolicy(){
  if(!fs.existsSync(policyPath))throw new Error(`TELEMETRY_POLICY_NOT_FOUND:${policyPath}`);
  return readJson(policyPath);
}
function safeFragment(v){return String(v??'task').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,100)||'task'}
function eventId(kind){return `${String(kind).toLowerCase()}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`}
function makeRunId(taskId){return `run-${safeFragment(taskId)}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`}
function source({runtime='aledevos',adapter=null,agent='orchestrator',model=null,provenance='DERIVED'}={}){
  return {runtime,adapter,agent,model,provenance};
}
function telemetryEnabled(policy){return policy?.telemetry?.enabled!==false}
function summaryRelativePath(policy,runId){
  const root=policy?.telemetry?.output_dir||'.aledevos/state/telemetry/contextos';
  return path.join(root,'runs',runId,'summary.json').replaceAll('\\','/');
}
function emit({cwd,runId,taskId,kind,runtime='aledevos',adapter=null,agent='orchestrator',model=null,provenance='DERIVED',metrics={},attributes}){
  if(!runId||!taskId)return {ok:false,error:'TELEMETRY_NOT_ACTIVE'};
  try{
    const policy=loadPolicy();
    if(!telemetryEnabled(policy))return {ok:true,disabled:true};
    const event={
      version:'1.0.0',
      event_id:eventId(kind),
      run_id:runId,
      task_id:taskId,
      timestamp:new Date().toISOString(),
      kind,
      source:source({runtime,adapter,agent,model,provenance}),
      metrics
    };
    if(attributes!==undefined)event.attributes=attributes;
    return {ok:true,...appendTelemetryEvent({cwd,policy,event})};
  }catch(e){
    return {ok:false,error:String(e?.message||e)};
  }
}

export function startTaskTelemetry({cwd,taskId,adapter=null,benchmarkKey=null,model=null,profile=null}){
  try{
    const policy=loadPolicy();
    if(!telemetryEnabled(policy))return {ok:true,disabled:true,run_id:null};
    const runId=makeRunId(taskId);
    const started=startTelemetryRun({
      cwd,
      policy,
      input:{
        run_id:runId,
        task_id:taskId,
        benchmark_key:benchmarkKey,
        runtime:'aledevos',
        adapter,
        model,
        runtime_profile:profile,
        labels:{automatic:true,lifecycle:'task'}
      }
    });
    const startEvent=emit({
      cwd,runId,taskId,kind:'RUN_START',adapter,agent:'orchestrator',
      provenance:'MEASURED',metrics:{}
    });
    return {ok:startEvent.ok===true,run_id:runId,started,start_event:startEvent};
  }catch(e){
    return {ok:false,run_id:null,error:String(e?.message||e)};
  }
}

export function emitGateTelemetry({cwd,runId,taskId,adapter=null,gateId,status}){
  return emit({
    cwd,runId,taskId,kind:'GATE',adapter,agent:'verifier',
    provenance:'DERIVED',metrics:{gate_status:status},attributes:{gate_id:gateId}
  });
}

export function emitJudgeTelemetry({cwd,runId,taskId,adapter=null,judge,score,blockers,unverified}){
  return emit({
    cwd,runId,taskId,kind:'JUDGE',adapter,agent:`judge-${safeFragment(judge)}`,
    provenance:'DERIVED',metrics:{score,blockers},attributes:{judge,unverified}
  });
}

export function emitRepairTelemetry({cwd,runId,taskId,adapter=null,repairCount}){
  return emit({
    cwd,runId,taskId,kind:'REPAIR',adapter,agent:'repairer',
    provenance:'DERIVED',metrics:{repair_count:repairCount}
  });
}

export function emitAgentCallTelemetry({cwd,runId,taskId,runtime='aledevos',adapter=null,agent='orchestrator',model=null,metrics={},attributes={}}){
  return emit({
    cwd,runId,taskId,kind:'AGENT_CALL',runtime,adapter,agent,model,
    provenance:'MEASURED',metrics,attributes
  });
}

export function finishTaskTelemetry({cwd,runId,taskId,adapter=null,finalState}){
  if(!runId)return {ok:true,disabled:true,run_id:null,summary_path:null};
  try{
    const policy=loadPolicy();
    if(!telemetryEnabled(policy))return {ok:true,disabled:true,run_id:runId,summary_path:null};
    const finalEvent=emit({
      cwd,runId,taskId,kind:'FINAL_STATE',adapter,agent:'orchestrator',
      provenance:'DERIVED',metrics:{final_state:finalState}
    });
    if(!finalEvent.ok)return {ok:false,run_id:runId,error:finalEvent.error};
    const summary=aggregateTelemetryRun({cwd,policy,runId});
    const verification=verifyTelemetryRun({cwd,policy,runId});
    return {
      ok:verification.valid===true,
      run_id:runId,
      summary,
      verification,
      summary_path:summaryRelativePath(policy,runId)
    };
  }catch(e){
    return {ok:false,run_id:runId,error:String(e?.message||e)};
  }
}
