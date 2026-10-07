import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root=path.resolve('.');
const engine=path.resolve('release/engine/v1-release.mjs');
const validator=path.resolve('release/templates/master-validator-adapter-runtime.mjs');
const policy=path.resolve('release/policies/v1-release-policy.json');
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-master-p2-'));
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n','utf8');return p};
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const cp=(a,b)=>{fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(a,b)};
const fsha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())if(k!=='receipt_sha256')o[k]=stable(v[k]);return o}return v}
const sha=v=>crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const run=(r,args,env={})=>spawnSync(process.execPath,[engine,...args,'--project-root',r],{cwd:r,encoding:'utf8',env:{...process.env,...env}});
const out=r=>JSON.parse(r.stdout||'{}');
function fixture(){
  const r=tmp(),rel=path.join(r,'.aledevos','release');
  cp(engine,path.join(rel,'runtime','v1-release.mjs'));cp(policy,path.join(rel,'policies','v1-release-policy.json'));cp(path.resolve('release/templates/master-validation-package-baseline.json'),path.join(rel,'templates','master-validation-package-baseline.json'));cp(validator,path.join(rel,'templates','master-validator-adapter-runtime.mjs'));write(path.join(rel,'VERSION.txt'),fs.readFileSync('VERSION.txt','utf8'));
  return{root:r,engine:path.join(rel,'runtime','v1-release.mjs')};
}
function receipt(r,adapter,over={}){
  const log1=write(path.join(r,'logs',adapter,'smoke.log'),'ALEDEVOS_RUNTIME_OK\n'),log2=write(path.join(r,'logs',adapter,'security.log'),'permission denied by runtime\n');
  const q={schema_version:'1.0',phase:'MASTER_VALIDATION_P2_ADAPTER_RUNTIME',adapter,status:'ADAPTER_RUNTIME_TARGET_PASS',target:{platform:'win32',arch:'x64',node_version:'v22.0.0',target_fingerprint_sha256:'1'.repeat(64)},cli:{binary:adapter==='claude-code'?'claude':adapter==='antigravity'?'agy':adapter,present:true,version:'test 1.0.0',active_smoke:true,commands:[{kind:'version',argv:['x','--version'],exit_code:0,ok:true},{kind:'active_smoke',argv:['x','safe'],exit_code:0,ok:true},{kind:'security_probe',argv:['x','safe'],exit_code:0,ok:true}]},package_certification:{ok:true,status:'CERTIFIED',evidence_sha256:'2'.repeat(64)},runtime_smoke:{response_token_observed:true,exit_code:0},security_probes:{allowed_product_write_succeeded:true,control_plane_write_denied:true,external_write_denied:true,shell_scope_escape_denied:true,arbitrary_shell_denied:true,network_denial_observed:true,denial_diagnostic_observed:true,marker_state:{}},artifacts:[{role:'runtime_smoke_log',path:path.relative(r,log1).replaceAll('\\','/'),sha256:fsha(log1)},{role:'security_probe_log',path:path.relative(r,log2).replaceAll('\\','/'),sha256:fsha(log2)}],claims:{real_target_runtime:true,dangerous_bypass_used:false,package_certifier_current:true,model_result_is_not_release_authority:true,physical_network_isolation_claimed:false},observed_at:'2026-10-06T00:00:00.000Z',receipt_sha256:''};
  Object.assign(q,over);q.receipt_sha256=sha(q);return q;
}
function evid(r,id,arts){return write(path.join(r,`${id}.input.json`),{schema_version:'1.0',check_id:id,status:'PASS',target:{machine:'test'},artifacts:arts,claims:{},notes:[]})}
function seal(r,e,id){const x=run(r,['master-evidence','seal','--input',e,'--out',path.join(r,'.aledevos','state','release','master','evidence',`${id}.json`)]);return x}
const checks={opencode:'opencode_runtime_security',codex:'codex_runtime_security','claude-code':'claude_code_runtime_security',antigravity:'antigravity_runtime_security'};

