import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const distRoot=path.resolve('.');
const runtime=path.resolve('contextos/engine/contextos.mjs');
const basePolicy=path.resolve('contextos/policies/context-policy.json');
const run=(cwd,...a)=>spawnSync(process.execPath,[runtime,...a],{cwd,encoding:'utf8'});
const jsonOut=r=>JSON.parse(r.stdout);
function git(cwd,...a){return spawnSync('git',a,{cwd,encoding:'utf8'});}
function makeRepo({commit=true}={}){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'contextos-p4-'));
  fs.mkdirSync(path.join(dir,'src','features','billing'),{recursive:true});
  fs.mkdirSync(path.join(dir,'src','features','users'),{recursive:true});
  fs.mkdirSync(path.join(dir,'tests','billing'),{recursive:true});
  fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({name:'p4-fixture',scripts:{test:'vitest run'}},null,2));
  fs.writeFileSync(path.join(dir,'src','features','billing','math.ts'),`export function total(a:number,b:number){ return a+b }\nexport const TAX = 0.2\n`);
  fs.writeFileSync(path.join(dir,'src','features','billing','service.ts'),`import { total } from './math'\nimport zod from 'zod'\nexport class BillingService { amount(){ return total(1,2) } }\n`);
  fs.writeFileSync(path.join(dir,'src','features','users','user.ts'),`import { total } from '../billing/math'\nexport interface User { id: string }\nexport const userTotal = total\n`);
  fs.writeFileSync(path.join(dir,'tests','billing','service.test.ts'),`import { BillingService } from '../../src/features/billing/service'\nexport const smoke = new BillingService()\n`);
  fs.mkdirSync(path.join(dir,'node_modules','ignored'),{recursive:true});fs.writeFileSync(path.join(dir,'node_modules','ignored','x.ts'),'export const nope=1');
  fs.mkdirSync(path.join(dir,'.aledevos','state'),{recursive:true});fs.writeFileSync(path.join(dir,'.aledevos','state','noise.json'),'{}');
  if(commit){git(dir,'init');git(dir,'config','user.email','p4@example.invalid');git(dir,'config','user.name','P4');git(dir,'add','.');git(dir,'commit','-m','baseline');}
  return dir;
}
function build(dir){return run(dir,'knowledge','build');}
function knowledgeRoot(dir){const p=JSON.parse(fs.readFileSync(basePolicy,'utf8'));return path.join(dir,...String(p.knowledge.output_dir).split('/'))}
function read(dir,name){return JSON.parse(fs.readFileSync(path.join(knowledgeRoot(dir),name),'utf8'));}

test('phase 4 policy enables persistent knowledge maps without changing the 64K safety reserve',()=>{
  const p=JSON.parse(fs.readFileSync(basePolicy,'utf8'));
  assert.equal(p.knowledge.enabled,true);assert.equal(p.knowledge.version,'0.5.0');
  const r=run(distRoot,'budget','resolve','--profile','opencode-qwen64k','--agent','orchestrator');assert.equal(r.status,0,r.stderr);const x=jsonOut(r);assert.equal(x.usable_input_tokens,45536);
});

test('repo map inventories relevant project files and excludes runtime/vendor noise',()=>{
  const dir=makeRepo(),r=build(dir);assert.equal(r.status,0,r.stderr||r.stdout);const repo=read(dir,'repo-map.json');
  const paths=repo.files.map(x=>x.path);assert.ok(paths.includes('src/features/billing/service.ts'));assert.ok(paths.includes('tests/billing/service.test.ts'));assert.ok(!paths.some(x=>x.startsWith('node_modules/')));assert.ok(!paths.some(x=>x.startsWith('.aledevos/')));assert.equal(repo.project.name,'p4-fixture');
});

