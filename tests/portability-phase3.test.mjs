import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const cert=path.join(root,'adapters/codex/certification/codex-certifier.mjs');
const abi=path.join(root,'core/adapter-runtime/adapter.mjs');
const run=(args,cwd=root)=>spawnSync(process.execPath,[cert,...args],{cwd,encoding:'utf8'});
const runAbi=(args,cwd=root)=>spawnSync(process.execPath,[abi,...args],{cwd,encoding:'utf8'});
const json=r=>JSON.parse(r.stdout);
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-p3-'));
function clone(){const d=tmp();fs.cpSync(root,d,{recursive:true});return d}
function mutateText(d,rel,fn){const p=path.join(d,rel);let s=fs.readFileSync(p,'utf8');s=fn(s);fs.writeFileSync(p,s)}
function mutateJson(d,rel,fn){const p=path.join(d,rel);const o=JSON.parse(fs.readFileSync(p,'utf8'));fn(o);fs.writeFileSync(p,JSON.stringify(o,null,2));}
function cp(srcRoot,rel,dstRoot,dstRel=rel){const src=path.join(srcRoot,rel),dst=path.join(dstRoot,dstRel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst)}
function installMinimal(d){
 cp(root,'adapters/codex/.codex/config.toml',d,'.codex/config.toml');
 cp(root,'adapters/codex/.codex/hooks/aledevos-role-guard.mjs',d,'.codex/hooks/aledevos-role-guard.mjs');
 for(const f of fs.readdirSync(path.join(root,'adapters/codex/.codex/agents')).filter(x=>x.endsWith('.toml')))cp(root,'adapters/codex/.codex/agents/'+f,d,'.codex/agents/'+f);
 for(const name of fs.readdirSync(path.join(root,'adapters/codex/.agents/skills'))){const rel=`adapters/codex/.agents/skills/${name}/SKILL.md`;if(fs.existsSync(path.join(root,rel)))cp(root,rel,d,`.agents/skills/${name}/SKILL.md`)}
 cp(root,'adapters/codex/adapter-capabilities.json',d,'.aledevos/adapters/codex/adapter-capabilities.json');
 cp(root,'adapters/codex/visualqa/playwright-driver.mjs',d,'.aledevos/visualqa/providers/playwright-driver.mjs');
 cp(root,'adapters/codex/project-template.json',d,'.aledevos/project.json');
 cp(root,'skillsystem/bindings/codex.json',d,'.aledevos/skillsystem/bindings/codex.json');
 cp(root,'skillsystem/discovery/codex.json',d,'.aledevos/skillsystem/discovery/codex.json');
 cp(root,'skillsystem/acquisition/codex.json',d,'.aledevos/skillsystem/acquisition/codex.json');
 cp(root,'core/engine/aledevos.mjs',d,'.aledevos/runtime/aledevos.mjs');
 cp(root,'contextos/engine/contextos.mjs',d,'.aledevos/contextos/runtime/contextos.mjs');
 cp(root,'skillsystem/engine/skillsystem.mjs',d,'.aledevos/skillsystem/runtime/skillsystem.mjs');
 cp(root,'visualqa/engine/visual-judge.mjs',d,'.aledevos/visualqa/runtime/visual-judge.mjs');
 cp(root,'release/engine/v1-release.mjs',d,'.aledevos/release/runtime/v1-release.mjs');
 cp(root,'adapters/codex/certification/codex-certifier.mjs',d,'.aledevos/adapters/codex/codex-certifier.mjs');
 return d;
}
const sourceResult=()=>json(run(['certify','run','--root',root]));