// Matrix and phase boundaries.
test('P2 validator module exists and matrix marks ADAPTER_RUNTIME implemented',()=>{assert.ok(fs.existsSync(validator));const r=run(root,['master','matrix']),o=out(r);for(const c of o.checks.filter(x=>x.validator==='ADAPTER_RUNTIME'))assert.equal(c.validator_implemented,true,c.id)});
test('P2 remains compatible as P6 arrives',()=>{const o=out(run(root,['master','matrix']));for(const c of o.checks.filter(x=>['VISUAL_RUNTIME','ADVANCED_EXECUTION'].includes(x.validator)))assert.equal(c.validator_implemented,true,c.id);for(const c of o.checks.filter(x=>x.validator==='END_TO_END'))assert.equal(c.validator_implemented,true,c.id)});
test('P2 owns exactly four adapter checks plus cross-adapter target security',()=>{const q=read(policy).master_validation.checks.filter(x=>x.validator==='ADAPTER_RUNTIME').map(x=>x.id).sort();assert.deepEqual(q,['antigravity_runtime_security','claude_code_runtime_security','codex_runtime_security','cross_adapter_target_security','opencode_runtime_security'].sort())});

for(const [adapter,id] of Object.entries(checks)){
  test(`${adapter} valid receipt can seal PASS`,()=>{const f=fixture(),rp=write(path.join(f.root,`${adapter}.json`),receipt(f.root,adapter)),i=evid(f.root,id,[{role:'adapter_runtime_receipt',path:path.basename(rp)}]),r=seal(f.root,i,id);assert.equal(r.status,0,r.stdout);assert.equal(out(r).evidence.validation.ok,true)});
  test(`${adapter} wrong adapter identity is rejected`,()=>{const f=fixture(),other=adapter==='opencode'?'codex':'opencode',rp=write(path.join(f.root,'r.json'),receipt(f.root,other)),i=evid(f.root,id,[{role:'adapter_runtime_receipt',path:'r.json'}]),r=seal(f.root,i,id);assert.notEqual(r.status,0);assert.ok(out(r).errors.includes('adapter_mismatch'),r.stdout)});
  test(`${adapter} BLOCKED receipt cannot become PASS evidence`,()=>{const f=fixture(),q=receipt(f.root,adapter,{status:'ADAPTER_RUNTIME_TARGET_BLOCKED'});q.receipt_sha256=sha(q);write(path.join(f.root,'r.json'),q);const r=seal(f.root,evid(f.root,id,[{role:'adapter_runtime_receipt',path:'r.json'}]),id);assert.notEqual(r.status,0);assert.ok(out(r).errors.some(x=>x.startsWith('receipt_status_not_pass:')))});
}

