import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const manager=path.join(root,'advanced-execution/worktrees/worktree-manager.mjs');
const policyFile=path.join(root,'advanced-execution/policies/worktree-policy.json');
const run=(argv,cwd=root,script=manager)=>spawnSync(process.execPath,[script,...argv],{cwd,encoding:'utf8'});
const j=r=>JSON.parse(r.stdout||'{}');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const write=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n');
const g=(cwd,args)=>spawnSync('git',args,{cwd,encoding:'utf8'});
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-ae-p1-'));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).filter(k=>!['receipt_sha256','evidence_sha256'].includes(k)).sort().map(k=>[k,stable(v[k])])):v;
const hashObj=v=>crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
function repo(){
 const d=tmp(),r=path.join(d,'repo');fs.mkdirSync(r);assert.equal(g(r,['init','-q']).status,0);g(r,['config','user.email','test@example.com']);g(r,['config','user.name','AleDevOS Test']);fs.writeFileSync(path.join(r,'app.txt'),'base\n');g(r,['add','app.txt']);assert.equal(g(r,['commit','-qm','initial']).status,0);return{d,r};
}
function prep(x,task='task-1',base='HEAD'){x.req=path.join(x.d,`${task}-request.json`);const p=run(['request','prepare','--repo',x.r,'--task-id',task,'--base-ref',base,'--out',x.req]);assert.equal(p.status,0,p.stdout+p.stderr);x.prep=j(p);return x}
function create(x,task='task-1'){x.receipt=path.join(x.d,`${task}-receipt.json`);const r=run(['worktree','create','--repo',x.r,'--request',x.req,'--out',x.receipt]);assert.equal(r.status,0,r.stdout+r.stderr);x.created=j(r);x.wt=x.created.worktree.path;return x}
function cleanCommit(wt,msg='worker commit'){g(wt,['add','-A']);assert.equal(g(wt,['commit','-qm',msg]).status,0)}

// Policy and phase boundaries.
test('P1 policy verifies',()=>assert.equal(run(['policy','verify']).status,0));
test('P1 phase is exact',()=>assert.equal(read(policyFile).phase,'ADVANCED_EXECUTION_P1_WORKTREES'));
test('primary checkout is mandatory',()=>assert.equal(read(policyFile).rules.require_primary_checkout,true));
test('clean primary is mandatory',()=>assert.equal(read(policyFile).rules.require_clean_primary,true));
test('pinned base commit is mandatory',()=>assert.equal(read(policyFile).rules.require_pinned_base_commit,true));
test('branch is AleDevOS-derived',()=>assert.equal(read(policyFile).rules.derive_branch_name,true));
test('worktree path is AleDevOS-derived',()=>assert.equal(read(policyFile).rules.derive_worktree_path,true));
test('branch reuse is forbidden',()=>assert.equal(read(policyFile).rules.allow_existing_branch_reuse,false));
test('existing target path is forbidden',()=>assert.equal(read(policyFile).rules.allow_existing_target_path,false));
test('force cleanup is forbidden',()=>assert.equal(read(policyFile).rules.allow_force_remove,false));
test('cleanup preserves branch',()=>assert.equal(read(policyFile).rules.cleanup_deletes_branch,false));
test('network is disabled in P1',()=>assert.equal(read(policyFile).rules.network_used,false));
test('worker execution is disabled in P1',()=>assert.equal(read(policyFile).rules.worker_execution_enabled,false));
test('concurrency is disabled in P1',()=>assert.equal(read(policyFile).rules.concurrency_enabled,false));
test('dispatcher and queue are disabled in P1',()=>{const p=read(policyFile).rules;assert.equal(p.dispatcher_enabled,false);assert.equal(p.queue_enabled,false)});
test('multi-machine is disabled in P1',()=>assert.equal(read(policyFile).rules.multi_machine_enabled,false));

