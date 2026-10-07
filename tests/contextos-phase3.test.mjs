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
function makeRepo(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'contextos-p3-'));
  git(dir,'init');git(dir,'config','user.email','p3@example.invalid');git(dir,'config','user.name','P3');
  fs.mkdirSync(path.join(dir,'src'),{recursive:true});
  fs.writeFileSync(path.join(dir,'src','a.ts'),'export const a = 1;\n');
  git(dir,'add','.');git(dir,'commit','-m','baseline');
  return dir;
}
function writeInput(dir,name,input){const p=path.join(dir,name);fs.writeFileSync(p,JSON.stringify(input,null,2));return p;}
function defaultInput(items,target='judge-regression'){return {version:'0.3.0',task_id:'task-p3',target_agent:target,items};}
function item(id,kind,content,extra={}){return {id,kind,content,...extra};}
function policyCopy(dir,mutate){const d=JSON.parse(fs.readFileSync(basePolicy,'utf8'));mutate(d);const p=path.join(dir,'policy.json');fs.writeFileSync(p,JSON.stringify(d,null,2));return p;}

test('phase 3 policy enables diff-first and de-dup without changing runtime profile safety reserve',()=>{
  const p=JSON.parse(fs.readFileSync(basePolicy,'utf8'));
  assert.equal(p.version,'0.3.0');
  assert.equal(p.diff_first.enabled,true);
  assert.equal(p.dedup.enabled,true);
  const r=run(distRoot,'budget','resolve','--profile','opencode-qwen64k','--agent','orchestrator');
  assert.equal(r.status,0,r.stderr);const x=jsonOut(r);
  assert.equal(x.usable_input_tokens,45536);assert.equal(x.target_tokens,10000);
});

test('diff snapshot captures tracked changes and does not mutate git index',()=>{
  const dir=makeRepo();
  fs.writeFileSync(path.join(dir,'src','a.ts'),'export const a = 2;\n');
  const before=git(dir,'diff','--cached','--binary').stdout;
  const r=run(dir,'diff','capture','--id','d1');
  assert.equal(r.status,0,r.stderr||r.stdout);const x=jsonOut(r);
  assert.equal(x.status,'DIFF_CAPTURED');assert.deepEqual(x.changed_paths,['src/a.ts']);assert.equal(x.index_mutated,false);
  assert.equal(git(dir,'diff','--cached','--binary').stdout,before);
  const saved=JSON.parse(fs.readFileSync(path.join(dir,'.aledevos','state','contextos','diffs','d1.json'),'utf8'));
  assert.match(saved.tracked_patch.text,/export const a = 2/);
});

test('untracked files are represented without staging them',()=>{
  const dir=makeRepo();fs.writeFileSync(path.join(dir,'src','new.ts'),'export const n = 3;\n');
  const r=run(dir,'diff','capture','--id','d2');assert.equal(r.status,0,r.stderr||r.stdout);
  const saved=JSON.parse(fs.readFileSync(path.join(dir,'.aledevos','state','contextos','diffs','d2.json'),'utf8'));
  assert.equal(saved.untracked_files.length,1);assert.equal(saved.untracked_files[0].path,'src/new.ts');assert.match(saved.untracked_files[0].preview,/n = 3/);
  assert.equal(git(dir,'diff','--cached','--name-only').stdout.trim(),'');
});

test('diff snapshot bounds large tracked patches and records truncation',()=>{
  const dir=makeRepo();fs.writeFileSync(path.join(dir,'src','a.ts'),Array.from({length:300},(_,i)=>`export const x${i} = ${i};`).join('\n')+'\n');
  const pp=policyCopy(dir,p=>{p.diff_first.max_tracked_patch_chars=240;p.diff_first.max_snapshot_estimated_tokens=5000});
  const r=run(dir,'diff','capture','--id','d3','--policy',pp);assert.equal(r.status,0,r.stderr||r.stdout);
  const saved=JSON.parse(fs.readFileSync(path.join(dir,'.aledevos','state','contextos','diffs','d3.json'),'utf8'));
  assert.equal(saved.tracked_patch.truncated,true);assert.ok(saved.tracked_patch.text.length<=240);
});

