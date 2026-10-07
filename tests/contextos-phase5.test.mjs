import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildKnowledgeMaps, refreshKnowledgeMaps, knowledgeFreshness } from '../contextos/engine/knowledge.mjs';
import { putResearchCache, getResearchCache, verifyResearchCache, explicitInvalidateResearch } from '../contextos/engine/research-cache.mjs';

const distRoot=path.resolve('.');
const runtime=path.resolve('contextos/engine/contextos.mjs');
const basePolicyPath=path.resolve('contextos/policies/context-policy.json');
const policy=()=>JSON.parse(fs.readFileSync(basePolicyPath,'utf8'));
const run=(cwd,...a)=>spawnSync(process.execPath,[runtime,...a],{cwd,encoding:'utf8'});
const jsonOut=r=>JSON.parse(r.stdout);
function git(cwd,...a){return spawnSync('git',a,{cwd,encoding:'utf8'});}
function makeRepo(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'contextos-p5-'));
  fs.mkdirSync(path.join(dir,'src','features','billing'),{recursive:true});
  fs.mkdirSync(path.join(dir,'src','features','users'),{recursive:true});
  fs.mkdirSync(path.join(dir,'tests','billing'),{recursive:true});
  fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({name:'p5-fixture',scripts:{test:'vitest run'}},null,2));
  fs.writeFileSync(path.join(dir,'src','features','billing','math.ts'),`export function total(a:number,b:number){ return a+b }\nexport const TAX = 0.2\n`);
  fs.writeFileSync(path.join(dir,'src','features','billing','service.ts'),`import { total } from './math'\nimport zod from 'zod'\nexport class BillingService { amount(){ return total(1,2) } }\n`);
  fs.writeFileSync(path.join(dir,'src','features','users','user.ts'),`import { total } from '../billing/math'\nexport interface User { id: string }\nexport const userTotal = total\n`);
  fs.writeFileSync(path.join(dir,'tests','billing','service.test.ts'),`import { BillingService } from '../../src/features/billing/service'\nexport const smoke = new BillingService()\n`);
  git(dir,'init');git(dir,'config','user.email','p5@example.invalid');git(dir,'config','user.name','P5');git(dir,'add','.');git(dir,'commit','-m','baseline');
  return dir;
}
function researchInput(source='src/features/billing/math.ts'){
  return {query:'How is billing total calculated?',namespace:'repo',result_summary:'Billing total delegates to the total helper.',source_paths:[source],evidence:[{claim:'The total helper adds two numbers.',source_path:source}],tags:['billing']};
}

test('phase 5 policy enables incremental knowledge, freshness and source-bound research cache',()=>{
  const p=policy();assert.equal(p.knowledge.version,'0.5.0');assert.equal(p.knowledge.incremental_refresh,true);assert.equal(p.research_cache.enabled,true);assert.equal(p.research_cache.stale_entries_usable,false);
});

test('freshness is FRESH immediately after build and STALE after source drift',()=>{
  const dir=makeRepo(),p=policy();buildKnowledgeMaps({cwd:dir,policy:p});let f=knowledgeFreshness({cwd:dir,policy:p});assert.equal(f.status,'FRESH');
  fs.appendFileSync(path.join(dir,'src/features/billing/math.ts'),'export const DISCOUNT = 1\n');f=knowledgeFreshness({cwd:dir,policy:p});assert.equal(f.status,'STALE');assert.deepEqual(f.changed,['src/features/billing/math.ts']);
});

test('freshness classifies added, changed and deleted files deterministically',()=>{
  const dir=makeRepo(),p=policy();buildKnowledgeMaps({cwd:dir,policy:p});fs.writeFileSync(path.join(dir,'src/features/billing/new.ts'),'export const NEW=1\n');fs.appendFileSync(path.join(dir,'src/features/billing/math.ts'),'export const C=1\n');fs.rmSync(path.join(dir,'src/features/users/user.ts'));
  const f=knowledgeFreshness({cwd:dir,policy:p});assert.deepEqual(f.added,['src/features/billing/new.ts']);assert.deepEqual(f.changed,['src/features/billing/math.ts']);assert.deepEqual(f.deleted,['src/features/users/user.ts']);
});

test('incremental refresh reparses only changed source/test files and reuses unchanged parse entries',()=>{
  const dir=makeRepo(),p=policy();const b=buildKnowledgeMaps({cwd:dir,policy:p});assert.equal(b.incremental.reparsed_files,4);fs.appendFileSync(path.join(dir,'src/features/billing/math.ts'),'export function discount(){return 1}\n');
  const r=refreshKnowledgeMaps({cwd:dir,policy:p});assert.equal(r.status,'KNOWLEDGE_REFRESHED');assert.equal(r.incremental.reparsed_files,1);assert.equal(r.incremental.reused_parse_entries,3);assert.equal(r.incremental.changed,1);assert.equal(knowledgeFreshness({cwd:dir,policy:p}).status,'FRESH');
});

