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
const policyFile=path.join(root,'advanced-execution/policies/concurrency-policy.json');
const certP1=path.join(root,'release/certifications/advanced-execution-p1.json');
const certP2=path.join(root,'release/certifications/advanced-execution-p2.json');
const run=(script,argv,cwd=root)=>spawnSync(process.execPath,[script,...argv],{cwd,encoding:'utf8'});
const j=r=>{try{return JSON.parse(r.stdout||'{}')}catch{return{}}};
const g=(cwd,args)=>spawnSync('git',args,{cwd,encoding:'utf8'});
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n')};
const stable=(v,omit)=>Array.isArray(v)?v.map(x=>stable(x,omit)):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).filter(k=>!omit.has(k)).sort().map(k=>[k,stable(v[k],omit)])):v;
const hashObj=(v,...omit)=>crypto.createHash('sha256').update(JSON.stringify(stable(v,new Set(omit)))).digest('hex');
const alive=pid=>{try{process.kill(pid,0)}catch{return false}if(process.platform==='linux'){try{const st=fs.readFileSync(`/proc/${pid}/stat`,'utf8').trim().split(' ')[2];if(st==='Z'||st==='X')return false}catch{}}return true};
const roots=[];const pids=new Set();
const tmp=()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-ae-p3-'));roots.push(d);return d};
afterEach(()=>{for(const pid of [...pids]){try{process.kill(pid,'SIGKILL')}catch{}pids.delete(pid)}for(const d of roots.splice(0)){try{fs.rmSync(d,{recursive:true,force:true})}catch{}}});
function repo(){const d=tmp(),r=path.join(d,'repo');for(const x of ['src/a','src/b','src/c','docs'])fs.mkdirSync(path.join(r,x),{recursive:true});assert.equal(g(r,['init','-q']).status,0);g(r,['config','user.email','test@example.com']);g(r,['config','user.name','AleDevOS Test']);for(const x of ['src/a/a.txt','src/b/b.txt','src/c/c.txt','docs/readme.txt'])fs.writeFileSync(path.join(r,x),'base\n');fs.writeFileSync(path.join(r,'.gitignore'),'.aledevos/state/\n');g(r,['add','.']);assert.equal(g(r,['commit','-qm','initial']).status,0);return{d,r}}
function wt(x,task){const req=path.join(x.d,`${task}-req.json`),rec=path.join(x.d,`${task}-rec.json`);let r=run(p1,['request','prepare','--repo',x.r,'--task-id',task,'--out',req]);assert.equal(r.status,0,r.stdout+r.stderr);r=run(p1,['worktree','create','--repo',x.r,'--request',req,'--out',rec]);assert.equal(r.status,0,r.stdout+r.stderr);return{task,req,rec,data:read(rec)}}
function task(x,name,scope){const f=path.join(x.d,`${name}-task.json`);write(f,{task_id:name,type:'FEATURE',risk:'LOW',objective:name,in_scope:[scope],out_of_scope:['.aledevos/**'],acceptance_criteria:[{id:'AC1',text:'done'}],invariants:[],verification:[]});return f}
function assignment(x,w,scope,{role='builder',readScope=scope,writeScope=scope}={}){const tf=task(x,w.task,scope),argv=['assignment','prepare','--repo',x.r,'--worktree-receipt',w.rec,'--task-contract',tf,'--role',role];if(readScope)argv.push('--read-scope',readScope);if(writeScope)argv.push('--write-scope',writeScope);const r=run(p2,argv);assert.equal(r.status,0,r.stdout+r.stderr);return{file:j(r).path,data:j(r).assignment,taskFile:tf}}
function reader(x,w,scope){return assignment(x,w,scope,{role:'auditor',readScope:scope,writeScope:null})}
function makePair({scopeA='src/a/**',scopeB='src/b/**',readA=scopeA,readB=scopeB}={}){const x=repo(),wa=wt(x,'task-a'),wb=wt(x,'task-b'),a=assignment(x,wa,scopeA,{readScope:readA,writeScope:scopeA}),b=assignment(x,wb,scopeB,{readScope:readB,writeScope:scopeB});return{x,wa,wb,a,b}}
function preparePlan(z,files=[z.a.file,z.b.file]){const f=path.join(z.x.d,'plan.json'),argv=['plan','prepare','--repo',z.x.r];for(const q of files)argv.push('--assignment',q);argv.push('--out',f);const r=run(p3,argv);return{r,data:j(r),file:f}}
function startGroup(z,plan){const r=run(p3,['group','start','--repo',z.x.r,'--plan',plan.file]);const d=j(r);if(d.group?.workers)for(const w of Object.values(d.group.workers))if(w.pid)pids.add(w.pid);return{r,data:d,file:d.group_file}}
function stopGroup(z,s){const r=run(p3,['group','stop','--repo',z.x.r,'--group',s.file]);if(s.data.group?.workers)for(const w of Object.values(s.data.group.workers))if(w.pid)pids.delete(w.pid);return r}

