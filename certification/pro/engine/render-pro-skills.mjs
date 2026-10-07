#!/usr/bin/env node
// Canonical, deterministic P36.1 projection. Rendering is not certification.
// Usage: node certification/pro/engine/render-pro-skills.mjs verify|write [--root path]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const defaultRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const canonical=s=>String(s).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
const sha=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const list=xs=>xs.map(x=>'- '+x).join('\n');
const ordered=xs=>xs.map((x,i)=>(i+1)+'. '+x).join('\n');
const adapters=[
  {dir:'core/skills',compatibility:'AleDevOS Core'},
  {dir:'adapters/opencode/.opencode/skills',compatibility:'OpenCode V2 adapter',id:'opencode',bindPrefix:'.opencode/skills'},
  {dir:'adapters/codex/.agents/skills',compatibility:'AleDevOS Core',id:'codex',bindPrefix:'.agents/skills'},
  {dir:'adapters/claude-code/.claude/skills',compatibility:'Claude Code project skill',id:'claude-code',bindPrefix:'.claude/skills'},
  {dir:'adapters/antigravity/.agents/skills',compatibility:'AleDevOS Core',id:'antigravity',bindPrefix:'.agents/skills'}
];
export function renderSkill(spec,common,compatibility){
  const lines=[
    '---',
    'name: '+spec.id,
    'description: '+spec.description,
    'compatibility: '+compatibility,
    'metadata:',
    '  system: aledevos-core-v1',
    '---',
    '',
    '# '+spec.title,
    '',
    spec.description,
    '',
    '> Authority: '+common.sourceRule,
    '',
    '## When to use',
    spec.trigger,
    '',
    '## Do not use',
    spec.exclude,
    '',
    '## Inputs',
    list(spec.inputs),
    '',
    '## Outputs',
    list(spec.outputs),
    '',
    '## Procedure',
    ordered(spec.steps),
    '',
    '## Decisions',
    list(spec.decisions),
    '',
    '## Permissions',
    spec.permissions,
    '',
    '## Failures',
    list(spec.failures),
    '',
    '## Verification',
    list(spec.verification),
    '',
    '## Evidence',
    common.evidenceRule,
    '',
    '## Examples',
    list(spec.examples),
    '',
    '## Finalization',
    common.stateRule,
    ''
  ];
  return lines.join('\n');
}
export const semanticHash=s=>sha(canonical(s).replace(/^compatibility:.*$/gm,'compatibility: <adapter-native>').trim()+'\n');
export function expectedOutputs(root=defaultRoot){
  const source=JSON.parse(fs.readFileSync(path.join(root,'certification/pro/content/p36-1-skill-sops.json'),'utf8'));
  if(source.schema_version!=='1.0'||source.skills.length!==13||new Set(source.skills.map(x=>x.id)).size!==13)throw Error('P36_SKILL_SOURCE_INVALID');
  const files=new Map();
  const fileJSON=(rel)=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8').replace(/^\uFEFF/,''));
  const catalogRel='skillsystem/catalogs/core-skills.json',catalog=fileJSON(catalogRel);
  const packRel='skillsystem/portable/portable-skill-pack.json',pack=fileJSON(packRel);
  const bindings={};
  for(const adapter of adapters.filter(x=>x.id))bindings[adapter.id]=fileJSON('skillsystem/bindings/'+adapter.id+'.json');
  const byId=new Map(source.skills.map(s=>[s.id,s]));
  for(const spec of source.skills){
    for(const ad of adapters){
      const text=renderSkill(spec,source.common,ad.compatibility);
      const rel=ad.dir+'/'+spec.id+'/SKILL.md';
      files.set(rel,text);
      if(ad.id){
        const binding=bindings[ad.id].bindings.find(b=>b.skill_id===spec.id);
        if(!binding||binding.path!==ad.bindPrefix+'/'+spec.id+'/SKILL.md')throw Error('P36_BINDING_ID_OR_PATH_MISMATCH:'+ad.id+':'+spec.id);
        binding.expected_sha256=sha(text);
      }else{
        const item=catalog.skills.find(x=>x.id===spec.id);
        if(!item)throw Error('P36_CORE_CATALOG_MISSING:'+spec.id);
        item.instruction_sha256=sha(text);
        item.description=spec.description;
        const p=pack.skills.find(x=>x.id===spec.id);
        if(!p||p.canonical_path!==rel)throw Error('P36_PORTABLE_PACK_MISSING:'+spec.id);
        p.semantic_sha256=semanticHash(text);
      }
      if(semanticHash(text)!==semanticHash(renderSkill(spec,source.common,'AleDevOS Core')))throw Error('P36_SEMANTIC_DRIFT:'+spec.id);
    }
  }
  for(const ad of adapters.filter(x=>x.id))files.set('skillsystem/bindings/'+ad.id+'.json',JSON.stringify(bindings[ad.id],null,2)+'\n');
  files.set(catalogRel,JSON.stringify(catalog,null,2)+'\n');
  files.set(packRel,JSON.stringify(pack,null,2)+'\n');
  return files;
}

const invoked=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  const mode=process.argv[2]||'verify',index=process.argv.indexOf('--root');
  const root=index>=0&&process.argv[index+1]?path.resolve(process.argv[index+1]):defaultRoot;
  try{
    const files=expectedOutputs(root),differences=[];
    for(const [rel,expected] of files){
      const p=path.join(root,rel);
      const actual=fs.existsSync(p)?canonical(fs.readFileSync(p,'utf8')):null;
      if(actual!==expected){
        differences.push(rel);
        if(mode==='write'){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,expected,'utf8')}
      }
    }
    console.log(JSON.stringify({phase:'P36.1',mode,generated_files:files.size,drifted:mode==='write'?0:differences.length,changed: differences,pro_certified:0},null,2));
    if(mode==='verify'&&differences.length)process.exit(4);
    if(!['verify','write'].includes(mode))process.exit(2);
  }catch(e){console.error('P36_SKILL_RENDER_ERROR:'+e.message);process.exit(7)}
}