test('unchanged incremental refresh is a no-op and preserves manifest bytes',()=>{
  const dir=makeRepo(),p=policy();buildKnowledgeMaps({cwd:dir,policy:p});const mp=path.join(dir,'.aledevos/state/knowledge/manifest.json'),before=fs.readFileSync(mp,'utf8');const r=refreshKnowledgeMaps({cwd:dir,policy:p});const after=fs.readFileSync(mp,'utf8');assert.equal(r.status,'KNOWLEDGE_FRESH_NOOP');assert.equal(r.incremental.reparsed_files,0);assert.equal(after,before);
});

test('incremental refresh removes deleted domain artifacts and updates aggregate maps',()=>{
  const dir=makeRepo(),p=policy();buildKnowledgeMaps({cwd:dir,policy:p});const idx1=JSON.parse(fs.readFileSync(path.join(dir,'.aledevos/state/knowledge/domains.index.json'),'utf8')),users=idx1.domains.find(x=>x.root==='src/features/users');assert.ok(users);fs.rmSync(path.join(dir,'src/features/users'),{recursive:true,force:true});const r=refreshKnowledgeMaps({cwd:dir,policy:p});assert.equal(r.incremental.deleted,1);const idx2=JSON.parse(fs.readFileSync(path.join(dir,'.aledevos/state/knowledge/domains.index.json'),'utf8'));assert.equal(idx2.domains.some(x=>x.root==='src/features/users'),false);assert.equal(fs.existsSync(path.join(dir,'.aledevos/state/knowledge/domains',`${users.id}.json`)),false);
});

test('research cache stores compact source-bound findings and returns a fresh hit',()=>{
  const dir=makeRepo(),p=policy();buildKnowledgeMaps({cwd:dir,policy:p});const put=putResearchCache({cwd:dir,policy:p,input:researchInput()});assert.equal(put.status,'RESEARCH_CACHE_STORED');const get=getResearchCache({cwd:dir,policy:p,query:'How is billing total calculated?'});assert.equal(get.status,'FRESH');assert.equal(get.usable,true);assert.equal(get.entry.result_summary,'Billing total delegates to the total helper.');assert.equal(get.entry.sources.length,1);
});

test('research cache becomes stale immediately when a bound source changes even before knowledge refresh',()=>{
  const dir=makeRepo(),p=policy();buildKnowledgeMaps({cwd:dir,policy:p});putResearchCache({cwd:dir,policy:p,input:researchInput()});fs.appendFileSync(path.join(dir,'src/features/billing/math.ts'),'export const DRIFT=1\n');const get=getResearchCache({cwd:dir,policy:p,query:'How is billing total calculated?'});assert.equal(get.status,'STALE');assert.equal(get.usable,false);assert.ok(get.reasons.some(x=>x.startsWith('SOURCE_CHANGED:')));assert.equal('entry' in get,false);
});

test('knowledge refresh explicitly invalidates research entries whose source changed',()=>{
  const dir=makeRepo(),p=policy();buildKnowledgeMaps({cwd:dir,policy:p});putResearchCache({cwd:dir,policy:p,input:researchInput()});fs.appendFileSync(path.join(dir,'src/features/billing/math.ts'),'export const DRIFT=1\n');const r=refreshKnowledgeMaps({cwd:dir,policy:p});assert.equal(r.research_invalidated,1);const get=getResearchCache({cwd:dir,policy:p,query:'How is billing total calculated?'});assert.ok(get.reasons.some(x=>x.startsWith('INVALIDATED:SOURCE_CHANGED')));
});

test('unrelated source refresh preserves a research cache entry as fresh',()=>{
  const dir=makeRepo(),p=policy();buildKnowledgeMaps({cwd:dir,policy:p});putResearchCache({cwd:dir,policy:p,input:researchInput()});fs.appendFileSync(path.join(dir,'src/features/users/user.ts'),'export const OTHER=1\n');const r=refreshKnowledgeMaps({cwd:dir,policy:p});assert.equal(r.research_invalidated,0);const get=getResearchCache({cwd:dir,policy:p,query:'How is billing total calculated?'});assert.equal(get.status,'FRESH');assert.equal(get.usable,true);
});