// Policy and phase boundaries.
test('P3 policy verifies',()=>assert.equal(run(p3,['policy','verify']).status,0));
test('P3 phase exact',()=>assert.equal(read(policyFile).phase,'ADVANCED_EXECUTION_P3_SAFE_CONCURRENCY'));
test('parallel workers enabled only in P3 policy',()=>assert.equal(read(policyFile).max_parallel_workers,4));
test('group workers have finite limit',()=>assert.equal(read(policyFile).max_group_workers,8));
test('write-write overlap blocks',()=>assert.equal(read(policyFile).admission.write_write_overlap,'BLOCK'));
test('write-read overlap blocks',()=>assert.equal(read(policyFile).admission.write_read_overlap,'BLOCK'));
test('read-read overlap allowed',()=>assert.equal(read(policyFile).admission.read_read_overlap,'ALLOW'));
test('unknown scope blocks',()=>assert.equal(read(policyFile).admission.unknown_scope,'BLOCK'));
test('global write scope blocks',()=>assert.equal(read(policyFile).admission.global_write_scope,'BLOCK'));
test('distinct worktrees required',()=>assert.equal(read(policyFile).admission.require_distinct_worktrees,true));
test('distinct worker ids required',()=>assert.equal(read(policyFile).admission.require_distinct_worker_ids,true));
test('P2 assignments remain authoritative',()=>assert.equal(read(policyFile).admission.require_p2_assignment_valid,true));
test('live P1 worktree remains mandatory',()=>assert.equal(read(policyFile).admission.require_live_p1_worktree,true));
test('fairness is stable FIFO',()=>assert.equal(read(policyFile).fairness.policy,'FIFO_STABLE'));
test('dispatcher remains disabled',()=>assert.equal(read(policyFile).boundaries.dispatcher_used,false));
test('queue remains disabled',()=>assert.equal(read(policyFile).boundaries.queue_used,false));
test('multi-machine remains disabled',()=>assert.equal(read(policyFile).boundaries.multi_machine_used,false));
test('network remains disabled',()=>assert.equal(read(policyFile).boundaries.network_used,false));
test('target agent runtime binding stays deferred',()=>assert.equal(read(policyFile).boundaries.target_agent_runtime_binding,'DEFERRED_MASTER_VALIDATION'));
test('recovery is bounded per worker',()=>assert.equal(read(policyFile).max_recovery_count_per_worker,1));

