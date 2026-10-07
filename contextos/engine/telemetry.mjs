import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const FORBIDDEN_KEY_RE = /^(prompt|prompt_text|completion|completion_text|transcript|conversation|messages|file_content|raw_content|secret|secrets|api[_-]?key|password|authorization|cookie|access[_-]?token|refresh[_-]?token)$/i;
const EVENT_KINDS = new Set([
  'RUN_START','RUN_END','AGENT_CALL','CONTEXT_SAMPLE','HANDOFF','CHECKPOINT','COMPACTION','RESUME',
  'RESEARCH_CACHE','KNOWLEDGE_REFRESH','FILE_READ','GATE','JUDGE','REPAIR','FINAL_STATE'
]);
const PROVENANCE = new Set(['MEASURED','REPORTED','DERIVED']);
const CACHE_STATES = new Set(['HIT','MISS','STALE','INVALID']);
const FINAL_STATES = new Set(['PASS','BLOCKED','FAILED']);
const GATE_STATES = new Set(['PASS','FAIL','BLOCKED','SKIPPED']);
const PRESSURE = new Set(['NORMAL','WATCH','CHECKPOINT_REQUIRED','COMPACT_REQUIRED','HARD_GUARD']);

function canonicalize(value){
  if(Array.isArray(value)) return '['+value.map(canonicalize).join(',')+']';
  if(value&&typeof value==='object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalize(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
function sha256Text(s){return crypto.createHash('sha256').update(s).digest('hex')}
function sha256Object(v){return sha256Text(canonicalize(v))}
function safeId(v,label='id'){const s=String(v||'');if(!/^[A-Za-z0-9._-]{1,160}$/.test(s))throw new Error(`INVALID_${label.toUpperCase()}:${s}`);return s}
function atomicWriteJson(p,v){fs.mkdirSync(path.dirname(p),{recursive:true});const t=`${p}.tmp-${process.pid}-${Date.now()}`;fs.writeFileSync(t,JSON.stringify(v,null,2)+'\n','utf8');fs.renameSync(t,p)}
function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''))}
function telemetryCfg(policy){return policy?.telemetry||{}}
function rootDir(cwd,policy){return path.resolve(cwd,telemetryCfg(policy).output_dir||'.aledevos/state/telemetry/contextos')}
function runDir(cwd,policy,runId){return path.join(rootDir(cwd,policy),'runs',safeId(runId,'run_id'))}
function runMetaPath(cwd,policy,runId){return path.join(runDir(cwd,policy,runId),'run.json')}
function eventsPath(cwd,policy,runId){return path.join(runDir(cwd,policy,runId),'events.jsonl')}
function summaryPath(cwd,policy,runId){return path.join(runDir(cwd,policy,runId),'summary.json')}
function comparisonsDir(cwd,policy){return path.join(rootDir(cwd,policy),'comparisons')}
function isNonNegativeNumber(v){return typeof v==='number'&&Number.isFinite(v)&&v>=0}
function assertNoSensitive(value,pathName='root'){
  if(Array.isArray(value)){value.forEach((v,i)=>assertNoSensitive(v,`${pathName}[${i}]`));return}
  if(!value||typeof value!=='object')return;
  for(const [k,v] of Object.entries(value)){
    if(FORBIDDEN_KEY_RE.test(k))throw new Error(`TELEMETRY_SENSITIVE_FIELD_FORBIDDEN:${pathName}.${k}`);
    assertNoSensitive(v,`${pathName}.${k}`);
  }
}
function normalizeSource(source={}){
  return {
    runtime: source.runtime??null,
    adapter: source.adapter??null,
    agent: source.agent??null,
    model: source.model??null,
    provenance: source.provenance??'REPORTED'
  };
}
function validateSource(source){
  const errors=[];
  if(!source||typeof source!=='object')return ['source:must_be_object'];
  for(const k of ['runtime','adapter','agent','model','provenance'])if(!(k in source))errors.push(`source.${k}:missing`);
  if(!PROVENANCE.has(source.provenance))errors.push('source.provenance:invalid');
  for(const k of ['runtime','adapter','agent','model'])if(source[k]!==null&&source[k]!==undefined&&typeof source[k]!=='string')errors.push(`source.${k}:must_be_string_or_null`);
  return errors;
}
function validateMetrics(kind,m={}){
  const errors=[];
  if(!m||typeof m!=='object'||Array.isArray(m))return ['metrics:must_be_object'];
  const nums=['input_tokens','output_tokens','context_tokens','duration_ms','generation_ms','decode_tokens_per_sec','prefill_tokens_per_sec','tool_calls','files_read','bytes_read','estimated_tokens','bytes','before_tokens','after_tokens','saved_tokens','avoided_reads','scanned_files','reparsed_files','reused_files','added_files','changed_files','deleted_files','research_invalidated','score','blockers','repair_count'];
  for(const k of nums)if(m[k]!==undefined&&m[k]!==null&&!isNonNegativeNumber(m[k]))errors.push(`metrics.${k}:must_be_nonnegative_number_or_null`);
  if(m.pressure_band!==undefined&&!PRESSURE.has(m.pressure_band))errors.push('metrics.pressure_band:invalid');
  if(m.cache_status!==undefined&&!CACHE_STATES.has(m.cache_status))errors.push('metrics.cache_status:invalid');
  if(m.gate_status!==undefined&&!GATE_STATES.has(m.gate_status))errors.push('metrics.gate_status:invalid');
  if(m.final_state!==undefined&&!FINAL_STATES.has(m.final_state))errors.push('metrics.final_state:invalid');
  if(m.score!==undefined&&m.score!==null&&m.score>100)errors.push('metrics.score:max_100');
  if(kind==='RESEARCH_CACHE'&&!CACHE_STATES.has(m.cache_status))errors.push('metrics.cache_status:required');
  if(kind==='CONTEXT_SAMPLE'&&!isNonNegativeNumber(m.context_tokens))errors.push('metrics.context_tokens:required');
  if(kind==='GATE'&&!GATE_STATES.has(m.gate_status))errors.push('metrics.gate_status:required');
  if(kind==='JUDGE'&&!isNonNegativeNumber(m.score))errors.push('metrics.score:required');
  if(kind==='REPAIR'&&!isNonNegativeNumber(m.repair_count))errors.push('metrics.repair_count:required');
  if(kind==='FINAL_STATE'&&!FINAL_STATES.has(m.final_state))errors.push('metrics.final_state:required');
  return [...new Set(errors)];
}
export function validateTelemetryEvent(event,policy){
  const errors=[];
  for(const k of ['version','event_id','run_id','task_id','timestamp','kind','source','metrics'])if(event?.[k]===undefined)errors.push(`missing:${k}`);
  if(event?.version!=='1.0.0')errors.push('version:must_equal_1.0.0');
  try{safeId(event?.event_id,'event_id')}catch(e){errors.push(String(e.message))}
  try{safeId(event?.run_id,'run_id')}catch(e){errors.push(String(e.message))}
  if(typeof event?.task_id!=='string'||event.task_id.length===0)errors.push('task_id:must_be_nonempty_string');
  if(!Number.isFinite(Date.parse(event?.timestamp)))errors.push('timestamp:invalid');
  if(!EVENT_KINDS.has(event?.kind))errors.push('kind:invalid');
  errors.push(...validateSource(event?.source));
  errors.push(...validateMetrics(event?.kind,event?.metrics));
  try{assertNoSensitive(event)}catch(e){errors.push(String(e.message))}
  const maxBytes=Number(telemetryCfg(policy).max_event_bytes||16384);
  const bytes=Buffer.byteLength(JSON.stringify(event),'utf8');
  if(bytes>maxBytes)errors.push(`event:too_large:${bytes}`);
  return {valid:errors.length===0,errors:[...new Set(errors)],bytes};
}
function runPayload(meta){const x=structuredClone(meta);delete x.integrity;return x}
function summaryPayload(summary){const x=structuredClone(summary);delete x.integrity;return x}
function eventPayload(record){const x=structuredClone(record);delete x.integrity;return x}
function validateRunMeta(meta){
  const errors=[];
  for(const k of ['version','run_id','task_id','benchmark_key','runtime','adapter','model','runtime_profile','started_at','integrity'])if(meta?.[k]===undefined)errors.push(`missing:${k}`);
  if(meta?.version!=='1.0.0')errors.push('version:must_equal_1.0.0');
  try{safeId(meta?.run_id,'run_id')}catch(e){errors.push(String(e.message))}
  if(!Number.isFinite(Date.parse(meta?.started_at)))errors.push('started_at:invalid');
  if(meta?.integrity?.algorithm!=='sha256')errors.push('integrity.algorithm:must_equal_sha256');
  const expected=sha256Object(runPayload(meta));if(meta?.integrity?.payload_sha256!==expected)errors.push('integrity.payload_sha256:mismatch');
  return {valid:errors.length===0,errors};
}
export function startTelemetryRun({cwd,policy,input,now=new Date()}){
  assertNoSensitive(input);
  const runId=safeId(input.run_id,'run_id'),p=runMetaPath(cwd,policy,runId);
  if(fs.existsSync(p))throw new Error('TELEMETRY_RUN_ALREADY_EXISTS');
  const meta={version:'1.0.0',run_id:runId,task_id:String(input.task_id||''),benchmark_key:input.benchmark_key??null,runtime:input.runtime??null,adapter:input.adapter??null,model:input.model??null,runtime_profile:input.runtime_profile??null,started_at:(input.started_at?new Date(input.started_at):now).toISOString(),labels:input.labels&&typeof input.labels==='object'?input.labels:{},integrity:{algorithm:'sha256',payload_sha256:''}};
  if(!meta.task_id)throw new Error('TELEMETRY_TASK_ID_REQUIRED');
  fs.mkdirSync(runDir(cwd,policy,runId),{recursive:true});
  meta.integrity.payload_sha256=sha256Object(runPayload(meta));atomicWriteJson(p,meta);fs.writeFileSync(eventsPath(cwd,policy,runId),'','utf8');
  return {status:'TELEMETRY_RUN_STARTED',run_id:runId,path:path.relative(cwd,p).replaceAll('\\','/')};
}
function readRunMeta({cwd,policy,runId}){const p=runMetaPath(cwd,policy,runId);if(!fs.existsSync(p))throw new Error('TELEMETRY_RUN_NOT_FOUND');const m=readJson(p),v=validateRunMeta(m);if(!v.valid)throw new Error(`TELEMETRY_RUN_META_INVALID:${v.errors.join(',')}`);return m}
function readRecords({cwd,policy,runId}){
  const p=eventsPath(cwd,policy,runId);if(!fs.existsSync(p))return [];
  const lines=fs.readFileSync(p,'utf8').split(/\r?\n/).filter(Boolean);const out=[];for(let i=0;i<lines.length;i++){let r;try{r=JSON.parse(lines[i])}catch{throw new Error(`TELEMETRY_EVENT_JSON_INVALID:${i+1}`)}out.push(r)}return out;
}
export function appendTelemetryEvent({cwd,policy,event}){
  const meta=readRunMeta({cwd,policy,runId:event.run_id});
  if(event.task_id!==meta.task_id)throw new Error('TELEMETRY_TASK_ID_MISMATCH');
  const v=validateTelemetryEvent(event,policy);if(!v.valid)throw new Error(`TELEMETRY_EVENT_INVALID:${v.errors.join(',')}`);
  const records=readRecords({cwd,policy,runId:event.run_id});
  const max=Number(telemetryCfg(policy).max_events_per_run||10000);if(records.length>=max)throw new Error('TELEMETRY_MAX_EVENTS_EXCEEDED');
  if(records.some(x=>x.event?.event_id===event.event_id))throw new Error('TELEMETRY_EVENT_ID_DUPLICATE');
  const prev=records.length?records.at(-1).integrity.event_sha256:null;
  const record={seq:records.length+1,prev_sha256:prev,event,integrity:{algorithm:'sha256',event_sha256:''}};record.integrity.event_sha256=sha256Object(eventPayload(record));
  fs.appendFileSync(eventsPath(cwd,policy,event.run_id),JSON.stringify(record)+'\n','utf8');
  return {status:'TELEMETRY_EVENT_APPENDED',run_id:event.run_id,event_id:event.event_id,seq:record.seq,event_sha256:record.integrity.event_sha256};
}
function verifyRecordChain(records,policy){
  const errors=[];let prev=null;const ids=new Set();
  for(let i=0;i<records.length;i++){
    const r=records[i];if(r.seq!==i+1)errors.push(`seq:mismatch:${i+1}`);if(r.prev_sha256!==prev)errors.push(`prev_sha256:mismatch:${i+1}`);if(r.integrity?.algorithm!=='sha256')errors.push(`integrity.algorithm:${i+1}`);const expected=sha256Object(eventPayload(r));if(r.integrity?.event_sha256!==expected)errors.push(`event_sha256:mismatch:${i+1}`);const ev=r.event;const v=validateTelemetryEvent(ev,policy);if(!v.valid)errors.push(...v.errors.map(e=>`event:${i+1}:${e}`));if(ids.has(ev?.event_id))errors.push(`event_id:duplicate:${ev?.event_id}`);ids.add(ev?.event_id);prev=r.integrity?.event_sha256??null;
  }
  return {valid:errors.length===0,errors,last_event_sha256:prev};
}
function zeroAgent(){return {calls:0,input_tokens:null,output_tokens:null,duration_ms:null,generation_ms:null,context_peak_tokens:null,tool_calls:null,files_read:null,bytes_read:null,reported_decode_tps_samples:[],derived_decode_tps:null}}
function sumMetric(obj,key,v){if(isNonNegativeNumber(v))obj[key]=(obj[key]??0)+v}
function maxMetric(obj,key,v){if(isNonNegativeNumber(v))obj[key]=obj[key]===null||obj[key]===undefined?v:Math.max(obj[key],v)}
export function aggregateTelemetryRun({cwd,policy,runId,now=new Date(),write=true}){
  const meta=readRunMeta({cwd,policy,runId}),records=readRecords({cwd,policy,runId});const chain=verifyRecordChain(records,policy);if(!chain.valid)throw new Error(`TELEMETRY_CHAIN_INVALID:${chain.errors.join(',')}`);
  const s={version:'1.0.0',run_id:runId,task_id:meta.task_id,benchmark_key:meta.benchmark_key,runtime:meta.runtime,adapter:meta.adapter,model:meta.model,runtime_profile:meta.runtime_profile,started_at:meta.started_at,ended_at:null,workflow_duration_ms:null,event_count:records.length,totals:{input_tokens:null,output_tokens:null,tool_calls:null,files_read:null,bytes_read:null,handoff_tokens:null,checkpoint_tokens:null,resume_tokens:null,compactions:0,checkpoints:0,resumes:0,handoffs:0,repairs:0},context:{peak_tokens:null,samples:0,pressure_bands:{}},research_cache:{hit:0,miss:0,stale:0,invalid:0,hit_rate:null},knowledge:{refreshes:0,reparsed_files:0,reused_files:0,scanned_files:0,research_invalidated:0},gates:{pass:0,fail:0,blocked:0,skipped:0},judges:{count:0,min_score:null,avg_score:null,total_blockers:0,scores:[]},agents:{},coverage:{event_kinds:[],metric_samples:{}},final_state:null,integrity:{algorithm:'sha256',event_chain_tail:chain.last_event_sha256,payload_sha256:''}};
  let firstTs=Date.parse(meta.started_at),lastTs=firstTs,endTs=null;const kindSet=new Set();
  for(const r of records){const e=r.event,m=e.metrics||{},agent=e.source?.agent||null,ts=Date.parse(e.timestamp);kindSet.add(e.kind);for(const [mk,mv] of Object.entries(m))if(mv!==null&&mv!==undefined)s.coverage.metric_samples[mk]=(s.coverage.metric_samples[mk]||0)+1;if(Number.isFinite(ts)){firstTs=Math.min(firstTs,ts);lastTs=Math.max(lastTs,ts);if(e.kind==='RUN_END'||e.kind==='FINAL_STATE')endTs=Math.max(endTs??ts,ts)}
    sumMetric(s.totals,'input_tokens',m.input_tokens);sumMetric(s.totals,'output_tokens',m.output_tokens);sumMetric(s.totals,'tool_calls',m.tool_calls);sumMetric(s.totals,'files_read',m.files_read);sumMetric(s.totals,'bytes_read',m.bytes_read);
    if(agent){const a=s.agents[agent]??=zeroAgent();if(e.kind==='AGENT_CALL')a.calls++;for(const k of ['input_tokens','output_tokens','duration_ms','generation_ms','tool_calls','files_read','bytes_read'])sumMetric(a,k,m[k]);maxMetric(a,'context_peak_tokens',m.context_tokens);if(isNonNegativeNumber(m.decode_tokens_per_sec))a.reported_decode_tps_samples.push(m.decode_tokens_per_sec)}
    if(e.kind==='CONTEXT_SAMPLE'){s.context.samples++;maxMetric(s.context,'peak_tokens',m.context_tokens);const b=m.pressure_band||'UNKNOWN';s.context.pressure_bands[b]=(s.context.pressure_bands[b]||0)+1;if(agent)maxMetric(s.agents[agent],'context_peak_tokens',m.context_tokens)}
    if(e.kind==='HANDOFF'){s.totals.handoffs++;sumMetric(s.totals,'handoff_tokens',m.estimated_tokens)}
    if(e.kind==='CHECKPOINT'){s.totals.checkpoints++;sumMetric(s.totals,'checkpoint_tokens',m.estimated_tokens)}
    if(e.kind==='COMPACTION')s.totals.compactions++;
    if(e.kind==='RESUME'){s.totals.resumes++;sumMetric(s.totals,'resume_tokens',m.estimated_tokens)}
    if(e.kind==='RESEARCH_CACHE'){const k=String(m.cache_status||'').toLowerCase();if(k in s.research_cache)s.research_cache[k]++}
    if(e.kind==='KNOWLEDGE_REFRESH'){s.knowledge.refreshes++;for(const k of ['reparsed_files','reused_files','scanned_files','research_invalidated'])sumMetric(s.knowledge,k,m[k])}
    if(e.kind==='GATE'){const k=String(m.gate_status||'').toLowerCase();if(k in s.gates)s.gates[k]++}
    if(e.kind==='JUDGE'){s.judges.count++;s.judges.scores.push(m.score);sumMetric(s.judges,'total_blockers',m.blockers)}
    if(e.kind==='REPAIR')s.totals.repairs=Math.max(s.totals.repairs,m.repair_count||0);
    if(e.kind==='FINAL_STATE')s.final_state=m.final_state;
  }
  const cacheDen=s.research_cache.hit+s.research_cache.miss+s.research_cache.stale+s.research_cache.invalid;s.research_cache.hit_rate=cacheDen?s.research_cache.hit/cacheDen:null;
  if(s.judges.scores.length){s.judges.min_score=Math.min(...s.judges.scores);s.judges.avg_score=s.judges.scores.reduce((a,b)=>a+b,0)/s.judges.scores.length}
  for(const a of Object.values(s.agents)){if((a.generation_ms??0)>0&&(a.output_tokens??0)>0)a.derived_decode_tps=a.output_tokens/(a.generation_ms/1000);const xs=a.reported_decode_tps_samples;a.reported_decode_tps_avg=xs.length?xs.reduce((x,y)=>x+y,0)/xs.length:null;delete a.reported_decode_tps_samples}
  s.coverage.event_kinds=[...kindSet].sort();s.ended_at=endTs===null?null:new Date(endTs).toISOString();s.workflow_duration_ms=endTs===null?null:Math.max(0,endTs-firstTs);s.integrity.payload_sha256=sha256Object(summaryPayload(s));if(write)atomicWriteJson(summaryPath(cwd,policy,runId),s);return s;
}
export function verifyTelemetryRun({cwd,policy,runId}){
  const meta=readRunMeta({cwd,policy,runId}),records=readRecords({cwd,policy,runId}),chain=verifyRecordChain(records,policy);const p=summaryPath(cwd,policy,runId);let summary=null,summary_valid=null,summary_errors=[];
  if(fs.existsSync(p)){try{summary=readJson(p);const expected=sha256Object(summaryPayload(summary));summary_valid=summary.integrity?.algorithm==='sha256'&&summary.integrity?.payload_sha256===expected&&summary.integrity?.event_chain_tail===chain.last_event_sha256;if(!summary_valid)summary_errors.push('summary_integrity_or_chain_mismatch')}catch{summary_valid=false;summary_errors.push('summary_json_invalid')}}
  return {valid:validateRunMeta(meta).valid&&chain.valid&&(summary_valid!==false),run_id:runId,event_count:records.length,event_chain_valid:chain.valid,event_errors:chain.errors,summary_present:Boolean(summary),summary_valid,summary_errors};
}
function pctDelta(base,cand){if(!isNonNegativeNumber(base)||!isNonNegativeNumber(cand))return null;if(base===0)return cand===0?0:null;return (cand-base)/base}
export function compareTelemetrySummaries({baseline,candidate}){
  const fields=[
    ['totals.input_tokens','lower'],['totals.output_tokens','neutral'],['context.peak_tokens','lower'],['workflow_duration_ms','lower'],['totals.compactions','lower'],['totals.handoff_tokens','lower'],['totals.files_read','lower'],['totals.bytes_read','lower'],['totals.repairs','lower'],['research_cache.hit_rate','higher']
  ];
  const get=(o,p)=>p.split('.').reduce((v,k)=>v?.[k],o);const metrics={};
  for(const [f,direction] of fields){const b=get(baseline,f),c=get(candidate,f);metrics[f]={baseline:b??null,candidate:c??null,absolute_delta:(typeof b==='number'&&typeof c==='number')?c-b:null,ratio_delta:pctDelta(b,c),preferred_direction:direction}}
  const comparable=Boolean(baseline.benchmark_key&&candidate.benchmark_key&&baseline.benchmark_key===candidate.benchmark_key);
  return {version:'1.0.0',baseline_run_id:baseline.run_id,candidate_run_id:candidate.run_id,benchmark_key:comparable?baseline.benchmark_key:null,comparable,warning:comparable?null:'BENCHMARK_KEY_MISMATCH_OR_MISSING',metrics};
}
export function writeTelemetryComparison({cwd,policy,comparison,id}){const cid=safeId(id||`compare-${Date.now()}`,'comparison_id'),out={...comparison,comparison_id:cid,created_at:new Date().toISOString()};atomicWriteJson(path.join(comparisonsDir(cwd,policy),`${cid}.json`),out);return out}
export { EVENT_KINDS, PROVENANCE, CACHE_STATES, FINAL_STATES };