test('research cache survives a full knowledge rebuild when its sources are unchanged',()=>{
  const dir=makeRepo(),p=policy();buildKnowledgeMaps({cwd:dir,policy:p});putResearchCache({cwd:dir,policy:p,input:researchInput()});const r=buildKnowledgeMaps({cwd:dir,policy:p});assert.equal(r.research_invalidated,0);const get=getResearchCache({cwd:dir,policy:p,query:'How is billing total calculated?'});assert.equal(get.status,'FRESH');assert.equal(get.usable,true);
});

test('research cache TTL is deterministic and stale content is not returned as usable',()=>{
  const dir=makeRepo(),p=policy(),t0=new Date('2026-01-01T00:00:00Z');buildKnowledgeMaps({cwd:dir,policy:p});putResearchCache({cwd:dir,policy:p,input:{...researchInput(),max_age_seconds:60},now:t0});const get=getResearchCache({cwd:dir,policy:p,query:'How is billing total calculated?',now:new Date('2026-01-01T00:02:00Z')});assert.equal(get.status,'STALE');assert.equal(get.usable,false);assert.ok(get.reasons.includes('TTL_EXPIRED'));assert.equal('entry' in get,false);
});

test('research cache rejects transcript-like payloads instead of persisting conversation dumps',()=>{
  const dir=makeRepo(),p=policy();buildKnowledgeMaps({cwd:dir,policy:p});assert.throws(()=>putResearchCache({cwd:dir,policy:p,input:{...researchInput(),transcript:'huge conversation'}}),/RESEARCH_TRANSCRIPT_FORBIDDEN/);
});

test('research verification detects tampering and source staleness separately',()=>{
  const dir=makeRepo(),p=policy();buildKnowledgeMaps({cwd:dir,policy:p});const put=putResearchCache({cwd:dir,policy:p,input:researchInput()});let v=verifyResearchCache({cwd:dir,policy:p});assert.equal(v.valid,true);assert.equal(v.fresh,1);const cp=path.join(dir,'.aledevos/state/knowledge/research',`${put.cache_id}.json`),e=JSON.parse(fs.readFileSync(cp,'utf8'));e.result_summary='tampered';fs.writeFileSync(cp,JSON.stringify(e,null,2));v=verifyResearchCache({cwd:dir,policy:p});assert.equal(v.valid,false);assert.equal(v.invalid,1);
});

test('manual research invalidation prevents reuse even when source bytes are unchanged',()=>{
  const dir=makeRepo(),p=policy();buildKnowledgeMaps({cwd:dir,policy:p});putResearchCache({cwd:dir,policy:p,input:researchInput()});const inv=explicitInvalidateResearch({cwd:dir,policy:p,query:'How is billing total calculated?',reason:'DECISION_CHANGED'});assert.equal(inv.status,'RESEARCH_CACHE_INVALIDATED');const get=getResearchCache({cwd:dir,policy:p,query:'How is billing total calculated?'});assert.equal(get.usable,false);assert.ok(get.reasons.includes('INVALIDATED:DECISION_CHANGED'));
});

test('CLI exposes freshness, incremental refresh and research-cache commands',()=>{
  const dir=makeRepo(),p=policy();buildKnowledgeMaps({cwd:dir,policy:p});let r=run(dir,'knowledge','freshness');assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(jsonOut(r).status,'FRESH');fs.writeFileSync(path.join(dir,'research.json'),JSON.stringify(researchInput(),null,2));r=run(dir,'research','put','--file','research.json');assert.equal(r.status,0,r.stdout+r.stderr);r=run(dir,'research','get','--query','How is billing total calculated?');assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(jsonOut(r).usable,true);
});

test('installer and agents carry Phase 5 freshness-before-use discipline',()=>{
  const s=fs.readFileSync(path.resolve('scripts/05-install-into-project.ps1'),'utf8');assert.match(s,/ContextOS Phase 1\+2\+3\+4\+5/);assert.match(s,/research-cache\.mjs/);assert.match(s,/state\\knowledge\\research/);
  for(const dir of ['core/agents','adapters/opencode/.opencode/agents'])for(const name of fs.readdirSync(dir).filter(x=>x.endsWith('.md'))){const body=fs.readFileSync(path.join(dir,name),'utf8');assert.match(body,/## ContextOS Phase 5/,`${dir}/${name}`);assert.match(body,/fresh/i,`${dir}/${name}`)}
});

test('phase 5 self-test preserves Phase 3 and 4 compatibility markers',()=>{
  const r=run(distRoot,'self-test');assert.equal(r.status,0,r.stderr||r.stdout);assert.match(r.stdout,/CONTEXTOS_PHASE3_SELF_TEST_PASS/);assert.match(r.stdout,/CONTEXTOS_PHASE4_SELF_TEST_PASS/);assert.match(r.stdout,/CONTEXTOS_PHASE5_SELF_TEST_PASS/);
});
