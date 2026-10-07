// P36.2 static handoff planner guard. Actual execution must use the protected Core runtime.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
export const loadFlow=(r=root)=>JSON.parse(fs.readFileSync(path.join(r,'certification/pro/workflows/p36-2-handoff-contract.json'),'utf8'));
export function validateHandoff(flow,q={}){
 const errors=[],stages=flow.default_code_change.stages;
 const byId=new Map(stages.map(s=>[s.id,s]));
 const to=byId.get(q.to);
 if(!to)errors.push('UNKNOWN_NEXT_STAGE');
 if(q.from!==null&&q.from!==undefined&&!byId.has(q.from))errors.push('UNKNOWN_PREVIOUS_STAGE');
 if(to&&q.actor!==to.owner&&!(to.aliases||[]).includes(q.actor))errors.push('ROLE_OWNERSHIP_DENIED');
 if(to){
  for(const required of to.requires||[])if(!(q.completed_stages||[]).includes(required))errors.push('MISSING_REQUIRED_STAGE:'+required);
 }
 const completed=q.completed_stages||[];
 if(new Set(completed).size!==completed.length)errors.push('DUPLICATE_COMPLETED_STAGE');
 if(!Array.isArray(q.completed_stages))errors.push('STAGE_EVIDENCE_MISSING');
 if(q.to==='FINALIZE'){
  const required=stages.filter(s=>s.id!=='FINALIZE').map(s=>s.id);
  for(const p of required)if(!completed.includes(p))errors.push('RELEASE_GATE_STAGE_MISSING:'+p);
  if(q.required_gate_blocked===true)errors.push('REQUIRED_GATE_VETO');
 }
 if(q.actor==='repairer'&&q.to!=='WRITER')errors.push('REPAIRER_CANNOT_JUDGE_OR_FINALIZE');
 if(q.visual_stage){
  const visual=flow.optional_visual.phases.map(x=>x.id),target=visual.indexOf(q.visual_stage);
  if(target<0)errors.push('UNKNOWN_VISUAL_STAGE');
  else{
   for(const earlier of visual.slice(0,target))if(!(q.fresh_visual_phases||[]).includes(earlier))errors.push('VISUAL_EVIDENCE_MISSING:'+earlier);
   if(q.visual_stage==='P5'&&q.native_image_capable!==true)errors.push('NATIVE_IMAGE_CAPABILITY_REQUIRED');
   if(q.visual_stage==='P5'&&q.visual_actor!=='visual-judge')errors.push('VISUAL_JUDGE_ROLE_REQUIRED');
   if(q.mock_only===true)errors.push('REAL_VISUAL_CLAIM_FORBIDDEN_WITH_MOCK');
  }
 }
 if(q.repair_cycle!==undefined){
  if(!Number.isInteger(q.repair_cycle)||q.repair_cycle<1||q.repair_cycle>flow.repair.max_cycles)errors.push('REPAIR_CYCLE_EXHAUSTED_OR_INVALID');
  if(!q.failed_finding_id)errors.push('FAILED_FINDING_REQUIRED');
  if(q.actor!=='repairer')errors.push('REPAIR_WRITER_ROLE_REQUIRED');
 }
 return {allowed:errors.length===0,errors:[...new Set(errors)].sort(),authority:'STATIC_ONLY_NOT_EXECUTION_PERMISSION',certification:'NOT_CERTIFIED'};
}
