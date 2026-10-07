import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const p1=path.join(root,'advanced-execution/worktrees/worktree-manager.mjs');
const p2=path.join(root,'advanced-execution/workers/worker-manager.mjs');
const p3=path.join(root,'advanced-execution/concurrency/concurrency-manager.mjs');
const p4=path.join(root,'advanced-execution/dispatcher/dispatcher-manager.mjs');
const policyFile=path.join(root,'advanced-execution/policies/dispatcher-policy.json');
const certP1=path.join(root,'release/certifications/advanced-execution-p1.json');
const certP2=path.join(root,'release/certifications/advanced-execution-p2.json');
const certP3=path.join(root,'release/certifications/advanced-execution-p3.json');
const run=(script,argv,cwd=root)=>spawnSync(process.execPath,[script,...argv],{cwd,encoding:'utf8'});
const j=r=>{try{return JSON.parse(r.stdout||'{}')}catch{return{}}};
const g=(cwd,args)=>spawnSync('git',args,{cwd,encoding:'utf8'});
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n')};
const stable=(v,omit)=>Array.isArray(v)?v.map(x=>stable(x,omit)):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).filter(k=>!omit.has(k)).sort().map(k=>[k,stable(v[k],omit)])):v;
const hashObj=(v,...omit)=>crypto.createHash('sha256').update(JSON.stringify(stable(v,new Set(omit)))).digest('hex');
const roots=[];const pids=new Set();
const tmp=()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-ae-p4-'));roots.push(d);return d};
const alive=pid=>{try{process.kill(pid,0)}catch{return false}if(process.platform==='linux'){try{const st=fs.readFileSync(`/proc/${pid}/stat`,'utf8').trim().split(' ')[2];if(st==='Z'||st==='X')return false}catch{}}return true};
afterEach(()=>{for(const pid of [...pids]){try{process.kill(pid,'SIGKILL')}catch{}pids.delete(pid)}for(const d of roots.splice(0)){try{fs.rmSync(d,{recursive:true,force:true})}catch{}}});
function repo(){const d=tmp(),r=path.join(d,'repo');for(const x of ['src/a','src/b','src/c','src/d','src/e','docs'])fs.mkdirSync(path.join(r,x),{recursive:true});assert.equal(g(r,['init','-q']).status,0);g(r,['config','user.email','test@example.com']);g(r,['config','user.name','AleDevOS Test']);for(const x of ['src/a/a.txt','src/b/b.txt','src/c/c.txt','src/d/d.txt','src/e/e.txt','docs/readme.txt'])fs.writeFileSync(path.join(r,x),'base\n');fs.writeFileSync(path.join(r,'.gitignore'),'.aledevos/state/\n');g(r,['add','.']);assert.equal(g(r,['commit','-qm','initial']).status,0);return{d,r}}
function wt(x,task){const req=path.join(x.d,`${task}-req.json`),rec=path.join(x.d,`${task}-rec.json`);let r=run(p1,['request','prepare','--repo',x.r,'--task-id',task,'--out',req]);assert.equal(r.status,0,r.stdout+r.stderr);r=run(p1,['worktree','create','--repo',x.r,'--request',req,'--out',rec]);assert.equal(r.status,0,r.stdout+r.stderr);return{task,rec,data:read(rec)}}
function taskFile(x,name,scope){const f=path.join(x.d,`${name}-task.json`);write(f,{task_id:name,type:'FEATURE',risk:'LOW',objective:name,in_scope:[scope],out_of_scope:['.aledevos/**'],acceptance_criteria:[{id:'AC1',text:'done'}],invariants:[],verification:[]});return f}
function assignment(x,w,scope){const tf=taskFile(x,w.task,scope),r=run(p2,['assignment','prepare','--repo',x.r,'--worktree-receipt',w.rec,'--task-contract',tf,'--role','builder','--read-scope',scope,'--write-scope',scope]);assert.equal(r.status,0,r.stdout+r.stderr);return j(r).path}
function plan(x,name,scopes){const files=[];for(const [i,scope] of scopes.entries()){const w=wt(x,`${name}-${i}`);files.push(assignment(x,w,scope))}const f=path.join(x.d,`${name}-plan.json`),argv=['plan','prepare','--repo',x.r];for(const a of files)argv.push('--assignment',a);argv.push('--out',f);const r=run(p3,argv);assert.equal(r.status,0,r.stdout+r.stderr);return{file:f,data:j(r).plan,assignments:files}}
function submit(x,p,priority=5,label='x'){const r=run(p4,['queue','submit','--repo',x.r,'--plan',p.file,'--priority',String(priority),'--label',label]);return{r,data:j(r)}}
function tick(x,max=null){const a=['dispatch','tick','--repo',x.r];if(max!=null)a.push('--max-starts',String(max));const r=run(p4,a);const d=j(r);for(const item of Object.values(d.queue?.items||{})){if(item.group_file&&fs.existsSync(item.group_file)){const gg=read(item.group_file);for(const w of Object.values(gg.workers||{}))if(w.pid)pids.add(w.pid)}}return{r,data:d}}
function stopAll(x){const s=run(p4,['queue','status','--repo',x.r]);for(const item of j(s).items||[]){if(item.state==='RUNNING'){const r=run(p4,['item','cancel','--repo',x.r,'--dispatch-id',item.dispatch_id]);const d=j(r);if(d.item?.group_file&&fs.existsSync(d.item.group_file)){const gg=read(d.item.group_file);for(const w of Object.values(gg.workers||{}))if(w.pid)pids.delete(w.pid)}}}}

