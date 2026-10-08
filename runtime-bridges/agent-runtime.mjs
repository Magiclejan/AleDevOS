#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const thisFile=fileURLToPath(import.meta.url);
const here=path.dirname(thisFile);
const args=process.argv.slice(2);

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''))}
function take(list,flag,def=null){const i=list.indexOf(flag);return i>=0&&i+1<list.length?list[i+1]:def}
function has(list,flag){return list.includes(flag)}
function canonicalAdapter(v){return String(v||'').toLowerCase()==='gemini'?'antigravity':String(v||'').toLowerCase()}
function safeNumber(v){return typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null}
function addNumber(a,b){return safeNumber(b)===null?a:(a??0)+b}
function jsonLines(text){const out=[];for(const line of String(text||'').split(/\r?\n/)){const s=line.trim();if(!s)continue;try{out.push(JSON.parse(s))}catch{}}return out}
function nested(obj,paths){for(const p of paths){let v=obj;for(const k of p.split('.'))v=v?.[k];if(v!==undefined&&v!==null)return v}return null}
function tokenPair(obj){if(!obj||typeof obj!=='object')return null;const input=safeNumber(nested(obj,['input_tokens','inputTokens','input']));const output=safeNumber(nested(obj,['output_tokens','outputTokens','output']));if(input===null&&output===null)return null;return{input,output}}
function modelString(provider,model){if(!model)return null;return provider?String(provider)+'/'+String(model):String(model)}
function safeDiagnostic(v){if(v===undefined||v===null)return null;const s=String(v).replace(/[^A-Za-z0-9._:-]/g,'_').slice(0,120);return s||null}
export function cliLaunchStrategy(platform=process.platform){return platform==='win32'?'powershell-base64-argv':'direct'}
export function encodeWindowsTransportArg(value){return Buffer.from(String(value),'utf8').toString('base64')}
function windowsLauncherPath(){const installed=path.resolve(here,'../agent-runtime/runtime/windows-cli-launcher.ps1'),source=path.resolve(here,'../core/agent-runtime/windows-cli-launcher.ps1');return fs.existsSync(installed)?installed:source}
function spawnCli(executable,argv,options={}){
  if(process.platform!=='win32')return spawnSync(executable,argv,options);
  const launcher=windowsLauncherPath();
  if(!fs.existsSync(launcher))return {status:null,stdout:'',stderr:'',error:Object.assign(new Error('WINDOWS_CLI_LAUNCHER_NOT_FOUND:'+launcher),{code:'ENOENT'})};
  const encoded=[encodeWindowsTransportArg(executable),...argv.map(encodeWindowsTransportArg)];
  return spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',launcher,...encoded],options);
}

export function parseOpenCodeJsonl(text){
  const rows=jsonLines(text),calls=new Set(),reads=new Set();let sessionId=null,model=null,stepInput=null,stepOutput=null,lastMessageUsage=null,errorType=null,errorCode=null;
  for(const row of rows){
    sessionId=sessionId||nested(row,['sessionID','sessionId','properties.sessionID','part.sessionID']);
    const part=row?.part??row?.properties?.part??null,info=row?.properties?.info??row?.message??null;
    if(row?.type==='error'){
      const err=row?.error??row?.properties?.error??null;
      errorType=errorType||safeDiagnostic(err?.name??err?.type);
      errorCode=errorCode||safeDiagnostic(err?.code??err?.data?.code??err?.data?.statusCode??err?.data?.status);
    }
    if(info?.role==='assistant'){const tp=tokenPair(info.tokens);if(tp)lastMessageUsage=tp;model=model||modelString(info.providerID??info.provider_id,info.modelID??info.model_id)}
    const isStep=row?.type==='step_finish'||row?.type==='step-finish'||part?.type==='step-finish'||part?.type==='step_finish';
    if(isStep){const tp=tokenPair(part?.tokens??row?.tokens);if(tp){stepInput=addNumber(stepInput,tp.input);stepOutput=addNumber(stepOutput,tp.output)}}
    const candidate=part?.type==='tool'?part:(row?.type==='tool_use'||row?.type==='tool-use'?row:null);
    if(candidate){const id=candidate.callID??candidate.callId??candidate.id;if(id)calls.add(String(id));const tool=String(candidate.tool??candidate.name??'').toLowerCase();if(id&&['read','read_file','readfile'].includes(tool))reads.add(String(id))}
  }
  const useSteps=stepInput!==null||stepOutput!==null;
  return{parser:'opencode-jsonl',session_id:sessionId?String(sessionId):null,model,input_tokens:useSteps?stepInput:lastMessageUsage?.input??null,output_tokens:useSteps?stepOutput:lastMessageUsage?.output??null,tool_calls:calls.size,files_read:reads.size,usage_source:useSteps?'step_finish':lastMessageUsage?'assistant_message':'unavailable',error_type:errorType,error_code:errorCode};
}

