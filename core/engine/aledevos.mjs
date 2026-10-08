#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  startTaskTelemetry,
  emitGateTelemetry,
  emitJudgeTelemetry,
  emitRepairTelemetry,
  finishTaskTelemetry
} from './telemetry-bridge.mjs';

const args=process.argv.slice(2);
const cwd=process.cwd();
const defaultState=path.join(cwd,'.aledevos','state','current.json');
const defaultProject=path.join(cwd,'.aledevos','project.json');

function fail(m,c=1){console.error(m);process.exit(c)}
function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''))}
function writeJson(p,v){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n','utf8')}
function take(f,d=null){const i=args.indexOf(f);return i>=0&&i+1<args.length?args[i+1]:d}
function takes(f){const o=[];for(let i=0;i<args.length;i++)if(args[i]===f&&i+1<args.length)o.push(args[i+1]);return o}
function norm(s){return String(s).replaceAll('\\','/').replace(/^\.\//,'')}
function globRx(g){let r='^';for(const c of g){if(c==='*')r+='.*';else if(c==='?')r+='.';else r+=c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}return new RegExp(r+'$',process.platform==='win32'?'i':'')}
function matches(f,ps){f=norm(f);return (ps||[]).some(p=>globRx(norm(p)).test(f))}
function statePath(){return take('--state',defaultState)}
function safeTaskId(v){return String(v).replace(/[^a-zA-Z0-9._-]/g,'_')}
function taskStateDir(taskId){return path.join(cwd,'.aledevos','state','tasks',safeTaskId(taskId))}
function taskContractPath(taskId){return path.join(taskStateDir(taskId),'task-contract.json')}
function loadState(){const p=statePath();if(!fs.existsSync(p))fail(`STATE_NOT_FOUND: ${p}`,2);return[p,readJson(p)]}
function event(s,type,data={}){s.history??=[];s.history.push({at:new Date().toISOString(),type,...data})}
function persistState(p,s){writeJson(p,s);if(s?.task_id)writeJson(path.join(taskStateDir(s.task_id),'state.json'),s)}
function saveGate(id,status,details={}){
 if(!fs.existsSync(statePath()))return;
 const[p,s]=loadState();
 s.gates[id]={status,at:new Date().toISOString(),...details};
 event(s,'GATE',{id,status});
 persistState(p,s);
 emitGateTelemetry({cwd,runId:s.telemetry_run_id??null,taskId:s.task_id,adapter:s.runtime_adapter??null,gateId:id,status});
}
function sha256File(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}
function sha256Json(v){return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex')}
const qualityPolicyPath=path.join(cwd,'.aledevos','quality-engineering','policies','quality-engineering-policy.json');
function qualityPlanPath(taskId){return path.join(taskStateDir(taskId),'quality-plan.json')}
function loadQualityPolicy(){if(!fs.existsSync(qualityPolicyPath))fail(`QUALITY_POLICY_NOT_FOUND: ${qualityPolicyPath}`,20);return readJson(qualityPolicyPath)}
function loadQualityPlan(taskId){const p=qualityPlanPath(taskId);if(!fs.existsSync(p))fail(`QUALITY_PLAN_NOT_FOUND: ${p}`,21);return[p,readJson(p)]}
function parseBool(v,d=false){if(v===null||v===undefined)return d;const s=String(v).toLowerCase();if(['true','1','yes'].includes(s))return true;if(['false','0','no'].includes(s))return false;fail(`INVALID_BOOLEAN: ${v}`,22)}
function recordQualityState(s,status,planPath){s.quality_engineering??={required:true,status:'UNPLANNED',plan_path:null};s.quality_engineering.status=status;s.quality_engineering.plan_path=planPath?norm(path.relative(cwd,planPath)):s.quality_engineering.plan_path}
function qualityEvidenceRefValid(ref,s){
 const raw=String(ref||'');
 if(raw.startsWith('gate:canonical/')){
  const id=raw.slice('gate:canonical/'.length);
  return s.gates?.canonical?.status==='PASS'&&(s.gates.canonical.results||[]).some(x=>x.id===id&&x.status==='PASS');
 }
 if(raw.startsWith('gate:')){
  const id=raw.slice('gate:'.length);
  return s.gates?.[id]?.status==='PASS';
 }
 const rel=norm(raw.replace(/^file:/,''));
 if(!rel||path.isAbsolute(rel)||rel.startsWith('../'))return false;
 const abs=path.resolve(cwd,rel),root=path.resolve(cwd)+path.sep;
 return (abs+path.sep).startsWith(root)||abs===path.resolve(cwd)?fs.existsSync(abs):false
}

function changedPaths(){
 const r=spawnSync('git',['status','--porcelain=v1','-uall'],{cwd,encoding:'utf8',windowsHide:true});
 if(r.status!==0)fail(`GIT_STATUS_FAILED: ${r.stderr||r.stdout}`,3);
 const out=[];for(const line of r.stdout.split(/\r?\n/)){if(!line.trim())continue;let p=line.slice(3).trim();if(p.includes(' -> '))p=p.split(' -> ').pop();out.push(norm(p.replace(/^"|"$/g,'')))}return[...new Set(out)]
}
function newAbstractionCandidates(policy){
 const r=spawnSync('git',['status','--porcelain=v1','-uall'],{cwd,encoding:'utf8',windowsHide:true});
 if(r.status!==0)return[];
 const segments=new Set((policy.reuse_contract?.candidate_path_segments||[]).map(x=>String(x).toLowerCase()));
 const extensions=new Set((policy.reuse_contract?.code_extensions||[]).map(x=>String(x).toLowerCase()));
 const out=[];
 for(const line of r.stdout.split(/\r?\n/)){
  if(!line.trim())continue;
  const status=line.slice(0,2);
  if(!(status==='??'||status.includes('A')))continue;
  let rel=line.slice(3).trim();if(rel.includes(' -> '))rel=rel.split(' -> ').pop();rel=norm(rel.replace(/^"|"$/g,''));
  if(!rel||rel.startsWith('.aledevos/')||rel.split('/')[0].startsWith('.')||rel.startsWith('.agents/')||rel.startsWith('.git/'))continue;
  if(/(^|\/)(tests?|__tests__|specs?)(\/|$)/i.test(rel))continue;
  if(!extensions.has(path.extname(rel).toLowerCase()))continue;
  const dirs=rel.toLowerCase().split('/').slice(0,-1);
  if(dirs.some(x=>segments.has(x)))out.push(rel);
 }
 return[...new Set(out)];
}

function verifyGateIntegrity(project){
 const drift=[];
 const pkgPath=path.join(cwd,'package.json');
 const expectedScripts=project.gate_integrity?.package_scripts||{};
 if(Object.keys(expectedScripts).length){
  if(!fs.existsSync(pkgPath))drift.push({path:'package.json',reason:'missing'});
  else{
   const pkg=readJson(pkgPath);
   for(const [name,expected] of Object.entries(expectedScripts)){
    const actual=pkg.scripts?.[name]??null;
    if(actual!==expected)drift.push({path:'package.json',field:`scripts.${name}`,expected,actual});
   }
  }
 }
 for(const [rel,expected] of Object.entries(project.gate_integrity?.files||{})){
  const fp=path.join(cwd,rel);
  if(!fs.existsSync(fp))drift.push({path:rel,reason:'missing'});
  else {const actual=sha256File(fp);if(actual!==expected)drift.push({path:rel,expected,actual})}
 }
 return drift;
}

const [group,cmd]=args;

if(group==='state'&&cmd==='init'){
 const requested=take('--task-id');if(!requested)fail('Missing --task-id');
 const task=requested==='auto'?(`task-${new Date().toISOString().replace(/\D/g,'').slice(0,14)}-${crypto.randomBytes(3).toString('hex')}`):requested;
 const scope=takes('--scope').map(norm),criteria=takes('--criterion'),adapter=take('--adapter',null),objective=take('--objective',''),benchmarkKey=take('--benchmark-key',null),createdAt=new Date().toISOString();
 const acceptance=criteria.map(id=>({id,status:'UNVERIFIED'}));
 const contract={schema_version:'1.0',task_id:task,adapter,objective,approved_scope:scope,acceptance_criteria:acceptance.map(x=>x.id),created_at:createdAt,integrity:{algorithm:'sha256',payload_sha256:''}};
 contract.integrity.payload_sha256=sha256Json({...contract,integrity:undefined});
 const contractPath=taskContractPath(task);writeJson(contractPath,contract);
 const telemetry=startTaskTelemetry({cwd,taskId:task,adapter,benchmarkKey});
 const telemetryStatus=telemetry.disabled?'DISABLED':telemetry.ok?'ACTIVE':'DEGRADED';
 const s={version:1,task_id:task,runtime_adapter:adapter,telemetry_run_id:telemetry.run_id??null,telemetry_status:telemetryStatus,telemetry_benchmark_key:benchmarkKey,task_contract_path:norm(path.relative(cwd,contractPath)),approved_scope:scope,scope_version:1,acceptance_criteria:acceptance,gates:{},judges:{},blockers:[],repair_count:0,max_repairs:2,blocked_reason:null,final_state:null,quality_engineering:{required:true,status:'UNPLANNED',plan_path:null},agent_trace:[{agent:'orchestrator',status:'STARTED',at:createdAt}],history:[]};
 event(s,'STATE_INIT',{adapter,task_contract_path:s.task_contract_path});persistState(statePath(),s);
 console.log('STATE_INITIALIZED');console.log(JSON.stringify({task_id:task,task_contract:s.task_contract_path,state:norm(path.relative(cwd,statePath())),telemetry_run_id:s.telemetry_run_id,telemetry_status:s.telemetry_status},null,2));process.exit(0)
}
if(group==='state'&&cmd==='show'){const[,s]=loadState();console.log(JSON.stringify(s,null,2));process.exit(0)}
if(group==='state'&&cmd==='scope-approve'){
 const[p,s]=loadState(),add=takes('--add').map(norm);if(!add.length)fail('Missing --add');for(const f of add)if(!s.approved_scope.includes(f))s.approved_scope.push(f);s.scope_version+=1;event(s,'SCOPE_APPROVED',{added:add,scope_version:s.scope_version});persistState(p,s);console.log('SCOPE_APPROVED');process.exit(0)
}
if(group==='state'&&cmd==='criterion'){
 const[p,s]=loadState(),id=take('--id'),status=take('--status');if(!['UNVERIFIED','VERIFIED','FAILED'].includes(status))fail('Invalid --status');const c=s.acceptance_criteria.find(x=>x.id===id);if(!c)fail(`Unknown criterion: ${id}`);c.status=status;event(s,'CRITERION',{id,status});persistState(p,s);console.log('CRITERION_RECORDED');process.exit(0)
}
if(group==='state'&&cmd==='judge'){
 const[p,s]=loadState(),judge=take('--judge'),score=Number(take('--score')),blockers=Number(take('--blockers','0')),unverified=Number(take('--unverified','0'));
 if(!['requirements','regression','quality'].includes(judge))fail('Invalid judge');if(!Number.isFinite(score)||score<0||score>100)fail('Invalid score');if(!Number.isInteger(blockers)||blockers<0||!Number.isInteger(unverified)||unverified<0)fail('Invalid blocker/unverified count');
 if(s.runtime_adapter==='codex'){
  const role=`judge-${judge}`,trace=s.agent_trace||[];
  if(!trace.some(x=>x.agent===role&&x.status==='STARTED'))fail(`CODEX_JUDGE_ROLE_NOT_STARTED: ${role}`,48);
  if(['scope','integrity','canonical','quality_engineering'].some(id=>s.gates?.[id]?.status!=='PASS'))fail('CODEX_JUDGE_GATES_NOT_PASS',49);
 }
 s.judges[judge]={score,blockers,unverified,at:new Date().toISOString()};
 event(s,'JUDGE',{judge,score,blockers,unverified});
 if(s.runtime_adapter==='codex'){
  const role=`judge-${judge}`,trace=s.agent_trace||[];
  if(!trace.some(x=>x.agent===role&&x.status==='COMPLETED')){
   const rec={agent:role,status:'COMPLETED',thread_id:null,at:new Date().toISOString()};
   s.agent_trace.push(rec);event(s,'AGENT',rec);
  }
 }
 persistState(p,s);
 emitJudgeTelemetry({cwd,runId:s.telemetry_run_id??null,taskId:s.task_id,adapter:s.runtime_adapter??null,judge,score,blockers,unverified});
 console.log('JUDGE_RECORDED');process.exit(0)
}
if(group==='state'&&cmd==='agent'){
 const[p,s]=loadState(),name=take('--name'),status=take('--status'),threadId=take('--thread-id',null);
 if(!name)fail('Missing --name');if(!['STARTED','COMPLETED','BLOCKED','FAILED'].includes(status))fail('Invalid --status');
 if(s.runtime_adapter==='codex'){
  const governed=new Set(['orchestrator','architect','auditor','builder','design-system-guardian','editor-backend','editor-config','editor-database','editor-frontend','editor-tests','judge-quality','judge-regression','judge-requirements','judge-uxui','motion-director','repairer','researcher','security-reviewer','v1-release-validator','verifier','visual-capture-runner','visual-judge','visual-regression-runner','visual-repair-controller','visual-runtime-audit-runner']);
  if(!governed.has(name))fail(`CODEX_AGENT_UNKNOWN: ${name}`,42);
  const trace=s.agent_trace||[],has=(agent,st)=>trace.some(x=>x.agent===agent&&x.status===st);
  const judgeNames=new Set(['judge-requirements','judge-regression','judge-quality']);
  if(status==='STARTED'){
   if(name==='builder'&&!s.approved_scope?.length)fail('CODEX_BUILDER_SCOPE_REQUIRED',43);
   if(name==='verifier'&&!has('builder','COMPLETED'))fail('CODEX_VERIFIER_REQUIRES_BUILDER',44);
   if(judgeNames.has(name)){
    if(!has('verifier','COMPLETED'))fail('CODEX_JUDGES_REQUIRE_VERIFIER',45);
    if(['scope','integrity','canonical','quality_engineering'].some(id=>s.gates?.[id]?.status!=='PASS'))fail('CODEX_JUDGES_REQUIRE_ALL_GATES_PASS',46);
   }
  }
  if(status==='COMPLETED'&&!has(name,'STARTED'))fail(`CODEX_AGENT_COMPLETION_WITHOUT_START: ${name}`,47);
 }
 s.agent_trace??=[];const rec={agent:name,status,thread_id:threadId,at:new Date().toISOString()};s.agent_trace.push(rec);event(s,'AGENT',rec);persistState(p,s);console.log('AGENT_RECORDED');process.exit(0)
}
if(group==='state'&&cmd==='block'){
 const[p,s]=loadState(),reason=take('--reason');if(!reason)fail('Missing --reason');s.blocked_reason=reason;event(s,'BLOCKED',{reason});persistState(p,s);console.log('BLOCK_RECORDED');process.exit(0)
}
if(group==='state'&&cmd==='repair-start'){
 const[p,s]=loadState();
 if(s.repair_count>=s.max_repairs){console.log('MAX_REPAIRS_REACHED');process.exit(4)}
 s.repair_count+=1;event(s,'REPAIR_START',{repair_count:s.repair_count});persistState(p,s);
 emitRepairTelemetry({cwd,runId:s.telemetry_run_id??null,taskId:s.task_id,adapter:s.runtime_adapter??null,repairCount:s.repair_count});
 console.log(`REPAIR_${s.repair_count}_STARTED`);process.exit(0)
}
if(group==='state'&&cmd==='finalize'){
 const[p,s]=loadState();if(s.blocked_reason)s.final_state='BLOCKED';else{
  const requiredGates=['scope','integrity','canonical'];
  if(s.quality_engineering?.required)requiredGates.push('quality_engineering');
  const gatePass=requiredGates.every(k=>s.gates[k]?.status==='PASS');
  const req=['requirements','regression','quality'];
  const judgesReady=req.every(k=>s.judges[k]&&s.judges[k].score>=90&&s.judges[k].blockers===0&&s.judges[k].unverified===0);
  const requiredCodexAgents=['builder','verifier','judge-requirements','judge-regression','judge-quality'];
  const completedAgents=new Set((s.agent_trace||[]).filter(x=>x.status==='COMPLETED').map(x=>x.agent));
  const missingCodexAgents=s.runtime_adapter==='codex'?requiredCodexAgents.filter(x=>!completedAgents.has(x)):[];
  const criteriaUnverified=s.acceptance_criteria.filter(c=>c.status!=='VERIFIED').length;
  const blockers=req.reduce((n,k)=>n+(s.judges[k]?.blockers||0),0)+(s.blockers||[]).length;
  if(gatePass&&judgesReady&&criteriaUnverified===0&&blockers===0&&missingCodexAgents.length===0)s.final_state='PASS';
  else if(s.repair_count>=s.max_repairs)s.final_state='FAILED';
  else{if(missingCodexAgents.length)console.error(`NOT_FINAL_REQUIRED_AGENT_EVIDENCE:${missingCodexAgents.join(',')}`);else console.log('NOT_FINAL');process.exit(5)}
 }
 event(s,'FINAL',{state:s.final_state});persistState(p,s);
 const telemetry=finishTaskTelemetry({cwd,runId:s.telemetry_run_id??null,taskId:s.task_id,adapter:s.runtime_adapter??null,finalState:s.final_state});
 s.telemetry_status=telemetry.disabled?'DISABLED':telemetry.ok?'VERIFIED':'DEGRADED';
 s.telemetry_summary_path=telemetry.summary_path??null;
 persistState(p,s);
 console.log(s.final_state);process.exit(s.final_state==='PASS'?0:s.final_state==='BLOCKED'?6:7)
}

if(group==='quality'&&cmd==='plan'){
 const[p,s]=loadState(),policy=loadQualityPolicy(),changeClass=take('--change-class'),risk=take('--risk','medium');
 if(!changeClass||!policy.change_classes?.[changeClass])fail(`QUALITY_CHANGE_CLASS_INVALID: ${changeClass||'missing'}`,23);
 if(!['low','medium','high','critical'].includes(risk))fail(`QUALITY_RISK_INVALID: ${risk}`,24);
 const requirements={...policy.change_classes[changeClass]};
 const planPath=qualityPlanPath(s.task_id),now=new Date().toISOString();
 const plan={schema_version:'1.0',task_id:s.task_id,change_class:changeClass,risk,requirements,evidence:[],reuse:{decision:'UNSET',target:null,evidence:null,reason:null},status:'OPEN',created_at:now,updated_at:now};
 writeJson(planPath,plan);recordQualityState(s,'OPEN',planPath);event(s,'QUALITY_PLAN',{change_class:changeClass,risk,plan_path:norm(path.relative(cwd,planPath))});persistState(p,s);
 console.log(JSON.stringify({status:'QUALITY_PLAN_CREATED',task_id:s.task_id,change_class:changeClass,risk,requirements,plan_path:norm(path.relative(cwd,planPath))},null,2));process.exit(0)
}
if(group==='quality'&&cmd==='evidence'){
 const[p,s]=loadState(),policy=loadQualityPolicy(),[planPath,plan]=loadQualityPlan(s.task_id);
 const type=take('--type'),ref=take('--ref'),source=take('--source',null),layer=take('--layer',null),coverage=take('--coverage','none'),regression=parseBool(take('--regression','false'));
 const allowedTypes=['test','regression-analysis','diff-review','visual-qa','canonical-gate','other'];
 if(!allowedTypes.includes(type))fail(`QUALITY_EVIDENCE_TYPE_INVALID: ${type}`,25);
 if(!ref)fail('QUALITY_EVIDENCE_REF_REQUIRED',26);
 if(type==='test'&&(!layer||!policy.allowed_test_layers?.includes(layer)))fail(`QUALITY_TEST_LAYER_INVALID: ${layer||'missing'}`,27);
 if(type==='test'&&!source)fail('QUALITY_TEST_SOURCE_REQUIRED',35);
 if(!['happy','edge','error','regression','compatibility','none'].includes(coverage))fail(`QUALITY_COVERAGE_INVALID: ${coverage}`,28);
 plan.evidence.push({type,ref,source,layer,coverage,regression,at:new Date().toISOString()});plan.updated_at=new Date().toISOString();plan.status='OPEN';writeJson(planPath,plan);recordQualityState(s,'OPEN',planPath);event(s,'QUALITY_EVIDENCE',{type,ref,source,layer,coverage,regression});persistState(p,s);
 console.log('QUALITY_EVIDENCE_RECORDED');process.exit(0)
}
if(group==='quality'&&cmd==='reuse'){
 const[p,s]=loadState(),policy=loadQualityPolicy(),[planPath,plan]=loadQualityPlan(s.task_id);
 const decision=take('--decision'),target=take('--target',null),evidence=take('--evidence',null),reason=take('--reason',null);
 if(!policy.reuse_decisions?.includes(decision))fail(`QUALITY_REUSE_DECISION_INVALID: ${decision||'missing'}`,29);
 if(decision==='NOT_APPLICABLE'){if(!reason)fail('QUALITY_REUSE_REASON_REQUIRED',30)}
 else{
  if(!target||!policy.reuse_targets?.includes(target))fail(`QUALITY_REUSE_TARGET_INVALID: ${target||'missing'}`,31);
  if(!evidence)fail('QUALITY_REUSE_EVIDENCE_REQUIRED',32);
  if(decision==='CREATE_NEW'&&!reason)fail('QUALITY_REUSE_CREATE_REASON_REQUIRED',33);
 }
 plan.reuse={decision,target,evidence,reason};plan.updated_at=new Date().toISOString();plan.status='OPEN';writeJson(planPath,plan);recordQualityState(s,'OPEN',planPath);event(s,'QUALITY_REUSE',{decision,target,evidence});persistState(p,s);
 console.log('QUALITY_REUSE_RECORDED');process.exit(0)
}
if(group==='quality'&&cmd==='verify'){
 const[p,s]=loadState(),policy=loadQualityPolicy(),[planPath,plan]=loadQualityPlan(s.task_id),missing=[];
 const ev=plan.evidence||[],req=plan.requirements||{},abstractionCandidates=newAbstractionCandidates(policy);
 const invalidEvidence=ev.filter(x=>!qualityEvidenceRefValid(x.ref,s));
 if(invalidEvidence.length)missing.push('invalid-evidence-ref');
 const tests=ev.filter(x=>x.type==='test');
 const invalidTestExecution=tests.filter(x=>!String(x.ref||'').startsWith('gate:canonical/'));
 const invalidTestSource=tests.filter(x=>!x.source||!qualityEvidenceRefValid(x.source,s));
 if(invalidTestExecution.length)missing.push('test-execution-evidence');
 if(invalidTestSource.length)missing.push('test-source-evidence');
 if(req.tests_required&&tests.length===0)missing.push('tests');
 if(req.tests_required&&s.gates?.canonical?.status!=='PASS')missing.push('canonical-gate-pass');
 if(req.regression_test_required&&!tests.some(x=>x.regression===true||x.coverage==='regression'))missing.push('regression-test');
 if(plan.change_class==='feature'&&req.tests_required){
  if(!tests.some(x=>x.coverage==='happy'))missing.push('feature-happy-path');
  if(!tests.some(x=>x.coverage==='edge'||x.coverage==='error'))missing.push('feature-edge-or-error-path');
 }
 if(req.regression_analysis_required&&!ev.some(x=>x.type==='regression-analysis'))missing.push('regression-analysis');
 if(req.diff_review_required&&!ev.some(x=>x.type==='diff-review'))missing.push('diff-review');
 if(req.visual_qa_required&&!ev.some(x=>x.type==='visual-qa'))missing.push('visual-qa');
 if(req.reuse_decision_required&&plan.reuse?.decision==='UNSET')missing.push('reuse-decision');
 if(abstractionCandidates.length&&plan.reuse?.decision==='UNSET')missing.push('reuse-decision-autodetected');
 if(plan.reuse?.decision==='CREATE_NEW'&&(!plan.reuse.reason||!plan.reuse.evidence))missing.push('create-new-justification');
 if(plan.reuse?.decision&&plan.reuse.decision!=='UNSET'&&plan.reuse.decision!=='NOT_APPLICABLE'&&!plan.reuse.evidence)missing.push('reuse-evidence');
 if(plan.reuse?.decision&&plan.reuse.decision!=='UNSET'&&plan.reuse.decision!=='NOT_APPLICABLE'&&plan.reuse.evidence&&!qualityEvidenceRefValid(plan.reuse.evidence,s))missing.push('reuse-evidence-ref');
 if(plan.reuse?.decision==='NOT_APPLICABLE'&&!plan.reuse.reason)missing.push('reuse-not-applicable-reason');
 const status=missing.length?'BLOCKED':'PASS';plan.status=status;plan.updated_at=new Date().toISOString();plan.verification={at:plan.updated_at,missing,abstraction_candidates:abstractionCandidates};writeJson(planPath,plan);recordQualityState(s,status,planPath);event(s,'QUALITY_VERIFY',{status,missing,abstraction_candidates:abstractionCandidates});persistState(p,s);saveGate('quality_engineering',status,{plan_path:norm(path.relative(cwd,planPath)),change_class:plan.change_class,missing,abstraction_candidates:abstractionCandidates});
 console.log(JSON.stringify({status:status==='PASS'?'QUALITY_ENGINEERING_PASS':'QUALITY_ENGINEERING_BLOCKED',task_id:s.task_id,change_class:plan.change_class,missing,abstraction_candidates:abstractionCandidates,plan_path:norm(path.relative(cwd,planPath))},null,2));process.exit(status==='PASS'?0:34)
}

if(group==='scope'&&cmd==='check'){
 const[,s]=loadState(),project=fs.existsSync(defaultProject)?readJson(defaultProject):{protected_paths:[]},changed=changedPaths(),forbidden=[],outside=[];
 for(const f of changed){if(matches(f,project.protected_paths||[]))forbidden.push(f);else if(!matches(f,s.approved_scope||[]))outside.push(f)}
 if(forbidden.length){saveGate('scope','FAIL',{reason:'PROTECTED_PATH',paths:forbidden});console.log(JSON.stringify({status:'PROTECTED_PATH',paths:forbidden},null,2));process.exit(8)}
 if(outside.length){saveGate('scope','FAIL',{reason:'SCOPE_ESCALATION',paths:outside});console.log(JSON.stringify({status:'SCOPE_ESCALATION',paths:outside},null,2));process.exit(9)}
 saveGate('scope','PASS',{paths:changed});console.log(JSON.stringify({status:'IN_SCOPE',paths:changed},null,2));process.exit(0)
}

if(group==='integrity'&&cmd==='scan'){
 const project=fs.existsSync(defaultProject)?readJson(defaultProject):{test_patterns:['tests/**','**/*.test.*','**/*.spec.*']},changed=changedPaths(),suspicious=[];
 const rx=/(\b(?:it|test|describe)\.(?:skip|only)\b|--passWithNoTests|passWithNoTests\s*[:=]\s*true)/;
 for(const f of changed){
  if(!matches(f,project.test_patterns||[]))continue;
  const fp=path.join(cwd,f);if(!fs.existsSync(fp)||!fs.statSync(fp).isFile())continue;
  const tracked=spawnSync('git',['ls-files','--error-unmatch','--',f],{cwd,encoding:'utf8',windowsHide:true}).status===0;
  let text='';
  if(tracked){const d=spawnSync('git',['diff','--unified=0','HEAD','--',f],{cwd,encoding:'utf8',windowsHide:true});text=(d.stdout||'').split(/\r?\n/).filter(x=>x.startsWith('+')&&!x.startsWith('+++')).join('\n')}
  else text=fs.readFileSync(fp,'utf8');
  if(rx.test(text))suspicious.push(f)
 }
 if(suspicious.length){saveGate('integrity','FAIL',{paths:suspicious});console.log(JSON.stringify({status:'TEST_INTEGRITY_FAIL',paths:suspicious},null,2));process.exit(10)}
 saveGate('integrity','PASS');console.log(JSON.stringify({status:'TEST_INTEGRITY_PASS'},null,2));process.exit(0)
}

if(group==='gate'&&cmd==='run'){
 if(!fs.existsSync(defaultProject)){saveGate('canonical','FAIL',{reason:'PROJECT_CONFIG_NOT_FOUND'});fail(`PROJECT_CONFIG_NOT_FOUND: ${defaultProject}`,11)}
 const project=readJson(defaultProject);if(!project.configured){saveGate('canonical','FAIL',{reason:'PROJECT_GATES_NOT_CONFIGURED'});fail('PROJECT_GATES_NOT_CONFIGURED',12)}
 const drift=verifyGateIntegrity(project);if(drift.length){saveGate('canonical','FAIL',{reason:'GATE_INTEGRITY_DRIFT',drift});console.log(JSON.stringify({status:'GATE_INTEGRITY_DRIFT',drift},null,2));process.exit(14)}
 const results=[];
 for(const g of project.gates||[]){if(!g.required)continue;const timeout=(g.timeout_seconds||600)*1000;const r=spawnSync(g.command,{cwd,shell:true,encoding:'utf8',windowsHide:true,timeout});results.push({id:g.id,command:g.command,status:r.status===0?'PASS':'FAIL',exit_code:r.status,stdout:(r.stdout||'').slice(-8000),stderr:(r.stderr||'').slice(-8000)});if(r.status!==0){saveGate('canonical','FAIL',{results});console.log(JSON.stringify({status:'GATE_FAIL',results},null,2));process.exit(13)}}
 saveGate('canonical','PASS',{results});console.log(JSON.stringify({status:'GATE_PASS',results},null,2));process.exit(0)
}

console.log('AleDevOS control runtime\nCommands: state init/show/scope-approve/criterion/judge/agent/block/repair-start/finalize | quality plan/evidence/reuse/verify | scope check | integrity scan | gate run');