test('Codex source adapter obtains deterministic P3 certification',()=>{const r=run(['certify','run','--root',root]);assert.equal(r.status,0,r.stderr);const o=json(r);assert.equal(o.status,'CODEX_ADAPTER_CERTIFIED');assert.equal(o.dialect,'codex-project-config-2026');assert.equal(o.summary.failed,0);assert.ok(o.summary.total>=240)});
test('Codex certification evidence is SHA-256 sealed',()=>{assert.match(sourceResult().evidence_sha256,/^[0-9a-f]{64}$/)});
test('P3 explicitly certifies project-local Codex configuration',()=>{const o=sourceResult();assert.equal(o.layout,'source');assert.ok(o.checks.some(x=>x.id==='config.multi_agent'&&x.status==='PASS'))});
test('approval policy must remain never',()=>{const d=clone();mutateText(d,'adapters/codex/.codex/config.toml',s=>s.replace('approval_policy = "never"','approval_policy = "on-request"'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='config.approval_never'&&x.status==='FAIL'))});
test('single governed runtime permission profile is mandatory',()=>{const d=clone();mutateText(d,'adapters/codex/.codex/config.toml',s=>s.replace('default_permissions = "aledevos_runtime"','default_permissions = "untrusted"'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='config.default_permissions'&&x.status==='FAIL'))});
test('native web search cannot be enabled silently',()=>{const d=clone();mutateText(d,'adapters/codex/.codex/config.toml',s=>s.replace('web_search = "disabled"','web_search = "live"'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='config.web_search_disabled'&&x.status==='FAIL'))});
test('login shell must remain disabled',()=>{const d=clone();mutateText(d,'adapters/codex/.codex/config.toml',s=>s.replace('allow_login_shell = false','allow_login_shell = true'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='config.login_shell_disabled'&&x.status==='FAIL'))});
test('native multi-agent support is required',()=>{const d=clone();mutateText(d,'adapters/codex/.codex/config.toml',s=>s.replace('multi_agent = true','multi_agent = false'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='config.multi_agent'&&x.status==='FAIL'))});
test('request-permissions tool cannot be enabled',()=>{const d=clone();mutateText(d,'adapters/codex/.codex/config.toml',s=>s.replace('request_permissions_tool = false','request_permissions_tool = true'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='config.request_permissions_disabled'&&x.status==='FAIL'))});
test('Code Mode and host must remain disabled',()=>{const d=clone();mutateText(d,'adapters/codex/.codex/config.toml',s=>s.replace('[features.code_mode]\nenabled = false','[features.code_mode]\nenabled = true'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='config.code_mode_disabled'&&x.status==='FAIL'))});
test('Codex adapter uses current :workspace_roots token only',()=>{const o=sourceResult();assert.ok(o.checks.some(x=>x.id==='permissions.current_workspace_token'&&x.status==='PASS'))});
test('runtime profile denies filesystem outside workspace',()=>{const o=sourceResult();assert.ok(o.checks.some(x=>x.id==='permissions.runtime.external_deny'&&x.status==='PASS'))});
test('runtime profile protects agent control-plane configuration',()=>{const o=sourceResult();assert.ok(o.checks.some(x=>x.id==='permissions.runtime.protect..codex'&&x.status==='PASS'))});
test('legacy :project_roots token is rejected',()=>{const d=clone();mutateText(d,'adapters/codex/.codex/config.toml',s=>s.replaceAll(':workspace_roots',':project_roots'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='permissions.current_workspace_token'&&x.status==='FAIL'))});
test('external root read access invalidates governed runtime sandbox',()=>{const d=clone();mutateText(d,'adapters/codex/.codex/config.toml',s=>s.replace('[permissions.aledevos_runtime.filesystem]\n":root" = "deny"','[permissions.aledevos_runtime.filesystem]\n":root" = "read"'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='permissions.runtime.external_deny'&&x.status==='FAIL'))});
test('governed runtime retains scoped product writes',()=>{const d=clone();mutateText(d,'adapters/codex/.codex/config.toml',s=>s.replace('":workspace_roots" = { "." = "write"','":workspace_roots" = { "." = "read"'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='permissions.runtime.product_and_state_write'&&x.status==='FAIL'))});
test('governed runtime rejects edits to protected AleDevOS adapter control plane',()=>{const d=clone();mutateText(d,'adapters/codex/.codex/config.toml',s=>s.replace('".aledevos/adapters" = "read"','".aledevos/adapters" = "write"'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='permissions.runtime.protect..aledevos/adapters'&&x.status==='FAIL'))});
test('governed runtime protects .codex adapter configuration',()=>{const d=clone();mutateText(d,'adapters/codex/.codex/config.toml',s=>s.replace('".codex" = "read"','".codex" = "write"'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='permissions.runtime.protect..codex'&&x.status==='FAIL'))});
test('governed runtime protects repository skills',()=>{const d=clone();mutateText(d,'adapters/codex/.codex/config.toml',s=>s.replace('".agents" = "read"','".agents" = "write"'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='permissions.runtime.protect..agents'&&x.status==='FAIL'))});
test('governed runtime rejects protected package-tree write escalation',()=>{const d=clone();mutateText(d,'adapters/codex/.codex/config.toml',s=>s.replace('".aledevos/release" = "read"','".aledevos/release" = "write"'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='permissions.runtime.protect..aledevos/release'&&x.status==='FAIL'))});
test('governed runtime blocks external network while permitting required local binding',()=>{const o=sourceResult();assert.ok(o.checks.some(x=>x.id==='permissions.runtime.network_restricted'&&x.status==='PASS'));assert.ok(o.checks.some(x=>x.id==='permissions.runtime.loopback_only'&&x.status==='PASS'))});
test('enabling external network fails governed runtime certification',()=>{const d=clone();mutateText(d,'adapters/codex/.codex/config.toml',s=>s.replace('[permissions.aledevos_runtime.network]\nenabled = false','[permissions.aledevos_runtime.network]\nenabled = true'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='permissions.runtime.network_restricted'&&x.status==='FAIL'))});
test('all 25 canonical Codex roles are declared',()=>{const o=sourceResult();assert.ok(o.checks.some(x=>x.id==='roles.count'&&x.status==='PASS'&&/25/.test(x.detail)))});
test('missing Codex role fails certification',()=>{const d=clone();fs.rmSync(path.join(d,'adapters/codex/.codex/agents/architect.toml'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='role.architect.file'&&x.status==='FAIL'))});
test('builder cannot override the governed runtime permission profile',()=>{const d=clone();mutateText(d,'adapters/codex/.codex/agents/builder.toml',s=>s.replace('default_permissions = "aledevos_runtime"','default_permissions = "untrusted"'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='role.builder.permissions'&&x.status==='FAIL'))});
test('builder cannot disable governed shell required for canonical state and gates',()=>{const d=clone();mutateText(d,'adapters/codex/.codex/agents/builder.toml',s=>s.replace('shell_tool = true','shell_tool = false'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='role.builder.shell_boundary'&&x.status==='FAIL'))});
test('Verifier uses state-runner permission profile',()=>{const o=sourceResult();assert.ok(o.checks.some(x=>x.id==='role.verifier.permissions'&&x.status==='PASS'))});
test('read-only researcher cannot enable shell',()=>{const d=clone();mutateText(d,'adapters/codex/.codex/agents/researcher.toml',s=>s.replace('shell_tool = false','shell_tool = true'));const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='role.researcher.shell_boundary'&&x.status==='FAIL'))});
test('every role disables model-driven permission expansion',()=>{const o=sourceResult();assert.equal(o.checks.filter(x=>x.id.endsWith('.permission_request_off')&&x.status==='FAIL').length,0)});
test('every role disables Code Mode',()=>{const o=sourceResult();assert.equal(o.checks.filter(x=>x.id.endsWith('.code_mode_off')&&x.status==='FAIL').length,0)});
test('Codex discovers repository skills from .agents/skills',()=>{const o=sourceResult();assert.ok(o.checks.some(x=>x.id==='skills.discovery_root'&&x.status==='PASS'))});
test('Codex safe acquisition targets .agents/skills',()=>{const o=sourceResult();assert.ok(o.checks.some(x=>x.id==='skills.acquisition_root'&&x.status==='PASS'))});
test('thirteen bundled repository skills are installed',()=>{const o=sourceResult();assert.ok(o.checks.some(x=>x.id==='skills.native_repository_skills'&&x.status==='PASS'&&/13/.test(x.detail)))});
test('removing a bundled skill fails certification',()=>{const d=clone();fs.rmSync(path.join(d,'adapters/codex/.agents/skills/backend-change'),{recursive:true,force:true});const o=json(run(['certify','run','--root',d],d));assert.ok(o.checks.some(x=>x.id==='skills.native_repository_skills'&&x.status==='FAIL'))});
test('all Codex Skill bindings remain repository-native',()=>{const o=sourceResult();assert.ok(o.checks.some(x=>x.id==='skills.binding_paths'&&x.status==='PASS'))});
test('Codex project template protects control plane',()=>{const o=sourceResult();assert.ok(o.checks.some(x=>x.id==='project.protected_paths'&&x.status==='PASS'))});
test('adapter-owned Playwright provider is present',()=>{const o=sourceResult();assert.ok(o.checks.some(x=>x.id==='binding.visual_provider'&&x.status==='PASS'))});
test('repair cap remains exactly two under Codex',()=>{const o=sourceResult();assert.ok(o.checks.some(x=>x.id==='behavior.repair_cap'&&x.status==='PASS'))});
test('Codex manifest identity is implemented and installable',()=>{const o=sourceResult();assert.ok(o.checks.some(x=>x.id==='manifest.identity'&&x.status==='PASS'))});
test('all non-unsupported Codex capabilities have P3 proof',()=>{const o=sourceResult();const cap=o.checks.filter(x=>x.id.startsWith('capability.'));assert.ok(cap.length>=27);assert.equal(cap.filter(x=>x.status!=='PASS').length,0)});
test('Adapter ABI reports Codex full_current compatible',()=>{const r=runAbi(['compatibility','check','--root',root,'--adapter','codex','--profile','full_current']);assert.equal(r.status,0,r.stdout+r.stderr);const o=json(r);assert.equal(o.status,'ADAPTER_COMPATIBLE');assert.equal(o.summary.blocked,0)});
test('Adapter ABI reports Codex installable',()=>{const r=runAbi(['install','check','--root',root,'--adapter','codex']);assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(json(r).status,'ADAPTER_INSTALLABLE')});
test('installed Codex layout obtains same certification class',()=>{const d=installMinimal(tmp());const rt=path.join(d,'.aledevos/adapters/codex/codex-certifier.mjs');const r=spawnSync(process.execPath,[rt,'certify','run','--root',d],{cwd:d,encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);const o=JSON.parse(r.stdout);assert.equal(o.layout,'installed');assert.equal(o.status,'CODEX_ADAPTER_CERTIFIED')});
test('source to installed Codex parity passes',()=>{const d=installMinimal(tmp());const r=run(['parity','verify','--source',root,'--installed',d,'--root',root]);assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(json(r).status,'CODEX_SOURCE_INSTALLED_PARITY_PASS')});
test('installed Codex config tamper is detected by parity',()=>{const d=installMinimal(tmp());fs.appendFileSync(path.join(d,'.codex/config.toml'),'\n# drift\n');const r=run(['parity','verify','--source',root,'--installed',d,'--root',root]);assert.equal(r.status,4);assert.equal(json(r).status,'CODEX_SOURCE_INSTALLED_PARITY_FAILED')});
test('installed role tamper is detected by parity',()=>{const d=installMinimal(tmp());fs.appendFileSync(path.join(d,'.codex/agents/verifier.toml'),'\n# drift\n');const r=run(['parity','verify','--source',root,'--installed',d,'--root',root]);assert.equal(r.status,4);assert.equal(json(r).status,'CODEX_SOURCE_INSTALLED_PARITY_FAILED')});
test('installed repository Skill tamper is detected by parity',()=>{const d=installMinimal(tmp());fs.appendFileSync(path.join(d,'.agents/skills/backend-change/SKILL.md'),'\nDRIFT\n');const r=run(['parity','verify','--source',root,'--installed',d,'--root',root]);assert.equal(r.status,4);assert.equal(json(r).status,'CODEX_SOURCE_INSTALLED_PARITY_FAILED')});
test('certifier fails closed on unknown layout',()=>{const d=tmp();const r=run(['certify','run','--root',d]);assert.equal(r.status,4);assert.equal(json(r).status,'CODEX_CERTIFICATION_BLOCKED')});
test('fresh Codex certificate verifies',()=>{const d=tmp(),f=path.join(d,'cert.json');let r=run(['certify','run','--root',root,'--out',f]);assert.equal(r.status,0,r.stdout+r.stderr);r=run(['certify','verify','--root',root,'--certificate',f]);assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(json(r).status,'CODEX_CERTIFICATE_VALID')});
test('certificate detects source drift after issuance',()=>{const d=clone(),f=path.join(d,'cert.json');let r=run(['certify','run','--root',d,'--out',f],d);assert.equal(r.status,0,r.stdout+r.stderr);fs.appendFileSync(path.join(d,'adapters/codex/.codex/agents/verifier.toml'),'\n# drift\n');r=run(['certify','verify','--root',d,'--certificate',f],d);assert.equal(r.status,4);assert.equal(json(r).status,'CODEX_CERTIFICATE_STALE_OR_TAMPERED')});
test('runtime preflight is truthful about Codex CLI presence',()=>{const r=run(['runtime','preflight','--root',root]);assert.ok([0,4].includes(r.status));const o=json(r);assert.ok(['CODEX_RUNTIME_PRESENT','CODEX_RUNTIME_BLOCKED'].includes(o.status));if(o.status==='CODEX_RUNTIME_BLOCKED')assert.equal(o.reason,'CODEX_CLI_NOT_FOUND')});
test('installer has explicit Codex projection and no silent fallback',()=>{const s=fs.readFileSync('scripts/05-install-into-project.ps1','utf8');assert.match(s,/Adapter -eq 'codex'/);assert.match(s,/\.codex/);assert.match(s,/\.agents\\skills/);assert.match(s,/ADAPTER_INSTALL_PROJECTION_NOT_IMPLEMENTED/)});
test('installer deploys Codex certifier into installed project',()=>{const s=fs.readFileSync('scripts/05-install-into-project.ps1','utf8');assert.match(s,/codex-certifier\.mjs/)});
test('P3 documentation separates package certification from target-runtime evidence',()=>{const s=fs.readFileSync('docs/PORTABILITY_PHASE3_CODEX_ADAPTER.md','utf8');assert.match(s,/does not certify target-runtime readiness/i);assert.match(s,/\.codex\/config\.toml/);assert.match(s,/\.agents\/skills/)});