test('diff snapshot integrity detects tampering',()=>{
  const dir=makeRepo();fs.writeFileSync(path.join(dir,'src','a.ts'),'export const a = 9;\n');run(dir,'diff','capture','--id','d4');
  const p=path.join(dir,'.aledevos','state','contextos','diffs','d4.json');const d=JSON.parse(fs.readFileSync(p,'utf8'));d.changed_paths.push('evil.ts');fs.writeFileSync(p,JSON.stringify(d,null,2));
  const r=run(dir,'diff','verify','--id','d4');assert.notEqual(r.status,0);assert.match(r.stdout,/payload_sha256:mismatch/);
});

test('exact duplicates inside one context packet become references',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'contextos-p3-dedup-'));
  const input=defaultInput([item('task','task_contract',{a:1},{required:true}),item('scope','approved_scope',['src/a.ts'],{required:true}),item('diff','diff_summary',{paths:['src/a.ts']},{required:true}),item('same-a','decision_record','same content'),item('same-b','decision_record','same content')]);
  const f=writeInput(dir,'input.json',input),r=run(dir,'context','plan','--file',f,'--agent','judge-regression');assert.equal(r.status,0,r.stderr||r.stdout);const x=jsonOut(r);
  const a=x.items.find(z=>z.id==='same-a'),b=x.items.find(z=>z.id==='same-b');assert.equal(a.decision,'INLINE');assert.equal(b.decision,'REFERENCE_ONLY');assert.equal(b.reason,'DUPLICATE_IN_PACKET');
});

test('ledger makes unchanged context reference-only on later packets',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'contextos-p3-ledger-'));
  const input=defaultInput([item('task','task_contract',{objective:'X'},{required:true}),item('scope','approved_scope',['src/a.ts'],{required:true}),item('diff','diff_summary',{p:['src/a.ts']},{required:true})]);
  const f=writeInput(dir,'input.json',input);
  let r=run(dir,'context','plan','--file',f,'--agent','judge-regression','--ledger-id','L1','--commit-ledger');assert.equal(r.status,0,r.stderr||r.stdout);
  r=run(dir,'context','plan','--file',f,'--agent','judge-regression','--ledger-id','L1');assert.equal(r.status,0,r.stderr||r.stdout);const x=jsonOut(r);
  assert.ok(x.items.every(z=>z.decision==='REFERENCE_ONLY'));assert.ok(x.dedup_saved_tokens>0);
});

test('same semantic item with changed content is inlined again',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'contextos-p3-change-'));
  const base=defaultInput([item('task','task_contract',{objective:'X'},{required:true}),item('scope','approved_scope',['a'],{required:true}),item('diff','diff_summary',{v:1},{required:true})]);
  const f=writeInput(dir,'a.json',base);let r=run(dir,'context','plan','--file',f,'--agent','judge-regression','--ledger-id','L2','--commit-ledger');assert.equal(r.status,0,r.stderr||r.stdout);
  base.items[2].content={v:2};writeInput(dir,'b.json',base);r=run(dir,'context','plan','--file',path.join(dir,'b.json'),'--agent','judge-regression','--ledger-id','L2');assert.equal(r.status,0,r.stderr||r.stdout);const x=jsonOut(r),d=x.items.find(z=>z.id==='diff');
  assert.equal(d.decision,'INLINE');assert.equal(d.reason,'CHANGED_CONTENT');
});

test('full-file fallback requires an explicit reason',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'contextos-p3-full-'));
  const f=writeInput(dir,'input.json',defaultInput([item('diff','diff_summary',{p:['a']}),item('whole','full_file','entire file')]));
  const r=run(dir,'context','plan','--file',f,'--agent','judge-regression');assert.equal(r.status,45);assert.match(r.stdout,/fallback_reason_required/);
});