// Policy / boundaries.
test('P4 policy verifies',()=>assert.equal(run(p4,['policy','verify']).status,0));
test('P4 phase exact',()=>assert.equal(read(policyFile).phase,'ADVANCED_EXECUTION_P4_DISPATCHER_QUEUE'));
test('dispatcher and queue enabled',()=>{const p=read(policyFile);assert.equal(p.boundaries.dispatcher_used,true);assert.equal(p.boundaries.queue_used,true)});
test('P3 remains concurrency authority',()=>assert.equal(read(policyFile).boundaries.safe_concurrency_authority,'ADVANCED_EXECUTION_P3'));
test('P2 remains worker authority',()=>assert.equal(read(policyFile).boundaries.worker_runtime_authority,'ADVANCED_EXECUTION_P2'));
test('P1 remains worktree authority',()=>assert.equal(read(policyFile).boundaries.worktree_authority,'ADVANCED_EXECUTION_P1'));
test('multi-machine remains disabled',()=>assert.equal(read(policyFile).boundaries.multi_machine_used,false));
test('network remains disabled',()=>assert.equal(read(policyFile).boundaries.network_used,false));
test('target runtime binding remains deferred',()=>assert.equal(read(policyFile).boundaries.target_agent_runtime_binding,'DEFERRED_MASTER_VALIDATION'));
test('queue capacity finite',()=>assert.equal(read(policyFile).queue.max_items,256));
test('priority bounded',()=>{const q=read(policyFile).queue;assert.equal(q.min_priority,0);assert.equal(q.max_priority,9)});
test('dispatch starts per tick bounded',()=>assert.equal(read(policyFile).queue.max_dispatch_starts_per_tick,4));
test('dispatch retries bounded',()=>assert.equal(read(policyFile).queue.max_dispatch_attempts,2));
test('fairness uses deterministic epoch aging',()=>assert.equal(read(policyFile).fairness.policy,'PRIORITY_FIFO_WITH_EPOCH_AGING'));
test('work conserving dispatch enabled',()=>assert.equal(read(policyFile).dispatch.work_conserving,true));
test('P4 never bypasses P3',()=>assert.equal(read(policyFile).dispatch.never_bypass_p3,true));
test('P4 never spawns workers directly',()=>assert.equal(read(policyFile).dispatch.never_spawn_worker_directly,true));
test('P4 manager contains no adapter/provider names',()=>{const s=fs.readFileSync(p4,'utf8').toLowerCase();for(const n of ['opencode','codex','claude','antigravity','gemini'])assert.equal(s.includes(n),false,n)});
test('P4 manager imports no network modules',()=>{const s=fs.readFileSync(p4,'utf8');for(const n of ['node:http','node:https','node:net','node:dgram'])assert.equal(s.includes(n),false,n)});

