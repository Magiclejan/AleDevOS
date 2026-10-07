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
function fail(message,code=1,obj=null){if(obj)process.stdout.write(JSON.stringify(obj,null,2)+'\n');else console.error(message);process.exit(code)}
function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''))}
function writeJson(p,v){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n','utf8')}
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())if(k!=='integrity_sha256')o[k]=stable(v[k]);return o}return v}
function sha(v){return crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(stable(v))).digest('hex')}
function rel(root,p){return path.relative(root,p).split(path.sep).join('/')}
function safeProjectRoot(p){const r=path.resolve(p||process.cwd());if(!fs.existsSync(r)||!fs.statSync(r).isDirectory())fail('PROJECT_ROOT_INVALID',20);return r}
function policy(){return readJson(path.join(distRoot,'policies','uxui-policy.json'))}
function ignored(parts,pol){return parts.some(x=>pol.detection.ignored_directories.includes(x))}

function walk(root,pol){
  const out=[];let ignoredCount=0;
  function rec(dir){
    for(const e of fs.readdirSync(dir,{withFileTypes:true})){
      const p=path.join(dir,e.name);const rp=rel(root,p);const parts=rp.split('/');
      if(ignored(parts,pol)){ignoredCount++;continue}
      if(e.isSymbolicLink()){ignoredCount++;continue}
      if(e.isDirectory())rec(p);else if(e.isFile())out.push({abs:p,rel:rp});
    }
  }
  rec(root);return {files:out,ignoredCount};
}

function parseIntent(p,pol){
  if(!p)return [];
  if(!fs.existsSync(p))fail('REQUEST_FILE_NOT_FOUND',21);
  const o=readJson(p);const vals=[];
  for(const key of ['intent','visual_intent','mode_hint','change_type']){
    const v=o[key]; if(typeof v==='string') vals.push(v.toLowerCase());
    if(Array.isArray(v)) vals.push(...v.map(x=>String(x).toLowerCase()));
  }
  const blob=vals.join(' ');
  return pol.detection.explicit_hybrid_signals.filter(s=>blob.includes(s.toLowerCase()));
}

function detectMode(root,requestFile=null,override=null,allowOverride=false){
  const pol=policy();const {files,ignoredCount}=walk(root,pol);
  const ui=[];const markers=[];
  for(const f of files){
    const ext=path.extname(f.rel).toLowerCase();const low=f.rel.toLowerCase();const parts=low.split('/');
    if(pol.detection.ui_extensions.includes(ext)||parts.some(x=>pol.detection.ui_path_markers.includes(x)))ui.push(f.rel);
    if(pol.detection.design_system_markers.some(m=>low===m||low.endsWith('/'+m)||parts.includes(m)))markers.push(f.rel);
  }
  const explicitSignals=parseIntent(requestFile,pol);
  const hasExistingUi=ui.length>=pol.detection.brownfield_min_ui_files;
  let mode,source;
  if(explicitSignals.length&&hasExistingUi){mode='HYBRID';source='EXPLICIT_INTENT'}
  else if(hasExistingUi){mode='BROWNFIELD';source='DETERMINISTIC_REPO_SCAN'}
  else {mode='GREENFIELD';source='DETERMINISTIC_REPO_SCAN'}

  if(override){
    const o=String(override).toUpperCase();if(!pol.modes.includes(o))fail('INVALID_MODE_OVERRIDE',22);
    const conflict=(o==='GREENFIELD'&&hasExistingUi)||(o==='HYBRID'&&!hasExistingUi);
    if(conflict&&!allowOverride)fail('MODE_OVERRIDE_CONFLICT',23,{status:'MODE_OVERRIDE_CONFLICT',detected_mode:mode,requested_mode:o,evidence:{ui_file_count:ui.length}});
    mode=o;source='HUMAN_OVERRIDE';
  }
  const decision={
    schema_version:'1.0',project_root:'.',mode,workflow:pol.mode_workflows[mode],decision_source:source,
    evidence:{ui_file_count:ui.length,ui_paths:ui.sort(),design_system_markers:[...new Set(markers)].sort(),explicit_signals:explicitSignals,ignored_paths_count:ignoredCount},
    integrity_sha256:''
  };
  decision.integrity_sha256=sha(decision);return decision;
}

