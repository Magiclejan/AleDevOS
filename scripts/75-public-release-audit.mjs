#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');

function runGit(args,{allow1=false}={}){
  const r=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024});
  if(r.error) throw r.error;
  if(r.status!==0 && !(allow1 && r.status===1)){
    throw new Error(`GIT_FAILED:${args.join(' ')}:exit=${r.status}\n${String(r.stderr||'').slice(0,800)}`);
  }
  return {status:r.status,stdout:String(r.stdout||''),stderr:String(r.stderr||'')};
}
function lines(s){return String(s).split(/\r?\n/).filter(Boolean)}
function add(list,severity,rule,location,ref='',count=1){
  list.push({severity,rule,location,ref,count});
}
function isNoReply(email){
  if(!email)return false;
  return /@users\.noreply\.github\.com$/i.test(email) ||
         /^noreply@github\.com$/i.test(email) ||
         /@github\.com$/i.test(email);
}
function safeOriginHost(origin){
  try{
    let u=origin;
    const sshPrefix=['git','github.com'].join('@')+':'; if(u.toLowerCase().startsWith(sshPrefix)) u='https://github.com/'+u.slice(sshPrefix.length);
    return new URL(u).host||'unknown';
  }catch{return 'unknown'}
}

process.chdir(root);
if(!fs.existsSync(path.join(root,'.git'))) throw new Error('PUBLIC_AUDIT_REQUIRES_GIT_CHECKOUT');

const skipFetch=process.argv.includes('--skip-fetch');
const snapshotOnly=process.argv.includes('--snapshot-only');
const origin=runGit(['remote','get-url','origin']).stdout.trim();
if(/https?:\/\/[^/@]+:[^/@]+@/i.test(origin)) throw new Error('PUBLIC_AUDIT_ORIGIN_EMBEDS_CREDENTIALS');

if(!skipFetch) runGit(['fetch','origin','--prune']);

const findings=[];
const dirty=lines(runGit(['status','--porcelain']).stdout);
if(dirty.length) add(findings,'REVIEW','LOCAL_WORKTREE_DIRTY','working-tree','',dirty.length);

// Commit identities become public with history.
const identitySeen=new Set();
const identityLogArgs=snapshotOnly
  ? ['log','-1','--format=%H%x09%an%x09%ae%x09%cn%x09%ce','HEAD']
  : ['log','--all','--format=%H%x09%an%x09%ae%x09%cn%x09%ce'];
for(const line of lines(runGit(identityLogArgs).stdout)){
  const [commit,an,ae,cn,ce]=line.split('\t');
  for(const [kind,name,email] of [['author',an,ae],['committer',cn,ce]]){
    if(!isNoReply(email)){
      const key=commit+'|'+kind;
      if(!identitySeen.has(key)){
        identitySeen.add(key);
        add(findings,'BLOCKER','NON_NOREPLY_COMMIT_IDENTITY',`commit:${commit}:${kind}`,commit,1);
      }
    }
  }
}

const refs=snapshotOnly
  ? ['HEAD']
  : lines(runGit(['for-each-ref','--format=%(refname)','refs/heads','refs/remotes/origin']).stdout).filter(x=>!x.endsWith('/HEAD'));
const uniqueRefs=[...new Set(refs)].sort();

const sensitiveName=/(^|\/)(\.env($|\.)|credentials\.json$|auth\.json$|id_rsa($|\.)|id_ed25519($|\.)|\.npmrc$|\.pypirc$|\.netrc$|\.git-credentials$|.*\.(pem|p12|pfx|key)$|\.ssh(\/|$)|\.aws(\/|$)|\.azure(\/|$)|\.kube(\/|$)|\.docker\/config\.json$)/i;
const opaque=/\.(zip|7z|rar|tar|tgz|gz|bz2|xz|db|sqlite|sqlite3)$/i;
const nameSeen=new Set();
for(const ref of uniqueRefs){
  for(const p0 of lines(runGit(['ls-tree','-r','--name-only',ref]).stdout)){
    const p=p0.replaceAll('\\','/');
    if(sensitiveName.test(p) && !/(^|\/)\.env\.example$/i.test(p)){
      const k='SENSITIVE_FILENAME|'+p;
      if(!nameSeen.has(k)){nameSeen.add(k);add(findings,'BLOCKER','SENSITIVE_FILENAME',p,ref,1)}
    }
    if(opaque.test(p)){
      const k='OPAQUE_CONTAINER_OR_DB|'+p;
      if(!nameSeen.has(k)){nameSeen.add(k);add(findings,'REVIEW','OPAQUE_CONTAINER_OR_DB',p,ref,1)}
    }
  }
}

