#!/usr/bin/env node
// P36 is an inventory and structural *candidate* check, never a PRO certification.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const codePath=fileURLToPath(import.meta.url);
const repositoryRoot=path.resolve(path.dirname(codePath),'../../..');
const sha256=(s)=>crypto.createHash('sha256').update(s).digest('hex');
const canonical=(s)=>String(s).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
const fileHash=(p)=>sha256(Buffer.from(canonical(fs.readFileSync(p,'utf8')),'utf8'));
const readJson=(p)=>JSON.parse(canonical(fs.readFileSync(p,'utf8')));
const relative=(root,p)=>path.relative(root,p).replaceAll('\\','/');
const isWithin=(root,p)=>{const rel=path.relative(root,p);return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel))};
const markdownHeadings=(body)=>body.split('\n').map(x=>/^#{2,3}\s+(.+?)\s*$/.exec(x)?.[1]?.trim()||null).filter(Boolean);
const frontmatter=(s)=>{
  const m=/^---\n([\s\S]*?)\n---(?:\n|$)/.exec(canonical(s));
  if(!m)return {name:null,description:null,body:canonical(s),valid:false};
  const get=(key)=>m[1].split('\n').map(x=>new RegExp('^'+key+':\\s*(.+)$','i').exec(x)?.[1]?.trim()).find(Boolean)||null;
  return {name:get('name'),description:get('description'),body:canonical(s).slice(m[0].length),valid:true};
};

export function auditP36(root=repositoryRoot,policy=null){
  root=path.resolve(root);
  const pp=path.join(root,'certification/pro/policies/p36-quality.json');
  const p=policy||readJson(pp);
  if(p.schema_version!=='1.0'||p.phase!=='ALEDEVOS_P36_PRO_QUALITY')throw Error('INVALID_P36_POLICY');
  const configured=Array.isArray(p.scope?.bundled_skills)?p.scope.bundled_skills:[];
  if(!configured.length||new Set(configured).size!==configured.length)throw Error('P36_SKILL_INVENTORY_INVALID');
  const bp=path.join(root,'skillsystem/bindings/opencode.json');
  const binding=fs.existsSync(bp)?readJson(bp):{bindings:[]};
  const bound=new Map((binding.bindings||[]).map(x=>[x.skill_id,x]));
  const skills=configured.map(id=>{
    const expected=bound.get(id);
    const target=path.join(root,'adapters/opencode/.opencode/skills',id,'SKILL.md');
    const problems=[];
    if(!expected)problems.push('BINDING_MISSING');
    if(!isWithin(root,target)||!fs.existsSync(target))problems.push('SKILL_FILE_MISSING');
    let content='',parsed={name:null,description:null,body:'',valid:false},actualHash=null;
    if(!problems.includes('SKILL_FILE_MISSING')){
      content=canonical(fs.readFileSync(target,'utf8'));
      actualHash=fileHash(target);
      parsed=frontmatter(content);
      if(!parsed.valid)problems.push('FRONTMATTER_MISSING');
      if(parsed.name!==id)problems.push('NAME_MISMATCH');
      if(!parsed.description||parsed.description.length<12)problems.push('DESCRIPTION_UNSPECIFIED');
      if(expected&&(expected.expected_sha256!==actualHash||expected.path!=='.opencode/skills/'+id+'/SKILL.md'))problems.push('BINDING_DRIFT');
    }
    const headings=markdownHeadings(parsed.body);
    const missingSections=(p.skill_required_sections||[]).filter(section=>!headings.some(h=>new RegExp(section.pattern,'i').test(h))).map(x=>x.id);
    if(missingSections.length)problems.push('SOP_SECTIONS_MISSING');
    if(/\b(?:TBD|TODO|LOREM IPSUM|PLACEHOLDER)\b/i.test(parsed.body))problems.push('UNFINISHED_INSTRUCTION');
    const status=problems.includes('BINDING_DRIFT')?'BINDING_DRIFT':problems.length?'NEEDS_PRO_EXPANSION':'DOCUMENTATION_CANDIDATE';
    return {id,path:relative(root,target),source_sha256:actualHash,expected_sha256:expected?.expected_sha256||null,status,
      problem_codes:problems,missing_sections:missingSections,body_lines:parsed.body.trim().split('\n').length,
      headings,semantic_review:'NOT_ASSESSED',operational_evidence:'NOT_ASSESSED',certification:'NOT_CERTIFIED'};
  });
  const agents=[];
  for(const directory of p.scope?.agent_roots||[]){
    const absolute=path.join(root,directory);
    if(!isWithin(root,absolute)||!fs.existsSync(absolute))throw Error('P36_AGENT_ROOT_MISSING:'+directory);
    for(const name of fs.readdirSync(absolute).filter(x=>x.endsWith('.md')).sort()){
      const f=path.join(absolute,name),s=canonical(fs.readFileSync(f,'utf8'));
      const markers={
        governance_phase4:s.includes('## Skill System Phase 4'),
        freshness_phase5:s.includes('## ContextOS Phase 5'),
        telemetry_phase6:s.includes('## ContextOS Phase 6'),
        permission_frontmatter:directory.includes('/opencode/')?/^---\n[\s\S]*?\npermissions:/i.test(s):null
      };
      agents.push({id:name.slice(0,-3),path:relative(root,f),source_sha256:fileHash(f),
        markers,semantic_review:'NOT_ASSESSED',operational_evidence:'NOT_ASSESSED',
        certification:'NOT_CERTIFIED',status:'NOT_ASSESSED'});
    }
  }
  const blocked=skills.filter(s=>s.status!=='DOCUMENTATION_CANDIDATE').length;
  return {schema_version:'1.0',phase:p.phase,mode:'SOURCE_INVENTORY_ONLY',status:'P36_NEEDS_WORK',
    limitations:['Section presence does not prove procedural adequacy','Agent marker presence does not prove permissions or safe behavior',
      'External Skills are not treated as installed','P37 execution and signed evidence are required for PRO_CERTIFIED'],
    summary:{bundled_skills:skills.length,skill_docs_needing_work:blocked,skill_doc_candidates:skills.length-blocked,
      agents_inventoried:agents.length,agents_certified:0,pro_certified:0},
    skills,agents};
}

const invoked=process.argv[1]&&path.resolve(process.argv[1])===codePath;
if(invoked){
  const args=process.argv.slice(2),mode=args[0]||'inventory',i=args.indexOf('--root');
  const root=i>=0&&args[i+1]?path.resolve(args[i+1]):repositoryRoot;
  if(!['inventory','gate'].includes(mode)){console.error('Usage: node pro-quality-audit.mjs inventory|gate [--root repo]');process.exit(2);}
  try {
    const result=auditP36(root);
    console.log(JSON.stringify(result,null,2));
    // The gate fails closed until a separate reviewed P36 evidence package exists.
    if(mode==='gate')process.exit(4);
  }catch(e){console.error('P36_AUDIT_ERROR:'+e.message);process.exit(7);}
}
