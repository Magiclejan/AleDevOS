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
function adapterManifestPath(name){return path.resolve(here,'../../adapters',String(name||'').toLowerCase(),'adapter-capabilities.json')}
function resolveCanonicalAdapter(value){
  const requested=String(value||'').toLowerCase();
  if(!requested)return '';
  const manifest=adapterManifestPath(requested);
  if(!fs.existsSync(manifest))return requested;
  try{const m=readJson(manifest);return String(m.alias_of||m.adapter||requested).toLowerCase()}catch{return requested}
}
export function cliLaunchStrategy(platform=process.platform){return platform==='win32'?'powershell-base64-argv':'direct'}
export function encodeWindowsTransportArg(value){return Buffer.from(String(value),'utf8').toString('base64')}
function windowsLauncherPath(){return path.resolve(here,'windows-cli-launcher.ps1')}
function spawnCli(executable,argv,options={}){
  if(process.platform!=='win32')return spawnSync(executable,argv,options);
  const launcher=windowsLauncherPath();
  if(!fs.existsSync(launcher))return {status:null,stdout:'',stderr:'',error:Object.assign(new Error('WINDOWS_CLI_LAUNCHER_NOT_FOUND:'+launcher),{code:'ENOENT'})};
  const encoded=[encodeWindowsTransportArg(executable),...argv.map(encodeWindowsTransportArg)];
  return spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',launcher,...encoded],options);
}

function sourceProfilePath(adapter){
  const installedNested=path.resolve(here,'../adapters',adapter,'runtime-profile.json');
  const installedLegacy=path.resolve(here,'../adapters',adapter+'.json');
  const source=path.resolve(here,'../../adapters',adapter,'runtime-profile.json');
  return [installedNested,installedLegacy,source].find(fs.existsSync)||source;
}
function loadProfile(adapter){
  const profilePath=sourceProfilePath(adapter);
  if(!fs.existsSync(profilePath))throw new Error('AGENT_RUNTIME_PROFILE_NOT_FOUND:'+adapter);
  const profile=readJson(profilePath);
  if(profile?.schema_version!=='1.0'||resolveCanonicalAdapter(profile.adapter)!==adapter)throw new Error('AGENT_RUNTIME_PROFILE_INVALID:'+adapter);
  if(!profile.parser_module||path.isAbsolute(profile.parser_module)||String(profile.parser_module).includes('..'))throw new Error('AGENT_RUNTIME_PARSER_MODULE_INVALID:'+adapter);
  return{profilePath,profile};
}
async function loadRuntimeParser(adapter,profilePath,profile){
  const direct=path.resolve(path.dirname(profilePath),profile.parser_module);
  const legacyNested=path.resolve(path.dirname(profilePath),adapter,profile.parser_module);
  const parserPath=[direct,legacyNested].find(fs.existsSync);
  if(!parserPath)throw new Error('AGENT_RUNTIME_PARSER_NOT_FOUND:'+adapter);
  const mod=await import(pathToFileURL(parserPath).href);
  if(typeof mod.parseRuntimeOutput!=='function')throw new Error('AGENT_RUNTIME_PARSER_INVALID:'+adapter);
  return mod;
}
export function buildInvocation(profile,{agent,model,prompt,skipRepoCheck=false}){const argv=[...(profile.base_args??[])];if(skipRepoCheck&&profile.repo_check_bypass_flag)argv.push(String(profile.repo_check_bypass_flag));if(profile.agent_flag&&agent)argv.push(profile.agent_flag,String(agent));if(profile.model_flag&&model)argv.push(profile.model_flag,String(model));if(profile.prompt_mode==='flag'){if(!profile.prompt_flag)throw new Error('AGENT_RUNTIME_PROMPT_FLAG_MISSING');argv.push(profile.prompt_flag,String(prompt))}else if(profile.prompt_mode==='positional')argv.push(String(prompt));else throw new Error('AGENT_RUNTIME_PROMPT_MODE_INVALID');return{executable:profile.executable,args:argv}}
function defaultStatePath(cwd){return path.join(cwd,'.aledevos','state','current.json')}
function resolveState(cwd,stateArg){const p=stateArg?path.resolve(cwd,stateArg):defaultStatePath(cwd);if(!fs.existsSync(p))throw new Error('AGENT_RUNTIME_STATE_NOT_FOUND:'+p);const state=readJson(p);if(!state.task_id||!state.telemetry_run_id)throw new Error('AGENT_RUNTIME_TELEMETRY_RUN_REQUIRED');if(state.final_state)throw new Error('AGENT_RUNTIME_TASK_ALREADY_FINAL');return{path:p,state}}
function readPrompt(cwd,list){const inline=take(list,'--prompt',null),file=take(list,'--prompt-file',null);if(inline!==null&&file!==null)throw new Error('AGENT_RUNTIME_PROMPT_SOURCE_AMBIGUOUS');if(file!==null)return fs.readFileSync(path.resolve(cwd,file),'utf8');if(inline!==null)return String(inline);if(!process.stdin.isTTY)return fs.readFileSync(0,'utf8');throw new Error('AGENT_RUNTIME_PROMPT_REQUIRED')}
function bridgePath(){const installed=path.resolve(here,'../../runtime/telemetry-bridge.mjs'),source=path.resolve(here,'../engine/telemetry-bridge.mjs'),p=fs.existsSync(installed)?installed:source;if(!fs.existsSync(p))throw new Error('AGENT_RUNTIME_TELEMETRY_BRIDGE_NOT_FOUND');return p}
async function emitCall(input){const m=await import(pathToFileURL(bridgePath()).href);return m.emitAgentCallTelemetry(input)}
function runUsageFallback(profile,cwd,sessionId,parser){
  if(!profile.usage_fallback?.enabled||!sessionId||typeof parser.parseFallback!=='function')return null;
  const argv=(profile.usage_fallback.args??[]).map(x=>String(x).replace('{session_id}',sessionId));
  const r=spawnCli(profile.executable,argv,{cwd,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024,timeout:Number(profile.usage_fallback.timeout_ms||30000)});
  if(r.error||r.status!==0)return null;
  return parser.parseFallback(r.stdout||'');
}