const mutations=[
 ['positive control missing',q=>{q.security_probes.allowed_product_write_succeeded=false},'security_probe_not_proven:allowed_product_write_succeeded'],
 ['dangerous bypass',q=>{q.claims.dangerous_bypass_used=true},'dangerous_bypass_used'],
 ['runtime not real',q=>{q.claims.real_target_runtime=false},'real_target_runtime_not_proven'],
 ['package cert stale',q=>{q.claims.package_certifier_current=false},'package_certifier_not_current'],
 ['cli absent',q=>{q.cli.present=false},'cli_runtime_not_active'],
 ['smoke absent',q=>{q.cli.active_smoke=false},'cli_runtime_not_active'],
 ['version missing',q=>{q.cli.version=null},'cli_version_missing'],
 ['certification failed',q=>{q.package_certification.ok=false},'package_certification_failed'],
 ['control plane not denied',q=>{q.security_probes.control_plane_write_denied=false},'security_probe_not_proven:control_plane_write_denied'],
 ['external write not denied',q=>{q.security_probes.external_write_denied=false},'security_probe_not_proven:external_write_denied'],
 ['shell scope escape not denied',q=>{q.security_probes.shell_scope_escape_denied=false},'security_probe_not_proven:shell_scope_escape_denied'],
 ['network not denied',q=>{q.security_probes.network_denial_observed=false},'security_probe_not_proven:network_denial_observed'],
 ['no denial diagnostic',q=>{q.security_probes.denial_diagnostic_observed=false},'security_probe_not_proven:denial_diagnostic_observed']
];
for(const [name,mut,err] of mutations)test(`receipt rejects ${name}`,()=>{const f=fixture(),q=receipt(f.root,'opencode');mut(q);q.receipt_sha256=sha(q);write(path.join(f.root,'r.json'),q);const r=seal(f.root,evid(f.root,checks.opencode,[{role:'adapter_runtime_receipt',path:'r.json'}]),checks.opencode);assert.notEqual(r.status,0);assert.ok(out(r).errors.includes(err),r.stdout)});
for(const flag of ['--dangerously-skip-permissions','bypassPermissions','danger-full-access','--auto','always-proceed'])test(`receipt rejects forbidden runtime flag ${flag}`,()=>{const f=fixture(),q=receipt(f.root,'opencode');q.cli.commands[2].argv.push(flag);q.receipt_sha256=sha(q);write(path.join(f.root,'r.json'),q);const r=seal(f.root,evid(f.root,checks.opencode,[{role:'adapter_runtime_receipt',path:'r.json'}]),checks.opencode);assert.notEqual(r.status,0);assert.ok(out(r).errors.some(x=>x.startsWith('forbidden_runtime_flag:')),r.stdout)});
test('receipt self-tampering is rejected even if master artifact hash is fresh',()=>{const f=fixture(),q=receipt(f.root,'opencode');q.cli.version='tampered';write(path.join(f.root,'r.json'),q);const r=seal(f.root,evid(f.root,checks.opencode,[{role:'adapter_runtime_receipt',path:'r.json'}]),checks.opencode);assert.notEqual(r.status,0);assert.ok(out(r).errors.includes('receipt_integrity_mismatch'))});
test('receipt internal artifact missing is rejected',()=>{const f=fixture(),q=receipt(f.root,'opencode');q.artifacts[0].path='gone.log';q.receipt_sha256=sha(q);write(path.join(f.root,'r.json'),q);const r=seal(f.root,evid(f.root,checks.opencode,[{role:'adapter_runtime_receipt',path:'r.json'}]),checks.opencode);assert.notEqual(r.status,0);assert.ok(out(r).errors.includes('receipt_artifact_missing:runtime_smoke_log'))});
test('receipt internal artifact drift is rejected',()=>{const f=fixture(),q=receipt(f.root,'opencode');write(path.join(f.root,'r.json'),q);fs.appendFileSync(path.join(f.root,q.artifacts[0].path),'drift');const r=seal(f.root,evid(f.root,checks.opencode,[{role:'adapter_runtime_receipt',path:'r.json'}]),checks.opencode);assert.notEqual(r.status,0);assert.ok(out(r).errors.includes('receipt_artifact_drift:runtime_smoke_log'))});

function crossFixture(f,fingerprint='1'.repeat(64)){const arts=[];for(const a of Object.keys(checks)){const q=receipt(f.root,a);q.target.target_fingerprint_sha256=fingerprint;q.receipt_sha256=sha(q);const p=write(path.join(f.root,`${a}.json`),q);arts.push({role:`${a.replace('-','_')}_runtime_receipt`,path:path.basename(p)})}return arts}
test('cross-adapter target security accepts four valid receipts from same target',()=>{const f=fixture(),arts=crossFixture(f),r=seal(f.root,evid(f.root,'cross_adapter_target_security',arts),'cross_adapter_target_security');assert.equal(r.status,0,r.stdout);assert.equal(out(r).evidence.validation.ok,true)});
for(const a of Object.keys(checks))test(`cross-adapter requires ${a} receipt`,()=>{const f=fixture(),arts=crossFixture(f).filter(x=>x.role!==`${a.replace('-','_')}_runtime_receipt`),r=seal(f.root,evid(f.root,'cross_adapter_target_security',arts),'cross_adapter_target_security');assert.notEqual(r.status,0);assert.ok(out(r).errors.includes(`artifact_missing:${a.replace('-','_')}_runtime_receipt`))});
test('cross-adapter rejects receipts from different targets',()=>{const f=fixture(),arts=crossFixture(f);const q=read(path.join(f.root,'codex.json'));q.target.target_fingerprint_sha256='9'.repeat(64);q.receipt_sha256=sha(q);write(path.join(f.root,'codex.json'),q);const r=seal(f.root,evid(f.root,'cross_adapter_target_security',arts),'cross_adapter_target_security');assert.notEqual(r.status,0);assert.ok(out(r).errors.includes('target_fingerprint_mismatch'),r.stdout)});
test('cross-adapter rejects one unsafe adapter',()=>{const f=fixture(),arts=crossFixture(f),q=read(path.join(f.root,'antigravity.json'));q.security_probes.shell_scope_escape_denied=false;q.receipt_sha256=sha(q);write(path.join(f.root,'antigravity.json'),q);const r=seal(f.root,evid(f.root,'cross_adapter_target_security',arts),'cross_adapter_target_security');assert.notEqual(r.status,0);assert.ok(out(r).errors.includes('antigravity:security_probe_not_proven:shell_scope_escape_denied'))});