// Real Git preflight.
test('clean primary repo passes preflight',()=>{const x=repo(),r=run(['preflight','check','--repo',x.r]);assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(j(r).status,'WORKTREE_PREFLIGHT_PASS')});
test('non-repository blocks preflight',()=>{const d=tmp(),r=run(['preflight','check','--repo',d]);assert.equal(r.status,5);assert.ok(j(r).errors.includes('NOT_A_GIT_WORKTREE'))});
test('repository subdirectory is not accepted as primary root',()=>{const x=repo(),s=path.join(x.r,'sub');fs.mkdirSync(s);const r=run(['preflight','check','--repo',s]);assert.equal(r.status,5);assert.ok(j(r).errors.includes('REPOSITORY_ROOT_REQUIRED'))});
test('dirty primary blocks preflight',()=>{const x=repo();fs.appendFileSync(path.join(x.r,'app.txt'),'dirty\n');const r=run(['preflight','check','--repo',x.r]);assert.equal(r.status,5);assert.ok(j(r).errors.includes('PRIMARY_WORKTREE_DIRTY'))});
test('detached primary blocks preflight',()=>{const x=repo();g(x.r,['checkout','--detach','-q']);const r=run(['preflight','check','--repo',x.r]);assert.equal(r.status,5);assert.ok(j(r).errors.includes('ATTACHED_PRIMARY_BRANCH_REQUIRED'))});
test('bare repository blocks preflight',()=>{const d=tmp(),b=path.join(d,'bare.git');assert.equal(g(d,['init','--bare','-q',b]).status,0);const r=run(['preflight','check','--repo',b]);assert.equal(r.status,5);assert.ok(j(r).errors.includes('BARE_REPOSITORY_UNSUPPORTED'))});
test('linked worktree cannot provision another P1 worktree',()=>{const x=repo(),linked=path.join(x.d,'linked');assert.equal(g(x.r,['worktree','add','-q','-b','manual-linked',linked]).status,0);const r=run(['preflight','check','--repo',linked]);assert.equal(r.status,5);assert.ok(j(r).errors.includes('PRIMARY_CHECKOUT_REQUIRED'))});
test('ongoing Git operation blocks preflight',()=>{const x=repo();const p=g(x.r,['rev-parse','--git-path','MERGE_HEAD']).stdout.trim();fs.writeFileSync(path.resolve(x.r,p),g(x.r,['rev-parse','HEAD']).stdout.trim()+'\n');const r=run(['preflight','check','--repo',x.r]);assert.equal(r.status,5);assert.ok(j(r).errors.some(e=>e.includes('GIT_OPERATION_IN_PROGRESS')))});

// Request preparation/pinning.
test('request prepare pins exact HEAD commit',()=>{const x=prep(repo());assert.equal(read(x.req).base_commit,g(x.r,['rev-parse','HEAD']).stdout.trim())});
test('request stores repository identity',()=>{const x=prep(repo());assert.match(read(x.req).repository_identity_sha256,/^[0-9a-f]{64}$/)});
test('prepared request verifies while repo is unchanged',()=>{const x=prep(repo());assert.equal(run(['request','verify','--repo',x.r,'--request',x.req]).status,0)});
test('task path traversal is rejected',()=>{const x=repo(),r=run(['request','prepare','--repo',x.r,'--task-id','../escape','--out',path.join(x.d,'r.json')]);assert.equal(r.status,3);assert.ok(j(r).errors.includes('TASK_ID_INVALID'))});
test('double-dot task id is rejected',()=>{const x=repo(),r=run(['request','prepare','--repo',x.r,'--task-id','task..escape','--out',path.join(x.d,'r.json')]);assert.equal(r.status,3)});
test('option-looking base ref is rejected',()=>{const x=repo(),r=run(['request','prepare','--repo',x.r,'--task-id','safe','--base-ref','--help','--out',path.join(x.d,'r.json')]);assert.equal(r.status,3);assert.ok(j(r).errors.includes('BASE_REF_INVALID'))});
test('unknown base ref is rejected',()=>{const x=repo(),r=run(['request','prepare','--repo',x.r,'--task-id','safe','--base-ref','missing-ref','--out',path.join(x.d,'r.json')]);assert.equal(r.status,3);assert.ok(j(r).errors.includes('BASE_REF_UNRESOLVABLE'))});
test('request cannot inject branch name',()=>{const x=prep(repo()),q=read(x.req);q.branch_name='evil';write(x.req,q);const r=run(['request','verify','--repo',x.r,'--request',x.req]);assert.equal(r.status,5);assert.ok(j(r).errors.includes('USER_CONTROLLED_BRANCH_NAME_FORBIDDEN'))});
test('request cannot inject worktree path',()=>{const x=prep(repo()),q=read(x.req);q.worktree_path='/tmp/evil';write(x.req,q);const r=run(['request','verify','--repo',x.r,'--request',x.req]);assert.equal(r.status,5);assert.ok(j(r).errors.includes('USER_CONTROLLED_WORKTREE_PATH_FORBIDDEN'))});
test('primary HEAD drift makes request stale',()=>{const x=prep(repo());fs.writeFileSync(path.join(x.r,'later.txt'),'later\n');g(x.r,['add','later.txt']);g(x.r,['commit','-qm','later']);const r=run(['request','verify','--repo',x.r,'--request',x.req]);assert.equal(r.status,5);assert.ok(j(r).errors.includes('PRIMARY_HEAD_DRIFT'))});
test('base ref drift makes request stale',()=>{const x=repo();g(x.r,['branch','base']);prep(x,'task-base','base');g(x.r,['checkout','-qb','tmp']);fs.writeFileSync(path.join(x.r,'b.txt'),'b\n');g(x.r,['add','b.txt']);g(x.r,['commit','-qm','b']);g(x.r,['branch','-f','base','HEAD']);g(x.r,['checkout','-q','master']);const r=run(['request','verify','--repo',x.r,'--request',x.req]);assert.equal(r.status,5);assert.ok(j(r).errors.includes('BASE_REF_DRIFT'))});

