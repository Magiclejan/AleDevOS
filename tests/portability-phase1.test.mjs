import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const runtime=path.resolve('core/adapter-runtime/adapter.mjs');
const run=(args=[],cwd=process.cwd())=>spawnSync(process.execPath,[runtime,...args,'--root',cwd],{cwd,encoding:'utf8'});
const jsonOut=r=>JSON.parse(r.stdout||'{}');
const adapters=['antigravity','claude-code','codex','gemini','generic','opencode'];
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-portability-p1-'));
function clonePortableRoot(){
  const d=tmp();
  fs.cpSync(path.resolve('core'),path.join(d,'core'),{recursive:true});
  fs.cpSync(path.resolve('adapters'),path.join(d,'adapters'),{recursive:true});
  return d;
}

test('adapter ABI schema is contract v2 and accepts truthful capability statuses',()=>{
  const s=JSON.parse(fs.readFileSync('core/schemas/adapter-contract.schema.json','utf8'));
  assert.equal(s.properties.contract_version.const,'2.0');
  assert.deepEqual(s.properties.capabilities.additionalProperties.properties.status.enum,['enforced','implemented','best_effort','unsupported']);
});

test('canonical capability catalog is valid and has 28 unique capabilities',()=>{
  const r=run(['catalog','verify']);const o=jsonOut(r);
  assert.equal(r.status,0,r.stderr);assert.equal(o.status,'ADAPTER_CATALOG_VALID');assert.equal(o.count,28);
});

test('all declared adapter manifests satisfy Adapter ABI 2.0 structurally',()=>{
  for(const adapter of adapters){const r=run(['manifest','verify','--adapter',adapter]);assert.equal(r.status,0,`${adapter}: ${r.stdout} ${r.stderr}`);assert.equal(jsonOut(r).status,'ADAPTER_MANIFEST_VALID')}
});

test('adapter catalog lists the six canonical adapters deterministically',()=>{
  const r=run(['catalog','list']);const o=jsonOut(r);assert.equal(r.status,0);assert.deepEqual(o.adapters.map(x=>x.adapter),adapters);
});

test('OpenCode remains implemented/installable while later phases may promote additional adapters',()=>{
  const o=jsonOut(run(['catalog','list']));const installable=o.adapters.filter(x=>x.installable);
  assert.ok(installable.some(x=>x.adapter==='opencode'&&x.status==='implemented'));assert.ok(installable.every(x=>x.status==='implemented'));
});

test('OpenCode satisfies portable_core capability profile',()=>{
  const r=run(['compatibility','check','--adapter','opencode','--profile','portable_core']);const o=jsonOut(r);
  assert.equal(r.status,0,r.stdout);assert.equal(o.status,'ADAPTER_COMPATIBLE');assert.equal(o.summary.blocked,0);
});

test('OpenCode satisfies UX/UI portability profile',()=>{
  const r=run(['compatibility','check','--adapter','opencode','--profile','uxui']);assert.equal(r.status,0,r.stdout);assert.equal(jsonOut(r).status,'ADAPTER_COMPATIBLE');
});

test('OpenCode satisfies Visual QA adapter implementation profile',()=>{
  const r=run(['compatibility','check','--adapter','opencode','--profile','visualqa']);assert.equal(r.status,0,r.stdout);const o=jsonOut(r);assert.equal(o.status,'ADAPTER_COMPATIBLE');assert.ok(o.checks.some(x=>x.id==='visual_qa_browser_capture'&&x.status==='PASS'));
});

test('OpenCode satisfies full_current adapter implementation profile',()=>{
  const r=run(['compatibility','check','--adapter','opencode','--profile','full_current']);assert.equal(r.status,0,r.stdout);assert.equal(jsonOut(r).status,'ADAPTER_COMPATIBLE');
});

test('adapter implementation compatibility does not imply target model readiness',()=>{
  const o=jsonOut(run(['compatibility','check','--adapter','opencode','--profile','visualqa']));assert.equal(o.status,'ADAPTER_COMPATIBLE');
  const cfg=JSON.parse(fs.readFileSync('adapters/opencode/opencode.json','utf8'));assert.equal(Object.hasOwn(cfg,'providers'),false);assert.equal(Object.hasOwn(cfg,'model'),false);
});

test('adapters that remain scaffolds block portable_core rather than silently degrading',()=>{
  const scaffolds=jsonOut(run(['catalog','list'])).adapters.filter(x=>x.status==='scaffold').map(x=>x.adapter);assert.ok(scaffolds.length>0);
  for(const adapter of scaffolds){const r=run(['compatibility','check','--adapter',adapter,'--profile','portable_core']);const o=jsonOut(r);assert.equal(r.status,4,`${adapter}: ${r.stdout}`);assert.equal(o.status,'ADAPTER_COMPATIBILITY_BLOCKED');assert.ok(o.summary.blocked>0)}
});

