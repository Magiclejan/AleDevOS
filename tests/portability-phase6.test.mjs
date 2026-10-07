import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const engine=path.join(root,'portability/conformance/conformance.mjs');
const run=(args,cwd=root)=>spawnSync(process.execPath,[engine,...args],{cwd,encoding:'utf8'});
const json=r=>JSON.parse(r.stdout);
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-p6-'));
const clone=()=>{const d=tmp();fs.cpSync(root,d,{recursive:true});return d};
const mutateJson=(d,rel,fn)=>{const p=path.join(d,rel),o=JSON.parse(fs.readFileSync(p,'utf8'));fn(o);fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n')};
const baseMatrix=json(run(['matrix','run','--root',root]));
const baseSkills=json(run(['skills','verify','--root',root]));

// Cross-adapter matrix basics.
test('P6 cross-adapter matrix passes',()=>assert.equal(baseMatrix.status,'CROSS_ADAPTER_CONFORMANCE_PASS'));
test('matrix normalizes successful package conformance to PASS',()=>assert.equal(baseMatrix.normalized_state,'PASS'));
test('matrix is package-only evidence',()=>assert.equal(baseMatrix.package_only,true));
test('target runtime validation remains deferred',()=>assert.equal(baseMatrix.target_runtime_validation,'DEFERRED'));
test('four canonical runtimes are compared',()=>assert.deepEqual(baseMatrix.canonical_adapters,['opencode','codex','claude-code','antigravity']));
test('Gemini remains explicit alias of Antigravity',()=>assert.equal(baseMatrix.aliases.gemini,'antigravity'));
test('all four adapters have fresh package certificates',()=>{for(const a of baseMatrix.canonical_adapters)assert.match(baseMatrix.adapters[a].certificate,/CERTIFICATE_VALID$/)});
test('all four adapters pass full_current',()=>{for(const a of baseMatrix.canonical_adapters)assert.equal(baseMatrix.adapters[a].full_current,'ADAPTER_COMPATIBLE')});
test('all four adapters expose exactly 25 roles',()=>{for(const a of baseMatrix.canonical_adapters)assert.equal(baseMatrix.adapters[a].roles,25)});
test('shared Playwright provider is byte-identical',()=>assert.equal(baseMatrix.checks.find(x=>x.id==='visualqa.provider.byte_parity').status,'PASS'));
test('Core has no runtime-specific adapter leakage',()=>assert.equal(baseMatrix.checks.find(x=>x.id==='core.runtime_specific_leakage').status,'PASS'));
test('scope_prewrite variance is explicit, not hidden',()=>assert.equal(baseMatrix.checks.find(x=>x.id==='capability.scope_prewrite.variance').status,'PASS'));
test('compaction variance is explicit, not hidden',()=>assert.equal(baseMatrix.checks.find(x=>x.id==='capability.compaction.variance').status,'PASS'));

// One test per normalized semantic scenario.
for(const row of baseMatrix.scenarios){
 test(`normalized scenario ${row.id} is ${row.expected} on every canonical adapter`,()=>{
   assert.equal(new Set(Object.values(row.adapters)).size,1);
   for(const v of Object.values(row.adapters))assert.equal(v,row.expected);
 });
}

// Portable Skill Pack.
test('portable Skill Pack passes',()=>assert.equal(baseSkills.status,'PORTABLE_SKILL_PACK_PASS'));
test('portable Skill Pack has 245 deterministic checks',()=>assert.equal(baseSkills.summary.total,245));
test('portable Skill Pack has zero failures',()=>assert.equal(baseSkills.summary.failed,0));
test('portable Skill Pack id is canonical',()=>assert.equal(baseSkills.pack_id,'aledevos-portable-core-skills'));
test('portable Skill Pack version is 1.0.0',()=>assert.equal(baseSkills.pack_version,'1.0.0'));
test('semantic drift in one adapter Skill is detected',()=>{
 const d=clone(),p=path.join(d,'adapters/claude-code/.claude/skills/safe-edit/SKILL.md');fs.appendFileSync(p,'\n- silently weaken safety\n');
 const o=json(run(['skills','verify','--root',d],d));assert.equal(o.status,'PORTABLE_SKILL_PACK_FAILED');assert.equal(o.checks.find(x=>x.id==='adapter.claude-code.safe-edit.semantic').status,'FAIL');
});
test('adapter-native compatibility label is semantically normalized but raw binding remains sealed',()=>{
 const d=clone(),p=path.join(d,'adapters/codex/.agents/skills/repo-map/SKILL.md');let s=fs.readFileSync(p,'utf8');s=s.replace(/^compatibility:.*$/m,'compatibility: Codex changed label');fs.writeFileSync(p,s);
 const o=json(run(['skills','verify','--root',d],d));assert.equal(o.checks.find(x=>x.id==='adapter.codex.repo-map.semantic').status,'PASS');assert.equal(o.checks.find(x=>x.id==='adapter.codex.repo-map.binding_sha').status,'FAIL');
});
test('missing adapter Skill is detected',()=>{
 const d=clone();fs.rmSync(path.join(d,'adapters/antigravity/.agents/skills/backend-change'),{recursive:true,force:true});const o=json(run(['skills','verify','--root',d],d));assert.equal(o.status,'PORTABLE_SKILL_PACK_FAILED');assert.equal(o.checks.find(x=>x.id==='adapter.antigravity.skill_set').status,'FAIL');
});
test('binding path drift is detected',()=>{
 const d=clone();mutateJson(d,'skillsystem/bindings/opencode.json',o=>o.bindings.find(x=>x.skill_id==='safe-edit').path='.opencode/skills/wrong/SKILL.md');const o=json(run(['skills','verify','--root',d],d));assert.equal(o.checks.find(x=>x.id==='adapter.opencode.safe-edit.binding_path').status,'FAIL');
});
test('binding SHA drift is detected',()=>{
 const d=clone();mutateJson(d,'skillsystem/bindings/claude-code.json',o=>o.bindings.find(x=>x.skill_id==='safe-edit').expected_sha256='0'.repeat(64));const o=json(run(['skills','verify','--root',d],d));assert.equal(o.checks.find(x=>x.id==='adapter.claude-code.safe-edit.binding_sha').status,'FAIL');
});
test('extra adapter Skill breaks exact portable set',()=>{
 const d=clone(),p=path.join(d,'adapters/opencode/.opencode/skills/not-portable/SKILL.md');fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'---\nname: not-portable\n---\n');const o=json(run(['skills','verify','--root',d],d));assert.equal(o.checks.find(x=>x.id==='adapter.opencode.skill_set').status,'FAIL');
});