// Durable queue basics.
test('queue init creates ACTIVE durable queue',()=>{const x=repo(),r=run(p4,['queue','init','--repo',x.r]);assert.equal(r.status,0,r.stdout);assert.equal(j(r).queue.mode,'ACTIVE');assert.ok(fs.existsSync(path.join(x.r,'.aledevos/state/execution/phase4/queue.json')))});
test('empty queue verifies',()=>{const x=repo();assert.equal(run(p4,['queue','init','--repo',x.r]).status,0);assert.equal(run(p4,['queue','verify','--repo',x.r]).status,0)});
test('queue hash tamper detected',()=>{const x=repo();run(p4,['queue','init','--repo',x.r]);const f=path.join(x.r,'.aledevos/state/execution/phase4/queue.json'),q=read(f);q.mode='PAUSED';write(f,q);assert.notEqual(run(p4,['queue','verify','--repo',x.r]).status,0)});
test('invalid priority rejected',()=>{const x=repo(),p=plan(x,'a',['src/a/**']),r=submit(x,p,99);assert.notEqual(r.r.status,0);assert.ok(r.data.errors.includes('PRIORITY_INVALID'))});
test('invalid P3 plan rejected',()=>{const x=repo(),f=path.join(x.d,'bad.json');write(f,{bad:true});const r=run(p4,['queue','submit','--repo',x.r,'--plan',f]);assert.notEqual(r.status,0);assert.equal(j(r).status,'DISPATCH_SUBMIT_BLOCKED')});
test('valid P3 plan becomes QUEUED',()=>{const x=repo(),p=plan(x,'a',['src/a/**']),s=submit(x,p,6);assert.equal(s.r.status,0,s.r.stdout);assert.equal(s.data.item.state,'QUEUED');assert.equal(s.data.item.priority,6)});
test('active duplicate plan rejected',()=>{const x=repo(),p=plan(x,'a',['src/a/**']);assert.equal(submit(x,p).r.status,0);const b=submit(x,p);assert.notEqual(b.r.status,0);assert.equal(b.data.status,'DISPATCH_DUPLICATE_ACTIVE_PLAN')});
test('submission snapshots plan inside repo state',()=>{const x=repo(),p=plan(x,'a',['src/a/**']),s=submit(x,p);assert.ok(path.resolve(s.data.item.plan_snapshot_path).startsWith(path.resolve(x.r,'.aledevos/state/execution/phase4')))});
test('changing original plan after submit does not mutate snapshot',()=>{const x=repo(),p=plan(x,'a',['src/a/**']),s=submit(x,p),before=fs.readFileSync(s.data.item.plan_snapshot_path,'utf8');write(p.file,{changed:true});assert.equal(fs.readFileSync(s.data.item.plan_snapshot_path,'utf8'),before);assert.equal(run(p4,['queue','verify','--repo',x.r]).status,0)});
test('tampering plan snapshot invalidates queue',()=>{const x=repo(),p=plan(x,'a',['src/a/**']),s=submit(x,p);fs.appendFileSync(s.data.item.plan_snapshot_path,'\n');assert.notEqual(run(p4,['queue','verify','--repo',x.r]).status,0)});
test('submission receipt created',()=>{const x=repo(),p=plan(x,'a',['src/a/**']),s=submit(x,p);assert.ok(fs.existsSync(s.data.receipt.path));assert.equal(s.data.receipt.receipt.event,'SUBMITTED')});
test('submission sequence is stable FIFO',()=>{const x=repo(),a=submit(x,plan(x,'a',['src/a/**']),5),b=submit(x,plan(x,'b',['src/b/**']),5);assert.ok(a.data.item.enqueue_sequence<b.data.item.enqueue_sequence)});

