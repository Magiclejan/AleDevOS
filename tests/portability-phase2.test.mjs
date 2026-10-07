import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const cert=path.join(root,'adapters/opencode/certification/opencode-certifier.mjs');
const run=(args,cwd=root)=>spawnSync(process.execPath,[cert,...args],{cwd,encoding:'utf8'});
const json=r=>JSON.parse(r.stdout);
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-p2-'));
function clone(){const d=tmp();fs.cpSync(root,d,{recursive:true});return d}
function mutateJson(d,rel,fn){const p=path.join(d,rel);const o=JSON.parse(fs.readFileSync(p,'utf8'));fn(o);fs.writeFileSync(p,JSON.stringify(o,null,2));}
function mutateAgent(d,name,fn){const p=path.join(d,'adapters/opencode/.opencode/agents',name+'.md');let s=fs.readFileSync(p,'utf8');s=fn(s);fs.writeFileSync(p,s)}
function installMinimal(d){
 const cp=(a,b)=>{const src=path.join(root,a),dst=path.join(d,b);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst)};
 cp('adapters/opencode/opencode.json','opencode.json');
 cp('adapters/opencode/adapter-capabilities.json','.aledevos/adapters/opencode/adapter-capabilities.json');
 cp('adapters/opencode/visualqa/playwright-driver.mjs','.aledevos/visualqa/providers/playwright-driver.mjs');
 cp('core/engine/aledevos.mjs','.aledevos/runtime/aledevos.mjs');
 cp('contextos/engine/contextos.mjs','.aledevos/contextos/runtime/contextos.mjs');
 cp('skillsystem/engine/skillsystem.mjs','.aledevos/skillsystem/runtime/skillsystem.mjs');
 cp('visualqa/engine/visual-judge.mjs','.aledevos/visualqa/runtime/visual-judge.mjs');
 cp('release/engine/v1-release.mjs','.aledevos/release/runtime/v1-release.mjs');
 for(const f of fs.readdirSync(path.join(root,'adapters/opencode/.opencode/agents')).filter(x=>x.endsWith('.md')))cp('adapters/opencode/.opencode/agents/'+f,'.opencode/agents/'+f);
 cp('adapters/opencode/certification/opencode-certifier.mjs','.aledevos/adapters/opencode/opencode-certifier.mjs');
 return d;
}

