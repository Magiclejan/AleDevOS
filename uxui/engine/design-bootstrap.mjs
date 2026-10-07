#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const distRoot=path.resolve(here,'..');
const args=process.argv.slice(2);const [group,cmd]=args;
const take=(f,d=null)=>{const i=args.indexOf(f);return i>=0&&i+1<args.length?args[i+1]:d};
const has=f=>args.includes(f);
function fail(status,code=1,extra={}){process.stdout.write(JSON.stringify({status,...extra},null,2)+'\n');process.exit(code)}
function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''))}
function writeJson(p,v){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n','utf8')}
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())if(!['integrity_sha256','plan_sha256'].includes(k))o[k]=stable(v[k]);return o}return v}
function sha(v){return crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(stable(v))).digest('hex')}
function fileSha(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}
function rel(root,p){return path.relative(root,p).split(path.sep).join('/')}
function rootOf(p){const r=path.resolve(p||process.cwd());if(!fs.existsSync(r)||!fs.statSync(r).isDirectory())fail('PROJECT_ROOT_INVALID',60);return r}
function inside(root,p){const rr=path.resolve(root),pp=path.resolve(p);return pp===rr||pp.startsWith(rr+path.sep)}
function pol(){return readJson(path.join(distRoot,'policies','uxui-policy.json'))}
function contextRoot(root){return path.join(root,'.aledevos','design')}
function manifestPath(root){return path.join(contextRoot(root),'design-context.json')}
function modePath(root){return path.join(contextRoot(root),'project-mode.json')}
function phaseState(root){return path.join(root,'.aledevos','state','uxui','phase3')}
function sectionTarget(root,id){const map={product_personality:'product-personality.md',brand:'brand.md',ux_principles:'ux-principles.md',design_system:'design-system.md',tokens:'tokens.json',typography:'typography.md',color_system:'color-system.md',spacing:'spacing.md',radii:'radii.md',shadows:'shadows.md',layouts:'layouts.md',responsive:'responsive.md',motion_language:'motion-language.md',interaction_patterns:'interaction-patterns.md',accessibility:'accessibility.md',iconography:'iconography.md'};return map[id]?path.join(contextRoot(root),map[id]):null}
function verifySeal(o,key='integrity_sha256'){return typeof o?.[key]==='string'&&o[key]===sha(o)}
function seal(o,key='integrity_sha256'){o[key]='';o[key]=sha(o);return o}
function requireContext(root){if(!fs.existsSync(manifestPath(root))||!fs.existsSync(modePath(root)))fail('DESIGN_CONTEXT_MISSING',61);const m=readJson(manifestPath(root)),d=readJson(modePath(root));if(!verifySeal(m)||!verifySeal(d))fail('DESIGN_CONTEXT_INVALID',62);if(m.project_mode!==d.mode)fail('DESIGN_MODE_CONTEXT_MISMATCH',62);return {m,d}}
function uniq(a){return [...new Set((a||[]).map(x=>String(x).trim()).filter(Boolean))].sort()}

const workflowDefs={
  GREENFIELD:{workflow:'DESIGN_GENESIS',stages:[
    {id:'product-foundation',capabilities:['ux.design'],preferred_skills:['design','ui-ux-pro-max'],outputs:['product_personality','ux_principles']},
    {id:'brand-direction',capabilities:['ux.design','visual.design'],preferred_skills:['brand','design'],outputs:['brand','color_system','typography','iconography']},
    {id:'design-system-foundation',capabilities:['ux.design','visual.design'],preferred_skills:['design-system','frontend-design','ui-styling'],outputs:['design_system','tokens','spacing','radii','shadows','layouts','responsive','interaction_patterns','accessibility']},
    {id:'reference-screen-specs',capabilities:['ux.design','visual.design'],preferred_skills:['frontend-design','ui-ux-pro-max'],outputs:['reference_screen_specs']}
  ]},
  BROWNFIELD:{workflow:'DESIGN_SYSTEM_DISCOVERY',stages:[
    {id:'deterministic-discovery',capabilities:[],preferred_skills:[],outputs:['design_discovery_evidence']},
    {id:'system-interpretation',capabilities:['ux.design','visual.design'],preferred_skills:['design-system','frontend-design','ui-ux-pro-max','ui-styling'],outputs:['design_system','tokens','typography','color_system','spacing','radii','shadows','layouts','responsive','interaction_patterns','accessibility']},
    {id:'consolidation-proposal',capabilities:['ux.design'],preferred_skills:['design-system','ui-ux-pro-max'],outputs:['consolidation_proposal']}
  ]},
  HYBRID:{workflow:'DESIGN_AUDIT_AND_CONSOLIDATE',stages:[
    {id:'deterministic-discovery',capabilities:[],preferred_skills:[],outputs:['design_discovery_evidence']},
    {id:'preserve-and-audit',capabilities:['ux.design','visual.design'],preferred_skills:['design-system','ui-ux-pro-max','frontend-design'],outputs:['preservation_matrix','design_system','tokens']},
    {id:'new-visual-direction',capabilities:['ux.design','visual.design'],preferred_skills:['brand','design','frontend-design'],outputs:['brand','color_system','typography','layouts','responsive']},
    {id:'consolidation-proposal',capabilities:['ux.design'],preferred_skills:['design-system','ui-ux-pro-max'],outputs:['consolidation_proposal','reference_screen_specs']}
  ]}
};