test('adapters that remain scaffolds are explicitly non-installable',()=>{
  const scaffolds=jsonOut(run(['catalog','list'])).adapters.filter(x=>x.status==='scaffold').map(x=>x.adapter);assert.ok(scaffolds.length>0);
  for(const adapter of scaffolds){const r=run(['install','check','--adapter',adapter]);const o=jsonOut(r);assert.equal(r.status,4);assert.equal(o.status,'ADAPTER_NOT_INSTALLABLE');assert.equal(o.adapter_status,'scaffold')}
});

test('OpenCode adapter passes deterministic installability gate',()=>{
  const r=run(['install','check','--adapter','opencode']);assert.equal(r.status,0,r.stdout);assert.equal(jsonOut(r).status,'ADAPTER_INSTALLABLE');
});

test('missing capability invalidates adapter manifest',()=>{
  const d=clonePortableRoot(),fp=path.join(d,'adapters','opencode','adapter-capabilities.json'),m=JSON.parse(fs.readFileSync(fp));delete m.capabilities.repository_read;fs.writeFileSync(fp,JSON.stringify(m));
  const r=run(['manifest','verify','--adapter','opencode'],d),o=jsonOut(r);assert.equal(r.status,2);assert.equal(o.status,'ADAPTER_MANIFEST_INVALID');assert.ok(o.errors.includes('capability_missing:repository_read'));
});

test('unknown capability invalidates adapter manifest',()=>{
  const d=clonePortableRoot(),fp=path.join(d,'adapters','opencode','adapter-capabilities.json'),m=JSON.parse(fs.readFileSync(fp));m.capabilities.magic_runtime={status:'implemented'};fs.writeFileSync(fp,JSON.stringify(m));
  const r=run(['manifest','verify','--adapter','opencode'],d),o=jsonOut(r);assert.equal(r.status,2);assert.ok(o.errors.includes('capability_unknown:magic_runtime'));
});

test('invalid capability status is rejected',()=>{
  const d=clonePortableRoot(),fp=path.join(d,'adapters','opencode','adapter-capabilities.json'),m=JSON.parse(fs.readFileSync(fp));m.capabilities.repository_read.status='trust_me_bro';fs.writeFileSync(fp,JSON.stringify(m));
  const r=run(['manifest','verify','--adapter','opencode'],d);assert.equal(r.status,2);assert.ok(jsonOut(r).errors.includes('capability_status_invalid:repository_read'));
});

test('adapter identity mismatch is rejected',()=>{
  const d=clonePortableRoot(),fp=path.join(d,'adapters','codex','adapter-capabilities.json'),m=JSON.parse(fs.readFileSync(fp));m.adapter='opencode';fs.writeFileSync(fp,JSON.stringify(m));const r=run(['manifest','verify','--adapter','codex'],d);assert.equal(r.status,2);assert.ok(jsonOut(r).errors.includes('adapter_identity_mismatch'));
});

test('scaffold cannot declare itself installable',()=>{
  const d=clonePortableRoot(),fp=path.join(d,'adapters','generic','adapter-capabilities.json'),m=JSON.parse(fs.readFileSync(fp));m.installation.supported=true;fs.writeFileSync(fp,JSON.stringify(m));const r=run(['manifest','verify','--adapter','generic'],d);assert.equal(r.status,2);assert.ok(jsonOut(r).errors.includes('scaffold_must_not_be_installable'));
});

test('implemented adapter cannot lose core repository capability and remain valid',()=>{
  const d=clonePortableRoot(),fp=path.join(d,'adapters','opencode','adapter-capabilities.json'),m=JSON.parse(fs.readFileSync(fp));m.capabilities.repository_read.status='unsupported';fs.writeFileSync(fp,JSON.stringify(m));const r=run(['manifest','verify','--adapter','opencode'],d);assert.equal(r.status,2);assert.ok(jsonOut(r).errors.includes('implemented_adapter_core_capability_unsupported:repository_read'));
});

test('compatibility blocks when an enforced security primitive is downgraded to best_effort',()=>{
  const d=clonePortableRoot(),fp=path.join(d,'adapters','opencode','adapter-capabilities.json'),m=JSON.parse(fs.readFileSync(fp));m.capabilities.network.status='best_effort';fs.writeFileSync(fp,JSON.stringify(m));const r=run(['compatibility','check','--adapter','opencode','--profile','portable_core'],d),o=jsonOut(r);assert.equal(r.status,4);assert.ok(o.checks.some(x=>x.id==='network'&&x.status==='BLOCKED'));
});

test('unknown compatibility profile fails closed',()=>{
  const r=run(['compatibility','check','--adapter','opencode','--profile','made-up']);assert.equal(r.status,2);assert.equal(jsonOut(r).status,'PROFILE_INVALID');
});

test('missing adapter manifest fails closed',()=>{
  const d=clonePortableRoot();fs.rmSync(path.join(d,'adapters','gemini','adapter-capabilities.json'));const r=run(['manifest','verify','--adapter','gemini'],d);assert.equal(r.status,2);assert.equal(jsonOut(r).status,'ADAPTER_MANIFEST_INVALID');
});

