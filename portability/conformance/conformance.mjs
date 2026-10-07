#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const argv=process.argv.slice(2); const [group,cmd]=argv;
const take=(f,d=null)=>{const i=argv.indexOf(f);return i>=0&&i+1<argv.length?argv[i+1]:d};
const root=path.resolve(take('--root',process.cwd()));
const outPath=take('--out');
const out=(o,code=0)=>{process.stdout.write(JSON.stringify(o,null,2)+'\n');process.exit(code)};
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const shaBuf=b=>crypto.createHash('sha256').update(b).digest('hex');
const shaFile=p=>shaBuf(fs.readFileSync(p));
const rel=p=>path.relative(root,p).replaceAll('\\','/');
const policyPath=path.join(root,'portability/conformance/conformance-policy.json');
const scenariosPath=path.join(root,'portability/conformance/conformance-scenarios.json');
const packPath=path.join(root,'skillsystem/portable/portable-skill-pack.json');
const policy=()=>readJson(policyPath);
const scenarios=()=>readJson(scenariosPath).scenarios||[];
const pack=()=>readJson(packPath);
const manifest=a=>readJson(path.join(root,'adapters',a,'adapter-capabilities.json'));
const add=(checks,id,ok,detail={})=>checks.push({id,status:ok?'PASS':'FAIL',...detail});
const normalizeSkill=s=>s.replace(/\r\n/g,'\n').replace(/^compatibility:.*$/gm,'compatibility: <adapter-native>').trim()+'\n';
const skillSemanticSha=p=>shaBuf(Buffer.from(normalizeSkill(fs.readFileSync(p,'utf8'))));
const runNode=(script,args=[])=>spawnSync(process.execPath,[script,...args],{cwd:root,encoding:'utf8'});
const parseStd=r=>{try{return JSON.parse(r.stdout)}catch{return null}};
const adapterSkillRoots={opencode:'adapters/opencode/.opencode/skills',codex:'adapters/codex/.agents/skills','claude-code':'adapters/claude-code/.claude/skills',antigravity:'adapters/antigravity/.agents/skills'};
const agentRoots={opencode:['adapters/opencode/.opencode/agents','.md'],codex:['adapters/codex/.codex/agents','.toml'],'claude-code':['adapters/claude-code/.claude/agents','.md'],antigravity:['adapters/antigravity/.agents/agents','.md']};
const bindingPaths={opencode:'skillsystem/bindings/opencode.json',codex:'skillsystem/bindings/codex.json','claude-code':'skillsystem/bindings/claude-code.json',antigravity:'skillsystem/bindings/antigravity.json'};