// Real worktree creation and isolation.
test('worktree create uses deterministic task branch',()=>{const x=create(prep(repo(),'alpha'),'alpha');assert.equal(x.created.worktree.branch,'aledevos/task/alpha')});
test('worktree create places target outside repository',()=>{const x=create(prep(repo(),'alpha'),'alpha');assert.equal(x.wt.startsWith(x.r+path.sep),false);assert.ok(x.wt.includes('.aledevos-worktrees'))});
test('created worktree starts at pinned base commit',()=>{const x=create(prep(repo(),'alpha'),'alpha');assert.equal(g(x.wt,['rev-parse','HEAD']).stdout.trim(),read(x.req).base_commit)});
test('primary HEAD is unchanged by provisioning',()=>{const x=repo(),head=g(x.r,['rev-parse','HEAD']).stdout.trim();create(prep(x,'alpha'),'alpha');assert.equal(g(x.r,['rev-parse','HEAD']).stdout.trim(),head)});
test('primary remains clean after provisioning',()=>{const x=create(prep(repo(),'alpha'),'alpha');assert.equal(g(x.r,['status','--porcelain']).stdout.trim(),'')});
test('task edit does not modify primary working tree',()=>{const x=create(prep(repo(),'alpha'),'alpha');fs.writeFileSync(path.join(x.wt,'app.txt'),'worker\n');assert.equal(fs.readFileSync(path.join(x.r,'app.txt'),'utf8'),'base\n')});
test('untracked task file does not appear in primary',()=>{const x=create(prep(repo(),'alpha'),'alpha');fs.writeFileSync(path.join(x.wt,'only-worker.txt'),'x');assert.equal(fs.existsSync(path.join(x.r,'only-worker.txt')),false)});
test('two provisioned worktrees stay isolated without executing workers',()=>{const x=repo();prep(x,'one');const req1=x.req;const rec1=path.join(x.d,'one-receipt.json');let r=run(['worktree','create','--repo',x.r,'--request',req1,'--out',rec1]);assert.equal(r.status,0);prep(x,'two');const req2=x.req,rec2=path.join(x.d,'two-receipt.json');r=run(['worktree','create','--repo',x.r,'--request',req2,'--out',rec2]);assert.equal(r.status,0);const a=read(rec1).worktree.path,b=read(rec2).worktree.path;fs.writeFileSync(path.join(a,'only-a.txt'),'a');assert.equal(fs.existsSync(path.join(b,'only-a.txt')),false);assert.equal(fs.existsSync(path.join(x.r,'only-a.txt')),false)});
test('creation receipt exposes all disabled P1 boundaries',()=>{const x=create(prep(repo(),'alpha'),'alpha'),b=x.created.boundaries;for(const k of ['network_used','worker_started','concurrency_used','dispatcher_used','queue_used','multi_machine_used'])assert.equal(b[k],false)});
test('fresh creation receipt verifies against Git state',()=>{const x=create(prep(repo(),'alpha'),'alpha');assert.equal(run(['worktree','verify','--receipt',x.receipt,'--repo',x.r,'--request',x.req]).status,0)});
test('receipt stays valid after worker-side commit',()=>{const x=create(prep(repo(),'alpha'),'alpha');fs.appendFileSync(path.join(x.wt,'app.txt'),'worker\n');cleanCommit(x.wt);assert.equal(run(['worktree','verify','--receipt',x.receipt,'--repo',x.r]).status,0)});
test('worktree inspect reports dirty worker tree',()=>{const x=create(prep(repo(),'alpha'),'alpha');fs.appendFileSync(path.join(x.wt,'app.txt'),'worker\n');const r=run(['worktree','inspect','--receipt',x.receipt,'--repo',x.r]);assert.equal(r.status,0);assert.equal(j(r).clean,false)});
test('branch reuse is blocked even after worktree exists',()=>{const x=create(prep(repo(),'alpha'),'alpha');const r=run(['worktree','create','--repo',x.r,'--request',x.req,'--out',path.join(x.d,'again.json')]);assert.equal(r.status,5);assert.ok(j(r).errors.some(e=>['TARGET_PATH_EXISTS','TASK_BRANCH_ALREADY_EXISTS'].includes(e)))});
test('existing deterministic target path blocks creation',()=>{const x=prep(repo(),'alpha'),target=x.prep.derived.worktree_path;fs.mkdirSync(target,{recursive:true});const r=run(['worktree','create','--repo',x.r,'--request',x.req,'--out',path.join(x.d,'rec.json')]);assert.equal(r.status,5);assert.ok(j(r).errors.includes('TARGET_PATH_EXISTS'))});