const sectionFiles={
  product_personality:'product-personality.md',brand:'brand.md',ux_principles:'ux-principles.md',design_system:'design-system.md',tokens:'tokens.json',typography:'typography.md',color_system:'color-system.md',spacing:'spacing.md',radii:'radii.md',shadows:'shadows.md',layouts:'layouts.md',responsive:'responsive.md',motion_language:'motion-language.md',interaction_patterns:'interaction-patterns.md',accessibility:'accessibility.md',iconography:'iconography.md',component_registry:'component-registry.json',decisions:'decisions/'
};
function artifactHash(p){
  if(!fs.existsSync(p))return null;
  const st=fs.statSync(p);
  if(st.isFile())return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  if(st.isDirectory()){
    const rows=[];
    const rec=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const q=path.join(d,e.name);if(e.isSymbolicLink())continue;if(e.isDirectory())rec(q);else if(e.isFile())rows.push([rel(p,q),crypto.createHash('sha256').update(fs.readFileSync(q)).digest('hex')])}};
    rec(p);return sha(rows);
  }
  return null;
}
function emptySection(name,p){return {id:name,path:p,status:'UNSET',source:null,source_sha256:null,artifact_sha256:null,notes:'No canonical evidence established yet.'}}
const directorySections=new Set(['decisions']);
function seedFile(target,name){
  if(directorySections.has(name)){fs.mkdirSync(target,{recursive:true});const r=path.join(target,'README.md');if(!fs.existsSync(r))fs.writeFileSync(r,'# UI Decision Records\n\nNo decisions recorded yet.\n','utf8');return}
  fs.mkdirSync(path.dirname(target),{recursive:true});if(fs.existsSync(target))return;
  if(target.endsWith('.json')){
    const obj=name==='tokens'?{schema_version:'1.0',status:'UNSET',tokens:{}}:{schema_version:'1.0',version:1,status:'UNSET',components:[]};
    fs.writeFileSync(target,JSON.stringify(obj,null,2)+'\n','utf8');
  } else fs.writeFileSync(target,`# ${name.replaceAll('_',' ')}\n\nStatus: UNSET\n\nNo canonical evidence established yet.\n`,'utf8');
}
function contextPaths(root,pol){const d=path.join(root,pol.context.root);return {d,manifest:path.join(root,pol.context.manifest),mode:path.join(root,pol.context.mode_decision)}}
function initContext(root,decision,force=false){
  const pol=policy();const p=contextPaths(root,pol);
  if(fs.existsSync(p.manifest)&&!force)fail('DESIGN_CONTEXT_ALREADY_EXISTS',24);
  fs.mkdirSync(p.d,{recursive:true});writeJson(p.mode,decision);
  const sections={};
  for(const id of pol.required_sections){const rp=sectionFiles[id];sections[id]=emptySection(id,rp);const abs=path.join(p.d,rp);seedFile(abs,id);sections[id].artifact_sha256=artifactHash(abs)}
  const manifest={schema_version:'1.0',context_version:1,project_mode:decision.mode,bootstrap_workflow:decision.workflow,canonical_root:pol.context.root,source_precedence:pol.context.source_precedence,sections,skill_policy:{registry_required:true,on_demand:true,acquire_missing:true,trusted_auto_acquire:true,untrusted_requires_approval:true,phase1_instruction_loading:false},integrity_sha256:''};
  manifest.integrity_sha256=sha(manifest);writeJson(p.manifest,manifest);return manifest;
}
function verifyDecision(o){return typeof o.integrity_sha256==='string'&&o.integrity_sha256===sha(o)}
function verifyContext(root){
  const pol=policy();const p=contextPaths(root,pol);const errors=[];
  if(!fs.existsSync(p.mode))errors.push('mode_decision_missing');if(!fs.existsSync(p.manifest))errors.push('design_context_missing');
  if(errors.length)return {valid:false,errors};
  const d=readJson(p.mode),m=readJson(p.manifest);if(!verifyDecision(d))errors.push('mode_integrity_mismatch');if(m.integrity_sha256!==sha(m))errors.push('context_integrity_mismatch');
  if(m.project_mode!==d.mode)errors.push('mode_context_mismatch');if(m.bootstrap_workflow!==d.workflow)errors.push('workflow_context_mismatch');
  for(const id of pol.required_sections){if(!m.sections?.[id])errors.push(`section_missing:${id}`);else{const rp=m.sections[id].path;const abs=path.join(p.d,rp);if(!fs.existsSync(abs))errors.push(`section_source_missing:${id}`);else if(m.sections[id].artifact_sha256!==artifactHash(abs))errors.push(`section_integrity_mismatch:${id}`)}}
  const forbiddenInvented=['#ffffff','#000000','inter','roboto','16px','8px'];
  for(const [id,s] of Object.entries(m.sections||{}))if(s.status==='UNSET'&&s.source!==null)errors.push(`unset_has_source:${id}`);
  return {valid:errors.length===0,errors,mode:d.mode,workflow:d.workflow,context_version:m.context_version,forbidden_invention_guard:forbiddenInvented};
}