function fullCurrent(adapter){
 const script=path.join(root,'core/adapter-runtime/adapter.mjs');
 const r=runNode(script,['compatibility','check','--root',root,'--adapter',adapter,'--profile','full_current']);
 return {exit:r.status??99,body:parseStd(r)};
}
function certFresh(adapter){
 const p=policy().package_certificates[adapter];
 const script=path.join(root,p.certifier), cert=path.join(root,p.certificate);
 if(!fs.existsSync(script)||!fs.existsSync(cert))return {ok:false,reason:'CERTIFIER_OR_CERTIFICATE_MISSING'};
 const r=runNode(script,['certify','verify','--root',root,'--certificate',cert]);
 const body=parseStd(r); return {ok:r.status===0&&body?.status===p.valid_status,exit:r.status??99,body};
}
function roleSet(adapter){
 const [dirRel,ext]=agentRoots[adapter],dir=path.join(root,dirRel);
 if(!fs.existsSync(dir))return [];
 return fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith(ext)).map(x=>x.name.slice(0,-ext.length)).sort();
}
function skillsVerify(){
 const checks=[],p=pack(),expectedIds=p.skills.map(x=>x.id).sort();
 add(checks,'pack.schema',p.schema_version==='1.0');
 add(checks,'pack.id',p.pack_id==='aledevos-portable-core-skills');
 add(checks,'pack.count',p.skill_count===13&&p.skills.length===13,{count:p.skills.length});
 for(const s of p.skills){
   const cp=path.join(root,s.canonical_path); add(checks,`core.${s.id}.exists`,fs.existsSync(cp));
   if(fs.existsSync(cp))add(checks,`core.${s.id}.semantic`,skillSemanticSha(cp)===s.semantic_sha256);
 }
 for(const a of policy().canonical_adapters){
   const sr=path.join(root,adapterSkillRoots[a]);
   const ids=fs.existsSync(sr)?fs.readdirSync(sr,{withFileTypes:true}).filter(x=>x.isDirectory()&&fs.existsSync(path.join(sr,x.name,'SKILL.md'))).map(x=>x.name).sort():[];
   add(checks,`adapter.${a}.skill_set`,JSON.stringify(ids)===JSON.stringify(expectedIds),{count:ids.length});
   const bind=readJson(path.join(root,bindingPaths[a]));
   const bm=new Map((bind.bindings||[]).map(x=>[x.skill_id,x]));
   add(checks,`adapter.${a}.binding_set`,JSON.stringify([...bm.keys()].sort())===JSON.stringify(expectedIds),{count:bm.size});
   for(const s of p.skills){
     const sp=path.join(sr,s.id,'SKILL.md'),b=bm.get(s.id);
     add(checks,`adapter.${a}.${s.id}.exists`,fs.existsSync(sp));
     if(fs.existsSync(sp)){
       add(checks,`adapter.${a}.${s.id}.semantic`,skillSemanticSha(sp)===s.semantic_sha256);
       add(checks,`adapter.${a}.${s.id}.binding_sha`,!!b&&b.expected_sha256===shaFile(sp));
       const expectedSuffix=(p.projections[a]?.skill_root||'')+'/'+s.id+'/SKILL.md';
       add(checks,`adapter.${a}.${s.id}.binding_path`,!!b&&b.path.replaceAll('\\','/')===expectedSuffix);
     }
   }
 }
 const failed=checks.filter(x=>x.status==='FAIL');
 return {status:failed.length?'PORTABLE_SKILL_PACK_FAILED':'PORTABLE_SKILL_PACK_PASS',summary:{total:checks.length,passed:checks.length-failed.length,failed:failed.length},pack_id:p.pack_id,pack_version:p.pack_version,checks};
}
function coreLeakage(){
 const cfg=policy().core_leakage_scan, hits=[];
 const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(cfg.extensions.includes(path.extname(e.name))){const s=fs.readFileSync(p,'utf8').toLowerCase();for(const t of cfg.forbidden_tokens)if(s.includes(t))hits.push({path:rel(p),token:t});}}};
 for(const r of cfg.roots){const p=path.join(root,r);if(fs.existsSync(p))walk(p)}
 return hits;
}
function matrixRun(){
 const pol=policy(),checks=[],adapters={};
 const capIds=Object.keys(manifest(pol.canonical_adapters[0]).capabilities);
 for(const a of pol.canonical_adapters){
   const m=manifest(a),fc=fullCurrent(a),cf=certFresh(a);
   const roles=roleSet(a);
   add(checks,`adapter.${a}.implemented`,m.status==='implemented'&&m.installation?.supported===true);
   add(checks,`adapter.${a}.full_current`,fc.exit===0&&fc.body?.status==='ADAPTER_COMPATIBLE',{summary:fc.body?.summary||null});
   add(checks,`adapter.${a}.certificate_fresh`,cf.ok,{certificate_status:cf.body?.status||cf.reason});
   add(checks,`adapter.${a}.role_set`,JSON.stringify(roles)===JSON.stringify([...pol.required_roles].sort()),{count:roles.length});
   adapters[a]={capabilities:Object.fromEntries(Object.entries(m.capabilities).map(([k,v])=>[k,v.status])),full_current:fc.body?.status||'ERROR',certificate:cf.body?.status||cf.reason,roles:roles.length};
 }
 for(const cap of capIds){
   const vals=pol.canonical_adapters.map(a=>manifest(a).capabilities[cap]?.status??'missing');
   const variance=pol.capability_variance[cap];
   if(variance)add(checks,`capability.${cap}.variance`,vals.every(v=>variance.allowed.includes(v)),{values:Object.fromEntries(pol.canonical_adapters.map((a,i)=>[a,vals[i]])),semantic_outcome:variance.semantic_outcome});
   else add(checks,`capability.${cap}.equal`,new Set(vals).size===1,{values:Object.fromEntries(pol.canonical_adapters.map((a,i)=>[a,vals[i]]))});
 }
 const providerHashes={};for(const a of pol.canonical_adapters){const p=path.join(root,'adapters',a,pol.provider_path);providerHashes[a]=fs.existsSync(p)?shaFile(p):null}
 add(checks,'visualqa.provider.byte_parity',new Set(Object.values(providerHashes)).size===1&&!Object.values(providerHashes).includes(null),{provider_hashes:providerHashes});
 const gm=manifest('gemini'),am=manifest('antigravity');
 add(checks,'alias.gemini.canonical',gm.alias_of==='antigravity');
 add(checks,'alias.gemini.capability_identity',JSON.stringify(gm.capabilities)===JSON.stringify(am.capabilities));
 const leaks=coreLeakage(); add(checks,'core.runtime_specific_leakage',leaks.length===0,{hits:leaks});
 const scenarioRows=[];
 for(const s of scenarios()){
   const row={id:s.id,expected:s.expected,adapters:{}};let ok=true;
   for(const a of pol.canonical_adapters){const st=manifest(a).capabilities[s.capability]?.status;const effective=(s.expected==='BLOCKED'?(st==='enforced'?'BLOCKED':'FAILED'):(['enforced','implemented'].includes(st)?'PASS':'FAILED'));row.adapters[a]=effective;if(effective!==s.expected)ok=false}
   scenarioRows.push(row);add(checks,`scenario.${s.id}`,ok,{expected:s.expected,adapters:row.adapters});
 }
 const skill=skillsVerify();add(checks,'portable_skill_pack',skill.status==='PORTABLE_SKILL_PACK_PASS',{summary:skill.summary});
 const failed=checks.filter(x=>x.status==='FAIL');
 return {schema_version:'1.0',status:failed.length?'CROSS_ADAPTER_CONFORMANCE_FAILED':'CROSS_ADAPTER_CONFORMANCE_PASS',normalized_state:failed.length?'FAILED':'PASS',package_only:true,target_runtime_validation:'DEFERRED',canonical_adapters:pol.canonical_adapters,aliases:pol.aliases,adapters,scenarios:scenarioRows,summary:{total:checks.length,passed:checks.length-failed.length,failed:failed.length},checks};
}
function projectionFiles(a){
 const base=[];
 const [agentDir,ext]=agentRoots[a];
 for(const n of roleSet(a))base.push({src:`${agentDir}/${n}${ext}`,dst:a==='opencode'?`.opencode/agents/${n}.md`:a==='codex'?`.codex/agents/${n}.toml`:a==='claude-code'?`.claude/agents/${n}.md`:`.agents/agents/${n}.md`});
 const sr=adapterSkillRoots[a], dstSkill=a==='opencode'?'.opencode/skills':a==='claude-code'?'.claude/skills':'.agents/skills';
 for(const s of pack().skills)base.push({src:`${sr}/${s.id}/SKILL.md`,dst:`${dstSkill}/${s.id}/SKILL.md`});
 base.push({src:`adapters/${a}/adapter-capabilities.json`,dst:`.aledevos/adapters/${a}/adapter-capabilities.json`});
 base.push({src:`adapters/${a}/visualqa/playwright-driver.mjs`,dst:'.aledevos/visualqa/providers/playwright-driver.mjs'});
 return base;
}
function materializeProjection(base){
 for(const a of policy().canonical_adapters){const dstRoot=path.join(base,a);for(const f of projectionFiles(a)){const s=path.join(root,f.src),d=path.join(dstRoot,f.dst);fs.mkdirSync(path.dirname(d),{recursive:true});fs.copyFileSync(s,d)}}
 return base;
}
function projectionVerify(installedBase=null){
 const checks=[],owned=!installedBase,base=installedBase||fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-p6-projection-'));
 if(owned)materializeProjection(base);
 for(const a of policy().canonical_adapters){const dstRoot=path.join(base,a);for(const f of projectionFiles(a)){const s=path.join(root,f.src),d=path.join(dstRoot,f.dst);add(checks,`projection.${a}.${f.dst}`,fs.existsSync(d)&&shaFile(s)===shaFile(d),{source:f.src,installed:path.relative(base,d).replaceAll('\\','/')})}}
 if(owned)fs.rmSync(base,{recursive:true,force:true});
 const failed=checks.filter(x=>x.status==='FAIL');return {status:failed.length?'CROSS_ADAPTER_PROJECTION_FAILED':'CROSS_ADAPTER_PROJECTION_PASS',summary:{total:checks.length,passed:checks.length-failed.length,failed:failed.length},checks};
}
function evidenceInputs(){
 const files=['portability/conformance/conformance.mjs','portability/conformance/conformance-policy.json','portability/conformance/conformance-scenarios.json','skillsystem/portable/portable-skill-pack.json','core/policies/security-policy.json'];
 for(const a of policy().canonical_adapters){files.push(`adapters/${a}/adapter-capabilities.json`,bindingPaths[a],`adapters/${a}/${policy().provider_path}`,policy().package_certificates[a].certificate)}
 files.push('adapters/gemini/adapter-capabilities.json');
 return [...new Set(files)].sort().map(p=>({path:p,sha256:shaFile(path.join(root,p))}));
}
function evidenceSha(inputs){return shaBuf(Buffer.from(JSON.stringify(inputs)))}
function certificateRun(){
 const matrix=matrixRun(),skill=skillsVerify(),proj=projectionVerify(),inputs=evidenceInputs();
 const good=matrix.status==='CROSS_ADAPTER_CONFORMANCE_PASS'&&skill.status==='PORTABLE_SKILL_PACK_PASS'&&proj.status==='CROSS_ADAPTER_PROJECTION_PASS';
 const cert={schema_version:'1.0',certification_phase:'portability-p6',status:good?'CROSS_ADAPTER_CONFORMANCE_CERTIFIED':'CROSS_ADAPTER_CONFORMANCE_FAILED',normalized_state:good?'PASS':'FAILED',canonical_adapters:policy().canonical_adapters,aliases:policy().aliases,package_only:true,target_runtime_validation:'DEFERRED',matrix_summary:matrix.summary,skill_pack_summary:skill.summary,projection_summary:proj.summary,inputs,evidence_sha256:evidenceSha(inputs)};
 if(outPath){fs.mkdirSync(path.dirname(path.resolve(outPath)),{recursive:true});fs.writeFileSync(path.resolve(outPath),JSON.stringify(cert,null,2)+'\n')}
 return cert;
}
function certificateVerify(certPath){
 if(!fs.existsSync(certPath))return {status:'CROSS_ADAPTER_CERTIFICATE_MISSING'};
 const saved=readJson(certPath),inputs=evidenceInputs(),current=evidenceSha(inputs);const matrix=matrixRun(),skill=skillsVerify(),proj=projectionVerify();
 const ok=saved.status==='CROSS_ADAPTER_CONFORMANCE_CERTIFIED'&&saved.evidence_sha256===current&&matrix.status==='CROSS_ADAPTER_CONFORMANCE_PASS'&&skill.status==='PORTABLE_SKILL_PACK_PASS'&&proj.status==='CROSS_ADAPTER_PROJECTION_PASS';
 return {status:ok?'CROSS_ADAPTER_CERTIFICATE_VALID':'CROSS_ADAPTER_CERTIFICATE_STALE_OR_TAMPERED',saved_sha256:saved.evidence_sha256||null,current_sha256:current,matrix:matrix.status,skill_pack:skill.status,projection:proj.status};
}