// Receipt tamper resistance.
test('receipt direct tamper is detected',()=>{const x=create(prep(repo(),'alpha'),'alpha'),o=read(x.receipt);o.boundaries.network_used=true;write(x.receipt,o);const r=run(['worktree','verify','--receipt',x.receipt]);assert.equal(r.status,5);assert.ok(j(r).errors.includes('RECEIPT_INTEGRITY_MISMATCH'))});
test('rehashed network boundary tamper is rejected',()=>{const x=create(prep(repo(),'alpha'),'alpha'),o=read(x.receipt);o.boundaries.network_used=true;o.receipt_sha256=hashObj(o);write(x.receipt,o);const r=run(['worktree','verify','--receipt',x.receipt]);assert.equal(r.status,5);assert.ok(j(r).errors.includes('BOUNDARY_NETWORK_USED_INVALID'))});
test('rehashed target path tamper is rejected against live repo',()=>{const x=create(prep(repo(),'alpha'),'alpha'),o=read(x.receipt);o.worktree.path=path.join(x.d,'evil');o.receipt_sha256=hashObj(o);write(x.receipt,o);const r=run(['worktree','verify','--receipt',x.receipt,'--repo',x.r]);assert.equal(r.status,5);assert.ok(j(r).errors.includes('WORKTREE_PATH_DRIFT'))});
test('request drift after creation is detected',()=>{const x=create(prep(repo(),'alpha'),'alpha'),q=read(x.req);q.prepared_at='changed';write(x.req,q);const r=run(['worktree','verify','--receipt',x.receipt,'--request',x.req]);assert.equal(r.status,5);assert.ok(j(r).errors.includes('REQUEST_HASH_DRIFT'))});
test('primary HEAD drift after creation is detected',()=>{const x=create(prep(repo(),'alpha'),'alpha');fs.writeFileSync(path.join(x.r,'main.txt'),'main\n');g(x.r,['add','main.txt']);g(x.r,['commit','-qm','main drift']);const r=run(['worktree','verify','--receipt',x.receipt,'--repo',x.r]);assert.equal(r.status,5);assert.ok(j(r).errors.includes('PRIMARY_HEAD_DRIFT'))});