test('OpenCode source adapter obtains deterministic P2 certification',()=>{const r=run(['certify','run','--root',root]);assert.equal(r.status,0,r.stderr);const o=json(r);assert.equal(o.status,'OPENCODE_ADAPTER_CERTIFIED');assert.equal(o.dialect,'opencode-v2');assert.equal(o.summary.failed,0);assert.ok(o.summary.total>=190)});
test('certification evidence is SHA-256 sealed',()=>{const o=json(run(['certify','run','--root',root]));assert.match(o.evidence_sha256,/^[0-9a-f]{64}$/)});
test('P2 explicitly certifies OpenCode V2 dialect',()=>{const o=json(run(['certify','run','--root',root]));assert.equal(o.dialect,'opencode-v2');assert.ok(o.checks.some(x=>x.id==='dialect.v2.permissions_array'&&x.status==='PASS'))});
test('V1 permission object mixed into V2 is rejected',()=>{const d=clone();mutateJson(d,'adapters/opencode/opencode.json',o=>o.permission={edit:'allow'});const r=run(['certify','run','--root',d],d);assert.equal(r.status,4);assert.ok(json(r).checks.some(x=>x.id==='dialect.no_v1_permission'&&x.status==='FAIL'))});
test('V2 permissions must remain an ordered array',()=>{const d=clone();mutateJson(d,'adapters/opencode/opencode.json',o=>o.permissions={edit:'deny'});const r=run(['certify','run','--root',d],d);assert.equal(r.status,4);assert.ok(json(r).checks.some(x=>x.id==='dialect.v2.permissions_array'&&x.status==='FAIL'))});
test('legacy tools block cannot substitute certification permissions',()=>{const d=clone();mutateJson(d,'adapters/opencode/opencode.json',o=>o.tools={edit:false});const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='dialect.no_legacy_tools'&&x.status==='FAIL'))});
test('AleDevOS OpenCode config does not bundle provider or model',()=>{const cfg=JSON.parse(fs.readFileSync('adapters/opencode/opencode.json','utf8'));assert.equal(Object.hasOwn(cfg,'providers'),false);assert.equal(Object.hasOwn(cfg,'model'),false);const o=json(run(['certify','run','--root',root]));assert.ok(o.checks.some(x=>x.id==='dialect.no_bundled_provider'&&x.status==='PASS'));assert.ok(o.checks.some(x=>x.id==='dialect.no_bundled_model'&&x.status==='PASS'));});
test('adapter certification does not falsify native-image readiness',()=>{const o=json(run(['certify','run','--root',root]));assert.ok(o.checks.some(x=>x.id==='runtime.truthful_text_only'&&x.status==='PASS'))});
test('global external-directory deny is certified',()=>{const o=json(run(['certify','run','--root',root]));assert.ok(o.checks.some(x=>x.id==='global.external_directory_deny'&&x.status==='PASS'))});
test('global external-directory allow after deny fails last-match semantics',()=>{const d=clone();mutateJson(d,'adapters/opencode/opencode.json',o=>o.permissions.push({action:'external_directory',resource:'*',effect:'allow'}));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='global.external_directory_deny'&&x.status==='FAIL'))});
test('global webfetch deny is required',()=>{const d=clone();mutateJson(d,'adapters/opencode/opencode.json',o=>o.permissions=o.permissions.filter(x=>x.action!=='webfetch'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='global.webfetch_deny'&&x.status==='FAIL'))});
test('global websearch deny is required',()=>{const d=clone();mutateJson(d,'adapters/opencode/opencode.json',o=>o.permissions=o.permissions.filter(x=>x.action!=='websearch'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='global.websearch_deny'&&x.status==='FAIL'))});
test('all agents use V2 permissions syntax',()=>{const o=json(run(['certify','run','--root',root]));assert.equal(o.checks.filter(x=>x.id.endsWith('.v2_permissions')&&x.status==='FAIL').length,0)});
test('V1 agent permission syntax is rejected',()=>{const d=clone();mutateAgent(d,'architect',s=>s.replace('permissions:','permission:'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='agent.architect.v2_permissions'&&x.status==='FAIL'))});
test('all agents deny arbitrary shell by default',()=>{const o=json(run(['certify','run','--root',root]));assert.equal(o.checks.filter(x=>x.id.endsWith('.shell_default_deny')&&x.status==='FAIL').length,0)});
test('later wildcard shell allow invalidates writer certification',()=>{const d=clone();mutateAgent(d,'builder',s=>s.replace(/\n---\n/,'\n  - action: shell\n    resource: "*"\n    effect: allow\n---\n'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='agent.builder.shell_default_deny'&&x.status==='FAIL'))});
test('all agents deny network tools',()=>{const o=json(run(['certify','run','--root',root]));assert.equal(o.checks.filter(x=>x.id.endsWith('.network_deny')&&x.status==='FAIL').length,0)});
test('all agents deny external-directory by default',()=>{const o=json(run(['certify','run','--root',root]));assert.equal(o.checks.filter(x=>x.id.endsWith('.external_deny')&&x.status==='FAIL').length,0)});
test('write-capable roles retain product edit authority',()=>{const o=json(run(['certify','run','--root',root]));assert.equal(o.checks.filter(x=>x.id.endsWith('.product_write')&&x.status==='FAIL').length,0)});
test('write-capable roles deny AleDevOS control-plane mutation',()=>{const o=json(run(['certify','run','--root',root]));assert.equal(o.checks.filter(x=>x.id.endsWith('.control_plane_deny')&&x.status==='FAIL').length,0)});
test('removing builder .aledevos deny fails control-plane certification',()=>{const d=clone();mutateAgent(d,'builder',s=>s.replace(/  - action: edit\n    resource: "\.aledevos\/\*\*"\n    effect: deny\n/,'') );const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='agent.builder.control_plane_deny'&&x.status==='FAIL'))});
test('Verifier has only narrow canonical gate binding',()=>{const o=json(run(['certify','run','--root',root]));assert.ok(o.checks.some(x=>x.id==='binding.canonical_gate'&&x.status==='PASS'))});
test('Verifier exposes deterministic scope prepass',()=>{const o=json(run(['certify','run','--root',root]));assert.ok(o.checks.some(x=>x.id==='binding.scope_prepass'&&x.status==='PASS'))});
test('Orchestrator defaults unknown subagents to deny',()=>{const o=json(run(['certify','run','--root',root]));assert.ok(o.checks.some(x=>x.id==='orchestrator.subagent_default_deny'&&x.status==='PASS'))});
test('Orchestrator explicitly delegates builder and verifier',()=>{const o=json(run(['certify','run','--root',root]));assert.ok(o.checks.some(x=>x.id==='orchestrator.builder_allow'&&x.status==='PASS'));assert.ok(o.checks.some(x=>x.id==='orchestrator.verifier_allow'&&x.status==='PASS'))});
test('Repair cap is behaviorally bound at exactly two',()=>{const o=json(run(['certify','run','--root',root]));assert.ok(o.checks.some(x=>x.id==='behavior.repair_cap'&&x.status==='PASS'))});
test('Playwright browser provider is adapter-owned and present',()=>{const o=json(run(['certify','run','--root',root]));assert.ok(o.checks.some(x=>x.id==='binding.visual_provider'&&x.status==='PASS'))});
test('Skill System runtime is bound',()=>{const o=json(run(['certify','run','--root',root]));assert.ok(o.checks.some(x=>x.id==='binding.skillsystem'&&x.status==='PASS'))});
test('ContextOS runtime is bound',()=>{const o=json(run(['certify','run','--root',root]));assert.ok(o.checks.some(x=>x.id==='binding.contextos'&&x.status==='PASS'))});
test('all non-unsupported OpenCode capabilities have P2 proof',()=>{const o=json(run(['certify','run','--root',root]));const cap=o.checks.filter(x=>x.id.startsWith('capability.'));assert.ok(cap.length>=27);assert.equal(cap.filter(x=>x.status!=='PASS').length,0)});
test('missing Playwright provider fails certification',()=>{const d=clone();fs.rmSync(path.join(d,'adapters/opencode/visualqa/playwright-driver.mjs'));const r=run(['certify','run','--root',d],d);assert.equal(r.status,4);assert.ok(json(r).checks.some(x=>x.id==='artifact.provider'&&x.status==='FAIL'))});
test('installed layout obtains same P2 certification class',()=>{const d=installMinimal(tmp());const rt=path.join(d,'.aledevos/adapters/opencode/opencode-certifier.mjs');const r=spawnSync(process.execPath,[rt,'certify','run','--root',d],{cwd:d,encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);const o=JSON.parse(r.stdout);assert.equal(o.layout,'installed');assert.equal(o.status,'OPENCODE_ADAPTER_CERTIFIED')});
test('source to installed adapter parity passes',()=>{const d=installMinimal(tmp());const r=run(['parity','verify','--source',root,'--installed',d,'--root',root]);assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(json(r).status,'OPENCODE_SOURCE_INSTALLED_PARITY_PASS')});
test('installed agent tamper is detected by parity',()=>{const d=installMinimal(tmp());fs.appendFileSync(path.join(d,'.opencode/agents/verifier.md'),'\nTAMPER\n');const r=run(['parity','verify','--source',root,'--installed',d,'--root',root]);assert.equal(r.status,4);assert.equal(json(r).status,'OPENCODE_SOURCE_INSTALLED_PARITY_FAILED')});
test('installed config tamper is detected by parity',()=>{const d=installMinimal(tmp());fs.appendFileSync(path.join(d,'opencode.json'),'\n ');const r=run(['parity','verify','--source',root,'--installed',d,'--root',root]);assert.equal(r.status,4);assert.ok(json(r).details.some(x=>x.installed==='opencode.json'&&x.status==='FAIL'))});
test('certifier fails closed on unknown layout',()=>{const d=tmp();const r=run(['certify','run','--root',d]);assert.equal(r.status,4);assert.equal(json(r).status,'OPENCODE_CERTIFICATION_BLOCKED')});
test('P1 ABI still reports OpenCode full_current compatible',()=>{const r=spawnSync(process.execPath,['core/adapter-runtime/adapter.mjs','compatibility','check','--root',root,'--adapter','opencode','--profile','full_current'],{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(JSON.parse(r.stdout).status,'ADAPTER_COMPATIBLE')});
test('installer is required to deploy P2 certifier into installed project',()=>{const s=fs.readFileSync('scripts/05-install-into-project.ps1','utf8');assert.match(s,/opencode-certifier\.mjs/)});
test('certificate verify accepts a fresh sealed certificate',()=>{const d=tmp(),f=path.join(d,'cert.json');const a=spawnSync(process.execPath,[cert,'certify','run','--root',root,'--out',f],{cwd:root,encoding:'utf8'});assert.equal(a.status,0,a.stdout+a.stderr);const b=run(['certify','verify','--root',root,'--certificate',f]);assert.equal(b.status,0,b.stdout+b.stderr);assert.equal(json(b).status,'OPENCODE_CERTIFICATE_VALID')});
test('certificate verify detects source drift after issuance',()=>{const d=clone(),f=path.join(d,'cert.json');let r=run(['certify','run','--root',d,'--out',f],d);assert.equal(r.status,0);fs.appendFileSync(path.join(d,'adapters/opencode/.opencode/agents/verifier.md'),'\nDRIFT\n');r=run(['certify','verify','--root',d,'--certificate',f],d);assert.equal(r.status,4);assert.equal(json(r).status,'OPENCODE_CERTIFICATE_STALE_OR_TAMPERED')});
test('P2 documentation separates adapter certification from target runtime readiness',()=>{const s=fs.readFileSync('docs/PORTABILITY_PHASE2_OPENCODE_CERTIFICATION.md','utf8');assert.match(s,/does not certify target-runtime readiness/i);assert.match(s,/OpenCode V2/i)});