export function parseOpenCodeExport(text){
  let doc;try{doc=JSON.parse(String(text||''))}catch{return{parser:'opencode-sanitized-export',input_tokens:null,output_tokens:null,tool_calls:null,files_read:null,model:null,usage_source:'unavailable'}}
  let input=null,output=null,model=null;const calls=new Set(),reads=new Set();
  for(const msg of doc?.messages??[]){const info=msg?.info??{};if(info.role==='assistant')model=model||modelString(info.providerID??info.provider_id,info.modelID??info.model_id);for(const part of msg?.parts??[]){if(part?.type==='step-finish'||part?.type==='step_finish'){const tp=tokenPair(part.tokens);if(tp){input=addNumber(input,tp.input);output=addNumber(output,tp.output)}}if(part?.type==='tool'){const id=part.callID??part.callId??part.id;if(id)calls.add(String(id));const tool=String(part.tool??part.name??'').toLowerCase();if(id&&['read','read_file','readfile'].includes(tool))reads.add(String(id))}}}
  return{parser:'opencode-sanitized-export',input_tokens:input,output_tokens:output,tool_calls:calls.size,files_read:reads.size,model,usage_source:(input!==null||output!==null)?'sanitized_session_export':'unavailable'};
}

export function parseCodexJsonl(text){
  const rows=jsonLines(text),calls=new Set(),reads=new Set();let usage=null,model=null;
  for(const row of rows){if(row?.type==='turn.completed'){const tp=tokenPair(row.usage??row?.turn?.usage);if(tp)usage=tp}model=model||nested(row,['model','turn.model','item.model']);const item=row?.item??null;if(item&&['item.started','item.completed','item.updated'].includes(String(row.type))){const kind=String(item.type??'').toLowerCase();if(/command|tool|mcp|web_search|websearch/.test(kind)){const id=item.id??item.call_id??item.callId;if(id)calls.add(String(id));if(id&&/read_file|readfile|file_read/.test(kind))reads.add(String(id))}}}
  return{parser:'codex-jsonl',input_tokens:usage?.input??null,output_tokens:usage?.output??null,tool_calls:calls.size,files_read:reads.size,model:model?String(model):null,usage_source:usage?'turn.completed':'unavailable'};
}

export function parseClaudeStreamJson(text){
  const rows=jsonLines(text),calls=new Set(),reads=new Set();let sumInput=null,sumOutput=null,resultUsage=null,model=null;
  for(const row of rows){model=model||nested(row,['model','message.model']);if(row?.type==='assistant'&&row?.message){const tp=tokenPair(row.message.usage);if(tp){sumInput=addNumber(sumInput,tp.input);sumOutput=addNumber(sumOutput,tp.output)}for(const block of row.message.content??[]){if(block?.type!=='tool_use')continue;const id=block.id??block.tool_use_id;if(id)calls.add(String(id));const tool=String(block.name??'').toLowerCase();if(id&&['read','read_file','readfile'].includes(tool))reads.add(String(id))}}if(row?.type==='result'){const tp=tokenPair(row.usage);if(tp)resultUsage=tp}}
  return{parser:'claude-stream-json',input_tokens:resultUsage?.input??sumInput,output_tokens:resultUsage?.output??sumOutput,tool_calls:calls.size,files_read:reads.size,model:model?String(model):null,usage_source:resultUsage?'result':(sumInput!==null||sumOutput!==null)?'assistant_messages':'unavailable'};
}
export function parseAntigravityText(){return{parser:'antigravity-text',input_tokens:null,output_tokens:null,tool_calls:null,files_read:null,model:null,usage_source:'unavailable_by_runtime'}}
export function parseRuntimeOutput(parser,text){if(parser==='opencode-jsonl')return parseOpenCodeJsonl(text);if(parser==='codex-jsonl')return parseCodexJsonl(text);if(parser==='claude-stream-json')return parseClaudeStreamJson(text);if(parser==='antigravity-text')return parseAntigravityText(text);return{parser:'unknown',input_tokens:null,output_tokens:null,tool_calls:null,files_read:null,model:null,usage_source:'unavailable'}}

