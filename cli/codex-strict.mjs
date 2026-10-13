#!/usr/bin/env node
/**
 * Project-scoped, fail-closed task ingress for the Codex CLI.
 *
 * This is not a replacement provider or a native Codex agent selector.
 * It owns task bootstrap and acceptance OUTSIDE the model process. A Codex
 * answer cannot be marked successful without AleDevOS state evidence.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const args=process.argv.slice(2);
function option(name){const i=args.indexOf(name);return i<0?null:args[i+1]??null;}
function fail(message,code=2){console.error('ALEDEVOS_STRICT_BLOCKED: '+message);process.exit(code);}
function run(exe,argv,cwd,timeout=0){
  const r=spawnSync(exe,argv,{cwd,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024,timeout});
  return {status:r.status,error:r.error,stdout:r.stdout||'',stderr:r.stderr||''};
}
function fileJson(filename){try{return JSON.parse(fs.readFileSync(filename,'utf8').replace(/^\uFEFF/,''));}catch{return null;}}
function requireFile(filename){if(!fs.existsSync(filename))fail('MISSING_PROJECT_ASSET: '+path.relative(project,filename));}
function extractCodexAnswer(stdout){
  let message=null,turnCompleted=false;
  for(const line of stdout.split(/\r?\n/)){
    if(!line.trim())continue;
    let item;try{item=JSON.parse(line);}catch{continue;}
    if(item.type==='turn.completed')turnCompleted=true;
    if(item.type==='item.completed'&&item.item?.type==='agent_message'&&typeof item.item.text==='string')message=item.item.text;
  }
  return {message,turnCompleted};
}
function recordBlock(reason){
  const state=fileJson(currentState);
  if(!state||state.final_state)return;
  run(process.execPath,[engine,'state','block','--reason',reason],project);
  run(process.execPath,[engine,'state','finalize'],project);
}
function verifiedState(expectedId){
  const state=fileJson(currentState);
  if(!state||state.task_id!==expectedId||state.runtime_adapter!=='codex'||state.final_state!=='PASS')return false;
  const taskRoot=path.join(project,'.aledevos','state','tasks',expectedId);
  const contract=fileJson(path.join(taskRoot,'task-contract.json'));
  const persisted=fileJson(path.join(taskRoot,'state.json'));
  const route=fileJson(path.join(project,'.aledevos','state','skills','routes',expectedId+'.json'));
  if(contract?.task_id!==expectedId||persisted?.task_id!==expectedId||persisted?.final_state!=='PASS')return false;
  if(route?.task_id!==expectedId||route?.status!=='ROUTE_READY'||!route.integrity?.payload_sha256)return false;
  const trace=state.agent_trace||[];
  for(const role of ['orchestrator','builder','verifier','judge-requirements','judge-regression','judge-quality']){
    if(!trace.some(t=>t.agent===role&&t.status==='COMPLETED'))return false;
  }
  if(!['scope','integrity','canonical','quality_engineering'].every(g=>state.gates?.[g]?.status==='PASS'))return false;
  return ['requirements','regression','quality'].every(j=>state.judges?.[j]?.score>=90&&state.judges[j].blockers===0&&state.judges[j].unverified===0);
}

const prompt=option('--prompt');
const projectArg=option('--project');
if(!projectArg||!prompt?.trim())fail('EXPECTED --project <path> --prompt <objective>');
const project=path.resolve(projectArg);
if(!fs.existsSync(project)||!fs.statSync(project).isDirectory())fail('PROJECT_NOT_FOUND');
const base=path.join(project,'.aledevos');
const engine=path.join(base,'runtime','aledevos.mjs');
const skills=path.join(base,'skillsystem','runtime','skillsystem.mjs');
const currentState=path.join(base,'state','current.json');
const codexConfig=path.join(project,'.codex','config.toml');
for(const p of [engine,skills,codexConfig,path.join(project,'.codex','agents','orchestrator.toml'),path.join(base,'project.json'),path.join(base,'skills','registries','codex.json')])requireFile(p);
const version=run('codex',['--version'],project);
if(version.error||version.status!==0)fail('CODEX_CLI_UNAVAILABLE_OR_UNHEALTHY');
const registry=run(process.execPath,[skills,'registry','verify','--project-root',project,'--adapter','codex'],project);
if(registry.error||registry.status!==0)fail('SKILL_REGISTRY_VERIFICATION_FAILED');
const initialized=run(process.execPath,[engine,'state','init','--task-id','auto','--adapter','codex','--objective',prompt,'--criterion','evidence-grounded','--criterion','requested-result'],project);
if(initialized.error||initialized.status!==0)fail('TASK_BOOTSTRAP_FAILED: '+(initialized.stderr||initialized.stdout).trim());
const task=fileJson(currentState);
if(!task?.task_id||task.runtime_adapter!=='codex'||task.final_state!==null)fail('INVALID_INITIAL_TASK_STATE');
const taskId=task.task_id;

const codexRootConfig=fs.readFileSync(codexConfig,'utf8');
const existingInstructions=codexRootConfig.match(/developer_instructions\s*=\s*'''([\s\S]*?)'''/)?.[1]||'';
if(!existingInstructions.trim()){recordBlock('STRICT_ROOT_POLICY_MISSING');fail('STRICT_ROOT_POLICY_MISSING',7);}
const ingressInstructions=existingInstructions+'\nSTRICT PROJECT CLI TASK '+taskId+': The task has ALREADY been initialized by the external AleDevOS controller. Delegate to the native orchestrator before any project action. Do not call state init a second time. You must not claim PASS unless the task evidence and final state exist; do not forge records. If delegation fails, report BLOCKED.\n';
const objective='AleDevOS strict task '+taskId+'. Delegate to the orchestrator first. The external controller has initialized the task. User objective:\n'+prompt;
console.log('[AleDevOS] Controlled task '+taskId+' | adapter=codex');
const codex=run('codex',['exec','--json','--enable','multi_agent','-c','developer_instructions='+JSON.stringify(ingressInstructions),objective],project);
const answer=extractCodexAnswer(codex.stdout);
const valid=codex.status===0&&!codex.error&&answer.turnCompleted&&verifiedState(taskId);
if(!valid){
  recordBlock('STRICT_ORCHESTRATION_INCOMPLETE');
  const state=fileJson(currentState);
  console.error('BLOCKED: Codex did not produce a completed, evidence-verified AleDevOS task. task_id='+taskId+' final_state='+(state?.final_state||'UNFINISHED'));
  if(codex.error)console.error('Codex process: '+codex.error.message);
  if(codex.stderr)console.error(codex.stderr.slice(-2500));
  process.exit(7);
}
console.log('PASS: verified AleDevOS orchestration task_id='+taskId);
if(answer.message)console.log(answer.message);