function makePlan(root,taskId){
  const {m,d}=requireContext(root),def=workflowDefs[d.mode];if(!def)fail('MODE_NOT_SUPPORTED',63);
  const p=pol(),routeRequests=def.stages.filter(s=>s.capabilities.length).map(s=>({schema_version:'1.0',task_id:`${taskId}.${s.id}`,intent:'specialist-task',required_capabilities:s.capabilities,preferred_skills:s.preferred_skills,max_skills:p.phase3?.max_skills_per_stage||4,missing_skill_policy:'ACQUIRE_IF_TRUSTED_ELSE_APPROVAL'}));
  const out=seal({schema_version:'1.0',task_id:taskId,project_mode:d.mode,workflow:def.workflow,design_context_integrity:m.integrity_sha256,mode_integrity:d.integrity_sha256,stages:def.stages,skill_route_requests:routeRequests,canonicalization:{automatic:false,requires_explicit_approval:true,skill_outputs_are_proposals:true,component_registry_managed_by_phase2:true},invariants:['NO_DESIGN_INVENTION','PRESERVE_CANONICAL_EVIDENCE','SKILLS_ON_DEMAND','MISSING_SKILLS_USE_SAFE_ACQUISITION','NO_AUTO_CANONICALIZATION'],integrity_sha256:''});
  fs.mkdirSync(path.join(phaseState(root),'plans'),{recursive:true});writeJson(path.join(phaseState(root),'plans',`${taskId}.json`),out);return out;
}
function verifyPlan(root,p){const e=[];if(!verifySeal(p))e.push('plan_integrity_mismatch');const {m,d}=requireContext(root);if(p.project_mode!==d.mode)e.push('mode_changed');if(p.design_context_integrity!==m.integrity_sha256)e.push('design_context_changed');if(p.mode_integrity!==d.integrity_sha256)e.push('mode_decision_changed');return {valid:e.length===0,errors:e,task_id:p.task_id,workflow:p.workflow}}