function sourceProfilePath(adapter){const installed=path.resolve(here,'../agent-runtime/adapters',adapter+'.json'),source=path.resolve(here,'../adapters',adapter,'runtime-profile.json');return fs.existsSync(installed)?installed:source}
function loadProfile(adapter){const p=sourceProfilePath(adapter);if(!fs.existsSync(p))throw new Error('AGENT_RUNTIME_PROFILE_NOT_FOUND:'+adapter);const profile=readJson(p);if(profile?.schema_version!=='1.0'||canonicalAdapter(profile.adapter)!==adapter)throw new Error('AGENT_RUNTIME_PROFILE_INVALID:'+adapter);return profile}
export function buildInvocation(profile,{agent,model,prompt,skipRepoCheck=false}){const argv=[...(profile.base_args??[])];if(skipRepoCheck&&profile.repo_check_bypass_flag)argv.push(String(profile.repo_check_bypass_flag));const overrides=[...(profile.config_overrides??[]),...(profile.role_config_overrides?.[agent]??[])];for(const override of overrides)if(typeof override==='string'&&override.trim())argv.push('--config',override);if(profile.agent_flag&&agent)argv.push(profile.agent_flag,String(agent));if(profile.model_flag&&model)argv.push(profile.model_flag,String(model));if(profile.prompt_mode==='flag'){if(!profile.prompt_flag)throw new Error('AGENT_RUNTIME_PROMPT_FLAG_MISSING');argv.push(profile.prompt_flag,String(prompt))}else if(profile.prompt_mode==='positional')argv.push(String(prompt));else throw new Error('AGENT_RUNTIME_PROMPT_MODE_INVALID');return{executable:profile.executable,args:argv}}
function defaultStatePath(cwd){return path.join(cwd,'.aledevos','state','current.json')}
function resolveState(cwd,stateArg){const p=stateArg?path.resolve(cwd,stateArg):defaultStatePath(cwd);if(!fs.existsSync(p))throw new Error('AGENT_RUNTIME_STATE_NOT_FOUND:'+p);const state=readJson(p);if(!state.task_id||!state.telemetry_run_id)throw new Error('AGENT_RUNTIME_TELEMETRY_RUN_REQUIRED');if(state.final_state)throw new Error('AGENT_RUNTIME_TASK_ALREADY_FINAL');return{path:p,state}}
function readPrompt(cwd,list){const inline=take(list,'--prompt',null),file=take(list,'--prompt-file',null);if(inline!==null&&file!==null)throw new Error('AGENT_RUNTIME_PROMPT_SOURCE_AMBIGUOUS');if(file!==null)return fs.readFileSync(path.resolve(cwd,file),'utf8');if(inline!==null)return String(inline);if(!process.stdin.isTTY)return fs.readFileSync(0,'utf8');throw new Error('AGENT_RUNTIME_PROMPT_REQUIRED')}
function bridgePath(){const installed=path.resolve(here,'../runtime/telemetry-bridge.mjs'),source=path.resolve(here,'../core/engine/telemetry-bridge.mjs'),p=fs.existsSync(installed)?installed:source;if(!fs.existsSync(p))throw new Error('AGENT_RUNTIME_TELEMETRY_BRIDGE_NOT_FOUND');return p}
async function emitCall(input){const m=await import(pathToFileURL(bridgePath()).href);return m.emitAgentCallTelemetry(input)}
function fallbackOpenCode(profile,cwd,sessionId){if(!profile.usage_fallback?.enabled||!sessionId)return null;const argv=(profile.usage_fallback.args??[]).map(x=>String(x).replace('{session_id}',sessionId));const r=spawnCli(profile.executable,argv,{cwd,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024,timeout:Number(profile.usage_fallback.timeout_ms||30000)});if(r.error||r.status!==0)return null;return parseOpenCodeExport(r.stdout||'')}