// Queue controls.
test('queue pause prevents dispatch',()=>{const x=repo(),s=submit(x,plan(x,'a',['src/a/**']));run(p4,['queue','pause','--repo',x.r]);const t=tick(x);assert.equal(t.data.started,0);assert.equal(t.data.queue.items[s.data.dispatch_id].state,'QUEUED')});
test('queue resume allows dispatch',()=>{const x=repo(),s=submit(x,plan(x,'a',['src/a/**']));run(p4,['queue','pause','--repo',x.r]);run(p4,['queue','resume','--repo',x.r]);const t=tick(x);assert.equal(t.data.started,1);stopAll(x)});
test('item pause excludes queued item',()=>{const x=repo(),s=submit(x,plan(x,'a',['src/a/**']));assert.equal(run(p4,['item','pause','--repo',x.r,'--dispatch-id',s.data.dispatch_id]).status,0);const t=tick(x);assert.equal(t.data.started,0)});
test('item resume restores eligibility',()=>{const x=repo(),s=submit(x,plan(x,'a',['src/a/**']));run(p4,['item','pause','--repo',x.r,'--dispatch-id',s.data.dispatch_id]);run(p4,['item','resume','--repo',x.r,'--dispatch-id',s.data.dispatch_id]);assert.equal(tick(x).data.started,1);stopAll(x)});
test('drain empty queue becomes DRAINED',()=>{const x=repo();run(p4,['queue','init','--repo',x.r]);const r=run(p4,['queue','drain','--repo',x.r]);assert.equal(j(r).queue.mode,'DRAINED')});
test('cancel queued item works without starting P3',()=>{const x=repo(),s=submit(x,plan(x,'a',['src/a/**'])),r=run(p4,['item','cancel','--repo',x.r,'--dispatch-id',s.data.dispatch_id]);assert.equal(r.status,0,r.stdout);assert.equal(j(r).item.state,'CANCELLED')});
test('queued item cannot be marked completed without running',()=>{const x=repo(),s=submit(x,plan(x,'a',['src/a/**'])),r=run(p4,['item','complete','--repo',x.r,'--dispatch-id',s.data.dispatch_id]);assert.notEqual(r.status,0);assert.equal(j(r).status,'DISPATCH_ITEM_ACTION_BLOCKED')});

