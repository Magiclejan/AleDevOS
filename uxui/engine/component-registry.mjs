#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const distRoot=path.resolve(here,'..');
const args=process.argv.slice(2);
const [group,cmd]=args;

function take(flag,fallback=null){const i=args.indexOf(flag);return i>=0&&i+1<args.length?args[i+1]:fallback}
function has(flag){return args.includes(flag)}
function fail(message,code=1,obj=null){const out=obj||{status:message};process.stdout.write(JSON.stringify(out,null,2)+'\n');process.exit(code)}
function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''))}
function writeJson(p,v){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n','utf8')}
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())if(!['integrity_sha256','decision_sha256'].includes(k))o[k]=stable(v[k]);return o}return v}
function sha(v){return crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(stable(v))).digest('hex')}
function fileSha(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}
function rel(root,p){return path.relative(root,p).split(path.sep).join('/')}
function rootOf(p){const r=path.resolve(p||process.cwd());if(!fs.existsSync(r)||!fs.statSync(r).isDirectory())fail('PROJECT_ROOT_INVALID',40);return r}
function policy(){return readJson(path.join(distRoot,'policies','uxui-policy.json'))}
function normPath(p){return String(p||'').replaceAll('\\','/').replace(/^\.\//,'').replace(/\/+$/,'')}
function normText(s){return String(s||'').trim().toLowerCase()}
function uniq(a){return [...new Set((a||[]).map(x=>String(x).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b))}
function inside(root,abs){const rr=path.resolve(root)+path.sep;const aa=path.resolve(abs);return aa===path.resolve(root)||aa.startsWith(rr)}
function registryPath(root){return path.join(root,'.aledevos','design','component-registry.json')}
function designManifestPath(root){return path.join(root,'.aledevos','design','design-context.json')}
function ignoredPath(rp,pol){const parts=normPath(rp).toLowerCase().split('/');return parts.some(x=>pol.detection.ignored_directories.includes(x))}
function sealRegistry(r){r.integrity_sha256='';r.integrity_sha256=sha(r);return r}
function validRegistryIntegrity(r){return typeof r.integrity_sha256==='string'&&r.integrity_sha256===sha(r)}
function sealDecision(d){d.decision_sha256='';d.decision_sha256=sha(d);return d}
function validDecision(d){return typeof d.decision_sha256==='string'&&d.decision_sha256===sha(d)}

function requireDesignContext(root){const p=designManifestPath(root);if(!fs.existsSync(p))fail('DESIGN_CONTEXT_MISSING',41);const m=readJson(p);if(m.integrity_sha256!==sha(m))fail('DESIGN_CONTEXT_INVALID',42);const sec=m.sections?.component_registry;if(sec){const rp=path.join(root,'.aledevos','design',sec.path);if(fs.existsSync(rp)&&sec.artifact_sha256&&sec.artifact_sha256!==fileSha(rp))fail('DESIGN_CONTEXT_COMPONENT_REGISTRY_DRIFT',42)}return m}
function syncDesignContext(root,source='uxui_phase2_component_registry'){
  const mp=designManifestPath(root);const m=readJson(mp);const rp=registryPath(root);
  if(!m.sections?.component_registry)fail('DESIGN_CONTEXT_COMPONENT_SECTION_MISSING',43);
  m.sections.component_registry.status='PRESENT';
  m.sections.component_registry.source=source;
  m.sections.component_registry.source_sha256=fileSha(rp);
  m.sections.component_registry.artifact_sha256=fileSha(rp);
  m.sections.component_registry.notes='Managed by UX/UI Phase 2 Component Registry. Canonical reusable components only.';
  m.context_version=Math.max(2,Number(m.context_version||1));
  m.integrity_sha256='';m.integrity_sha256=sha(m);writeJson(mp,m);return m;
}
function newRegistry(){return sealRegistry({schema_version:'2.0',version:1,status:'PRESENT',policy:'REUSE_BEFORE_CREATE',components:[],integrity_sha256:''})}
function ensureRegistry(root,create=false){
  requireDesignContext(root);const p=registryPath(root);
  if(!fs.existsSync(p)){if(!create)fail('COMPONENT_REGISTRY_MISSING',44);writeJson(p,newRegistry());syncDesignContext(root);}
  let r=readJson(p);
  // Upgrade Phase 1 UNSET skeleton deterministically.
  if(r.status==='UNSET'&&!r.integrity_sha256){if(!create)fail('COMPONENT_REGISTRY_UNMANAGED',45);r=newRegistry();writeJson(p,r);syncDesignContext(root)}
  return r;
}
function verifyRegistry(root){
  const errors=[];let r;
  try{r=ensureRegistry(root,false)}catch(e){return {valid:false,errors:['registry_missing_or_unmanaged']}}
  if(!validRegistryIntegrity(r))errors.push('registry_integrity_mismatch');
  const ids=new Set(),names=new Set(),paths=new Set(),aliases=new Map();
  for(const c of r.components||[]){
    if(!c.component_id||!c.name||!c.canonical_path)errors.push('component_required_field_missing');
    if(ids.has(c.component_id))errors.push(`duplicate_component_id:${c.component_id}`);ids.add(c.component_id);
    const n=normText(c.name);if(names.has(n))errors.push(`duplicate_component_name:${c.name}`);names.add(n);
    const cp=normPath(c.canonical_path);if(paths.has(cp))errors.push(`duplicate_canonical_path:${cp}`);paths.add(cp);
    for(const a of c.aliases||[]){const k=normText(a);if(aliases.has(k)&&aliases.get(k)!==c.component_id)errors.push(`alias_collision:${a}`);aliases.set(k,c.component_id)}
    const abs=path.join(root,cp);if(!inside(root,abs)||ignoredPath(cp,policy()))errors.push(`invalid_canonical_path:${cp}`);
    else if(!fs.existsSync(abs)||!fs.statSync(abs).isFile())errors.push(`canonical_source_missing:${c.component_id}`);
    else if(c.source_sha256!==fileSha(abs))errors.push(`canonical_source_drift:${c.component_id}`);
  }
  return {valid:errors.length===0,errors,component_count:(r.components||[]).length,registry_version:r.version,status:r.status};
}
function componentCandidateFiles(root){
  const pol=policy();const cfg=pol.component_registry;const out=[];
  function rec(dir){
    for(const e of fs.readdirSync(dir,{withFileTypes:true})){
      const p=path.join(dir,e.name),rp=rel(root,p);if(ignoredPath(rp,pol)||e.isSymbolicLink())continue;
      if(e.isDirectory()){rec(p);continue}if(!e.isFile())continue;
      const ext=path.extname(e.name).toLowerCase();if(!cfg.discovery_extensions.includes(ext))continue;
      const parts=normPath(rp).toLowerCase().split('/');const inMarker=parts.some(x=>cfg.discovery_path_markers.includes(x));
      const base=path.basename(e.name,ext);if(!inMarker)continue;
      if(cfg.ignore_file_suffixes.some(s=>base.toLowerCase().endsWith(s)))continue;
      out.push({candidate_id:'candidate:'+sha(rp).slice(0,16),name:base,path:rp,source_sha256:fileSha(p),reason:'component_path_marker'});
    }
  }
  rec(root);return out.sort((a,b)=>a.path.localeCompare(b.path));
}
function discover(root){
  const r=ensureRegistry(root,true);const registered=new Set((r.components||[]).map(c=>normPath(c.canonical_path)));
  const candidates=componentCandidateFiles(root).filter(c=>!registered.has(normPath(c.path)));
  const out={schema_version:'1.0',status:'DISCOVERY_COMPLETE',candidate_count:candidates.length,candidates,auto_registered:false,integrity_sha256:''};out.integrity_sha256=sha(out);return out;
}
function slug(s){return normText(s).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function normalizeInput(o){
  return {component_id:o.component_id||`component:${slug(o.name)}`,name:String(o.name||'').trim(),canonical_path:normPath(o.canonical_path),category:normText(o.category||'general'),capabilities:uniq(o.capabilities),variants:uniq(o.variants),aliases:uniq(o.aliases),ownership:String(o.ownership||'GLOBAL').toUpperCase(),domain:o.domain?String(o.domain):null,reusable:o.reusable!==false,source:String(o.source||'human_approved_design_context'),notes:String(o.notes||'').trim()};
}
function isCanonicalRoot(p){const rp=normPath(p).toLowerCase();return policy().component_registry.canonical_component_roots.some(x=>rp===x||rp.startsWith(x+'/'))}
function validateComponentInput(root,c,flags={}){
  const pol=policy(),errs=[];if(!c.name)errs.push('name_required');if(!c.canonical_path)errs.push('canonical_path_required');
  if(!['GLOBAL','DOMAIN'].includes(c.ownership))errs.push('ownership_invalid');if(c.ownership==='DOMAIN'&&!c.domain)errs.push('domain_required');
  const abs=path.join(root,c.canonical_path);if(!inside(root,abs)||ignoredPath(c.canonical_path,pol))errs.push('canonical_path_invalid');
  if(c.reusable&&c.ownership==='GLOBAL'&&!isCanonicalRoot(c.canonical_path))errs.push('global_reusable_component_requires_canonical_root');
  if(!fs.existsSync(abs)||!fs.statSync(abs).isFile())errs.push('canonical_source_missing');
  const sourceAllow=pol.component_registry.allowed_registration_sources;if(!sourceAllow.includes(c.source))errs.push('registration_source_not_allowed');
  if(['verified_runtime_discovery','existing_canonical_design_system'].includes(c.source)&&!flags.approveExisting)errs.push('existing_candidate_requires_approval');
  return errs;
}
function verifyCreationDecision(root,c,decisionPath){
  if(!decisionPath||!fs.existsSync(decisionPath))return ['creation_decision_required'];
  const d=readJson(path.resolve(decisionPath)),v=verifyReuseDecision(root,d),errs=[];if(!v.valid)errs.push(...v.errors);
  if(d.action!=='CREATE_NEW_JUSTIFIED'||d.status!=='APPROVED')errs.push('creation_decision_not_approved');
  if(normPath(d.requested?.proposed_path)!==normPath(c.canonical_path))errs.push('creation_decision_path_mismatch');
  return errs;
}
function register(root,input,flags={}){
  let r=ensureRegistry(root,true);if(!validRegistryIntegrity(r))fail('COMPONENT_REGISTRY_INVALID',46);
  const c=normalizeInput(input),errs=validateComponentInput(root,c,flags);
  if(!['verified_runtime_discovery','existing_canonical_design_system'].includes(c.source))errs.push(...verifyCreationDecision(root,c,flags.decision));
  if(errs.length)fail('COMPONENT_REGISTRATION_BLOCKED',47,{status:'COMPONENT_REGISTRATION_BLOCKED',errors:[...new Set(errs)]});
  const name=normText(c.name),cp=normPath(c.canonical_path);
  if(r.components.some(x=>x.component_id===c.component_id||normText(x.name)===name||normPath(x.canonical_path)===cp))fail('COMPONENT_DUPLICATE',48);
  const takenAliases=new Set(r.components.flatMap(x=>[x.name,...(x.aliases||[])]).map(normText));if(c.aliases.some(a=>takenAliases.has(normText(a))))fail('COMPONENT_ALIAS_COLLISION',49);
  c.source_sha256=fileSha(path.join(root,c.canonical_path));r.components.push(c);r.components.sort((a,b)=>a.component_id.localeCompare(b.component_id));r.version=Number(r.version||0)+1;sealRegistry(r);writeJson(registryPath(root),r);syncDesignContext(root);return c;
}
function syncComponent(root,id,reason){
  if(!reason||String(reason).trim().length<8)fail('SYNC_REASON_REQUIRED',50);let r=ensureRegistry(root,false);if(!validRegistryIntegrity(r))fail('COMPONENT_REGISTRY_INVALID',46);
  const c=r.components.find(x=>x.component_id===id);if(!c)fail('COMPONENT_NOT_FOUND',51);const abs=path.join(root,c.canonical_path);if(!fs.existsSync(abs))fail('CANONICAL_SOURCE_MISSING',52);c.source_sha256=fileSha(abs);c.notes=[c.notes,`SYNC: ${String(reason).trim()}`].filter(Boolean).join(' | ');r.version++;sealRegistry(r);writeJson(registryPath(root),r);syncDesignContext(root);return c;
}
function requestObj(p){if(!p||!fs.existsSync(p))fail('REUSE_REQUEST_MISSING',53);return readJson(p)}
function isLocalPath(p){const parts=normPath(p).toLowerCase().split('/');return policy().component_registry.page_local_markers.some(x=>parts.includes(x))}
function componentCoverage(c,req){const caps=uniq(req.required_capabilities),vars=uniq(req.required_variants);const cc=new Set(c.capabilities||[]),vv=new Set(c.variants||[]);return {missing_capabilities:caps.filter(x=>!cc.has(x)),missing_variants:vars.filter(x=>!vv.has(x))}}
function candidatesFor(r,req){
  const name=normText(req.requested_name),category=normText(req.category),caps=uniq(req.required_capabilities);
  return (r.components||[]).map(c=>{const names=[c.name,...(c.aliases||[])].map(normText);let score=0;if(name&&names.includes(name))score+=100;if(category&&normText(c.category)===category)score+=30;const cset=new Set(c.capabilities||[]);score+=caps.filter(x=>cset.has(x)).length*10;return {c,score,coverage:componentCoverage(c,req)}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.c.component_id.localeCompare(b.c.component_id));
}
function decide(root,req){
  const v=verifyRegistry(root);if(!v.valid)fail('COMPONENT_REGISTRY_INVALID',46,{status:'COMPONENT_REGISTRY_INVALID',errors:v.errors});const r=ensureRegistry(root,false),pol=policy(),matches=candidatesFor(r,req);const proposed=normPath(req.proposed_path||'');
  const top=matches[0];let action,reason,target=null,missing_variants=[],missing_capabilities=[];
  if(top){
    const tied=matches.filter(x=>x.score===top.score);
    if(tied.length>1&&top.score<100){action='REVIEW_REQUIRED_AMBIGUOUS';reason='multiple_equally_ranked_canonical_components'}
    else {
      target=top.c.component_id;missing_variants=top.coverage.missing_variants;missing_capabilities=top.coverage.missing_capabilities;
      if(proposed&&isLocalPath(proposed)&&top.coverage.missing_capabilities.length===0){action='BLOCK_LOCAL_FORK';reason='canonical_component_exists_local_fork_denied'}
      else if(top.coverage.missing_capabilities.length===0&&top.coverage.missing_variants.length===0){action='REUSE_CANONICAL';reason='canonical_component_covers_request'}
      else if(top.coverage.missing_capabilities.length===0){action='EXTEND_CANONICAL';reason='canonical_component_requires_variant_extension'}
      else if(top.score>=100){action='EXTEND_CANONICAL';reason='named_canonical_component_requires_capability_extension'}
      else {action='REVIEW_REQUIRED_PARTIAL_MATCH';reason='partial_canonical_match_requires_human_or_guardian_review'}
    }
  } else {
    const justification=String(req.justification||'').trim();
    if(req.reusable!==false&&(!proposed||!isCanonicalRoot(proposed))){action='CREATE_BLOCKED_NONCANONICAL_PATH';reason='reusable_component_must_use_canonical_root'}
    else if(justification.length<pol.component_registry.new_component_justification_min_chars){action='CREATE_BLOCKED_JUSTIFICATION_REQUIRED';reason='new_reusable_component_requires_explicit_justification'}
    else {action='CREATE_NEW_JUSTIFIED';reason='no_canonical_match_and_creation_is_justified'}
  }
  const decision=sealDecision({schema_version:'1.0',status:action.startsWith('BLOCK')||action.startsWith('CREATE_BLOCKED')?'BLOCKED':action.startsWith('REVIEW')?'REVIEW_REQUIRED':'APPROVED',action,reason,target_component_id:target,canonical_path:target?(r.components.find(c=>c.component_id===target)?.canonical_path||null):null,requested:{name:req.requested_name||null,category:req.category||null,required_capabilities:uniq(req.required_capabilities),required_variants:uniq(req.required_variants),proposed_path:proposed||null,reusable:req.reusable!==false,domain:req.domain||null},missing_capabilities,missing_variants,registry_integrity_sha256:r.integrity_sha256,decision_sha256:''});return decision;
}
function verifyReuseDecision(root,d){const r=ensureRegistry(root,false);const errors=[];if(!validDecision(d))errors.push('decision_integrity_mismatch');if(d.registry_integrity_sha256!==r.integrity_sha256)errors.push('registry_drift_since_decision');if(d.target_component_id&&!r.components.some(c=>c.component_id===d.target_component_id))errors.push('target_component_missing');return {valid:errors.length===0,errors,action:d.action,status:d.status}}

function usage(){console.error('component-registry.mjs registry init|discover|register|sync|verify|status OR reuse decide|verify')}
if(group==='registry'&&cmd==='init'){
  const root=rootOf(take('--project-root'));const r=ensureRegistry(root,true);if(!validRegistryIntegrity(r))fail('COMPONENT_REGISTRY_INVALID',46);syncDesignContext(root);process.stdout.write(JSON.stringify({status:'COMPONENT_REGISTRY_INITIALIZED',component_count:r.components.length,version:r.version},null,2)+'\n');
}else if(group==='registry'&&cmd==='discover'){
  const root=rootOf(take('--project-root'));const o=discover(root);const out=take('--out');if(out)writeJson(path.resolve(out),o);process.stdout.write(JSON.stringify(o,null,2)+'\n');
}else if(group==='registry'&&cmd==='register'){
  const root=rootOf(take('--project-root')),input=take('--input');if(!input)fail('COMPONENT_INPUT_REQUIRED',54);const c=register(root,readJson(path.resolve(input)),{approveExisting:has('--approve-existing'),decision:take('--decision')});process.stdout.write(JSON.stringify({status:'COMPONENT_REGISTERED',component:c},null,2)+'\n');
}else if(group==='registry'&&cmd==='sync'){
  const root=rootOf(take('--project-root')),id=take('--component-id');if(!id)fail('COMPONENT_ID_REQUIRED',55);const c=syncComponent(root,id,take('--reason'));process.stdout.write(JSON.stringify({status:'COMPONENT_SYNCED',component_id:c.component_id,source_sha256:c.source_sha256},null,2)+'\n');
}else if(group==='registry'&&cmd==='verify'){
  const root=rootOf(take('--project-root'));const o=verifyRegistry(root);process.stdout.write(JSON.stringify(o,null,2)+'\n');if(!o.valid)process.exit(56);
}else if(group==='registry'&&cmd==='status'){
  const root=rootOf(take('--project-root')),r=ensureRegistry(root,false);const v=verifyRegistry(root);const cats={};for(const c of r.components||[])cats[c.category]=(cats[c.category]||0)+1;process.stdout.write(JSON.stringify({valid:v.valid,component_count:r.components.length,categories:cats,version:r.version},null,2)+'\n');if(!v.valid)process.exit(56);
}else if(group==='reuse'&&cmd==='decide'){
  const root=rootOf(take('--project-root')),req=requestObj(take('--request')),d=decide(root,req),out=take('--out');if(out)writeJson(path.resolve(out),d);process.stdout.write(JSON.stringify(d,null,2)+'\n');if(d.status==='BLOCKED')process.exit(57);
}else if(group==='reuse'&&cmd==='verify'){
  const root=rootOf(take('--project-root')),p=take('--decision');if(!p||!fs.existsSync(p))fail('REUSE_DECISION_MISSING',58);const o=verifyReuseDecision(root,readJson(path.resolve(p)));process.stdout.write(JSON.stringify(o,null,2)+'\n');if(!o.valid)process.exit(59);
}else{usage();process.exit(2)}