export async function invokeAgentCall({cwd=process.cwd(),statePath=null,adapter,agent='orchestrator',model=null,prompt,quiet=false,timeoutMs=null,skipRepoCheck=false}){
  adapter=resolveCanonicalAdapter(adapter);if(!adapter)throw new Error('AGENT_RUNTIME_ADAPTER_REQUIRED');
  const {state}=resolveState(cwd,statePath),stateAdapter=resolveCanonicalAdapter(state.runtime_adapter);if(stateAdapter&&stateAdapter!==adapter)throw new Error('AGENT_RUNTIME_ADAPTER_STATE_MISMATCH');
  const {profilePath,profile}=loadProfile(adapter),parser=await loadRuntimeParser(adapter,profilePath,profile),inv=buildInvocation(profile,{agent,model,prompt,skipRepoCheck}),started=Date.now();
  const requestedTimeout=Number(timeoutMs),effectiveTimeout=Number.isFinite(requestedTimeout)&&requestedTimeout>0?requestedTimeout:Number(profile.default_timeout_ms||600000);
  const child=spawnCli(inv.executable,inv.args,{cwd,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024,timeout:effectiveTimeout});
  const durationMs=Math.max(0,Date.now()-started);let parsed=parser.parseRuntimeOutput(child.stdout||''),fallbackUsed=false;
  if(profile.usage_fallback?.enabled&&(parsed.input_tokens===null||parsed.output_tokens===null)&&parsed.session_id){const fb=runUsageFallback(profile,cwd,parsed.session_id,parser);if(fb&&(fb.input_tokens!==null||fb.output_tokens!==null)){parsed={...parsed,...fb,session_id:parsed.session_id,parser:parsed.parser};fallbackUsed=true}}
  const exitCode=Number.isInteger(child.status)?child.status:(child.error?.code==='ETIMEDOUT'?124:127),callStatus=exitCode===0?'COMPLETED':child.error?.code==='ETIMEDOUT'?'TIMED_OUT':'FAILED',actualModel=parsed.model||model||null;
  const metrics={input_tokens:parsed.input_tokens??null,output_tokens:parsed.output_tokens??null,context_tokens:null,duration_ms:durationMs,generation_ms:null,tool_calls:parsed.tool_calls??null,files_read:parsed.files_read??null,bytes_read:null};
  const metricProvenance={input_tokens:metrics.input_tokens===null?'UNAVAILABLE':'REPORTED',output_tokens:metrics.output_tokens===null?'UNAVAILABLE':'REPORTED',context_tokens:'UNAVAILABLE',duration_ms:'MEASURED',generation_ms:'UNAVAILABLE',tool_calls:metrics.tool_calls===null?'UNAVAILABLE':'MEASURED_FROM_STRUCTURED_RUNTIME',files_read:metrics.files_read===null?'UNAVAILABLE':'MEASURED_FROM_STRUCTURED_RUNTIME',bytes_read:'UNAVAILABLE'};
  const telemetry=await emitCall({cwd,runId:state.telemetry_run_id,taskId:state.task_id,runtime:profile.runtime_family,adapter,agent,model:actualModel,metrics,attributes:{call_status:callStatus,exit_code:exitCode,parser:profile.parser,usage_status:(metrics.input_tokens!==null||metrics.output_tokens!==null)?'REPORTED':'UNAVAILABLE',usage_source:parsed.usage_source??'unavailable',fallback_used:fallbackUsed,structured_output:profile.structured_output===true,native_agent_binding:Boolean(profile.agent_flag),launch_strategy:cliLaunchStrategy(),error_type:parsed.error_type??null,error_code:parsed.error_code??null,metric_provenance:metricProvenance}});
  if(!quiet&&child.stdout)process.stdout.write(child.stdout);if(child.stderr)process.stderr.write(child.stderr);
  return{exit_code:exitCode,call_status:callStatus,telemetry,metrics,model:actualModel,parser:profile.parser,usage_source:parsed.usage_source??'unavailable',fallback_used:fallbackUsed,error_type:parsed.error_type??null,error_code:parsed.error_code??null};
}

