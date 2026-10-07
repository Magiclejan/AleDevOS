#!/usr/bin/env node
// P36.2 deterministic source audit. Structural findings are not a runtime certification.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const defaultRoot=path.resolve(here,'../../..');
const canonical=s=>String(s).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
const hash=s=>crypto.createHash('sha256').update(canonical(s),'utf8').digest('hex');
const rolePath={
 core:id=>'core/agents/'+id+'.md',
 opencode:id=>'adapters/opencode/.opencode/agents/'+id+'.md',
 codex:id=>'adapters/codex/.codex/agents/'+id+'.toml',
 'claude-code':id=>'adapters/claude-code/.claude/agents/'+id+'.md',
 antigravity:id=>'adapters/antigravity/.agents/agents/'+id+'.md'
};
const alwaysReadOnly=new Set(['orchestrator','judge-quality','judge-regression','judge-requirements','judge-uxui',
 'security-reviewer','verifier','auditor','researcher','architect','design-system-guardian','motion-director',
 'visual-capture-runner','visual-regression-runner','visual-runtime-audit-runner','visual-judge',
 'visual-repair-controller','v1-release-validator']);
const mutableEvidenceAllow=new Map([
 ['visual-judge','.aledevos/state/visualqa/phase5/submissions/**'],
 ['v1-release-validator','.aledevos/state/release/v1/**']
]);
const pathInside=(root,target)=>{const r=path.relative(root,target);return r===''||(r!=='..'&&!r.startsWith('..'+path.sep)&&!path.isAbsolute(r))};
function fm(s){
 const m=/^---\n([\s\S]*?)\n---(?:\n|$)/.exec(canonical(s));
 return m?m[1]:null;
}
function opencodeEditPermissions(front){
 const lines=front.split('\n'),out=[];
 for(let i=0;i<lines.length;i++){
  const m=/^\s*-\s*action:\s*(\S+)\s*$/.exec(lines[i]);
  if(!m)continue;
  let resource=null,effect=null;
  for(let j=i+1;j<Math.min(lines.length,i+5)&&!/^\s*-\s*action:/.test(lines[j]);j++){
   const r=/^\s*resource:\s*['"]?(.+?)['"]?\s*$/.exec(lines[j]);
   const e=/^\s*effect:\s*(allow|deny)\s*$/.exec(lines[j]);
   if(r)resource=r[1].replace(/^["']|["']$/g,'');
   if(e)effect=e[1];
  }
  if(m[1]==='edit')out.push({resource,effect});
 }
 return out;
}
function checkRoleContract(s){
 const failures=[];
 for(const prop of ['id','role_class','objective','trigger','non_trigger','prohibition','handoff','examples']){
  if(typeof s[prop]!=='string'||s[prop].trim().length<12)failures.push('ROLE_FIELD_INCOMPLETE:'+prop);
 }
 for(const prop of ['inputs','outputs','procedure','decisions']){
  if(!Array.isArray(s[prop])||s[prop].length<(prop==='procedure'?4:prop==='decisions'?2:3))failures.push('ROLE_SECTION_INCOMPLETE:'+prop);
  else if(s[prop].some(x=>typeof x!=='string'||x.trim().length<16))failures.push('ROLE_SECTION_UNSUBSTANTIATED:'+prop);
 }
 if(s.structural_status!=='NOT_REVIEWED'||s.operational_certification!=='NOT_CERTIFIED')failures.push('PREMATURE_CERTIFICATION');
 return failures;
}
function checkProjection(adapter,role,s){
 const errors=[],front=fm(s);
 if(adapter!=='core'){
  if(adapter!=='codex'&&!front)errors.push('FRONTMATTER_MISSING');
  if(adapter==='codex'){
   if(!s.includes("developer_instructions = '''"))errors.push('CODEX_DEVELOPER_INSTRUCTIONS_MISSING');
   if(!s.includes('default_permissions = "aledevos_runtime"'))errors.push('CODEX_PERMISSION_PROFILE_MISMATCH');
  }else if(adapter==='opencode'){
   if(!/^mode:\s*(subagent|primary)$/m.test(front||''))errors.push('OPENCODE_MODE_MISSING');
   if(!/^permissions:/m.test(front||''))errors.push('OPENCODE_PERMISSIONS_MISSING');
   const edits=opencodeEditPermissions(front||'');
   const hasAllow=edits.some(e=>e.effect==='allow');
   const denyWildcard=edits.some(e=>e.resource==='*'&&e.effect==='deny');
   if(alwaysReadOnly.has(role)){
    if(!denyWildcard)errors.push('NON_WRITER_MUST_DENY_ALL_EDITS');
    const permitted=mutableEvidenceAllow.get(role);
    for(const e of edits.filter(e=>e.effect==='allow')){
     if(e.resource!==permitted)errors.push('UNAUTHORIZED_EDIT_ALLOW:'+e.resource);
    }
   }else{
    if(!hasAllow)errors.push('WRITER_NO_PRODUCT_EDIT_CAPABILITY');
    for(const protectedPath of ['.aledevos/**','.opencode/**']){
     if(!edits.some(e=>e.resource===protectedPath&&e.effect==='deny'))errors.push('WRITER_CONTROL_PLANE_CARVEOUT_MISSING:'+protectedPath);
    }
   }
   if(role==='orchestrator'){
    if(!/^mode:\s*primary$/m.test(front||''))errors.push('ORCHESTRATOR_NOT_PRIMARY');
    if(!/action:\s*subagent[\s\S]*?resource:\s*["']?\*["']?[\s\S]*?effect:\s*deny/.test(front||''))errors.push('ORCHESTRATOR_SUBAGENT_DENY_MISSING');
   }else if(/- action:\s*subagent[\s\S]*?resource:\s*["']?\*["']?[\s\S]*?effect:\s*allow/.test(front||''))errors.push('UNAUTHORIZED_SUBAGENT_DELEGATION');
  }else if(adapter==='claude-code'){
   if(!new RegExp('^name:\\s*'+role+'\\s*$','m').test(front||''))errors.push('CLAUDE_ROLE_ID_MISMATCH');
   if(!/^permissionMode:\s*dontAsk$/m.test(front||''))errors.push('CLAUDE_PERMISSION_MODE_MISMATCH');
  }else if(adapter==='antigravity'){
   if(!new RegExp('^name:\\s*'+role+'\\s*$','m').test(front||''))errors.push('ANTIGRAVITY_ROLE_ID_MISMATCH');
   if(!/^commandExecutionPolicy:\s*sandbox$/m.test(front||''))errors.push('ANTIGRAVITY_SANDBOX_POLICY_MISSING');
  }
 }
 if(adapter==='core'||adapter==='opencode'){
  for(const [tag,marker] of [['governance','## Skill System Phase 4'],['freshness','## ContextOS Phase 5'],['telemetry','## ContextOS Phase 6']]){
   if(!s.includes(marker))errors.push('REQUIRED_PHASE_DISCIPLINE_MISSING:'+tag);
  }
 }
 if(role==='visual-judge'&&!/native.image/i.test(s))errors.push('NATIVE_IMAGE_JUDGE_BOUNDARY_MISSING');
 if(role==='visual-repair-controller'&&!/repair/i.test(s))errors.push('VISUAL_REPAIR_CONTROL_BOUNDARY_MISSING');
 if(role==='orchestrator'&&!/one subagent at a time|one (?:specialist|writer) at a time/i.test(s))errors.push('SEQUENTIAL_DELEGATION_BOUNDARY_MISSING');
 return errors;
}
export function auditAgents(root=defaultRoot,contract=null){
 root=path.resolve(root);
 const file=path.join(root,'certification/pro/roles/p36-2-role-contracts.json');
 const doc=contract||JSON.parse(fs.readFileSync(file,'utf8'));
 if(doc.schema_version!=='1.0'||doc.phase!=='P36.2'||doc.roles.length!==25)throw Error('P36_2_POLICY_INVALID');
 const ids=doc.roles.map(x=>x.id);
 if(new Set(ids).size!==25)throw Error('P36_2_DUPLICATE_ROLES');
 if(doc.expected_core_role_ids.length!==22||doc.expected_adapters.join(',')!=='opencode,codex,claude-code,antigravity')throw Error('P36_2_EXPECTED_SCOPE_INVALID');
 const contractFindings=doc.roles.flatMap(r=>checkRoleContract(r).map(code=>({role:r.id,code})));
 const results=[],allDirs=['core',...doc.expected_adapters];
 for(const adapter of allDirs){
  const expected=adapter==='core'?doc.expected_core_role_ids:ids;
  const sample=rolePath[adapter](expected[0]);
  const directory=path.join(root,path.dirname(sample));
  const disk=fs.existsSync(directory)?fs.readdirSync(directory).filter(x=>x.endsWith(adapter==='codex'?'.toml':'.md')).map(x=>path.parse(x).name).sort():[];
  const expectedSorted=[...expected].sort();
  if(JSON.stringify(disk)!==JSON.stringify(expectedSorted))contractFindings.push({role:'*',adapter,code:'ROLE_SET_MISMATCH',expected:expectedSorted,actual:disk});
  for(const id of expected){
   const relative=rolePath[adapter](id),full=path.join(root,relative),errors=[];
   if(!pathInside(root,full)||!fs.existsSync(full)){
    errors.push('ROLE_FILE_MISSING');
    results.push({adapter,id,path:relative,source_sha256:null,issues:errors,status:'BLOCKED',certification:'NOT_CERTIFIED'});
    continue;
   }
   const source=canonical(fs.readFileSync(full,'utf8'));
   errors.push(...checkProjection(adapter,id,source));
   results.push({adapter,id,path:relative,source_sha256:hash(source),issues:errors,status:errors.length?'STRUCTURAL_BLOCKED':'STRUCTURAL_CANDIDATE',certification:'NOT_CERTIFIED'});
  }
 }
 const blocked=results.filter(x=>x.issues.length).length;
 const summary={expected_roles:25,core_roles:22,adapter_roles:100,projected_role_files:results.length,
  role_files_blocked:blocked,role_files_candidates:results.length-blocked,invalid_contracts:contractFindings.length,pro_certified:0};
 return {schema_version:'1.0',phase:'P36.2',status:blocked||contractFindings.length?'STRUCTURAL_BLOCKED':'STRUCTURAL_CANDIDATE',
  summary,role_contract_findings:contractFindings,role_sources:results,
  nonclaims:['Source marker checks are not a security proof','Adapter-native ACL still needs runtime enforcement tests',
    'Role dossiers are authored reference artifacts; current adapter prompts are not automatically replaced by these dossiers',
    'No model execution, independent judgment, P37 E2E or PRO_CERTIFIED is asserted']};
}
const invoked=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 const mode=process.argv[2]||'inventory';
 const idx=process.argv.indexOf('--root'),root=idx>=0&&process.argv[idx+1]?process.argv[idx+1]:defaultRoot;
 if(!['inventory','gate'].includes(mode)){console.error('Usage: node pro-agent-audit.mjs inventory|gate [--root repo]');process.exit(2);}
 try{
  const result=auditAgents(root);
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(mode==='gate')process.exit(4);
 }catch(err){console.error('P36_2_AUDIT_ERROR:'+err.message);process.exit(7)}
}