// Real P3 dispatch.
test('dispatch tick starts real P3 group',()=>{const x=repo(),s=submit(x,plan(x,'a',['src/a/**'])),t=tick(x);assert.equal(t.r.status,0,t.r.stdout);assert.equal(t.data.started,1);assert.equal(t.data.queue.items[s.data.dispatch_id].state,'RUNNING');stopAll(x)});
test('running item status synchronizes HEALTHY',()=>{const x=repo(),s=submit(x,plan(x,'a',['src/a/**']));tick(x);const r=run(p4,['queue','status','--repo',x.r]),item=j(r).items.find(y=>y.dispatch_id===s.data.dispatch_id);assert.equal(item.runtime_health,'HEALTHY');stopAll(x)});
test('cancel running item asks P3 to stop group',()=>{const x=repo(),s=submit(x,plan(x,'a',['src/a/**']));tick(x);const r=run(p4,['item','cancel','--repo',x.r,'--dispatch-id',s.data.dispatch_id]);assert.equal(r.status,0,r.stdout);assert.equal(j(r).item.state,'CANCELLED');const gg=read(j(r).item.group_file);for(const w of Object.values(gg.workers||{})){pids.delete(w.pid);assert.equal(alive(w.pid),false)}});
test('complete running item stops group then marks completed',()=>{const x=repo(),s=submit(x,plan(x,'a',['src/a/**']));tick(x);const r=run(p4,['item','complete','--repo',x.r,'--dispatch-id',s.data.dispatch_id]);assert.equal(r.status,0,r.stdout);assert.equal(j(r).item.state,'COMPLETED');for(const w of Object.values(read(j(r).item.group_file).workers||{}))pids.delete(w.pid)});
test('max-starts one dispatches only one eligible item',()=>{const x=repo();submit(x,plan(x,'a',['src/a/**']));submit(x,plan(x,'b',['src/b/**']));const t=tick(x,1);assert.equal(t.data.started,1);stopAll(x)});
test('higher priority dispatches before lower priority',()=>{const x=repo(),lo=submit(x,plan(x,'lo',['src/a/**']),1),hi=submit(x,plan(x,'hi',['src/b/**']),9),t=tick(x,1);assert.equal(t.data.events.find(e=>e.event==='STARTED').dispatch_id,hi.data.dispatch_id);assert.equal(t.data.queue.items[lo.data.dispatch_id].state,'QUEUED');stopAll(x)});
test('epoch aging eventually lets older item tie and win FIFO',()=>{const x=repo(),lo=submit(x,plan(x,'lo',['src/a/**']),8);run(p4,['queue','pause','--repo',x.r]);for(let i=0;i<5;i++)tick(x);const hi=submit(x,plan(x,'hi',['src/b/**']),9);run(p4,['queue','resume','--repo',x.r]);const t=tick(x,1);assert.equal(t.data.events.find(e=>e.event==='STARTED').dispatch_id,lo.data.dispatch_id);assert.equal(t.data.queue.items[hi.data.dispatch_id].state,'QUEUED');stopAll(x)});
test('work-conserving tick skips blocked high item and starts safe lower item',()=>{const x=repo(),outside=plan(x,'outside',['src/a/**']);const sr=run(p3,['group','start','--repo',x.r,'--plan',outside.file]);assert.equal(sr.status,0,sr.stdout);const og=j(sr);for(const w of Object.values(og.group.workers))pids.add(w.pid);const high=submit(x,plan(x,'high',['src/a/**']),9),low=submit(x,plan(x,'low',['src/b/**']),1),t=tick(x,2);assert.equal(t.data.queue.items[high.data.dispatch_id].state,'BLOCKED');assert.equal(t.data.queue.items[low.data.dispatch_id].state,'RUNNING');run(p3,['group','stop','--repo',x.r,'--group',og.group_file]);for(const w of Object.values(og.group.workers))pids.delete(w.pid);stopAll(x)});
test('temporary P3 admission block does not consume dispatch failure attempt',()=>{const x=repo(),outside=plan(x,'outside',['src/a/**']),sr=run(p3,['group','start','--repo',x.r,'--plan',outside.file]),og=j(sr);for(const w of Object.values(og.group.workers))pids.add(w.pid);const s=submit(x,plan(x,'high',['src/a/**']),9),t=tick(x,1),it=t.data.queue.items[s.data.dispatch_id];assert.equal(it.state,'BLOCKED');assert.equal(it.dispatch_attempts,0);run(p3,['group','stop','--repo',x.r,'--group',og.group_file]);for(const w of Object.values(og.group.workers))pids.delete(w.pid)});
test('blocked item is rechecked and can start after lease releases',()=>{const x=repo(),outside=plan(x,'outside',['src/a/**']),sr=run(p3,['group','start','--repo',x.r,'--plan',outside.file]),og=j(sr);for(const w of Object.values(og.group.workers))pids.add(w.pid);const s=submit(x,plan(x,'high',['src/a/**']),9);assert.equal(tick(x,1).data.queue.items[s.data.dispatch_id].state,'BLOCKED');run(p3,['group','stop','--repo',x.r,'--group',og.group_file]);for(const w of Object.values(og.group.workers))pids.delete(w.pid);assert.equal(tick(x,1).data.queue.items[s.data.dispatch_id].state,'RUNNING');stopAll(x)});
test('drain with running item stops new starts and becomes DRAINED after completion',()=>{const x=repo(),a=submit(x,plan(x,'a',['src/a/**']),9),b=submit(x,plan(x,'b',['src/b/**']),1);tick(x,1);let r=run(p4,['queue','drain','--repo',x.r]);assert.equal(j(r).queue.mode,'DRAINING');assert.equal(tick(x,1).data.started,0);r=run(p4,['item','complete','--repo',x.r,'--dispatch-id',a.data.dispatch_id]);assert.equal(j(r).queue.mode,'DRAINED');assert.equal(j(r).queue.items[b.data.dispatch_id].state,'QUEUED')});