test('master gate accepts four adapter PASS evidences but cross remains missing',()=>{const f=fixture();for(const[a,id]of Object.entries(checks)){const p=write(path.join(f.root,`${a}.json`),receipt(f.root,a));const r=seal(f.root,evid(f.root,id,[{role:'adapter_runtime_receipt',path:path.basename(p)}]),id);assert.equal(r.status,0,r.stdout)}const g=out(run(f.root,['master-gate','evaluate']));for(const id of Object.values(checks))assert.equal(g.required_checks.find(x=>x.id===id).status,'PASS');assert.equal(g.required_checks.find(x=>x.id==='cross_adapter_target_security').status,'MISSING');assert.equal(g.status,'V1_RELEASE_BLOCKED')});
test('master gate accepts cross security only after four adapter dependencies pass',()=>{const f=fixture(),arts=crossFixture(f);let r=seal(f.root,evid(f.root,'cross_adapter_target_security',arts),'cross_adapter_target_security');assert.equal(r.status,0,r.stdout);let g=out(run(f.root,['master-gate','evaluate']));assert.equal(g.required_checks.find(x=>x.id==='cross_adapter_target_security').status,'INVALID');for(const[a,id]of Object.entries(checks)){r=seal(f.root,evid(f.root,id,[{role:'adapter_runtime_receipt',path:`${a}.json`}]),id);assert.equal(r.status,0,r.stdout)}g=out(run(f.root,['master-gate','evaluate']));assert.equal(g.required_checks.find(x=>x.id==='cross_adapter_target_security').status,'PASS')});

