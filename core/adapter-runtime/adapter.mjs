#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const argv=process.argv.slice(2);
const [group,cmd]=argv;
const take=(f,d=null)=>{const i=argv.indexOf(f);return i>=0&&i+1<argv.length?argv[i+1]:d};
const root=path.resolve(take('--root',process.cwd()));
const adapter=take('--adapter');
const profile=take('--profile','portable_core');
const out=(o,code=0)=>{process.stdout.write(JSON.stringify(o,null,2)+'\n');process.exit(code)};
const read=(p)=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const sha=(p)=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const firstExisting=(...ps)=>ps.find(p=>fs.existsSync(p))||ps[0];
const manifestPath=(name)=>firstExisting(path.join(root,'adapters',name,'adapter-capabilities.json'),path.join(root,'.aledevos','adapters',name,'adapter-capabilities.json'));
const catalogPath=firstExisting(path.join(root,'core','adapter-contracts','capability-catalog.json'),path.join(root,'.aledevos','adapters','contracts','capability-catalog.json'));
const profilesPath=firstExisting(path.join(root,'core','adapter-contracts','compatibility-profiles.json'),path.join(root,'.aledevos','adapters','contracts','compatibility-profiles.json'));
const adapterStatuses=new Set(['implemented','partial','scaffold']);
const capStatuses=new Set(['enforced','implemented','best_effort','unsupported']);

function loadCatalog(){if(!fs.existsSync(catalogPath))throw new Error('CAPABILITY_CATALOG_NOT_FOUND');const c=read(catalogPath);return c.capabilities||[]}
function validateManifest(name){
 const errors=[];const p=manifestPath(name);if(!fs.existsSync(p))return {ok:false,adapter:name,path:p,errors:['ADAPTER_MANIFEST_NOT_FOUND']};
 let m;try{m=read(p)}catch(e){return {ok:false,adapter:name,path:p,errors:['ADAPTER_MANIFEST_JSON_INVALID']}}
 if(m.contract_version!=='2.0')errors.push('contract_version_invalid');
 if(m.adapter!==name)errors.push('adapter_identity_mismatch');
 if(typeof m.adapter_version!=='string'||!m.adapter_version)errors.push('adapter_version_invalid');
 if(!adapterStatuses.has(m.status))errors.push('adapter_status_invalid');
 if(!m.installation||typeof m.installation.supported!=='boolean')errors.push('installation_contract_invalid');
 if(m.status==='scaffold'&&m.installation?.supported!==false)errors.push('scaffold_must_not_be_installable');
 if(m.alias_of!==undefined){
   if(typeof m.alias_of!=='string'||!m.alias_of||m.alias_of===name)errors.push('adapter_alias_invalid');
   if(m.status==='scaffold')errors.push('adapter_alias_cannot_be_scaffold');
   if(typeof m.alias_of==='string'&&m.alias_of&&m.alias_of!==name){
     const cp=manifestPath(m.alias_of);
     if(!fs.existsSync(cp))errors.push('adapter_alias_canonical_not_found');
     else{
       try{
         const cm=read(cp);
         if(cm.adapter!==m.alias_of)errors.push('adapter_alias_canonical_identity_mismatch');
         if(cm.alias_of!==undefined)errors.push('adapter_alias_chain_not_allowed');
         if(cm.status!=='implemented'||cm.installation?.supported!==true)errors.push('adapter_alias_canonical_not_installable');
         if(m.status!==cm.status||m.installation?.supported!==cm.installation?.supported)errors.push('adapter_alias_lifecycle_drift');
         const ac=m.capabilities||{},cc=cm.capabilities||{},all=new Set([...Object.keys(ac),...Object.keys(cc)]);
         for(const id of all)if(JSON.stringify(ac[id]??null)!==JSON.stringify(cc[id]??null))errors.push(`adapter_alias_capability_drift:${id}`);
       }catch{errors.push('adapter_alias_canonical_json_invalid')}
     }
   }
 }
 if(!m.capabilities||typeof m.capabilities!=='object'||Array.isArray(m.capabilities))errors.push('capabilities_invalid');
 const ids=loadCatalog().map(x=>x.id), known=new Set(ids), actual=Object.keys(m.capabilities||{});
 for(const id of ids)if(!Object.hasOwn(m.capabilities||{},id))errors.push(`capability_missing:${id}`);
 for(const id of actual)if(!known.has(id))errors.push(`capability_unknown:${id}`);
 for(const [id,c] of Object.entries(m.capabilities||{})){
   if(!c||typeof c!=='object'||!capStatuses.has(c.status))errors.push(`capability_status_invalid:${id}`);
   if(c?.status==='unsupported'&&m.status==='implemented'&&['repository_read','canonical_gate'].includes(id))errors.push(`implemented_adapter_core_capability_unsupported:${id}`);
 }
 return {ok:errors.length===0,adapter:name,path:path.relative(root,p).replaceAll('\\','/'),manifest:m,manifest_sha256:sha(p),errors};
}
function flattenProfile(name,seen=new Set()){
 const all=read(profilesPath).profiles||{};if(!all[name])throw new Error(`PROFILE_UNKNOWN:${name}`);if(seen.has(name))throw new Error(`PROFILE_CYCLE:${name}`);seen.add(name);
 const p=all[name], req={};for(const parent of p.extends||[])Object.assign(req,flattenProfile(parent,new Set(seen)).required);Object.assign(req,p.required||{});return {name,description:p.description||'',required:req,optional:p.optional||{}};
}
function compatibility(name,profileName){
 const v=validateManifest(name);if(!v.ok)return {status:'ADAPTER_INVALID',adapter:name,profile:profileName,errors:v.errors,manifest_sha256:v.manifest_sha256||null};
 let pr;try{pr=flattenProfile(profileName)}catch(e){return {status:'PROFILE_INVALID',adapter:name,profile:profileName,errors:[e.message]}}
 const checks=[];for(const [id,accepted] of Object.entries(pr.required)){const actual=v.manifest.capabilities[id]?.status??'missing';checks.push({id,required:true,accepted,actual,status:accepted.includes(actual)?'PASS':'BLOCKED'})}
 const blocked=checks.filter(x=>x.status!=='PASS');return {status:blocked.length?'ADAPTER_COMPATIBILITY_BLOCKED':'ADAPTER_COMPATIBLE',adapter:name,canonical_adapter:v.manifest.alias_of||name,adapter_status:v.manifest.status,profile:profileName,manifest_sha256:v.manifest_sha256,summary:{total:checks.length,passed:checks.length-blocked.length,blocked:blocked.length},checks};
}