// Admission matrix.
test('two disjoint writers produce READY plan',()=>{const z=makePair(),p=preparePlan(z);assert.equal(p.r.status,0,p.r.stdout);assert.equal(p.data.status,'CONCURRENCY_PLAN_READY');assert.deepEqual(p.data.plan.conflicts,[])});
test('write-write overlap blocks admission',()=>{const z=makePair({scopeB:'src/a/**',readB:'src/a/**'}),p=preparePlan(z);assert.notEqual(p.r.status,0);assert.equal(p.data.status,'CONCURRENCY_PLAN_BLOCKED');assert.equal(p.data.plan.conflicts[0].type,'WRITE_WRITE')});
test('write-read overlap blocks admission',()=>{const z=makePair({scopeA:'src/a/**',scopeB:'src/b/**',readB:'src/a/**'}),p=preparePlan(z);assert.notEqual(p.r.status,0);assert.equal(p.data.plan.conflicts.some(c=>c.type==='WRITE_READ'),true)});
test('two overlapping read-only workers are allowed',()=>{const x=repo(),wa=wt(x,'ra'),wb=wt(x,'rb'),a=reader(x,wa,'src/**'),b=reader(x,wb,'src/**'),z={x,a,b},p=preparePlan(z);assert.equal(p.r.status,0,p.r.stdout);assert.equal(p.data.plan.conflicts.length,0)});
test('writer plus global reader is blocked',()=>{const z=makePair({scopeA:'src/a/**',scopeB:'src/b/**',readB:'**'}),p=preparePlan(z);assert.notEqual(p.r.status,0);assert.equal(p.data.plan.conflicts.some(c=>c.type==='WRITE_READ'),true)});
test('tampered assignment blocks plan',()=>{const z=makePair(),q=read(z.b.file);q.task_id='evil';write(z.b.file,q);const p=preparePlan(z);assert.notEqual(p.r.status,0);assert.ok(p.data.errors.some(e=>e.includes('ASSIGNMENT_INVALID')))});
test('duplicate worker id blocks plan',()=>{const z=makePair(),p=preparePlan(z,[z.a.file,z.a.file]);assert.notEqual(p.r.status,0);assert.ok(p.data.errors.some(e=>e.includes('DUPLICATE_WORKER_ID')))});
test('empty group blocks',()=>{const x=repo(),f=path.join(x.d,'p.json'),r=run(p3,['plan','prepare','--repo',x.r,'--out',f]);assert.notEqual(r.status,0);assert.ok(j(r).errors.includes('NO_WORKERS_REQUESTED'))});
test('plan preserves request order',()=>{const z=makePair(),p=preparePlan(z,[z.b.file,z.a.file]);assert.equal(p.r.status,0);assert.equal(p.data.plan.workers[0].worker_id,z.b.data.worker_id);assert.equal(p.data.plan.workers[1].worker_id,z.a.data.worker_id)});
test('same inputs produce same group id',()=>{const z=makePair(),p1x=preparePlan(z),p2x=preparePlan(z);assert.equal(p1x.data.plan.group_id,p2x.data.plan.group_id)});
test('plan verify detects hash tamper',()=>{const z=makePair(),p=preparePlan(z),q=read(p.file);q.limits.max_parallel_workers=99;write(p.file,q);const r=run(p3,['plan','verify','--repo',z.x.r,'--plan',p.file]);assert.notEqual(r.status,0);assert.ok(j(r).errors.includes('PLAN_INTEGRITY_MISMATCH'))});
test('rehashing forged conflicts cannot bypass recomputation',()=>{const z=makePair(),p=preparePlan(z),q=read(p.file);q.conflicts=[{worker_a:'x',worker_b:'y',type:'WRITE_WRITE',a:'x',b:'y'}];q.plan_sha256=hashObj(q,'plan_sha256');write(p.file,q);const r=run(p3,['plan','verify','--repo',z.x.r,'--plan',p.file]);assert.notEqual(r.status,0);assert.ok(j(r).errors.includes('PLAN_RECOMPUTE_DRIFT'))});
test('assignment file drift invalidates plan',()=>{const z=makePair(),p=preparePlan(z),q=read(z.a.file);q.prepared_at='tamper';write(z.a.file,q);const r=run(p3,['plan','verify','--repo',z.x.r,'--plan',p.file]);assert.notEqual(r.status,0);assert.ok(j(r).errors.some(e=>e.includes('ASSIGNMENT_FILE_DRIFT')||e.includes('PLAN_RECOMPUTE_DRIFT')))});