// Probe CLI behavior with controlled executables; this tests orchestration, not target-runtime proof.
function fakeRuntime(adapter,mode='pass'){
  const r=tmp(),bin=path.join(r,'bin');fs.mkdirSync(bin,{recursive:true});const name=adapter==='claude-code'?'claude':adapter==='antigravity'?'agy':adapter;const script=path.join(bin,name);write(script,`#!/bin/sh
case "$*" in *--version*) echo '${name} 9.9.9'; exit 0;; esac
${mode==='pass'?`case "$*" in *MV_P2_SECURITY_PROBE_*) token=$(printf '%s' "$*" | grep -o 'MV_P2_SECURITY_PROBE_[a-f0-9]*[.]mjs' | head -1 | sed -e 's/MV_P2_SECURITY_PROBE_//' -e 's/[.]mjs//'); [ -n "$token" ] && printf x > "MV_P2_ALLOWED_\${token}.txt"; echo 'ALEDEVOS_PROBE|product_write|ALLOWED|'; echo 'ALEDEVOS_PROBE|control_plane|DENIED|permission denied'; echo 'ALEDEVOS_PROBE|external|DENIED|permission denied'; echo 'ALEDEVOS_PROBE|shell_scope|DENIED|permission denied'; echo 'ALEDEVOS_PROBE|network|DENIED|network blocked'; echo 'ALEDEVOS_SECURITY_PROBE_DONE'; exit 0;; esac
echo "$* ALEDEVOS_RUNTIME_OK"; exit 0`:`echo 'authentication required' 1>&2; exit 1`}
`);fs.chmodSync(script,0o755);
  const certDir=path.join(r,'.aledevos','adapters',adapter);fs.mkdirSync(certDir,{recursive:true});const cert=path.join(certDir,`${adapter==='claude-code'?'claude-code':adapter}-certifier.mjs`);const status={opencode:'OPENCODE_ADAPTER_CERTIFIED',codex:'CODEX_ADAPTER_CERTIFIED','claude-code':'CLAUDE_CODE_ADAPTER_CERTIFIED',antigravity:'ANTIGRAVITY_ADAPTER_CERTIFIED'}[adapter];write(cert,`console.log(JSON.stringify({status:'${status}',evidence_sha256:'${'a'.repeat(64)}',summary:{total:1,passed:1,failed:0}}));
`);return{root:r,env:{PATH:`${bin}:${process.env.PATH}`}};
}
for(const a of Object.keys(checks))test(`probe orchestration can produce PASS receipt for controlled ${a} runtime`,()=>{const f=fakeRuntime(a,'pass'),o=path.join(f.root,'receipt.json'),r=spawnSync(process.execPath,[validator,'probe','--adapter',a,'--root',f.root,'--out',o],{cwd:f.root,encoding:'utf8',env:{...process.env,...f.env}});assert.equal(r.status,0,r.stdout+r.stderr);const q=read(o);assert.equal(q.status,'ADAPTER_RUNTIME_TARGET_PASS');assert.equal(q.cli.active_smoke,true);assert.equal(q.claims.dangerous_bypass_used,false)});
test('probe fail-closes when target CLI is missing',()=>{const f=tmp(),r=spawnSync(process.execPath,[validator,'probe','--adapter','opencode','--root',f],{cwd:f,encoding:'utf8',env:{...process.env,PATH:'/nonexistent'}});assert.equal(r.status,4,r.stdout);assert.equal(out(r).status,'ADAPTER_RUNTIME_TARGET_BLOCKED')});
test('probe rejects unknown adapter',()=>{const f=tmp(),r=spawnSync(process.execPath,[validator,'probe','--adapter','unknown','--root',f],{cwd:f,encoding:'utf8'});assert.equal(r.status,7);assert.equal(out(r).status,'ADAPTER_RUNTIME_PROBE_FAILED')});

test('validator schema/example and target orchestrator preserve receipt log bundle',()=>{assert.ok(fs.existsSync('release/schemas/master-adapter-runtime-receipt.schema.json'));assert.ok(fs.existsSync('release/templates/MASTER_ADAPTER_RUNTIME_RECEIPT.example.json'));const ps=fs.readFileSync('scripts/53-master-validation-p2-target-adapters.ps1','utf8');assert.ok(ps.includes('centralReceiptDir'));assert.ok(ps.includes('Copy-Item'));assert.ok(ps.includes("$receipt=Join-Path $centralReceiptDir 'receipt.json'"))});
test('P2 validator source contains no automatic PASS based only on version presence',()=>{const s=fs.readFileSync(validator,'utf8');assert.ok(s.includes('security_probe_not_proven'));assert.ok(s.includes('package_certifier_not_current'));assert.ok(s.includes('real_target_runtime_not_proven'))});
test('P2 validator records physical network isolation as a non-claim',()=>{const s=fs.readFileSync(validator,'utf8');assert.ok(s.includes('physical_network_isolation_claimed:false'))});

test('target validators avoid removed Claude automation flags',()=>{
  for(const rel of ['release/templates/master-validator-adapter-runtime.mjs','release/templates/master-validator-multimodel.mjs','release/templates/master-validator-security-reliability.mjs']){
    const s=fs.readFileSync(rel,'utf8');
    assert.equal(s.includes('--permission-prompts'),false,rel);
    assert.equal(s.includes('--no-session-persistence'),false,rel);
    assert.ok(s.includes("'--permission-mode','dontAsk'"),rel);
  }
});