const commits=snapshotOnly ? ['HEAD'] : lines(runGit(['rev-list','--all']).stdout);
if(!commits.length) throw new Error('PUBLIC_AUDIT_NO_COMMITS');

const rules=[
  ['BLOCKER','PRIVATE_KEY_BLOCK','-----BEGIN[[:space:]]+([A-Z0-9]+[[:space:]]+)?PRIVATE[[:space:]]+KEY-----'],
  ['BLOCKER','GITHUB_TOKEN','gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}'],
  ['BLOCKER','OPENAI_OR_ANTHROPIC_KEY','(^|[^A-Za-z0-9])sk-(proj-|ant-)?[A-Za-z0-9_-]{20,}'],
  ['BLOCKER','AWS_ACCESS_KEY','AKIA[0-9A-Z]{16}'],
  ['BLOCKER','GOOGLE_API_KEY','AIza[0-9A-Za-z_-]{35}'],
  ['BLOCKER','SLACK_TOKEN','xox[baprs]-[0-9A-Za-z-]{10,}'],
  ['BLOCKER','GITLAB_TOKEN','glpat-[A-Za-z0-9_-]{20,}'],
  ['BLOCKER','HUGGINGFACE_TOKEN','hf_[A-Za-z0-9]{20,}'],
  ['BLOCKER','NPM_TOKEN','npm_[A-Za-z0-9]{20,}'],
  ['BLOCKER','STRIPE_SECRET','(sk_live_|rk_live_)[0-9A-Za-z]{16,}'],
  ['BLOCKER','URL_EMBEDDED_CREDENTIALS','https?://[^/@[:space:]]+:[^/@[:space:]]+@'],
  ['BLOCKER','LITERAL_BEARER_TOKEN','Bearer[[:space:]]+[A-Za-z0-9._~+/-]{20,}={0,2}'],
  ['REVIEW','GENERIC_SECRET_ASSIGNMENT','(api[_-]?key|access[_-]?token|auth[_-]?token|secret|password|passwd|client[_-]?secret|private[_-]?key)[[:space:]]*[:=][[:space:]]*["' + "'" + '][^"' + "'" + ']{12,}["' + "'" + ']'],
  ['BLOCKER','WINDOWS_USER_PATH','[A-Za-z]:\\\\Users\\\\'],
  ['BLOCKER','MAC_USER_PATH','(^|[[:space:]"' + "'" + '=:(])/Users/[A-Za-z0-9._-]+/'],
  ['REVIEW','LINUX_HOME_PATH','(^|[[:space:]"' + "'" + '=:(])/home/[A-Za-z0-9._-]+/'],
  ['REVIEW','EMAIL_IN_REPO_CONTENT','[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}'],
  ['REVIEW','PRIVATE_IPV4','(10\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}|192\\.168\\.[0-9]{1,3}\\.[0-9]{1,3}|172\\.(1[6-9]|2[0-9]|3[01])\\.[0-9]{1,3}\\.[0-9]{1,3})'],
  ['REVIEW','FOREIGN_PROJECT_REFERENCE',[['SE','ROK'],['OR','NITH'],['Ale','Creator'],['Stra','ta-AleDevOS']].map(x=>x.join('')).join('|')]
];