test('symbol map extracts deterministic JS/TS symbols with line metadata',()=>{
  const dir=makeRepo();build(dir);const s=read(dir,'symbol-map.json');const math=s.files.find(x=>x.path==='src/features/billing/math.ts');
  assert.ok(math);assert.ok(math.symbols.some(x=>x.name==='total'&&x.kind==='function'&&x.exported));assert.ok(math.symbols.some(x=>x.name==='TAX'&&x.kind==='const'&&x.exported));assert.ok(math.symbols.every(x=>Number.isInteger(x.line)&&x.line>0));
});

test('dependency map resolves local JS/TS imports and records external packages',()=>{
  const dir=makeRepo();build(dir);const d=read(dir,'dependency-map.json');
  assert.ok(d.edges.some(x=>x.from==='src/features/billing/service.ts'&&x.to==='src/features/billing/math.ts'&&x.type==='local'));
  assert.ok(d.edges.some(x=>x.from==='src/features/billing/service.ts'&&x.to==='zod'&&x.type==='external'));
  assert.ok(d.external_packages.some(x=>x.name==='zod'));
});

test('domain maps group configured feature roots and expose cross-domain dependencies',()=>{
  const dir=makeRepo();build(dir);const idx=read(dir,'domains.index.json');
  const billing=idx.domains.find(x=>x.root==='src/features/billing'),users=idx.domains.find(x=>x.root==='src/features/users');assert.ok(billing);assert.ok(users);
  const u=read(dir,`domains/${users.id}.json`);assert.ok(u.depends_on_domains.some(x=>x.domain===billing.id));
  const b=read(dir,`domains/${billing.id}.json`);assert.ok(b.test_files.includes('tests/billing/service.test.ts'));
});


test('unsupported source languages are inventoried without fabricated symbols or dependencies',()=>{
  const dir=makeRepo();fs.writeFileSync(path.join(dir,'src','features','billing','native.go'),'package billing\nfunc Total() int { return 1 }\n');build(dir);const sy=read(dir,'symbol-map.json'),dp=read(dir,'dependency-map.json');
  const sf=sy.files.find(x=>x.path==='src/features/billing/native.go'),df=dp.nodes.find(x=>x.path==='src/features/billing/native.go');assert.equal(sf.parse_status,'UNSUPPORTED');assert.deepEqual(sf.symbols,[]);assert.equal(df.parse_status,'UNSUPPORTED');assert.ok(read(dir,'manifest.json').coverage.unsupported_source>=1);
});

test('rebuild atomically replaces prior domain snapshot so removed domains do not leave stale map files',()=>{
  const dir=makeRepo();build(dir);const idx1=read(dir,'domains.index.json'),users=idx1.domains.find(x=>x.root==='src/features/users');assert.ok(users);assert.equal(fs.existsSync(path.join(knowledgeRoot(dir),'domains',`${users.id}.json`)),true);
  fs.rmSync(path.join(dir,'src','features','users'),{recursive:true,force:true});build(dir);const idx2=read(dir,'domains.index.json');assert.equal(idx2.domains.some(x=>x.root==='src/features/users'),false);assert.equal(fs.existsSync(path.join(knowledgeRoot(dir),'domains',`${users.id}.json`)),false);
});

test('manifest seals every generated map and verify succeeds',()=>{
  const dir=makeRepo();build(dir);const v=run(dir,'knowledge','verify');assert.equal(v.status,0,v.stderr||v.stdout);const x=jsonOut(v);assert.equal(x.valid,true);assert.ok(x.checks.length>=5);assert.ok(x.checks.every(c=>c.valid));
});

test('knowledge verification detects map tampering',()=>{
  const dir=makeRepo();build(dir);const p=path.join(knowledgeRoot(dir),'repo-map.json'),d=JSON.parse(fs.readFileSync(p,'utf8'));d.stats.files+=1;fs.writeFileSync(p,JSON.stringify(d,null,2));
  const v=run(dir,'knowledge','verify');assert.notEqual(v.status,0);assert.equal(jsonOut(v).valid,false);
});