test('review agents reject full-file fallback when diff evidence is absent',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'contextos-p3-nodiff-'));
  const f=writeInput(dir,'input.json',defaultInput([item('task','task_contract',{x:1}),item('whole','full_file','entire',{fallback_reason:'Need unchanged helper context'})]));
  const r=run(dir,'context','plan','--file',f,'--agent','judge-regression');assert.equal(r.status,45);assert.match(r.stdout,/diff_first_evidence_missing/);
});

test('optional low-priority context is omitted when packet budget is reached',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'contextos-p3-budget-'));const pp=policyCopy(dir,p=>{p.dedup.max_packet_estimated_tokens=300;p.dedup.max_packet_ratio_of_agent_target=1;p.dedup.max_inline_item_estimated_tokens=2000});
  const input=defaultInput([item('task','task_contract','t',{required:true}),item('scope','approved_scope','s',{required:true}),item('diff','diff_summary','d',{required:true}),item('extra','other','x'.repeat(1800),{required:false})]);
  const f=writeInput(dir,'input.json',input),r=run(dir,'context','plan','--file',f,'--agent','judge-regression','--policy',pp);assert.equal(r.status,0,r.stderr||r.stdout);const x=jsonOut(r),extra=x.items.find(z=>z.id==='extra');
  assert.equal(extra.decision,'OMIT_BUDGET');assert.equal(extra.reason,'PACKET_BUDGET');
});

test('required context fails closed rather than being silently omitted',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'contextos-p3-required-'));const pp=policyCopy(dir,p=>{p.dedup.max_packet_estimated_tokens=100;p.dedup.max_packet_ratio_of_agent_target=1;p.dedup.max_inline_item_estimated_tokens=2000});
  const f=writeInput(dir,'input.json',defaultInput([item('task','task_contract','x'.repeat(1000),{required:true}),item('diff','diff_summary','d',{required:true})]));
  const r=run(dir,'context','plan','--file',f,'--agent','judge-regression','--policy',pp);assert.equal(r.status,46);assert.match(r.stdout,/required_context_exceeds_packet_budget/);
});

test('diff-first priority reorders review context before full files',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'contextos-p3-order-'));
  const f=writeInput(dir,'input.json',defaultInput([item('whole','full_file','abc',{fallback_reason:'Need unchanged helper'}),item('verify','verification_evidence',{tests:'PASS'}),item('diff','diff_patch','@@ patch'),item('task','task_contract',{o:'x'}),item('scope','approved_scope',['a'])]));
  const r=run(dir,'context','plan','--file',f,'--agent','judge-regression');assert.equal(r.status,0,r.stderr||r.stdout);const ids=jsonOut(r).items.map(z=>z.id);
  assert.ok(ids.indexOf('task')<ids.indexOf('diff'));assert.ok(ids.indexOf('diff')<ids.indexOf('whole'));assert.ok(ids.indexOf('verify')<ids.indexOf('whole'));
});

test('installer packages phase 3 runtime directories and contracts',()=>{
  const s=fs.readFileSync(path.resolve('scripts/05-install-into-project.ps1'),'utf8');
  assert.match(s,/state\\contextos\\diffs/);assert.match(s,/state\\contextos\\dedup/);assert.match(s,/state\\contextos\\packets/);assert.match(s,/ContextOS Phase 1\+2\+3/);
});

test('all Core and OpenCode agents carry phase 3 diff/de-dup discipline',()=>{
  for(const dir of ['core/agents','adapters/opencode/.opencode/agents'])for(const name of fs.readdirSync(dir).filter(x=>x.endsWith('.md'))){const s=fs.readFileSync(path.join(dir,name),'utf8');assert.match(s,/## ContextOS Phase 3/,`${dir}/${name}`);assert.match(s,/diff-first/i,`${dir}/${name}`);assert.match(s,/de-dup ledger/i,`${dir}/${name}`)}
});

test('phase 3 self-test passes',()=>{
  const r=run(distRoot,'self-test');assert.equal(r.status,0,r.stderr||r.stdout);assert.match(r.stdout,/CONTEXTOS_PHASE3_SELF_TEST_PASS/);
});