test('manifest SHA changes when adapter declaration is tampered',()=>{
  const d=clonePortableRoot();const a=jsonOut(run(['manifest','verify','--adapter','opencode'],d)).manifest_sha256;const fp=path.join(d,'adapters','opencode','adapter-capabilities.json'),m=JSON.parse(fs.readFileSync(fp));m.capabilities.scope_prewrite.notes='tampered';fs.writeFileSync(fp,JSON.stringify(m));const b=jsonOut(run(['manifest','verify','--adapter','opencode'],d)).manifest_sha256;assert.notEqual(a,b);
});

test('installer recognizes all canonical adapters but performs ABI installability preflight first',()=>{
  const s=fs.readFileSync('scripts/05-install-into-project.ps1','utf8');assert.match(s,/ValidateSet\('opencode','codex','claude-code','gemini','antigravity','generic'\)/);assert.match(s,/adapter-runtime\\adapter\.mjs/);assert.match(s,/install check --root \$root --adapter \$RequestedAdapter/);assert.match(s,/ADAPTER_NOT_INSTALLABLE/);
});

test('installer deploys Adapter ABI runtime, catalog, profiles and selected manifest into project',()=>{
  const s=fs.readFileSync('scripts/05-install-into-project.ps1','utf8');assert.match(s,/adapters\\runtime\\adapter\.mjs/);assert.match(s,/capability-catalog\.json/);assert.match(s,/compatibility-profiles\.json/);assert.match(s,/adapter-capabilities\.json/);
});

test('project config records selected adapter and ABI version',()=>{
  const t=JSON.parse(fs.readFileSync('adapters/opencode/project-template.json','utf8'));assert.equal(t.adapter,'opencode');assert.equal(t.adapter_contract_version,'2.0');const s=JSON.parse(fs.readFileSync('core/schemas/project.schema.json','utf8'));assert.ok(s.properties.adapter);assert.ok(s.properties.adapter_contract_version);
});

test('Core adapter runtime contains no runtime-specific OpenCode branch',()=>{
  const s=fs.readFileSync(runtime,'utf8').toLowerCase();assert.doesNotMatch(s,/opencode/);
});

test('Portability documentation explicitly forbids silent semantic weakening',()=>{
  const a=fs.readFileSync('core/adapter-contracts/ADAPTER_ABI.md','utf8');const p=fs.readFileSync('docs/PORTABILITY.md','utf8');assert.match(a,/MUST NOT redefine workflows/);assert.match(p,/No adapter may silently weaken Core/);
});

test('Adapter ABI verifier works from installed .aledevos layout',()=>{
  const d=tmp();
  const cp=(src,dst)=>{fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(path.resolve(src),dst)};
  cp('core/adapter-runtime/adapter.mjs',path.join(d,'.aledevos/adapters/runtime/adapter.mjs'));
  cp('core/adapter-contracts/capability-catalog.json',path.join(d,'.aledevos/adapters/contracts/capability-catalog.json'));
  cp('core/adapter-contracts/compatibility-profiles.json',path.join(d,'.aledevos/adapters/contracts/compatibility-profiles.json'));
  cp('adapters/opencode/adapter-capabilities.json',path.join(d,'.aledevos/adapters/opencode/adapter-capabilities.json'));
  const rt=path.join(d,'.aledevos/adapters/runtime/adapter.mjs');
  let r=spawnSync(process.execPath,[rt,'manifest','verify','--root',d,'--adapter','opencode'],{cwd:d,encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(JSON.parse(r.stdout).status,'ADAPTER_MANIFEST_VALID');
  r=spawnSync(process.execPath,[rt,'compatibility','check','--root',d,'--adapter','opencode','--profile','full_current'],{cwd:d,encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(JSON.parse(r.stdout).status,'ADAPTER_COMPATIBLE');
});

test('installed-layout catalog lists only manifests actually installed',()=>{
  const d=tmp();
  const cp=(src,dst)=>{fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(path.resolve(src),dst)};
  cp('core/adapter-runtime/adapter.mjs',path.join(d,'.aledevos/adapters/runtime/adapter.mjs'));
  cp('core/adapter-contracts/capability-catalog.json',path.join(d,'.aledevos/adapters/contracts/capability-catalog.json'));
  cp('core/adapter-contracts/compatibility-profiles.json',path.join(d,'.aledevos/adapters/contracts/compatibility-profiles.json'));
  cp('adapters/opencode/adapter-capabilities.json',path.join(d,'.aledevos/adapters/opencode/adapter-capabilities.json'));
  const rt=path.join(d,'.aledevos/adapters/runtime/adapter.mjs');
  const r=spawnSync(process.execPath,[rt,'catalog','list','--root',d],{cwd:d,encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);assert.deepEqual(JSON.parse(r.stdout).adapters.map(x=>x.adapter),['opencode']);
});