if(group==='manifest'&&cmd==='verify'){
 if(!adapter)out({status:'ADAPTER_ARGUMENT_REQUIRED'},2);const v=validateManifest(adapter);out({status:v.ok?'ADAPTER_MANIFEST_VALID':'ADAPTER_MANIFEST_INVALID',adapter:v.adapter,path:v.path,manifest_sha256:v.manifest_sha256||null,errors:v.errors},v.ok?0:2);
}
if(group==='catalog'&&cmd==='verify'){
 let c;try{c=loadCatalog()}catch(e){out({status:'ADAPTER_CATALOG_INVALID',errors:[e.message]},2)}const ids=c.map(x=>x.id),dupes=ids.filter((x,i)=>ids.indexOf(x)!==i),errors=[];if(dupes.length)errors.push(...[...new Set(dupes)].map(x=>`duplicate_capability:${x}`));for(const x of c){if(!x.id||!x.kind||!x.description)errors.push(`capability_definition_invalid:${x.id||'unknown'}`)}out({status:errors.length?'ADAPTER_CATALOG_INVALID':'ADAPTER_CATALOG_VALID',count:c.length,errors},errors.length?2:0);
}
if(group==='catalog'&&cmd==='list'){
 const sourceDir=path.join(root,'adapters'), installedDir=path.join(root,'.aledevos','adapters');
 const dir=fs.existsSync(sourceDir)?sourceDir:installedDir;
 if(!fs.existsSync(dir))out({status:'ADAPTER_CATALOG',adapters:[]});
 const names=fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isDirectory()&&fs.existsSync(path.join(dir,x.name,'adapter-capabilities.json'))).map(x=>x.name).sort();const adapters=names.map(n=>{const v=validateManifest(n);return {adapter:n,status:v.manifest?.status??'invalid',installable:v.manifest?.installation?.supported===true,valid:v.ok,manifest_sha256:v.manifest_sha256||null}});out({status:'ADAPTER_CATALOG',adapters});
}
if(group==='compatibility'&&cmd==='check'){
 if(!adapter)out({status:'ADAPTER_ARGUMENT_REQUIRED'},2);const r=compatibility(adapter,profile);out(r,r.status==='ADAPTER_COMPATIBLE'?0:r.status==='ADAPTER_COMPATIBILITY_BLOCKED'?4:2);
}
if(group==='install'&&cmd==='check'){
 if(!adapter)out({status:'ADAPTER_ARGUMENT_REQUIRED'},2);const v=validateManifest(adapter);if(!v.ok)out({status:'ADAPTER_INVALID',adapter,errors:v.errors},2);if(v.manifest.status!=='implemented'||v.manifest.installation.supported!==true)out({status:'ADAPTER_NOT_INSTALLABLE',adapter,adapter_status:v.manifest.status,installation_supported:v.manifest.installation.supported},4);const c=compatibility(adapter,'portable_core');if(c.status!=='ADAPTER_COMPATIBLE')out({status:'ADAPTER_NOT_INSTALLABLE',adapter,reason:'portable_core_incompatible',compatibility:c},4);out({status:'ADAPTER_INSTALLABLE',adapter,canonical_adapter:v.manifest.alias_of||adapter,deprecated_alias:v.manifest.deprecated_alias===true,manifest_sha256:v.manifest_sha256});
}
out({status:'ADAPTER_COMMAND_UNKNOWN',commands:['manifest verify','catalog verify','catalog list','compatibility check','install check']},2);