// Non-destructive cleanup.
test('dirty task worktree blocks cleanup',()=>{const x=create(prep(repo(),'alpha'),'alpha');fs.appendFileSync(path.join(x.wt,'app.txt'),'dirty\n');const r=run(['worktree','cleanup','--receipt',x.receipt,'--repo',x.r,'--out',path.join(x.d,'cleanup.json')]);assert.equal(r.status,5);assert.equal(j(r).status,'WORKTREE_CLEANUP_BLOCKED_DIRTY')});
test('clean task worktree can be removed',()=>{const x=create(prep(repo(),'alpha'),'alpha'),c=path.join(x.d,'cleanup.json');const r=run(['worktree','cleanup','--receipt',x.receipt,'--repo',x.r,'--out',c]);assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(fs.existsSync(x.wt),false)});
test('cleanup preserves task branch',()=>{const x=create(prep(repo(),'alpha'),'alpha'),c=path.join(x.d,'cleanup.json');run(['worktree','cleanup','--receipt',x.receipt,'--repo',x.r,'--out',c]);assert.equal(g(x.r,['show-ref','--verify','--quiet','refs/heads/aledevos/task/alpha']).status,0)});
test('cleanup receipt verifies against live repo',()=>{const x=create(prep(repo(),'alpha'),'alpha'),c=path.join(x.d,'cleanup.json');run(['worktree','cleanup','--receipt',x.receipt,'--repo',x.r,'--out',c]);assert.equal(run(['cleanup','verify','--cleanup',c,'--receipt',x.receipt,'--repo',x.r]).status,0)});
test('cleanup receipt tamper is detected',()=>{const x=create(prep(repo(),'alpha'),'alpha'),c=path.join(x.d,'cleanup.json');run(['worktree','cleanup','--receipt',x.receipt,'--repo',x.r,'--out',c]);const o=read(c);o.boundaries.force_remove_used=true;write(c,o);assert.equal(run(['cleanup','verify','--cleanup',c]).status,5)});
test('rehashed destructive cleanup claim is rejected',()=>{const x=create(prep(repo(),'alpha'),'alpha'),c=path.join(x.d,'cleanup.json');run(['worktree','cleanup','--receipt',x.receipt,'--repo',x.r,'--out',c]);const o=read(c);o.boundaries.branch_delete_used=true;o.receipt_sha256=hashObj(o);write(c,o);const r=run(['cleanup','verify','--cleanup',c]);assert.equal(r.status,5);assert.ok(j(r).errors.includes('CLEANUP_BOUNDARY_INVALID'))});
test('same task cannot be recreated after safe cleanup because branch is preserved',()=>{const x=create(prep(repo(),'alpha'),'alpha'),c=path.join(x.d,'cleanup.json');run(['worktree','cleanup','--receipt',x.receipt,'--repo',x.r,'--out',c]);const r=run(['worktree','create','--repo',x.r,'--request',x.req,'--out',path.join(x.d,'again.json')]);assert.equal(r.status,5);assert.ok(j(r).errors.includes('TASK_BRANCH_ALREADY_EXISTS'))});

test('Windows reserved task device name is rejected',()=>{const x=repo(),r=run(['request','prepare','--repo',x.r,'--task-id','CON','--out',path.join(x.d,'r.json')]);assert.equal(r.status,3);assert.ok(j(r).errors.includes('TASK_ID_INVALID'))});
test('task id ending in .lock is rejected before Git branch creation',()=>{const x=repo(),r=run(['request','prepare','--repo',x.r,'--task-id','feature.lock','--out',path.join(x.d,'r.json')]);assert.equal(r.status,3)});
test('task id ending in dot is rejected for cross-platform path safety',()=>{const x=repo(),r=run(['request','prepare','--repo',x.r,'--task-id','feature.','--out',path.join(x.d,'r.json')]);assert.equal(r.status,3)});
test('symlinked worktree container blocks creation',()=>{const x=prep(repo(),'alpha'),outside=path.join(x.d,'outside'),container=path.join(x.d,'.aledevos-worktrees');fs.mkdirSync(outside);fs.symlinkSync(outside,container,'dir');const r=run(['worktree','create','--repo',x.r,'--request',x.req,'--out',path.join(x.d,'rec.json')]);assert.equal(r.status,5);assert.ok(j(r).errors.includes('CONTAINER_IS_SYMLINK'))});
test('broken symlink at deterministic target counts as existing path',()=>{const x=prep(repo(),'alpha'),target=x.prep.derived.worktree_path;fs.mkdirSync(path.dirname(target),{recursive:true});fs.symlinkSync(path.join(x.d,'missing-target'),target);const r=run(['worktree','create','--repo',x.r,'--request',x.req,'--out',path.join(x.d,'rec.json')]);assert.equal(r.status,5);assert.ok(j(r).errors.includes('TARGET_PATH_EXISTS'))});