export async function invokeAgentCall({cwd=process.cwd(),statePath=null,adapter,agent='orchestrator',model=null,prompt,quiet=false,timeoutMs=null,skipRepoCheck=false}){
  adapter=canonicalAdapter(adapter);if(!adapter)throw new Error('AGENT_RUNTIME_ADAPTER_REQUIRED');
  const {state}=resolveState(cwd,statePath),stateAdapter=canonicalAdapter(state.runtime_adapter);if(stateAdapter&&stateAdapter!==adapter)throw new Error('AGENT_RUNTIME_ADAPTER_STATE_MISMATCH');
  const profile=loadProfile(adapter),inv=buildInvocation(profile,{agent,model,prompt,skipRepoCheck}),started=Date.now();
  const requestedTimeout=Number(timeoutMs),effectiveTimeout=Number.isFinite(requestedTimeout)&&requestedTimeout>0?requestedTimeout:Number(profile.default_timeout_ms||600000);
  const child=spawnCli(inv.executable,inv.args,{cwd,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024,timeout:effectiveTimeout});
  const durationMs=Math.max(0,Date.now()-started);let parsed=parseRuntimeOutput(profile.parser,child.stdout||''),fallbackUsed=false;
  if(adapter==='opencode'&&(parsed.input_tokens===null||parsed.output_tokens===null)&&parsed.session_id){const fb=fallbackOpenCode(profile,cwd,parsed.session_id);if(fb&&(fb.input_tokens!==null||fb.output_tokens!==null)){parsed={...parsed,...fb,session_id:parsed.session_id,parser:parsed.parser};fallbackUsed=true}}
  const exitCode=Number.isInteger(child.status)?child.status:(child.error?.code==='ETIMEDOUT'?124:127),callStatus=exitCode===0?'COMPLETED':child.error?.code==='ETIMEDOUT'?'TIMED_OUT':'FAILED',actualModel=parsed.model||model||null;
  const metrics={input_tokens:parsed.input_tokens??null,output_tokens:parsed.output_tokens??null,context_tokens:null,duration_ms:durationMs,generation_ms:null,tool_calls:parsed.tool_calls??null,files_read:parsed.files_read??null,bytes_read:null};
  const metricProvenance={input_tokens:metrics.input_tokens===null?'UNAVAILABLE':'REPORTED',output_tokens:metrics.output_tokens===null?'UNAVAILABLE':'REPORTED',context_tokens:'UNAVAILABLE',duration_ms:'MEASURED',generation_ms:'UNAVAILABLE',tool_calls:metrics.tool_calls===null?'UNAVAILABLE':'MEASURED_FROM_STRUCTURED_RUNTIME',files_read:metrics.files_read===null?'UNAVAILABLE':'MEASURED_FROM_STRUCTURED_RUNTIME',bytes_read:'UNAVAILABLE'};
  const telemetry=await emitCall({cwd,runId:state.telemetry_run_id,taskId:state.task_id,runtime:profile.runtime_family,adapter,agent,model:actualModel,metrics,attributes:{call_status:callStatus,exit_code:exitCode,parser:profile.parser,usage_status:(metrics.input_tokens!==null||metrics.output_tokens!==null)?'REPORTED':'UNAVAILABLE',usage_source:parsed.usage_source??'unavailable',fallback_used:fallbackUsed,structured_output:profile.parser!=='antigravity-text',native_agent_binding:Boolean(profile.agent_flag),launch_strategy:cliLaunchStrategy(),error_type:parsed.error_type??null,error_code:parsed.error_code??null,metric_provenance:metricProvenance}});
  if(!quiet&&child.stdout)process.stdout.write(child.stdout);if(child.stderr)process.stderr.write(child.stderr);
  return{exit_code:exitCode,call_status:callStatus,telemetry,metrics,model:actualModel,parser:profile.parser,usage_source:parsed.usage_source??'unavailable',fallback_used:fallbackUsed,error_type:parsed.error_type??null,error_code:parsed.error_code??null};
}

export async function runAgentRuntimeCli(){const[group,command]=args;if(group!=='call'&&!(group==='agent'&&command==='call')){process.stderr.write('Usage: agent-runtime.mjs call --adapter <adapter> --agent <agent> [--model <model>] --prompt <text> [--state <state>] [--timeout-ms <ms>] [--skip-repo-check] [--quiet]\n');process.exit(2)}const offset=group==='agent'?2:1,list=args.slice(offset),cwd=process.cwd(),adapter=take(list,'--adapter',null),agent=take(list,'--agent','orchestrator'),model=take(list,'--model',null),statePath=take(list,'--state',null),timeoutMs=take(list,'--timeout-ms',null),skipRepoCheck=has(list,'--skip-repo-check'),quiet=has(list,'--quiet');try{const prompt=readPrompt(cwd,list),result=await invokeAgentCall({cwd,statePath,adapter,agent,model,prompt,quiet,timeoutMs,skipRepoCheck});if(quiet)process.stdout.write(JSON.stringify({status:'AGENT_CALL_RECORDED',adapter:canonicalAdapter(adapter),agent,model:result.model,call_status:result.call_status,exit_code:result.exit_code,usage_status:(result.metrics.input_tokens!==null||result.metrics.output_tokens!==null)?'REPORTED':'UNAVAILABLE',input_tokens:result.metrics.input_tokens,output_tokens:result.metrics.output_tokens,duration_ms:result.metrics.duration_ms,tool_calls:result.metrics.tool_calls,files_read:result.metrics.files_read,fallback_used:result.fallback_used,error_type:result.error_type??null,error_code:result.error_code??null},null,2)+'\n');process.exit(result.exit_code)}catch(e){process.stderr.write(String(e?.message||e)+'\n');process.exit(2)}}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(thisFile))await runAgentRuntimeCli();