test('knowledge build works outside Git and records null Git provenance',()=>{
  const dir=makeRepo({commit:false}),r=build(dir);assert.equal(r.status,0,r.stderr||r.stdout);const repo=read(dir,'repo-map.json');assert.equal(repo.source.git.is_git_repo,false);assert.equal(repo.source.git.head,null);
});

test('rebuilding unchanged source keeps the same source fingerprint and semantic map hashes',()=>{
  const dir=makeRepo();let r=build(dir);assert.equal(r.status,0);const one=jsonOut(r),m1=read(dir,'manifest.json');r=build(dir);assert.equal(r.status,0);const two=jsonOut(r),m2=read(dir,'manifest.json');
  assert.equal(one.source_fingerprint_sha256,two.source_fingerprint_sha256);assert.equal(m1.maps.repo.payload_sha256,m2.maps.repo.payload_sha256);assert.equal(m1.maps.symbols.payload_sha256,m2.maps.symbols.payload_sha256);
});

test('source edits change provenance and affected semantic maps on rebuild',()=>{
  const dir=makeRepo();build(dir);const m1=read(dir,'manifest.json');fs.appendFileSync(path.join(dir,'src','features','billing','math.ts'),'export function discount(){ return 1 }\n');build(dir);const m2=read(dir,'manifest.json');
  assert.notEqual(m1.source.source_fingerprint_sha256,m2.source.source_fingerprint_sha256);assert.notEqual(m1.maps.symbols.payload_sha256,m2.maps.symbols.payload_sha256);
});

test('max-files guard fails closed rather than silently truncating the repository map',()=>{
  const dir=makeRepo(),policy=JSON.parse(fs.readFileSync(basePolicy,'utf8'));policy.knowledge.max_files=2;const pp=path.join(dir,'policy.json');fs.writeFileSync(pp,JSON.stringify(policy,null,2));
  const r=run(dir,'knowledge','build','--policy',pp);assert.equal(r.status,47);assert.match(r.stdout,/KNOWLEDGE_MAX_FILES_EXCEEDED/);
});

test('knowledge summary is compact and does not embed source file bodies',()=>{
  const dir=makeRepo();build(dir);const r=run(dir,'knowledge','summary');assert.equal(r.status,0,r.stderr||r.stdout);const x=jsonOut(r);assert.equal(x.project.name,'p4-fixture');assert.ok(x.domains.length>=2);assert.equal(JSON.stringify(x).includes('BillingService { amount'),false);
});

test('installer creates mutable knowledge state under the ignored AleDevOS state plane',()=>{
  const s=fs.readFileSync(path.resolve('scripts/05-install-into-project.ps1'),'utf8');assert.match(s,/state\\knowledge\\domains/);assert.match(s,/ContextOS Phase 1\+2\+3\+4\+5/);
  const gi=fs.readFileSync(path.resolve('.gitignore'),'utf8');assert.match(gi,/\.aledevos\/state\//);assert.equal(gi.split(/\r?\n/).some(line=>line.trim()==='.aledevos/knowledge/'),false);
});

test('all Core and OpenCode agents carry a concise Phase 4 map-first discipline',()=>{
  for(const dir of ['core/agents','adapters/opencode/.opencode/agents'])for(const name of fs.readdirSync(dir).filter(x=>x.endsWith('.md'))){const s=fs.readFileSync(path.join(dir,name),'utf8');assert.match(s,/## ContextOS Phase 4/,`${dir}/${name}`);assert.match(s,/knowledge maps/i,`${dir}/${name}`)}
});

test('phase 4 self-test passes while retaining phase 3 compatibility marker',()=>{
  const r=run(distRoot,'self-test');assert.equal(r.status,0,r.stderr||r.stdout);assert.match(r.stdout,/CONTEXTOS_PHASE3_SELF_TEST_PASS/);assert.match(r.stdout,/CONTEXTOS_PHASE4_SELF_TEST_PASS/);
});