// Package certification, installation and structure.
test('P1 package certificate can be generated',()=>{const d=tmp(),f=path.join(d,'cert.json'),r=run(['certify','run','--out',f]);assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(j(r).status,'ADVANCED_EXECUTION_P1_PACKAGE_CERTIFIED')});
test('fresh P1 package certificate verifies',()=>{const d=tmp(),f=path.join(d,'cert.json');run(['certify','run','--out',f]);assert.equal(run(['certify','verify','--certificate',f]).status,0)});
test('P1 certificate paths are root-relative',()=>{const d=tmp(),f=path.join(d,'cert.json');run(['certify','run','--out',f]);for(const x of read(f).inputs)assert.equal(path.isAbsolute(x.path),false)});
test('P1 certificate defers target runtime validation',()=>{const d=tmp(),f=path.join(d,'cert.json');run(['certify','run','--out',f]);assert.equal(read(f).target_runtime_validation,'DEFERRED')});
test('P1 certificate tamper is detected',()=>{const d=tmp(),f=path.join(d,'cert.json');run(['certify','run','--out',f]);const c=read(f);c.claims.concurrency_disabled=false;write(f,c);assert.equal(run(['certify','verify','--certificate',f]).status,4)});
test('P1 policy drift invalidates certificate',()=>{const d=tmp(),f=path.join(d,'cert.json'),bak=fs.readFileSync(policyFile);run(['certify','run','--out',f]);try{fs.appendFileSync(policyFile,' ');assert.equal(run(['certify','verify','--certificate',f]).status,4)}finally{fs.writeFileSync(policyFile,bak)}});
test('installer forward-projects advanced execution recursively',()=>{const s=fs.readFileSync(path.join(root,'scripts/05-install-into-project.ps1'),'utf8');assert.match(s,/advanced-execution/);assert.match(s,/Get-ChildItem \$execSrc -Recurse -File/);assert.match(s,/execution\\phase1\\worktrees/)});
test('installed execution layout runs policy verification',()=>{const d=tmp(),exec=path.join(d,'.aledevos/execution');fs.cpSync(path.join(root,'advanced-execution'),exec,{recursive:true});const m=path.join(exec,'worktrees/worktree-manager.mjs');assert.equal(run(['policy','verify'],d,m).status,0)});
test('installed execution layout can provision a real worktree',()=>{const x=repo(),exec=path.join(x.r,'.aledevos/execution');fs.cpSync(path.join(root,'advanced-execution'),exec,{recursive:true});g(x.r,['add','.aledevos']);g(x.r,['commit','-qm','install execution']);const m=path.join(exec,'worktrees/worktree-manager.mjs'),req=path.join(x.d,'req.json'),rec=path.join(x.d,'rec.json');assert.equal(run(['request','prepare','--repo',x.r,'--task-id','installed','--out',req],x.r,m).status,0);assert.equal(run(['worktree','create','--repo',x.r,'--request',req,'--out',rec],x.r,m).status,0)});
test('worktree schemas parse',()=>{for(const f of ['worktree-request.schema.json','worktree-receipt.schema.json'])assert.doesNotThrow(()=>read(path.join(root,'advanced-execution/schemas',f)))});
test('worktree template parses',()=>assert.doesNotThrow(()=>read(path.join(root,'advanced-execution/templates/worktree-request.example.json'))));
test('worktree contract explicitly leaves workers for later phase',()=>assert.match(fs.readFileSync(path.join(root,'advanced-execution/contracts/WORKTREE_ISOLATION.md'),'utf8'),/does not start workers/i));
test('P1 manager is runtime/model agnostic',()=>{const s=fs.readFileSync(manager,'utf8').toLowerCase();for(const n of ['opencode','codex','claude','antigravity','gemini','openai','anthropic'])assert.equal(s.includes(n),false)});