const contentIndex=new Map();
for(const [severity,rule,pattern] of rules){
  const r=spawnSync('git',['grep','-I','-l','-E','-i','-e',pattern,...commits,'--'],{
    cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024
  });
  if(r.error) throw r.error;
  if(r.status!==0 && r.status!==1){
    throw new Error(`PUBLIC_AUDIT_GIT_GREP_FAILED:${rule}:exit=${r.status}`);
  }
  for(const hit of lines(r.stdout)){
    const split=hit.indexOf(':');
    if(split<1) continue;
    const commit=hit.slice(0,split);
    const file=hit.slice(split+1);
    if(rule==='EMAIL_IN_REPO_CONTENT'){
      const safe=spawnSync('git',['show',`${commit}:${file}`],{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});
      const body=String(safe.stdout||'');
      const emails=body.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)||[];
      if(emails.length>0 && emails.every(e=>(
        /@example\.com$/i.test(e) ||
        /@example\.(?:org|net)$/i.test(e) ||
        /@[^@]+\.invalid$/i.test(e) ||
        /@local\.invalid$/i.test(e)
      ))) continue;
    }
    const key=rule+'|'+file;
    const prev=contentIndex.get(key);
    if(prev) prev.count++;
    else contentIndex.set(key,{severity,rule,location:file,ref:commit,count:1});
  }
}
for(const v of contentIndex.values()) findings.push(v);

// Symlink absolute personal targets.
const symlinkSeen=new Set();
for(const ref of uniqueRefs){
  const listing=lines(runGit(['ls-tree','-r',ref]).stdout);
  for(const line of listing){
    const m=line.match(/^120000\s+blob\s+([0-9a-f]{40})\t(.+)$/);
    if(!m)continue;
    const [,blob,file]=m;
    const target=runGit(['cat-file','-p',blob]).stdout.trim();
    if(/^[A-Za-z]:\\Users\\/i.test(target)||/^\/Users\//.test(target)||/^\/home\//.test(target)){
      const k=file+'|'+blob;
      if(!symlinkSeen.has(k)){symlinkSeen.add(k);add(findings,'BLOCKER','SYMLINK_PERSONAL_ABSOLUTE_TARGET',file,ref,1)}
    }
  }
}

findings.sort((a,b)=>a.severity.localeCompare(b.severity)||a.rule.localeCompare(b.rule)||a.location.localeCompare(b.location)||a.ref.localeCompare(b.ref));
const blockers=findings.filter(x=>x.severity==='BLOCKER');
const reviews=findings.filter(x=>x.severity==='REVIEW');

const outDir=path.join(root,'.aledevos','state','public-release-audit');
fs.mkdirSync(outDir,{recursive:true});
const report={
  schema_version:'2.1',
  mode:snapshotOnly?'SNAPSHOT':'HISTORY',
  generated_at:new Date().toISOString(),
  repository:path.basename(root),
  origin_host:safeOriginHost(origin),
  refs_scanned:uniqueRefs.length,
  commits_scanned:commits.length,
  blocker_count:blockers.length,
  review_count:reviews.length,
  public_ready:blockers.length===0&&reviews.length===0,
  findings
};
fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify(report,null,2)+'\n','utf8');

console.log('');
console.log('============================================================');
console.log(' ALEDEVOS PUBLIC RELEASE AUDIT');
console.log('============================================================');
console.log('Mode            : '+(snapshotOnly?'SNAPSHOT':'HISTORY'));
console.log('Refs scanned    : '+uniqueRefs.length);
console.log('Commits scanned : '+commits.length);
console.log('Blockers        : '+blockers.length);
console.log('Review          : '+reviews.length);
console.log('Report          : .aledevos/state/public-release-audit/report.json');
if(findings.length){
  console.log('');
  console.log('Findings (matched values are NEVER printed):');
  for(const f of findings){
    console.log(`${f.severity}\t${f.rule}\t${f.location}\t${f.ref}\tcount=${f.count}`);
  }
}
if(blockers.length){
  console.log('');
  console.log(snapshotOnly?'PUBLIC_SNAPSHOT_AUDIT_BLOCKED':'PUBLIC_RELEASE_AUDIT_BLOCKED');
  process.exit(7);
}
if(reviews.length){
  console.log('');
  console.log(snapshotOnly?'PUBLIC_SNAPSHOT_AUDIT_REVIEW_REQUIRED':'PUBLIC_RELEASE_AUDIT_REVIEW_REQUIRED');
  process.exit(6);
}
console.log('');
console.log(snapshotOnly?'PUBLIC_SNAPSHOT_AUDIT_PASS':'PUBLIC_RELEASE_AUDIT_PASS');