function usage(){console.error('uxui.mjs mode detect|verify OR context init|verify|status ...')}
if(group==='mode'&&cmd==='detect'){
  const root=safeProjectRoot(take('--project-root'));const d=detectMode(root,take('--request'),take('--override'),has('--allow-override'));const out=take('--out');if(out)writeJson(path.resolve(out),d);process.stdout.write(JSON.stringify(d,null,2)+'\n');
}else if(group==='mode'&&cmd==='verify'){
  const root=safeProjectRoot(take('--project-root'));const p=contextPaths(root,policy()).mode;if(!fs.existsSync(p))fail('MODE_DECISION_MISSING',25);const d=readJson(p);const o={valid:verifyDecision(d),mode:d.mode,workflow:d.workflow};process.stdout.write(JSON.stringify(o,null,2)+'\n');if(!o.valid)process.exit(26);
}else if(group==='context'&&cmd==='init'){
  const root=safeProjectRoot(take('--project-root'));let d;if(take('--decision'))d=readJson(path.resolve(take('--decision')));else d=detectMode(root,take('--request'),take('--override'),has('--allow-override'));if(!verifyDecision(d))fail('MODE_DECISION_INVALID',27);const m=initContext(root,d,has('--force'));process.stdout.write(JSON.stringify({status:'DESIGN_CONTEXT_INITIALIZED',project_mode:m.project_mode,bootstrap_workflow:m.bootstrap_workflow,manifest:policy().context.manifest},null,2)+'\n');
}else if(group==='context'&&cmd==='verify'){
  const root=safeProjectRoot(take('--project-root'));const o=verifyContext(root);process.stdout.write(JSON.stringify(o,null,2)+'\n');if(!o.valid)process.exit(28);
}else if(group==='context'&&cmd==='status'){
  const root=safeProjectRoot(take('--project-root'));const pol=policy(),p=contextPaths(root,pol);if(!fs.existsSync(p.manifest))fail('DESIGN_CONTEXT_MISSING',29);const m=readJson(p.manifest);const counts={UNSET:0,PRESENT:0,NOT_APPLICABLE:0};for(const s of Object.values(m.sections||{}))counts[s.status]=(counts[s.status]||0)+1;process.stdout.write(JSON.stringify({project_mode:m.project_mode,bootstrap_workflow:m.bootstrap_workflow,section_status:counts,skill_instruction_loading:false},null,2)+'\n');
}else{usage();process.exit(2)}