if(group==='matrix'&&cmd==='run'){const r=matrixRun();out(r,r.status.endsWith('_PASS')?0:4)}
if(group==='skills'&&cmd==='verify'){const r=skillsVerify();out(r,r.status.endsWith('_PASS')?0:4)}
if(group==='projection'&&cmd==='materialize'){const d=take('--out-root');if(!d)out({status:'PROJECTION_OUT_ROOT_REQUIRED'},2);materializeProjection(path.resolve(d));out({status:'CROSS_ADAPTER_PROJECTION_MATERIALIZED',out_root:path.resolve(d),adapters:policy().canonical_adapters})}
if(group==='projection'&&cmd==='verify'){const d=take('--installed-root');const r=projectionVerify(d?path.resolve(d):null);out(r,r.status.endsWith('_PASS')?0:4)}
if(group==='certify'&&cmd==='run'){const r=certificateRun();out(r,r.status==='CROSS_ADAPTER_CONFORMANCE_CERTIFIED'?0:4)}
if(group==='certify'&&cmd==='verify'){const c=take('--certificate',path.join(root,'release/certifications/cross-adapter-portability-p6.json'));const r=certificateVerify(path.resolve(c));out(r,r.status==='CROSS_ADAPTER_CERTIFICATE_VALID'?0:4)}
out({status:'CONFORMANCE_COMMAND_UNKNOWN',commands:['matrix run','skills verify','projection materialize','projection verify','certify run','certify verify']},2);