function walk(root){const p=pol(),out=[];let bytes=0;const cfg=p.phase3.discovery;function rec(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const abs=path.join(dir,e.name),rp=rel(root,abs),parts=rp.toLowerCase().split('/');if(parts.some(x=>p.detection.ignored_directories.includes(x)))continue;if(e.isSymbolicLink())continue;if(e.isDirectory())rec(abs);else if(e.isFile()){if(out.length>=cfg.max_files)fail('DISCOVERY_FILE_LIMIT_EXCEEDED',64,{max_files:cfg.max_files});const st=fs.statSync(abs);bytes+=st.size;if(bytes>cfg.max_total_bytes)fail('DISCOVERY_BYTE_LIMIT_EXCEEDED',64,{max_total_bytes:cfg.max_total_bytes});out.push({abs,rel:rp,size:st.size})}}}rec(root);return out}
function sampleMatches(text,re,limit=24){const out=[];for(const m of text.matchAll(re)){out.push(m[0]);if(out.length>=limit)break}return out}
function countBy(xs){const m={};for(const x of xs)m[x]=(m[x]||0)+1;return Object.entries(m).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([value,count])=>({value,count}))}
function discovery(root){
  const {d}=requireContext(root);if(d.mode==='GREENFIELD')fail('DISCOVERY_NOT_APPLICABLE_TO_GREENFIELD',65);
  const p=pol(),cfg=p.phase3.discovery,files=walk(root),rows=[],all={colors:[],spacing:[],radii:[],shadows:[],fonts:[],motion:[],breakpoints:[],css_variables:[]};let scannedBytes=0;
  for(const f of files){const ext=path.extname(f.rel).toLowerCase();if(!cfg.extensions.includes(ext))continue;let text=fs.readFileSync(f.abs,'utf8');scannedBytes+=Buffer.byteLength(text);if(Buffer.byteLength(text)>cfg.max_single_file_bytes)text=text.slice(0,cfg.max_single_file_bytes);
    const rec={path:f.rel,sha256:fileSha(f.abs),bytes:f.size,evidence:{}};
    const vars=sampleMatches(text,/--[a-zA-Z0-9_-]+\s*:\s*[^;}{]+/g);const colors=sampleMatches(text,/(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\))/g);const spacing=sampleMatches(text,/\b\d+(?:\.\d+)?(?:px|rem|em)\b/g);const radii=sampleMatches(text,/border-radius\s*:\s*[^;}{]+/gi);const shadows=sampleMatches(text,/box-shadow\s*:\s*[^;}{]+/gi);const fonts=sampleMatches(text,/font-family\s*:\s*[^;}{]+/gi);const motion=sampleMatches(text,/(?:transition|animation(?:-duration|-timing-function)?)\s*:\s*[^;}{]+/gi);const bp=sampleMatches(text,/@media\s*[^\{]+/gi);
    Object.assign(rec.evidence,{css_variables:vars,colors,spacing,radii,shadows,fonts,motion,breakpoints:bp});
    for(const [k,xs] of Object.entries(rec.evidence))all[k].push(...xs.map(x=>x.trim()));
    const low=f.rel.toLowerCase();if(p.detection.design_system_markers.some(m=>low.includes(m)))rec.design_system_marker=true;rows.push(rec);
  }
  const componentCandidates=[];for(const f of files){const ext=path.extname(f.rel).toLowerCase(),parts=f.rel.toLowerCase().split('/');if(p.component_registry.discovery_extensions.includes(ext)&&parts.some(x=>p.component_registry.discovery_path_markers.includes(x)))componentCandidates.push(f.rel)}
  const summary={files_scanned:rows.length,bytes_scanned:scannedBytes,component_candidates:componentCandidates.length,token_like_evidence:Object.values(all).reduce((n,x)=>n+x.length,0)};
  const out=seal({schema_version:'1.0',project_mode:d.mode,source:'verified_runtime_discovery',summary,files:rows,component_candidates:componentCandidates.sort(),aggregates:{css_variables:countBy(all.css_variables),colors:countBy(all.colors),spacing:countBy(all.spacing),radii:countBy(all.radii),shadows:countBy(all.shadows),fonts:countBy(all.fonts),motion:countBy(all.motion),breakpoints:countBy(all.breakpoints)},notes:['Evidence only. No candidate becomes canonical automatically.','Hardcoded values are observations, not approved tokens.'],integrity_sha256:''});
  fs.mkdirSync(path.join(phaseState(root),'discovery'),{recursive:true});writeJson(path.join(phaseState(root),'discovery','design-discovery.json'),out);return out;
}
function verifyDiscovery(root,o){const e=[];if(!verifySeal(o))e.push('discovery_integrity_mismatch');for(const f of o.files||[]){const abs=path.join(root,f.path);if(!inside(root,abs)||!fs.existsSync(abs))e.push(`source_missing:${f.path}`);else if(fileSha(abs)!==f.sha256)e.push(`source_drift:${f.path}`)}return {valid:e.length===0,errors:e,summary:o.summary||{}}}