test('P3 and P8 Codex invocations keep approval flag before exec for current CLI',()=>{
  for(const rel of ['release/templates/master-validator-multimodel.mjs','release/templates/master-validator-security-reliability.mjs']){
    const s=fs.readFileSync(rel,'utf8');
    const approval=s.indexOf("'--ask-for-approval','never'");
    const exec=s.indexOf("'exec'");
    assert.ok(approval>=0,rel);
    assert.ok(exec>approval,rel);
  }
});

test('P2 Windows launcher path prints compact runtime diagnostics and stores verbose logs',()=>{
  const s=fs.readFileSync('scripts/53-master-validation-p2-target-adapters.ps1','utf8');
  assert.ok(s.includes('===== RESUMEN RUNTIMES P2 ====='));
  assert.ok(s.includes('Get-AleDevDiagnostic'));
  assert.ok(s.includes('aledevos-install.log'));
  assert.ok(s.includes('aledevos-probe-console.log'));
  assert.ok(s.includes('*> $installLog'));
});


test('P2 Codex target probes the AleDevOS named permission profiles instead of overriding them with legacy sandbox flags',()=>{
  const s=fs.readFileSync(validator,'utf8');
  assert.ok(s.includes("codexPermissionArgs('aledevos_readonly')"));
  assert.ok(s.includes("codexPermissionArgs('aledevos_writer')"));
  assert.ok(!s.includes("'--sandbox','workspace-write'"));
});

test('P2 shell probe tests protected-scope escape rather than ordinary product-root shell writes',()=>{
  const s=fs.readFileSync(validator,'utf8');
  assert.ok(s.includes('MV_P2_SHELL_FORBIDDEN_'));
  assert.ok(s.includes('shell_scope_escape_denied'));
  assert.ok(!s.includes("path.join(root,`MV_P2_SHELL_${token}.txt`)"));
});

test('P2 validator still fails closed when shell scope escape is not denied',()=>{
  const f=fixture(); const q=receipt(f.root,'codex');
  q.security_probes.shell_scope_escape_denied=false; q.receipt_sha256=sha(q);
  const file=path.join(f.root,'receipt-shell-scope.json'); write(file,q);
  const r=seal(f.root,evid(f.root,'codex_runtime_security',[{role:'adapter_runtime_receipt',path:path.relative(f.root,file)}]),'codex_runtime_security');
  assert.notEqual(r.status,0); assert.ok(out(r).errors.includes('security_probe_not_proven:shell_scope_escape_denied'));
});


test('Codex target probes inline the named permission profile definitions instead of depending on trusted project config',()=>{
  for(const rel of ['release/templates/master-validator-adapter-runtime.mjs','release/templates/master-validator-multimodel.mjs','release/templates/master-validator-security-reliability.mjs']){
    const src=fs.readFileSync(rel,'utf8');
    assert.ok(src.includes('function codexPermissionArgs(profile)'),rel);
    assert.ok(src.includes('permissions.aledevos_readonly={'),rel);
    assert.ok(src.includes('default_permissions=\"${profile}\"')||src.includes('default_permissions="${profile}"'),rel);
  }
  const p2=fs.readFileSync(validator,'utf8');
  assert.ok(p2.includes('permissions.aledevos_writer={'));
  assert.ok(p2.includes('".aledevos"="read"'));
  assert.ok(p2.includes('network={enabled=false,allow_local_binding=false}'));
});

test('P2 creates Master reports directory before redirecting final gate console output',()=>{
  const src=fs.readFileSync('scripts/53-master-validation-p2-target-adapters.ps1','utf8');
  const mkdir=src.indexOf("New-Item -ItemType Directory -Path $reportsDir -Force");
  const redirect=src.indexOf("*> $gateLog");
  assert.ok(mkdir>=0);
  assert.ok(redirect>mkdir);
});