// Lock/restart durability.
test('live control lock blocks mutation',()=>{const x=repo(),f=path.join(x.r,'.aledevos/state/execution/phase4/control.lock');fs.mkdirSync(path.dirname(f),{recursive:true});write(f,{pid:process.pid,created_at:new Date().toISOString()});const r=run(p4,['queue','init','--repo',x.r]);assert.notEqual(r.status,0);assert.equal(j(r).status,'DISPATCH_CONTROL_BUSY')});
test('dead stale control lock is recovered',()=>{const x=repo(),f=path.join(x.r,'.aledevos/state/execution/phase4/control.lock');fs.mkdirSync(path.dirname(f),{recursive:true});write(f,{pid:999999999,created_at:new Date(Date.now()-60000).toISOString()});const r=run(p4,['queue','init','--repo',x.r]);assert.equal(r.status,0,r.stdout);assert.equal(fs.existsSync(f),false)});
test('queue survives independent manager invocations',()=>{const x=repo(),s=submit(x,plan(x,'a',['src/a/**']));const r=run(p4,['queue','status','--repo',x.r]);assert.equal(r.status,0);assert.ok(j(r).items.some(y=>y.dispatch_id===s.data.dispatch_id))});

// Freeze and certification.
test('P1 certificate remains valid',()=>assert.equal(run(p1,['certify','verify','--certificate',certP1]).status,0));
test('P2 certificate remains valid',()=>assert.equal(run(p2,['certify','verify','--certificate',certP2]).status,0));
test('P3 certificate remains valid',()=>assert.equal(run(p3,['certify','verify','--certificate',certP3]).status,0));
test('P3 policy still declares dispatcher and queue disabled',()=>{const p=read(path.join(root,'advanced-execution/policies/concurrency-policy.json'));assert.equal(p.boundaries.dispatcher_used,false);assert.equal(p.boundaries.queue_used,false)});
test('recursive installer already covers P4 without installer change',()=>{const s=fs.readFileSync(path.join(root,'scripts/05-install-into-project.ps1'),'utf8');assert.match(s,/advanced-execution/);assert.match(s,/Recurse/)});
test('installed execution layout can verify P4 policy',()=>{const d=tmp(),ale=path.join(d,'.aledevos','execution');fs.cpSync(path.join(root,'advanced-execution'),ale,{recursive:true});const m=path.join(ale,'dispatcher','dispatcher-manager.mjs'),r=run(m,['policy','verify'],d);assert.equal(r.status,0,r.stdout);assert.equal(j(r).status,'DISPATCH_POLICY_VALID')});
test('P4 package certificate can be generated and verified',()=>{const d=tmp(),f=path.join(d,'p4cert.json'),r=run(p4,['certify','run','--out',f]);assert.equal(r.status,0,r.stdout);assert.equal(j(r).status,'ADVANCED_EXECUTION_P4_PACKAGE_CERTIFIED');const v=run(p4,['certify','verify','--certificate',f]);assert.equal(v.status,0,v.stdout);assert.equal(j(v).status,'ADVANCED_EXECUTION_P4_CERTIFICATE_VALID')});
test('P4 certificate claims dispatcher queue but not multi-machine/network',()=>{const d=tmp(),f=path.join(d,'p4cert.json');run(p4,['certify','run','--out',f]);const c=read(f);assert.equal(c.claims.durable_local_queue,true);assert.equal(c.claims.p3_authoritative_dispatch,true);assert.equal(c.claims.multi_machine_disabled,true);assert.equal(c.claims.network_disabled,true);assert.equal(c.claims.target_agent_runtime_binding,false)});
test('P4 certificate tamper is detected',()=>{const d=tmp(),f=path.join(d,'p4cert.json');run(p4,['certify','run','--out',f]);const c=read(f);c.claims.network_disabled=false;write(f,c);const r=run(p4,['certify','verify','--certificate',f]);assert.notEqual(r.status,0);assert.ok(j(r).errors.includes('CERTIFICATE_INTEGRITY_MISMATCH'))});
test('rehashing forged P4 certificate cannot hide input drift',()=>{const d=tmp(),f=path.join(d,'p4cert.json');run(p4,['certify','run','--out',f]);const c=read(f);c.inputs[0].sha256='0'.repeat(64);c.evidence_sha256=hashObj(c,'evidence_sha256');write(f,c);const r=run(p4,['certify','verify','--certificate',f]);assert.notEqual(r.status,0);assert.ok(j(r).errors.some(e=>e.startsWith('INPUT_DRIFT:')))});