// Matrix sabotage and fail-closed behavior.
test('provider drift across one runtime fails conformance',()=>{
 const d=clone();fs.appendFileSync(path.join(d,'adapters/codex/visualqa/playwright-driver.mjs'),'\n// drift\n');const o=json(run(['matrix','run','--root',d],d));assert.equal(o.status,'CROSS_ADAPTER_CONFORMANCE_FAILED');assert.equal(o.checks.find(x=>x.id==='visualqa.provider.byte_parity').status,'FAIL');
});
test('missing canonical role fails conformance',()=>{
 const d=clone();fs.rmSync(path.join(d,'adapters/claude-code/.claude/agents/verifier.md'));const o=json(run(['matrix','run','--root',d],d));assert.equal(o.checks.find(x=>x.id==='adapter.claude-code.role_set').status,'FAIL');
});
test('Core runtime-specific token fails conformance',()=>{
 const d=clone();fs.appendFileSync(path.join(d,'core/engine/aledevos.mjs'),'\n// opencode leak\n');const o=json(run(['matrix','run','--root',d],d));assert.equal(o.checks.find(x=>x.id==='core.runtime_specific_leakage').status,'FAIL');
});
test('Gemini alias capability drift fails conformance',()=>{
 const d=clone();mutateJson(d,'adapters/gemini/adapter-capabilities.json',o=>o.capabilities.network.status='best_effort');const o=json(run(['matrix','run','--root',d],d));assert.equal(o.checks.find(x=>x.id==='alias.gemini.capability_identity').status,'FAIL');
});
test('required capability weakening fails conformance',()=>{
 const d=clone();mutateJson(d,'adapters/codex/adapter-capabilities.json',o=>o.capabilities.network.status='best_effort');const o=json(run(['matrix','run','--root',d],d));assert.equal(o.status,'CROSS_ADAPTER_CONFORMANCE_FAILED');assert.equal(o.checks.find(x=>x.id==='adapter.codex.full_current').status,'FAIL');
});
test('allowed scope_prewrite variance remains semantically recognized',()=>{
 const d=clone();mutateJson(d,'adapters/codex/adapter-capabilities.json',o=>o.capabilities.scope_prewrite.status='unsupported');const o=json(run(['matrix','run','--root',d],d));assert.equal(o.checks.find(x=>x.id==='capability.scope_prewrite.variance').status,'PASS');assert.equal(o.checks.find(x=>x.id==='adapter.codex.certificate_fresh').status,'FAIL');
});