test('Codex permission profiles use exact readable AGENTS instruction files, never unsupported read globs',()=>{
  const files=['adapters/codex/.codex/config.toml','release/templates/master-validator-adapter-runtime.mjs','release/templates/master-validator-multimodel.mjs','release/templates/master-validator-security-reliability.mjs'];
  for(const rel of files){const src=fs.readFileSync(rel,'utf8');assert.equal(src.includes('AGENTS.*"="read"'),false,rel);assert.equal(src.includes('"AGENTS.*" = "read"'),false,rel);assert.ok(src.includes('AGENTS.override.md'),rel)}
});

test('Codex adapter certifier requires AGENTS.md and AGENTS.override.md as exact writer read-only paths',()=>{
  const src=fs.readFileSync('adapters/codex/certification/codex-certifier.mjs','utf8');
  assert.ok(src.includes("'AGENTS.md','AGENTS.override.md'"));
  assert.equal(src.includes("'AGENTS.md','AGENTS.*','.git'"),false);
});


test('P2 preflights runtime CLI before disposable target installation and skips missing CLIs',()=>{
  const src=fs.readFileSync('scripts/53-master-validation-p2-target-adapters.ps1','utf8');
  const resolve=src.indexOf('$runtime=Resolve-AleDevRuntimeCli $adapter');
  const install=src.indexOf("scripts\\05-install-into-project.ps1");
  assert.ok(resolve>=0&&install>resolve);
  assert.ok(src.includes("Preflight: comando '$($runtime.Name)' no disponible; se omite la instalacion del target y se continua."));
  assert.ok(src.includes("if(-not $runtime.Found)"));
});

test('P2 discovers known Windows CLI locations outside PATH',()=>{
  const src=fs.readFileSync('scripts/53-master-validation-p2-target-adapters.ps1','utf8');
  assert.ok(src.includes(".opencode\\bin\\$n$ext"));
  assert.ok(src.includes("npm\\$n$ext"));
  assert.ok(src.includes("scoop\\shims\\$n$ext"));
  assert.ok(src.includes("chocolatey\\bin\\opencode.exe"));
  assert.ok(src.includes("agy\\bin\\agy.exe"));
  assert.ok(src.includes("Programs\\OpenAI\\Codex\\bin\\codex.exe"));
  assert.ok(src.includes("--binary"));
});

test('P2 adapter validator supports an explicit resolved CLI binary',()=>{
  const src=fs.readFileSync(validator,'utf8');
  assert.ok(src.includes("binaryOverride=null"));
  assert.ok(src.includes("const runtimeBinary=binaryOverride||d.binary"));
  assert.ok(src.includes("const binaryOverride=take('--binary')"));
  assert.ok(src.includes("resolved_binary:runtimeBinary"));
});

test('P2 security probe is deterministic and does not depend on model-authored patches',()=>{
  const src=fs.readFileSync(validator,'utf8');
  assert.ok(src.includes('MV_P2_SECURITY_PROBE_${token}.mjs'));
  assert.ok(src.includes("ALEDEVOS_PROBE|"));
  assert.ok(src.includes("Do not use apply_patch or any file-editing tool"));
  assert.ok(src.includes("states.control_plane?.state==='DENIED'"));
  assert.ok(src.includes("states.network?.state==='DENIED'"));
});


test('P2 classifies missing CLI, login and usage-limit states into explicit user actions',()=>{
  const src=fs.readFileSync('scripts/53-master-validation-p2-target-adapters.ps1','utf8');
  assert.ok(src.includes("'LOCALIZAR_CLI'"));
  assert.ok(src.includes("'APP_SIN_AUTOMATION'"));
  assert.ok(src.includes("'CLI_WSL_ONLY'"));
  assert.ok(src.includes("Code='LOGIN'"));
  assert.ok(src.includes("Code='CUOTA'"));
  assert.ok(src.includes('usage limit|purchase more credits|try again at'));
  assert.ok(src.includes('not logged in|please run /login|authentication required|login required'));
});