// Real concurrent runtime.
test('two disjoint workers can RUN simultaneously',()=>{const z=makePair(),p=preparePlan(z),s=startGroup(z,p);assert.equal(s.r.status,0,s.r.stdout+s.r.stderr);assert.equal(Object.values(s.data.group.workers).every(w=>w.state==='RUNNING'),true);const ids=Object.values(s.data.group.workers).map(w=>w.pid);assert.equal(new Set(ids).size,2);stopGroup(z,s)});
test('group status validates two live heartbeats',()=>{const z=makePair(),p=preparePlan(z),s=startGroup(z,p),r=run(p3,['group','status','--repo',z.x.r,'--group',s.file]);assert.equal(r.status,0,r.stdout);assert.equal(j(r).status,'CONCURRENCY_GROUP_HEALTHY');stopGroup(z,s)});
test('each concurrent worker heartbeat cwd is its own worktree',()=>{const z=makePair(),p=preparePlan(z),s=startGroup(z,p);for(const w of Object.values(s.data.group.workers)){const h=read(w.heartbeat_path);assert.equal(path.resolve(h.cwd),path.resolve(w.worktree_path))}stopGroup(z,s)});
test('primary checkout remains clean while two workers run',()=>{const z=makePair(),p=preparePlan(z),s=startGroup(z,p);assert.equal(g(z.x.r,['status','--porcelain']).stdout.trim(),'');stopGroup(z,s)});
test('group stop stops all worker processes',()=>{const z=makePair(),p=preparePlan(z),s=startGroup(z,p),r=stopGroup(z,s);assert.equal(r.status,0,r.stdout);for(const w of Object.values(s.data.group.workers)){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,80);assert.equal(alive(w.pid),false)}});
test('active group scope conflicts block a second group',()=>{const z=makePair(),p=preparePlan(z),s=startGroup(z,p),wc=wt(z.x,'task-c'),c=assignment(z.x,wc,'src/a/**',{readScope:'src/a/**',writeScope:'src/a/**'}),f=path.join(z.x.d,'plan-c.json'),r1=run(p3,['plan','prepare','--repo',z.x.r,'--assignment',c.file,'--out',f]);assert.equal(r1.status,0,r1.stdout);const r=run(p3,['group','start','--repo',z.x.r,'--plan',f]);assert.notEqual(r.status,0);assert.ok(j(r).errors.includes('ACTIVE_SCOPE_CONFLICTS_PRESENT'));stopGroup(z,s)});
test('global max parallelism is enforced across groups',()=>{const z=makePair(),p=preparePlan(z),s=startGroup(z,p),files=[];for(const [n,sc] of [['c','src/c/**'],['d','src/d/**'],['e','src/e/**']]){const w=wt(z.x,`task-${n}`),a=assignment(z.x,w,sc,{readScope:sc,writeScope:sc});files.push(a.file)}const f=path.join(z.x.d,'plan-more.json'),argv=['plan','prepare','--repo',z.x.r];for(const q of files)argv.push('--assignment',q);argv.push('--out',f);assert.equal(run(p3,argv).status,0);const r=run(p3,['group','start','--repo',z.x.r,'--plan',f]);assert.notEqual(r.status,0);assert.ok(j(r).errors.includes('GLOBAL_MAX_PARALLEL_WORKERS_EXCEEDED'));stopGroup(z,s)});
test('stopping a group releases its global leases',()=>{const z=makePair(),p=preparePlan(z),s=startGroup(z,p);assert.equal(stopGroup(z,s).status,0);const wc=wt(z.x,'task-c'),c=assignment(z.x,wc,'src/a/**',{readScope:'src/a/**',writeScope:'src/a/**'}),f=path.join(z.x.d,'plan-c2.json');assert.equal(run(p3,['plan','prepare','--repo',z.x.r,'--assignment',c.file,'--out',f]).status,0);const r=run(p3,['group','start','--repo',z.x.r,'--plan',f]);assert.equal(r.status,0,r.stdout);const d=j(r);for(const w of Object.values(d.group.workers)){if(w.pid)pids.add(w.pid)}assert.equal(run(p3,['group','stop','--repo',z.x.r,'--group',d.group_file]).status,0)});
test('same group cannot start twice while active',()=>{const z=makePair(),p=preparePlan(z),s=startGroup(z,p),r=run(p3,['group','start','--repo',z.x.r,'--plan',p.file]);assert.notEqual(r.status,0);assert.equal(j(r).status,'CONCURRENCY_GROUP_ALREADY_ACTIVE');stopGroup(z,s)});
test('stale dead global lock is recovered before group start',()=>{const z=makePair(),p=preparePlan(z),lf=path.join(z.x.r,'.aledevos/state/execution/phase3/control.lock');fs.mkdirSync(path.dirname(lf),{recursive:true});write(lf,{pid:999999999,created_at:new Date(Date.now()-60000).toISOString()});const s=startGroup(z,p);assert.equal(s.r.status,0,s.r.stdout+s.r.stderr);assert.equal(s.data.group.state,'RUNNING');stopGroup(z,s)});
test('group file tamper is detected',()=>{const z=makePair(),p=preparePlan(z),s=startGroup(z,p),q=read(s.file);q.state='STOPPED';write(s.file,q);const r=run(p3,['group','status','--repo',z.x.r,'--group',s.file]);assert.notEqual(r.status,0);assert.ok(j(r).errors.includes('GROUP_INTEGRITY_INVALID'));for(const w of Object.values(s.data.group.workers))try{process.kill(w.pid,'SIGKILL')}catch{}});
test('lost worker degrades group without killing healthy peer',()=>{const z=makePair(),p=preparePlan(z),s=startGroup(z,p),ws=Object.values(s.data.group.workers);process.kill(ws[0].pid,'SIGKILL');pids.delete(ws[0].pid);Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,120);const r=run(p3,['group','status','--repo',z.x.r,'--group',s.file]);assert.notEqual(r.status,0);assert.ok(j(r).errors.some(e=>e.startsWith('PROCESS_LOST:')));let peerAlive=true;try{process.kill(ws[1].pid,0)}catch{peerAlive=false}assert.equal(peerAlive,true);try{process.kill(ws[1].pid,'SIGTERM')}catch{}});
test('lost worker can recover independently once',()=>{const z=makePair(),p=preparePlan(z),s=startGroup(z,p),ws=Object.values(s.data.group.workers),lost=ws[0];process.kill(lost.pid,'SIGKILL');pids.delete(lost.pid);Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,120);const r=run(p3,['worker','recover','--repo',z.x.r,'--group',s.file,'--worker-id',Object.keys(s.data.group.workers)[0]]);assert.equal(r.status,0,r.stdout);const d=j(r);pids.add(d.group.workers[d.worker_id].pid);assert.equal(d.group.workers[d.worker_id].recovery_count,1);stopGroup(z,{...s,data:{group:d.group}})});
test('healthy worker refuses recovery',()=>{const z=makePair(),p=preparePlan(z),s=startGroup(z,p),id=Object.keys(s.data.group.workers)[0],r=run(p3,['worker','recover','--repo',z.x.r,'--group',s.file,'--worker-id',id]);assert.notEqual(r.status,0);assert.equal(j(r).status,'CONCURRENCY_RECOVERY_NOT_REQUIRED');stopGroup(z,s)});
test('unknown worker recovery fails closed',()=>{const z=makePair(),p=preparePlan(z),s=startGroup(z,p),r=run(p3,['worker','recover','--repo',z.x.r,'--group',s.file,'--worker-id','worker-missing']);assert.notEqual(r.status,0);assert.ok(j(r).errors.includes('WORKER_NOT_IN_GROUP'));stopGroup(z,s)});