// Generic source -> installed projection parity.
test('cross-adapter projection materializes and verifies',()=>{
 const d=tmp();let r=run(['projection','materialize','--root',root,'--out-root',d]);assert.equal(r.status,0,r.stdout+r.stderr);r=run(['projection','verify','--root',root,'--installed-root',d]);assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(json(r).summary.failed,0);
});
test('cross-adapter projection contains 160 sealed files',()=>{const o=json(run(['projection','verify','--root',root]));assert.equal(o.summary.total,160)});
test('installed projection tamper is detected',()=>{
 const d=tmp();assert.equal(run(['projection','materialize','--root',root,'--out-root',d]).status,0);fs.appendFileSync(path.join(d,'antigravity/.agents/agents/verifier.md'),'\nDRIFT\n');const r=run(['projection','verify','--root',root,'--installed-root',d]);assert.equal(r.status,4);assert.equal(json(r).status,'CROSS_ADAPTER_PROJECTION_FAILED');
});
test('installed Skill projection tamper is detected',()=>{
 const d=tmp();assert.equal(run(['projection','materialize','--root',root,'--out-root',d]).status,0);fs.appendFileSync(path.join(d,'opencode/.opencode/skills/safe-edit/SKILL.md'),'\nDRIFT\n');const r=run(['projection','verify','--root',root,'--installed-root',d]);assert.equal(r.status,4);
});

// P6 certificate.
test('P6 certification can be generated',()=>{const d=tmp(),f=path.join(d,'p6.json'),r=run(['certify','run','--root',root,'--out',f]);assert.equal(r.status,0,r.stdout+r.stderr);const o=json(r);assert.equal(o.status,'CROSS_ADAPTER_CONFORMANCE_CERTIFIED');assert.match(o.evidence_sha256,/^[0-9a-f]{64}$/);assert.ok(fs.existsSync(f))});
test('fresh P6 certificate verifies',()=>{const d=tmp(),f=path.join(d,'p6.json');assert.equal(run(['certify','run','--root',root,'--out',f]).status,0);const r=run(['certify','verify','--root',root,'--certificate',f]);assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(json(r).status,'CROSS_ADAPTER_CERTIFICATE_VALID')});
test('P6 certificate is invalidated by skill binding drift',()=>{
 const d=clone(),f=path.join(d,'p6.json');assert.equal(run(['certify','run','--root',d,'--out',f],d).status,0);mutateJson(d,'skillsystem/bindings/codex.json',o=>o.binding_version='9.9.9');const r=run(['certify','verify','--root',d,'--certificate',f],d);assert.equal(r.status,4);assert.equal(json(r).status,'CROSS_ADAPTER_CERTIFICATE_STALE_OR_TAMPERED');
});
test('P6 certificate inputs are root-relative',()=>{const d=tmp(),f=path.join(d,'p6.json');assert.equal(run(['certify','run','--root',root,'--out',f]).status,0);const o=JSON.parse(fs.readFileSync(f,'utf8'));for(const x of o.inputs){assert.equal(path.isAbsolute(x.path),false);assert.equal(x.path.includes('..'),false)}});
test('P6 certificate explicitly defers target runtime validation',()=>{const d=tmp(),f=path.join(d,'p6.json');assert.equal(run(['certify','run','--root',root,'--out',f]).status,0);const o=JSON.parse(fs.readFileSync(f,'utf8'));assert.equal(o.target_runtime_validation,'DEFERRED');assert.equal(o.package_only,true)});

// Installer and frozen architecture wiring.
test('installer carries portable Skill Pack metadata into installed projects',()=>{const s=fs.readFileSync('scripts/05-install-into-project.ps1','utf8');assert.match(s,/portable-skill-pack\.json/)});
test('Core security policy delegates adapter-native control plane to adapter project templates',()=>{const o=JSON.parse(fs.readFileSync('core/policies/security-policy.json','utf8'));assert.match(o.adapter_control_plane,/project-template\.json/)});
test('Core security policy has no runtime-specific adapter directory names',()=>{const s=fs.readFileSync('core/policies/security-policy.json','utf8').toLowerCase();for(const t of ['opencode','codex','claude','antigravity','gemini'])assert.equal(s.includes(t),false)});
test('portable pack maps Gemini alias to Antigravity',()=>{const o=JSON.parse(fs.readFileSync('skillsystem/portable/portable-skill-pack.json','utf8'));assert.equal(o.alias_projections.gemini,'antigravity')});