async function main(){const[group,command]=args;if(group!=='call'&&!(group==='agent'&&command==='call')){process.stderr.write('Usage: agent-runtime.mjs call --adapter <adapter> --agent <agent> [--model <model>] --prompt <text> [--state <state>] [--timeout-ms <ms>] [--skip-repo-check] [--quiet]\n');process.exit(2)}const offset=group==='agent'?2:1,list=args.slice(offset),cwd=process.cwd(),adapter=take(list,'--adapter',null),agent=take(list,'--agent','orchestrator'),model=take(list,'--model',null),statePath=take(list,'--state',null),timeoutMs=take(list,'--timeout-ms',null),skipRepoCheck=has(list,'--skip-repo-check'),quiet=has(list,'--quiet');try{const prompt=readPrompt(cwd,list),result=await invokeAgentCall({cwd,statePath,adapter,agent,model,prompt,quiet,timeoutMs,skipRepoCheck});if(quiet)process.stdout.write(JSON.stringify({status:'AGENT_CALL_RECORDED',adapter:resolveCanonicalAdapter(adapter),agent,model:result.model,call_status:result.call_status,exit_code:result.exit_code,usage_status:(result.metrics.input_tokens!==null||result.metrics.output_tokens!==null)?'REPORTED':'UNAVAILABLE',input_tokens:result.metrics.input_tokens,output_tokens:result.metrics.output_tokens,duration_ms:result.metrics.duration_ms,tool_calls:result.metrics.tool_calls,files_read:result.metrics.files_read,fallback_used:result.fallback_used,error_type:result.error_type??null,error_code:result.error_code??null},null,2)+'\n');process.exit(result.exit_code)}catch(e){process.stderr.write(String(e?.message||e)+'\n');process.exit(2)}}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(thisFile))await main();