function validateEvidence(root,q){const p=pol(),e=[];if(q?.schema_version!=='1.0')e.push('schema_version');if(!q?.task_id)e.push('task_id');if(!p.phase3.allowed_evidence_sources.includes(q?.source_kind))e.push('source_kind');if(!Array.isArray(q?.artifacts)||!q.artifacts.length)e.push('artifacts');for(const a of q?.artifacts||[]){if(!p.phase3.canonicalizable_sections.includes(a.section))e.push(`section_not_canonicalizable:${a.section}`);if(!a.path||!/^[a-f0-9]{64}$/.test(a.sha256||''))e.push(`artifact_ref:${a.section}`);else{const abs=path.resolve(root,a.path);if(!inside(root,abs))e.push(`artifact_external:${a.section}`);else if(!fs.existsSync(abs)||!fs.statSync(abs).isFile())e.push(`artifact_missing:${a.section}`);else if(fileSha(abs)!==a.sha256)e.push(`artifact_hash_mismatch:${a.section}`);if(abs.startsWith(contextRoot(root)+path.sep))e.push(`canonical_self_source_forbidden:${a.section}`)}}return [...new Set(e)]}
function applyEvidence(root,q,approved){const {m}=requireContext(root),errs=validateEvidence(root,q);if(!approved)errs.push('explicit_approval_required');if(errs.length)fail('DESIGN_EVIDENCE_APPLY_BLOCKED',66,{errors:errs});const changed=[];for(const a of q.artifacts){const target=sectionTarget(root,a.section);if(!target)fail('SECTION_TARGET_MISSING',66,{section:a.section});fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.resolve(root,a.path),target);const h=fileSha(target),sec=m.sections[a.section];sec.status='PRESENT';sec.source=q.source_kind;sec.source_sha256=a.sha256;sec.artifact_sha256=h;sec.notes=`Canonicalized by UX/UI Phase 3 from ${q.source_ref||q.task_id}.`;changed.push(a.section)}m.context_version=Math.max(3,Number(m.context_version||1)+1);m.integrity_sha256='';m.integrity_sha256=sha(m);writeJson(manifestPath(root),m);const receipt=seal({schema_version:'1.0',task_id:q.task_id,status:'DESIGN_EVIDENCE_APPLIED',source_kind:q.source_kind,sections:changed.sort(),design_context_integrity:m.integrity_sha256,integrity_sha256:''});fs.mkdirSync(path.join(phaseState(root),'evidence'),{recursive:true});writeJson(path.join(phaseState(root),'evidence',`${q.task_id}.json`),receipt);return receipt}

function usage(){console.error('design-bootstrap.mjs workflow plan|verify | discovery scan|verify | evidence validate|apply')}
const root=rootOf(take('--project-root'));
if(group==='workflow'&&cmd==='plan'){const id=take('--task-id');if(!id)fail('TASK_ID_REQUIRED',67);const o=makePlan(root,id),out=take('--out');if(out)writeJson(path.resolve(out),o);process.stdout.write(JSON.stringify(o,null,2)+'\n')}
else if(group==='workflow'&&cmd==='verify'){const f=take('--plan');if(!f||!fs.existsSync(f))fail('PLAN_FILE_REQUIRED',68);const o=verifyPlan(root,readJson(path.resolve(f)));process.stdout.write(JSON.stringify(o,null,2)+'\n');if(!o.valid)process.exit(69)}
else if(group==='discovery'&&cmd==='scan'){const o=discovery(root),out=take('--out');if(out)writeJson(path.resolve(out),o);process.stdout.write(JSON.stringify(o,null,2)+'\n')}
else if(group==='discovery'&&cmd==='verify'){const f=take('--artifact',path.join(phaseState(root),'discovery','design-discovery.json'));if(!fs.existsSync(f))fail('DISCOVERY_ARTIFACT_REQUIRED',70);const o=verifyDiscovery(root,readJson(path.resolve(f)));process.stdout.write(JSON.stringify(o,null,2)+'\n');if(!o.valid)process.exit(71)}
else if(group==='evidence'&&cmd==='validate'){const f=take('--input');if(!f||!fs.existsSync(f))fail('EVIDENCE_INPUT_REQUIRED',72);const errors=validateEvidence(root,readJson(path.resolve(f))),o={valid:errors.length===0,errors};process.stdout.write(JSON.stringify(o,null,2)+'\n');if(errors.length)process.exit(73)}
else if(group==='evidence'&&cmd==='apply'){const f=take('--input');if(!f||!fs.existsSync(f))fail('EVIDENCE_INPUT_REQUIRED',72);const o=applyEvidence(root,readJson(path.resolve(f)),has('--approve'));process.stdout.write(JSON.stringify(o,null,2)+'\n')}
else{usage();process.exit(2)}