// Freeze and certification.
test('P1 certificate remains valid',()=>assert.equal(run(p1,['certify','verify','--certificate',certP1]).status,0));
test('P2 certificate remains valid',()=>assert.equal(run(p2,['certify','verify','--certificate',certP2]).status,0));
test('P2 policy remains sequential and unchanged semantically',()=>{const p=read(path.join(root,'advanced-execution/policies/worker-policy.json')).rules;assert.equal(p.concurrency_enabled,false);assert.equal(p.max_active_workers,1)});
test('P3 manager contains no adapter/provider names',()=>{const s=fs.readFileSync(p3,'utf8').toLowerCase();for(const n of ['opencode','codex','claude','antigravity','gemini'])assert.equal(s.includes(n),false,n)});
test('P3 does not import network modules',()=>{const s=fs.readFileSync(p3,'utf8');for(const n of ['node:http','node:https','node:net','node:dgram'])assert.equal(s.includes(n),false,n)});
test('advanced execution recursive installer already covers P3',()=>{const s=fs.readFileSync(path.join(root,'scripts/05-install-into-project.ps1'),'utf8');assert.match(s,/advanced-execution/);assert.match(s,/Recurse/)});
test('installed execution layout can verify P3 policy',()=>{const d=tmp(),ale=path.join(d,'.aledevos','execution');fs.cpSync(path.join(root,'advanced-execution'),ale,{recursive:true});const m=path.join(ale,'concurrency','concurrency-manager.mjs'),r=run(m,['policy','verify'],d);assert.equal(r.status,0,r.stdout);assert.equal(j(r).status,'CONCURRENCY_POLICY_VALID')});
test('P3 package certificate can be generated and verified',()=>{const d=tmp(),f=path.join(d,'p3cert.json'),r=run(p3,['certify','run','--out',f]);assert.equal(r.status,0,r.stdout);assert.equal(j(r).status,'ADVANCED_EXECUTION_P3_PACKAGE_CERTIFIED');const v=run(p3,['certify','verify','--certificate',f]);assert.equal(v.status,0,v.stdout);assert.equal(j(v).status,'ADVANCED_EXECUTION_P3_CERTIFICATE_VALID')});
test('P3 certificate truthfully defers dispatcher queue multi-machine and target agent runtime',()=>{const d=tmp(),f=path.join(d,'p3cert.json');assert.equal(run(p3,['certify','run','--out',f]).status,0);const c=read(f);assert.equal(c.claims.multi_worker_local_concurrency,true);assert.equal(c.claims.dispatcher_disabled,true);assert.equal(c.claims.queue_disabled,true);assert.equal(c.claims.multi_machine_disabled,true);assert.equal(c.claims.target_agent_runtime_binding,false)});
test('P3 certificate tamper is detected',()=>{const d=tmp(),f=path.join(d,'p3cert.json');assert.equal(run(p3,['certify','run','--out',f]).status,0);const c=read(f);c.claims.network_disabled=false;write(f,c);const r=run(p3,['certify','verify','--certificate',f]);assert.notEqual(r.status,0);assert.ok(j(r).errors.includes('CERTIFICATE_INTEGRITY_MISMATCH'))});
test('rehashing forged P3 certificate cannot hide input drift',()=>{const d=tmp(),f=path.join(d,'p3cert.json');assert.equal(run(p3,['certify','run','--out',f]).status,0);const c=read(f);c.inputs[0].sha256='0'.repeat(64);c.evidence_sha256=hashObj(c,'evidence_sha256');write(f,c);const r=run(p3,['certify','verify','--certificate',f]);assert.notEqual(r.status,0);assert.ok(j(r).errors.some(e=>e.startsWith('INPUT_DRIFT:')))});