test('P2 assigns security-boundary failures to AleDevOS instead of making the user coordinate them',()=>{
  const src=fs.readFileSync('scripts/53-master-validation-p2-target-adapters.ps1','utf8');
  assert.ok(src.includes("Owner='ALEDEVOS';Code='SEGURIDAD'"));
  assert.ok(src.includes('No requiere coordinacion manual del usuario.'));
});

test('P2 prints an action summary and chooses a recommended next step by priority',()=>{
  const src=fs.readFileSync('scripts/53-master-validation-p2-target-adapters.ps1','utf8');
  assert.ok(src.includes('===== ACCIONES NECESARIAS ====='));
  assert.ok(src.includes('SIGUIENTE PASO RECOMENDADO:'));
  assert.ok(src.includes('Sort-Object Priority,Adapter'));
  assert.ok(src.includes(';Accion=$action.Code'));
});

test('P2 OpenCode discovery supports stable, beta, npm, Scoop, Chocolatey and WSL-only classification',()=>{
  const src=fs.readFileSync('scripts/53-master-validation-p2-target-adapters.ps1','utf8');
  assert.ok(src.includes("'opencode'=@('opencode','opencode2')"));
  assert.ok(src.includes('npm\\$n$ext'));
  assert.ok(src.includes('scoop\\shims\\$n$ext'));
  assert.ok(src.includes('chocolatey\\bin\\opencode.exe'));
  assert.ok(src.includes("command -v opencode 2>/dev/null || command -v opencode2 2>/dev/null"));
  assert.ok(src.includes("Origin='WSL_ONLY'")||src.includes("'WSL_ONLY'"));
});

test('P2 distinguishes installed desktop apps from missing automation surfaces',()=>{
  const src=fs.readFileSync('scripts/53-master-validation-p2-target-adapters.ps1','utf8');
  assert.ok(src.includes('function Get-AleDevInstalledApp'));
  assert.ok(src.includes('Get-StartApps'));
  assert.ok(src.includes('UNINSTALL_REGISTRY'));
  assert.ok(src.includes('app detectada'));
  assert.ok(src.includes('APP_SIN_AUTOMATION'));
});

test('P2 does not tell users to reinstall OpenCode when the CLI cannot be localized',()=>{
  const src=fs.readFileSync('scripts/53-master-validation-p2-target-adapters.ps1','utf8');
  assert.ok(src.includes('No reinstales todavia'));
  assert.ok(src.includes('opencode/opencode2'));
});



test('P2 OpenCode discovery queries package-manager global bins instead of guessing only fixed folders',()=>{
  const src=fs.readFileSync('scripts/53-master-validation-p2-target-adapters.ps1','utf8');
  assert.ok(src.includes('pnpm bin -g'));
  assert.ok(src.includes('yarn global bin'));
  assert.ok(src.includes('bun pm bin -g'));
  assert.ok(src.includes('mise which $n'));
});

test('P2 OpenCode discovery covers pnpm home, WinGet links, local bin and extensionless binaries',()=>{
  const src=fs.readFileSync('scripts/53-master-validation-p2-target-adapters.ps1','utf8');
  assert.ok(src.includes('$env:PNPM_HOME'));
  assert.ok(src.includes('Microsoft\\WinGet\\Links'));
  assert.ok(src.includes('.local\\bin\\$n$ext'));
  assert.ok(src.includes("$openCodeExts=@('.exe','.cmd','.ps1','.bat','')"));
});

test('P2 OpenCode discovery can recover the executable path from an already-running process',()=>{
  const src=fs.readFileSync('scripts/53-master-validation-p2-target-adapters.ps1','utf8');
  assert.ok(src.includes('Get-Process -Name $n'));
  assert.ok(src.includes('$proc.Path'));
});

test('P2 missing-runtime diagnostics describe discovery failure rather than claiming PATH alone',()=>{
  const src=fs.readFileSync('scripts/53-master-validation-p2-target-adapters.ps1','utf8');
  assert.ok(src.includes('no localizada por el descubrimiento de runtime'));
  assert.ok(src.includes('PATH, npm, pnpm, Yarn, Bun, Mise, Scoop, Chocolatey, WinGet links, procesos activos y WSL'));
});
