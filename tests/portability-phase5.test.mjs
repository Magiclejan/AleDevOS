import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const cert=path.join(root,'adapters/antigravity/certification/antigravity-certifier.mjs');
const abi=path.join(root,'core/adapter-runtime/adapter.mjs');
const guard=path.join(root,'adapters/antigravity/hooks/pretool-guard.mjs');
const run=(args,cwd=root)=>spawnSync(process.execPath,[cert,...args],{cwd,encoding:'utf8'});
const runAbi=(args,cwd=root)=>spawnSync(process.execPath,[abi,...args],{cwd,encoding:'utf8'});
const json=r=>JSON.parse(r.stdout);
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-p5-google-'));
function clone(){const d=tmp();fs.cpSync(root,d,{recursive:true});return d}
function mj(d,rel,fn){const p=path.join(d,rel),o=JSON.parse(fs.readFileSync(p,'utf8'));fn(o);fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n')}
function mt(d,rel,fn){const p=path.join(d,rel);fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')))}
function cp(rel,d,dst=rel){const s=path.join(root,rel),p=path.join(d,dst);fs.mkdirSync(path.dirname(p),{recursive:true});fs.copyFileSync(s,p)}
function hook(input){return spawnSync(process.execPath,[guard],{input:JSON.stringify(input),encoding:'utf8'})}
function installMinimal(d){
 cp('adapters/antigravity/.agents/hooks.json',d,'.agents/hooks.json');
 for(const f of fs.readdirSync(path.join(root,'adapters/antigravity/.agents/agents')).filter(x=>x.endsWith('.md')))cp('adapters/antigravity/.agents/agents/'+f,d,'.agents/agents/'+f);
 for(const n of fs.readdirSync(path.join(root,'adapters/antigravity/.agents/skills'))){const r=`adapters/antigravity/.agents/skills/${n}/SKILL.md`;if(fs.existsSync(path.join(root,r)))cp(r,d,`.agents/skills/${n}/SKILL.md`)}
 cp('adapters/antigravity/AGENTS.md.template',d,'AGENTS.AleDevOS.template.md');
 cp('adapters/antigravity/adapter-capabilities.json',d,'.aledevos/adapters/antigravity/adapter-capabilities.json');
 cp('adapters/antigravity/hooks/pretool-guard.mjs',d,'.aledevos/adapters/antigravity/hooks/pretool-guard.mjs');
 cp('adapters/antigravity/settings/aledevos-permissions.overlay.json',d,'.aledevos/adapters/antigravity/aledevos-permissions.overlay.json');
 cp('adapters/antigravity/scripts/acquire-skill.ps1',d,'.aledevos/adapters/antigravity/acquire-skill.ps1');
 cp('adapters/antigravity/visualqa/playwright-driver.mjs',d,'.aledevos/visualqa/providers/playwright-driver.mjs');
 cp('adapters/antigravity/project-template.json',d,'.aledevos/project.json');
 for(const k of ['bindings','discovery','acquisition'])cp(`skillsystem/${k}/antigravity.json`,d,`.aledevos/skillsystem/${k}/antigravity.json`);
 cp('core/engine/aledevos.mjs',d,'.aledevos/runtime/aledevos.mjs');
 cp('contextos/engine/contextos.mjs',d,'.aledevos/contextos/runtime/contextos.mjs');
 cp('skillsystem/engine/skillsystem.mjs',d,'.aledevos/skillsystem/runtime/skillsystem.mjs');
 cp('visualqa/engine/visual-judge.mjs',d,'.aledevos/visualqa/runtime/visual-judge.mjs');
 cp('release/engine/v1-release.mjs',d,'.aledevos/release/runtime/v1-release.mjs');
 cp('adapters/antigravity/certification/antigravity-certifier.mjs',d,'.aledevos/adapters/antigravity/antigravity-certifier.mjs');
 return d;
}
const src=()=>json(run(['certify','run','--root',root]));

test('Antigravity source adapter obtains P5 certification',()=>{const r=run(['certify','run','--root',root]);assert.equal(r.status,0,r.stdout+r.stderr);const o=json(r);assert.equal(o.status,'ANTIGRAVITY_ADAPTER_CERTIFIED');assert.equal(o.summary.failed,0);assert.ok(o.summary.total>=240)});
test('Antigravity certificate uses current Google dialect',()=>assert.equal(src().dialect,'google-antigravity-cli-1.2+'));
test('Antigravity evidence is SHA-256 sealed',()=>assert.match(src().evidence_sha256,/^[0-9a-f]{64}$/));
test('workspace PreToolUse safety gate is enabled',()=>assert.ok(src().checks.some(x=>x.id==='hooks.pretool.enabled'&&x.status==='PASS')));
test('hook matcher covers governed command, file, network and dynamic-agent tools',()=>{const o=src();for(const t of ['run_command','view_file','write_to_file','replace_file_content','grep_search','search_web','define_subagent'])assert.ok(o.checks.some(x=>x.id===`hooks.matcher.${t}`&&x.status==='PASS'))});
test('removing run_command from hook matcher fails certification',()=>{const d=clone();mj(d,'adapters/antigravity/.agents/hooks.json',o=>o['aledevos-safety-gate'].PreToolUse[0].matcher=o['aledevos-safety-gate'].PreToolUse[0].matcher.replace('run_command|',''));assert.ok(json(run(['certify','run','--root',d],d)).checks.some(x=>x.id==='hooks.matcher.run_command'&&x.status==='FAIL'))});
test('external workspace boundary has direct proof',()=>assert.ok(src().checks.some(x=>x.id==='guard.external_workspace_boundary'&&x.status==='PASS')));
test('dynamic subagent definition is directly blocked',()=>assert.ok(src().checks.some(x=>x.id==='guard.dynamic_subagent_denied'&&x.status==='PASS')));
test('permission overlay denies URL, MCP and unsandboxed modes',()=>{const o=src();for(const id of ['read_url(*)','execute_url(*)','mcp(*)','unsandboxed(*)'])assert.ok(o.checks.some(x=>x.id===`permissions.deny.${id}`&&x.status==='PASS'))});
test('permission overlay keeps command wildcard in review',()=>assert.ok(src().checks.some(x=>x.id==='permissions.command_review'&&x.status==='PASS')));
test('permission overlay has no wildcard allow',()=>assert.ok(src().checks.some(x=>x.id==='permissions.no_wildcard_allow'&&x.status==='PASS')));
test('removing unsandboxed deny fails certification',()=>{const d=clone();mj(d,'adapters/antigravity/settings/aledevos-permissions.overlay.json',o=>o.permissions.deny=o.permissions.deny.filter(x=>x!=='unsandboxed(*)'));assert.ok(json(run(['certify','run','--root',d],d)).checks.some(x=>x.id==='permissions.unsandboxed_denied'&&x.status==='FAIL'))});
test('guard allows governed AleDevOS runtime command',()=>{const d=tmp(),r=hook({toolCall:{name:'run_command',args:{CommandLine:'node .aledevos/runtime/aledevos.mjs gate run --task x'}},workspacePaths:[d]});assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).decision,'allow')});
test('guard denies arbitrary curl shell',()=>{const d=tmp(),r=hook({toolCall:{name:'run_command',args:{CommandLine:'curl https://example.com'}},workspacePaths:[d]});assert.equal(JSON.parse(r.stdout).decision,'deny')});
test('guard denies arbitrary PowerShell shell',()=>{const d=tmp(),r=hook({toolCall:{name:'run_command',args:{CommandLine:'Get-ChildItem'}},workspacePaths:[d]});assert.equal(JSON.parse(r.stdout).decision,'deny')});
test('guard allows product write inside workspace',()=>{const d=tmp(),r=hook({toolCall:{name:'write_to_file',args:{TargetFile:path.join(d,'src/app.js')}},workspacePaths:[d]});assert.equal(JSON.parse(r.stdout).decision,'allow')});
test('guard denies control-plane write',()=>{const d=tmp(),r=hook({toolCall:{name:'write_to_file',args:{TargetFile:path.join(d,'.aledevos/project.json')}},workspacePaths:[d]});assert.equal(JSON.parse(r.stdout).decision,'deny')});
test('guard denies external workspace write',()=>{const d=tmp(),r=hook({toolCall:{name:'write_to_file',args:{TargetFile:path.join(path.dirname(d),'outside.txt')}},workspacePaths:[d]});assert.equal(JSON.parse(r.stdout).decision,'deny')});
test('guard denies external workspace read',()=>{const d=tmp(),r=hook({toolCall:{name:'view_file',args:{AbsolutePath:path.join(path.dirname(d),'outside.txt')}},workspacePaths:[d]});assert.equal(JSON.parse(r.stdout).decision,'deny')});
test('guard denies native web search',()=>{const d=tmp(),r=hook({toolCall:{name:'search_web',args:{query:'x'}},workspacePaths:[d]});assert.equal(JSON.parse(r.stdout).decision,'deny')});
test('guard denies dynamic define_subagent',()=>{const d=tmp(),r=hook({toolCall:{name:'define_subagent',args:{}},workspacePaths:[d]});assert.equal(JSON.parse(r.stdout).decision,'deny')});
test('guard fails closed on malformed input',()=>{const r=spawnSync(process.execPath,[guard],{input:'{bad',encoding:'utf8'});assert.equal(r.status,2)});
test('all 24 Antigravity roles exist',()=>assert.equal(src().checks.filter(x=>/^role\..+\.file$/.test(x.id)&&x.status==='PASS').length,25));
test('role wording is Antigravity-native',()=>assert.ok(src().checks.some(x=>x.id==='roles.native_wording'&&x.status==='PASS')));
test('cross-adapter wording in a role fails certification',()=>{const d=clone();fs.appendFileSync(path.join(d,'adapters/antigravity/.agents/agents/orchestrator.md'),'\nYou are the OpenCode projection.\n');assert.ok(json(run(['certify','run','--root',d],d)).checks.some(x=>x.id==='roles.native_wording'&&x.status==='FAIL'))});
test('missing canonical role fails certification',()=>{const d=clone();fs.rmSync(path.join(d,'adapters/antigravity/.agents/agents/architect.md'));assert.ok(json(run(['certify','run','--root',d],d)).checks.some(x=>x.id==='role.architect.file'&&x.status==='FAIL'))});
test('writers have native edit tools but no shell/subagent delegation',()=>{const o=src();for(const n of ['builder','repairer','editor-frontend','editor-backend','editor-database','editor-tests','editor-config'])assert.ok(o.checks.some(x=>x.id===`role.${n}.tool_boundary`&&x.status==='PASS'))});
test('builder cannot gain run_command',()=>{const d=clone();mt(d,'adapters/antigravity/.agents/agents/builder.md',s=>s.replace('  - find_by_name\n','  - find_by_name\n  - run_command\n'));assert.ok(json(run(['certify','run','--root',d],d)).checks.some(x=>x.id==='role.builder.tool_boundary'&&x.status==='FAIL'))});
test('read-only researcher remains bounded',()=>assert.ok(src().checks.some(x=>x.id==='role.researcher.tool_boundary'&&x.status==='PASS')));
test('researcher cannot gain product write',()=>{const d=clone();mt(d,'adapters/antigravity/.agents/agents/researcher.md',s=>s.replace('  - find_by_name\n','  - find_by_name\n  - write_to_file\n'));assert.ok(json(run(['certify','run','--root',d],d)).checks.some(x=>x.id==='role.researcher.tool_boundary'&&x.status==='FAIL'))});
test('orchestrator alone receives invoke_subagent among state roles',()=>{const o=src();assert.ok(o.checks.some(x=>x.id==='role.orchestrator.tool_boundary'&&x.status==='PASS'));assert.ok(o.checks.some(x=>x.id==='role.verifier.tool_boundary'&&x.status==='PASS'))});
test('no canonical role receives define_subagent',()=>assert.equal(src().checks.filter(x=>/\.no_dynamic_agent$/.test(x.id)&&x.status==='PASS').length,25));
test('no canonical role receives native network tools',()=>assert.equal(src().checks.filter(x=>/\.no_network$/.test(x.id)&&x.status==='PASS').length,25));
test('writer/read-only roles disable command execution',()=>{const o=src();for(const n of ['builder','repairer','researcher'])assert.ok(o.checks.some(x=>x.id===`role.${n}.policy`&&x.status==='PASS'))});
test('state runners use sandbox command policy',()=>{const o=src();for(const n of ['orchestrator','verifier','visual-capture-runner'])assert.ok(o.checks.some(x=>x.id===`role.${n}.policy`&&x.status==='PASS'))});
test('thirteen Antigravity native skills are present',()=>assert.ok(src().checks.some(x=>x.id==='skills.native_count'&&x.status==='PASS')));
test('Antigravity skills bind to .agents/skills',()=>assert.ok(src().checks.some(x=>x.id==='skills.binding_paths'&&x.status==='PASS')));
test('removing skill fails certification',()=>{const d=clone();fs.rmSync(path.join(d,'adapters/antigravity/.agents/skills/backend-change'),{recursive:true,force:true});assert.ok(json(run(['certify','run','--root',d],d)).checks.some(x=>x.id==='skills.native_count'&&x.status==='FAIL'))});
test('project template protects Google control plane',()=>assert.ok(src().checks.some(x=>x.id==='project.protected_paths'&&x.status==='PASS')));
test('Playwright provider is bound',()=>assert.ok(src().checks.some(x=>x.id==='binding.visual_provider'&&x.status==='PASS')));
test('repair cap remains exactly two',()=>assert.ok(src().checks.some(x=>x.id==='behavior.repair_cap'&&x.status==='PASS')));
test('Antigravity manifest is implemented and installable',()=>assert.ok(src().checks.some(x=>x.id==='manifest.identity'&&x.status==='PASS')));
test('all declared Antigravity capabilities have proof',()=>{const c=src().checks.filter(x=>x.id.startsWith('capability.'));assert.ok(c.length>=27);assert.equal(c.filter(x=>x.status!=='PASS').length,0)});
test('ABI reports Antigravity full_current compatible',()=>{const r=runAbi(['compatibility','check','--root',root,'--adapter','antigravity','--profile','full_current']);assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(json(r).summary.blocked,0)});
test('ABI reports Antigravity installable',()=>{const r=runAbi(['install','check','--root',root,'--adapter','antigravity']);assert.equal(r.status,0);assert.equal(json(r).canonical_adapter,'antigravity')});
test('Gemini manifest is an explicit deprecated Antigravity alias',()=>{const m=JSON.parse(fs.readFileSync('adapters/gemini/adapter-capabilities.json','utf8'));assert.equal(m.alias_of,'antigravity');assert.equal(m.deprecated_alias,true);assert.equal(m.status,'implemented')});
test('ABI reports Gemini compatibility through explicit canonical identity',()=>{const r=runAbi(['compatibility','check','--root',root,'--adapter','gemini','--profile','full_current']);assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(json(r).canonical_adapter,'antigravity');assert.equal(json(r).summary.blocked,0)});
test('ABI reports Gemini installable as canonical Antigravity',()=>{const r=runAbi(['install','check','--root',root,'--adapter','gemini']);assert.equal(r.status,0);const o=json(r);assert.equal(o.canonical_adapter,'antigravity');assert.equal(o.deprecated_alias,true)});
test('Gemini alias capability drift is rejected',()=>{const d=clone();mj(d,'adapters/gemini/adapter-capabilities.json',o=>o.capabilities.network.status='best_effort');const r=runAbi(['manifest','verify','--root',d,'--adapter','gemini'],d);assert.equal(r.status,2);assert.ok(json(r).errors.includes('adapter_alias_capability_drift:network'))});
test('Gemini alias cannot point to missing canonical adapter',()=>{const d=clone();fs.rmSync(path.join(d,'adapters/antigravity/adapter-capabilities.json'));const r=runAbi(['manifest','verify','--root',d,'--adapter','gemini'],d);assert.equal(r.status,2);assert.ok(json(r).errors.includes('adapter_alias_canonical_not_found'))});
test('installer explicitly canonicalizes Gemini to Antigravity',()=>{const s=fs.readFileSync('scripts/05-install-into-project.ps1','utf8');assert.match(s,/CanonicalAdapter=if\(\$Adapter -eq 'gemini'\)\{'antigravity'\}/);assert.match(s,/compatibility alias/);assert.match(s,/\.agents/);assert.match(s,/antigravity-certifier\.mjs/)});
test('installed Antigravity layout certifies',()=>{const d=installMinimal(tmp()),rt=path.join(d,'.aledevos/adapters/antigravity/antigravity-certifier.mjs'),r=spawnSync(process.execPath,[rt,'certify','run','--root',d],{cwd:d,encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(JSON.parse(r.stdout).layout,'installed')});
test('source to installed Antigravity parity passes',()=>{const d=installMinimal(tmp()),r=run(['parity','verify','--source',root,'--installed',d,'--root',root]);assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(json(r).status,'ANTIGRAVITY_SOURCE_INSTALLED_PARITY_PASS')});
test('installed hooks drift is detected',()=>{const d=installMinimal(tmp());fs.appendFileSync(path.join(d,'.agents/hooks.json'),'\n ');assert.equal(run(['parity','verify','--source',root,'--installed',d]).status,4)});
test('installed agent drift is detected',()=>{const d=installMinimal(tmp());fs.appendFileSync(path.join(d,'.agents/agents/verifier.md'),'\nDRIFT\n');assert.equal(run(['parity','verify','--source',root,'--installed',d]).status,4)});
test('installed skill drift is detected',()=>{const d=installMinimal(tmp());fs.appendFileSync(path.join(d,'.agents/skills/backend-change/SKILL.md'),'\nDRIFT\n');assert.equal(run(['parity','verify','--source',root,'--installed',d]).status,4)});
test('installed guard drift is detected',()=>{const d=installMinimal(tmp());fs.appendFileSync(path.join(d,'.aledevos/adapters/antigravity/hooks/pretool-guard.mjs'),'\n// drift\n');assert.equal(run(['parity','verify','--source',root,'--installed',d]).status,4)});
test('installed permission overlay drift is detected',()=>{const d=installMinimal(tmp());fs.appendFileSync(path.join(d,'.aledevos/adapters/antigravity/aledevos-permissions.overlay.json'),'\n ');assert.equal(run(['parity','verify','--source',root,'--installed',d]).status,4)});
test('installed acquisition wrapper drift is detected',()=>{const d=installMinimal(tmp());fs.appendFileSync(path.join(d,'.aledevos/adapters/antigravity/acquire-skill.ps1'),'\n# drift\n');assert.equal(run(['parity','verify','--source',root,'--installed',d]).status,4)});
test('fresh Antigravity certificate verifies',()=>{const d=tmp(),f=path.join(d,'c.json');assert.equal(run(['certify','run','--root',root,'--out',f]).status,0);const r=run(['certify','verify','--root',root,'--certificate',f]);assert.equal(r.status,0);assert.equal(json(r).status,'ANTIGRAVITY_CERTIFICATE_VALID')});
test('certificate detects role drift',()=>{const d=clone(),f=path.join(d,'c.json');assert.equal(run(['certify','run','--root',d,'--out',f],d).status,0);fs.appendFileSync(path.join(d,'adapters/antigravity/.agents/agents/verifier.md'),'\nDRIFT\n');const r=run(['certify','verify','--root',d,'--certificate',f],d);assert.equal(r.status,4);assert.equal(json(r).status,'ANTIGRAVITY_CERTIFICATE_STALE_OR_TAMPERED')});
test('certifier blocks unknown layout',()=>{const d=tmp(),r=run(['certify','run','--root',d]);assert.equal(r.status,4);assert.equal(json(r).status,'ANTIGRAVITY_CERTIFICATION_BLOCKED')});
test('runtime preflight truthfully reports Antigravity CLI',()=>{const r=run(['runtime','preflight','--root',root]);assert.ok([0,4].includes(r.status));assert.ok(['ANTIGRAVITY_RUNTIME_PRESENT_UNCERTIFIED','ANTIGRAVITY_RUNTIME_BLOCKED'].includes(json(r).status))});
test('runtime preflight never equates CLI presence with certification',()=>{const r=run(['runtime','preflight','--root',root]);const o=json(r);if(r.status===0)assert.match(o.note,/Presence is not certification/);else assert.ok(Array.isArray(o.required_probes)&&o.required_probes.includes('effective_permissions'))});
