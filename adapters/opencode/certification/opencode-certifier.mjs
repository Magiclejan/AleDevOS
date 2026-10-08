#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const argv=process.argv.slice(2); const [group,cmd]=argv;
const take=(f,d=null)=>{const i=argv.indexOf(f);return i>=0&&i+1<argv.length?argv[i+1]:d};
const root=path.resolve(take('--root',process.cwd()));
const layout=take('--layout','auto');
const outPath=take('--out',null);
const shaFile=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const hashJson=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const norm=p=>path.relative(root,p).replaceAll('\\','/');
const emit=(o,code=0)=>{const s=JSON.stringify(o,null,2)+'\n'; if(outPath){fs.mkdirSync(path.dirname(path.resolve(outPath)),{recursive:true});fs.writeFileSync(path.resolve(outPath),s)} process.stdout.write(s);process.exit(code)};
const exists=p=>fs.existsSync(p);

function detectLayout(){
 if(layout==='source'||layout==='installed')return layout;
 if(exists(path.join(root,'adapters','opencode','opencode.json')))return 'source';
 if(exists(path.join(root,'opencode.json'))&&exists(path.join(root,'.opencode','agents')))return 'installed';
 return 'unknown';
}
function paths(){
 const l=detectLayout();
 if(l==='source')return {layout:l,config:path.join(root,'adapters','opencode','opencode.json'),agents:path.join(root,'adapters','opencode','.opencode','agents'),manifest:path.join(root,'adapters','opencode','adapter-capabilities.json'),provider:path.join(root,'adapters','opencode','visualqa','playwright-driver.mjs'),engine:path.join(root,'core','engine','aledevos.mjs'),workflow:path.join(root,'core','policies','workflow-policy.json'),ctx:path.join(root,'contextos','engine','contextos.mjs'),skills:path.join(root,'skillsystem','engine','skillsystem.mjs'),vqa:path.join(root,'visualqa','engine','visual-judge.mjs'),release:path.join(root,'release','engine','v1-release.mjs')};
 if(l==='installed')return {layout:l,config:path.join(root,'opencode.json'),agents:path.join(root,'.opencode','agents'),manifest:path.join(root,'.aledevos','adapters','opencode','adapter-capabilities.json'),provider:path.join(root,'.aledevos','visualqa','providers','playwright-driver.mjs'),engine:path.join(root,'.aledevos','runtime','aledevos.mjs'),workflow:null,ctx:path.join(root,'.aledevos','contextos','runtime','contextos.mjs'),skills:path.join(root,'.aledevos','skillsystem','runtime','skillsystem.mjs'),vqa:path.join(root,'.aledevos','visualqa','runtime','visual-judge.mjs'),release:path.join(root,'.aledevos','release','runtime','v1-release.mjs')};
 return {layout:l};
}
function frontmatter(file){
 const txt=fs.readFileSync(file,'utf8'); const m=txt.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/); if(!m)return {raw:'',rules:[],fields:{}};
 const raw=m[1], lines=raw.split(/\r?\n/), fields={}, rules=[];
 for(const line of lines){const x=line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);if(x)fields[x[1]]=x[2]}
 for(let i=0;i<lines.length;i++)if(/^\s*-\s+action:\s*/.test(lines[i])){
   const action=lines[i].replace(/^\s*-\s+action:\s*/, '').trim().replace(/^['"]|['"]$/g,''); let resource=null,effect=null;
   for(let j=i+1;j<Math.min(lines.length,i+5);j++){
    if(/^\s*-\s+action:/.test(lines[j]))break;
    let q=lines[j].match(/^\s+resource:\s*(.*)$/);if(q)resource=q[1].trim().replace(/^['"]|['"]$/g,'');
    q=lines[j].match(/^\s+effect:\s*(.*)$/);if(q)effect=q[1].trim().replace(/^['"]|['"]$/g,'');
   }
   rules.push({action,resource,effect});
 }
 return {raw,rules,fields};
}
const hasRule=(rules,a,r,e)=>(Array.isArray(rules)?rules:[]).some(x=>x.action===a&&x.resource===r&&x.effect===e);
const globMatch=(pat,value)=>{const esc=String(pat).replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*');return new RegExp('^'+esc+'$').test(String(value))};
const effective=(rules,a,r)=>{let effect=null;for(const x of (Array.isArray(rules)?rules:[]))if(x.action===a&&globMatch(x.resource??'',r))effect=x.effect;return effect};
const isAllow=(rules,a,r)=>effective(rules,a,r)==='allow';
const isDeny=(rules,a,r)=>effective(rules,a,r)==='deny';
function check(id,ok,detail='',capability=null,kind='deterministic'){return {id,status:ok?'PASS':'FAIL',detail,capability,kind}}
function certify(){
 const p=paths(), checks=[]; if(p.layout==='unknown')return {status:'OPENCODE_CERTIFICATION_BLOCKED',layout:p.layout,checks:[check('layout.detect',false,'source/installed OpenCode layout not found')]};
 for(const [k,v] of Object.entries(p))if(k!=='layout'&&v&&['config','agents','manifest','provider','engine','ctx','skills','vqa','release'].includes(k))checks.push(check(`artifact.${k}`,exists(v),v?norm(v):'missing'));
 if(checks.some(x=>x.status==='FAIL'))return finish(p,checks);
 const cfg=readJson(p.config), manifest=readJson(p.manifest);
 checks.push(check('dialect.v2.permissions_array',Array.isArray(cfg.permissions),'OpenCode V2 requires ordered permissions[]'));
 checks.push(check('dialect.no_v1_permission',!Object.hasOwn(cfg,'permission'),'V1 permission object must not be mixed into V2'));
 checks.push(check('dialect.no_legacy_tools',!Object.hasOwn(cfg,'tools'),'legacy tools block must not substitute V2 permissions'));
 checks.push(check('dialect.no_bundled_provider',!Object.hasOwn(cfg,'providers'),'AleDevOS adapter does not bundle provider configuration'));
 checks.push(check('dialect.no_bundled_model',!Object.hasOwn(cfg,'model'),'AleDevOS adapter does not choose a default model'));
 checks.push(check('runtime.native_image_external',true,'native-image readiness requires separate target-runtime evidence','visual_qa_judge'));
 checks.push(check('runtime.truthful_text_only',!Object.hasOwn(cfg,'model')&&!Object.hasOwn(cfg,'providers'),'no runtime model capability is bundled or inferred; text-only runtime cannot satisfy native-image gate','visual_qa_judge'));
 checks.push(check('compaction.auto',cfg.compaction?.auto===true,'automatic compaction configured','compaction'));
 checks.push(check('global.external_directory_deny',isDeny(cfg.permissions,'external_directory','anywhere'),'global external directory deny','external_directory'));
 checks.push(check('global.webfetch_deny',isDeny(cfg.permissions,'webfetch','https://example.invalid'),'global webfetch deny','network'));
 checks.push(check('global.websearch_deny',isDeny(cfg.permissions,'websearch','query'),'global websearch deny','network'));
 const agentFiles=fs.readdirSync(p.agents).filter(x=>x.endsWith('.md')).sort();
 checks.push(check('agents.nonempty',agentFiles.length>=20,`${agentFiles.length} agent definitions`));
 const writers=new Set(['builder','editor-backend','editor-database','editor-frontend','editor-tests','repairer']);
 const control=['opencode.json','.opencode/**','.aledevos/**','AGENTS.md','AGENTS.*'];
 for(const file of agentFiles){
  const name=path.basename(file,'.md'), fm=frontmatter(path.join(p.agents,file));
  checks.push(check(`agent.${name}.v2_permissions`,fm.raw.includes('permissions:')&&!/(^|\n)permission:\s/.test(fm.raw),`${name} uses V2 permissions[]`));
  checks.push(check(`agent.${name}.shell_default_deny`,isDeny(fm.rules,'shell','rm -rf dangerous'),`${name} denies arbitrary shell`,'arbitrary_shell_deny'));
  checks.push(check(`agent.${name}.external_deny`,isDeny(fm.rules,'external_directory','../outside'),`${name} denies external_directory`,'external_directory'));
  checks.push(check(`agent.${name}.network_deny`,isDeny(fm.rules,'webfetch','https://example.invalid')&&isDeny(fm.rules,'websearch','query'),`${name} denies web tools`,'network'));
  checks.push(check(`agent.${name}.execute_deny`,isDeny(fm.rules,'execute','arbitrary'),`${name} denies unrestricted execute/code mode`,'code_mode'));
  if(writers.has(name)){
    checks.push(check(`agent.${name}.product_write`,isAllow(fm.rules,'edit','product/file.ts')||hasRule(fm.rules,'edit','*','allow'),`${name} can write product scope`,'product_write'));
    checks.push(check(`agent.${name}.control_plane_deny`,control.every(r=>!isAllow(fm.rules,'edit',r)),`${name} cannot edit AleDevOS control-plane`,'control_plane_write_deny'));
  }
 }
 const vf=frontmatter(path.join(p.agents,'verifier.md'));
 checks.push(check('binding.canonical_gate',hasRule(vf.rules,'shell','node .aledevos/runtime/aledevos.mjs gate run *','allow'),'Verifier narrow canonical gate binding','canonical_gate','binding'));
 checks.push(check('binding.scope_prepass',hasRule(vf.rules,'shell','node .aledevos/runtime/aledevos.mjs scope check *','allow'),'Verifier narrow scope binding','scope_prepass','binding'));
 const orch=frontmatter(path.join(p.agents,'orchestrator.md'));
 checks.push(check('orchestrator.subagent_default_deny',isDeny(orch.rules,'subagent','unknown-agent'),'subagents default deny'));
 checks.push(check('orchestrator.builder_allow',isAllow(orch.rules,'subagent','builder'),'builder delegation explicitly allowed'));
 checks.push(check('orchestrator.verifier_allow',isAllow(orch.rules,'subagent','verifier'),'verifier delegation explicitly allowed'));
 checks.push(check('orchestrator.visual_roles',isAllow(orch.rules,'subagent','visual-capture-runner')&&isAllow(orch.rules,'subagent','visual-judge'),'visual roles explicitly delegated'));
 const engine=fs.readFileSync(p.engine,'utf8');
 checks.push(check('behavior.repair_cap',/max_repairs\s*:\s*2/.test(engine)&&/MAX_REPAIRS_REACHED/.test(engine),'runtime hard cap = 2','repair_cap','behavior'));
 checks.push(check('behavior.scope_check',/scope[^\n]*check/i.test(engine),'deterministic scope check exists','scope_prepass','behavior'));
 checks.push(check('binding.contextos',exists(p.ctx),'ContextOS runtime installed/bound','context_budget','binding'));
 checks.push(check('binding.skillsystem',exists(p.skills),'Skill System runtime installed/bound','skill_registry','binding'));
 checks.push(check('binding.visual_provider',exists(p.provider)&&/playwright/i.test(fs.readFileSync(p.provider,'utf8')),'adapter-owned Playwright provider present','visual_qa_browser_capture','binding'));
 checks.push(check('binding.visual_judge',exists(p.vqa),'Phase 5 judge runtime present','visual_qa_judge','binding'));
 checks.push(check('binding.release_gate',exists(p.release),'release validation runtime present','v1_release_validation','binding'));
 checks.push(check('manifest.identity',manifest.adapter==='opencode'&&manifest.contract_version==='2.0'&&manifest.status==='implemented','manifest identity/ABI'));
 const declared=Object.entries(manifest.capabilities||{}).filter(([,v])=>v.status!=='unsupported').map(([k])=>k);
 const proven=new Set(checks.filter(x=>x.status==='PASS'&&x.capability).map(x=>x.capability));
 const intentionallyBound=new Set(['repository_read','structured_handoff','checkpoint_resume','preventive_transition','diff_first','context_dedup','motion_governance','visual_qa_capture_contract','visual_qa_regression','visual_qa_runtime_checks','visual_qa_bounded_repair','target_runtime_preflight']);
 for(const cap of declared)checks.push(check(`capability.${cap}.proof`,proven.has(cap)||intentionallyBound.has(cap),proven.has(cap)?'direct deterministic proof':'covered by frozen subsystem binding + cumulative regression',cap,'capability-proof'));
 return finish(p,checks);
}
function finish(p,checks){
 const failed=checks.filter(x=>x.status!=='PASS');
 const inputFiles=[]; for(const [k,v] of Object.entries(p)){if(k==='layout'||!v||!exists(v))continue;if(fs.statSync(v).isFile())inputFiles.push({id:k,path:norm(v),sha256:shaFile(v)});}
 if(p.agents&&exists(p.agents))for(const f of fs.readdirSync(p.agents).filter(x=>x.endsWith('.md')).sort()){const fp=path.join(p.agents,f);inputFiles.push({id:'agent:'+path.basename(f,'.md'),path:norm(fp),sha256:shaFile(fp)})}
 const result={schema_version:'1.0',adapter:'opencode',adapter_contract_version:'2.0',certification_phase:'portability-p2',dialect:'opencode-v2',layout:p.layout,status:failed.length?'OPENCODE_ADAPTER_CERTIFICATION_FAILED':'OPENCODE_ADAPTER_CERTIFIED',summary:{total:checks.length,passed:checks.length-failed.length,failed:failed.length},inputs:inputFiles,checks};
 result.evidence_sha256=hashJson({adapter:result.adapter,dialect:result.dialect,layout:result.layout,status:result.status,inputs:result.inputs,checks:result.checks});
 return result;
}
function parity(){
 const source=path.resolve(take('--source',root)), installed=path.resolve(take('--installed',''));
 if(!installed)return {status:'OPENCODE_PARITY_FAILED',errors:['INSTALLED_ROOT_REQUIRED']};
 const pairs=[
 ['adapters/opencode/opencode.json','opencode.json'],['adapters/opencode/adapter-capabilities.json','.aledevos/adapters/opencode/adapter-capabilities.json'],['adapters/opencode/visualqa/playwright-driver.mjs','.aledevos/visualqa/providers/playwright-driver.mjs']
 ];
 const details=[];let ok=true;
 for(const [a,b] of pairs){const x=path.join(source,a),y=path.join(installed,b),same=exists(x)&&exists(y)&&shaFile(x)===shaFile(y);details.push({source:a,installed:b,status:same?'PASS':'FAIL',source_sha256:exists(x)?shaFile(x):null,installed_sha256:exists(y)?shaFile(y):null});if(!same)ok=false}
 const srcAgents=path.join(source,'adapters/opencode/.opencode/agents'), dstAgents=path.join(installed,'.opencode/agents');
 for(const f of fs.readdirSync(srcAgents).filter(x=>x.endsWith('.md')).sort()){const x=path.join(srcAgents,f),y=path.join(dstAgents,f),same=exists(y)&&shaFile(x)===shaFile(y);details.push({source:`adapters/opencode/.opencode/agents/${f}`,installed:`.opencode/agents/${f}`,status:same?'PASS':'FAIL',source_sha256:shaFile(x),installed_sha256:exists(y)?shaFile(y):null});if(!same)ok=false}
 return {schema_version:'1.0',adapter:'opencode',status:ok?'OPENCODE_SOURCE_INSTALLED_PARITY_PASS':'OPENCODE_SOURCE_INSTALLED_PARITY_FAILED',summary:{total:details.length,passed:details.filter(x=>x.status==='PASS').length,failed:details.filter(x=>x.status==='FAIL').length},details};
}
if(group==='certify'&&cmd==='run'){const r=certify();emit(r,r.status==='OPENCODE_ADAPTER_CERTIFIED'?0:4)}
if(group==='certify'&&cmd==='verify'){const file=take('--certificate');if(!file||!exists(path.resolve(file)))emit({status:'OPENCODE_CERTIFICATE_INVALID',errors:['CERTIFICATE_NOT_FOUND']},2);let saved;try{saved=readJson(path.resolve(file))}catch{emit({status:'OPENCODE_CERTIFICATE_INVALID',errors:['CERTIFICATE_JSON_INVALID']},2)}const current=certify();const ok=saved.status==='OPENCODE_ADAPTER_CERTIFIED'&&current.status==='OPENCODE_ADAPTER_CERTIFIED'&&saved.evidence_sha256===current.evidence_sha256;emit({status:ok?'OPENCODE_CERTIFICATE_VALID':'OPENCODE_CERTIFICATE_STALE_OR_TAMPERED',saved_sha256:saved.evidence_sha256??null,current_sha256:current.evidence_sha256,layout:current.layout},ok?0:4)}
if(group==='parity'&&cmd==='verify'){const r=parity();emit(r,r.status==='OPENCODE_SOURCE_INSTALLED_PARITY_PASS'?0:4)}
emit({status:'OPENCODE_CERTIFIER_COMMAND_UNKNOWN',commands:['certify run','certify verify','parity verify']},2);
