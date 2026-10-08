#!/usr/bin/env node
// P36.3: reissue package-only source provenance after deliberate source changes.
// Never claims target-runtime evidence or allows a blocked V1 Master Gate to pass.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const args=process.argv.slice(2);
const write=args.includes('--reissue'),emit=args.includes('--emit-payload');
if(!write){console.error('P36_3_REISSUE_REQUIRED: run with --reissue; never silently rewrite evidence');process.exit(2)}
const rel=p=>p.replaceAll('\\','/');
const shaBytes=s=>crypto.createHash('sha256').update(s).digest('hex');
const hashFile=p=>shaBytes(fs.readFileSync(path.join(root,p)));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,''));
const save=(p,o)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),JSON.stringify(o,null,2)+'\n','utf8')};
function stable(v){
 if(Array.isArray(v))return v.map(stable);
 if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort()){
  if(!['master_evidence_sha256','master_report_sha256','master_certificate_sha256','baseline_sha256','manifest_sha256'].includes(k))o[k]=stable(v[k])
 }return o}
 return v
}
const masterSha=o=>shaBytes(Buffer.from(JSON.stringify(stable(o))));
const changed=[];
function invoke(script,argv,label){
 const c=spawnSync(process.execPath,[path.join(root,script),...argv],{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024,windowsHide:true,shell:false});
 if(c.status!==0){console.error('P36_3_CERTIFIER_BLOCKED '+label+' code='+c.status+' stdout='+(c.stdout||'').slice(-1300)+' stderr='+(c.stderr||'').slice(-1300));process.exit(c.status||4)}
 console.log('P36_3_CERTIFIER_VERIFIED '+label);
}
function certify(script,id,runArgs,verifyArgs){
 const cert='release/certifications/'+id+'.json',abs=path.join(root,cert);
 invoke(script,runArgs.concat(['--out',abs]),id+'/run');
 if(!fs.existsSync(abs))throw Error('CERTIFIER_DID_NOT_WRITE:'+id);
 invoke(script,verifyArgs.concat(['--certificate',abs]),id+'/verify');
 const obj=read(cert);
 if(!obj.status||!/CERTIFIED$/.test(obj.status)||!/^[a-f0-9]{64}$/.test(String(obj.evidence_sha256||obj.master_p2_certificate_sha256||obj.final_master_gate_certificate_sha256||''))){
  throw Error('CERTIFIER_RESULT_INVALID:'+id);
 }
 if(obj.package_only===false||obj.target_runtime_validation==='PASS'||obj.target_runtime_evidence==='VERIFIED')throw Error('FALSE_TARGET_CLAIM:'+id);
 changed.push(cert);
}
const advanced=[
 'advanced-execution/worktrees/worktree-manager.mjs',
 'advanced-execution/workers/worker-manager.mjs',
 'advanced-execution/concurrency/concurrency-manager.mjs',
 'advanced-execution/dispatcher/dispatcher-manager.mjs',
 'advanced-execution/multimachine/multimachine-manager.mjs'
];
for(let i=0;i<advanced.length;i++)certify(advanced[i],'advanced-execution-p'+(i+1),['certify','run'],['certify','verify']);
const adapters=[
 ['opencode','adapters/opencode/certification/opencode-certifier.mjs','opencode-portability-p2'],
 ['codex','adapters/codex/certification/codex-certifier.mjs','codex-portability-p3'],
 ['claude-code','adapters/claude-code/certification/claude-code-certifier.mjs','claude-code-portability-p4'],
 ['antigravity','adapters/antigravity/certification/antigravity-certifier.mjs','antigravity-portability-p5']
];
for(const [,script,id] of adapters)certify(script,id,['certify','run','--root',root],['certify','verify','--root',root]);
const multimodel=[
 'multimodel/engine/multimodel.mjs',
 'multimodel/router/model-router.mjs',
 'multimodel/extensions/diversity/judge-diversity.mjs',
 'multimodel/extensions/fallback/model-fallback.mjs'
];
for(let i=0;i<multimodel.length;i++)certify(multimodel[i],'multimodel-p'+(i+1),['certify','run'],['certify','verify']);
// Explain the exact P6 matrix blocker before trying to reissue its certificate.
const p6Matrix=spawnSync(process.execPath,[path.join(root,'portability/conformance/conformance.mjs'),'matrix','run','--root',root],{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});
if(p6Matrix.status!==0){
 let matrix;try{matrix=JSON.parse(p6Matrix.stdout)}catch{matrix=null}
 console.error('P36_3_P6_MATRIX_BLOCKED '+JSON.stringify({status:matrix?.status,failed:(matrix?.checks||[]).filter(x=>x.status==='FAIL'),adapters:matrix?.adapters,error:(p6Matrix.stderr||'').slice(-1000)}));
 process.exit(p6Matrix.status||4);
}
certify('portability/conformance/conformance.mjs','cross-adapter-portability-p6',['certify','run','--root',root],['certify','verify','--root',root]);
const manifest='release/templates/package-tree-manifest.json',baseline='release/templates/master-validation-package-baseline.json';
invoke('release/templates/package-tree-manifest.mjs',['generate','--root',root,'--out',path.join(root,manifest)],'package-tree/generate');
invoke('release/templates/package-tree-manifest.mjs',['verify','--root',root,'--out',path.join(root,manifest)],'package-tree/verify');
changed.push(manifest);
const saved=read(baseline);
if(saved.schema_version!=='1.0'||saved.certificate_count!==14||saved.certificates?.length!==14)throw Error('BASELINE_INVENTORY_UNEXPECTED');
for(const row of saved.certificates){
 const cert=read(row.path);
 if(!changed.includes(row.path))throw Error('UNREISSUED_CERTIFICATE:'+row.id);
 if(!/CERTIFIED$/.test(cert.status))throw Error('UNVERIFIED_CERTIFICATE_STATUS:'+row.id);
 row.status=cert.status;
 row.evidence_sha256=cert.evidence_sha256;
 if(!/^[a-f0-9]{64}$/.test(String(row.evidence_sha256||'')))throw Error('MISSING_EVIDENCE_HASH:'+row.id);
}
saved.package_tree_manifest_sha256=hashFile(manifest);
saved.source_attestation='Package-only source certificates were reissued through their canonical certifier run/verify commands after approved AleDevOS changes. Target execution, native-image observation and V1 freeze remain independent and unverified.';
saved.baseline_sha256=masterSha(saved);
save(baseline,saved);changed.push(baseline);
invoke('release/engine/v1-release.mjs',['master','package','--project-root',root],'master/package-valid');
invoke('release/engine/v1-release.mjs',['master','certify','--project-root',root,'--out',path.join(root,'release/certifications/master-validation-p1.json')],'master-p1/run');
invoke('release/engine/v1-release.mjs',['master','verify-certificate','--project-root',root,'--certificate',path.join(root,'release/certifications/master-validation-p1.json')],'master-p1/verify');
changed.push('release/certifications/master-validation-p1.json');
for(let i=2;i<=8;i++){
 const script='release/templates/master-validation-p'+i+'-certifier.mjs';
 invoke(script,['certify','run','--root',root,'--out',path.join(root,'release/certifications/master-validation-p'+i+'.json')],'master-p'+i+'/run');
 invoke(script,['certify','verify','--root',root,'--certificate',path.join(root,'release/certifications/master-validation-p'+i+'.json')],'master-p'+i+'/verify');
 changed.push('release/certifications/master-validation-p'+i+'.json');
}
invoke('release/templates/final-master-gate-certifier.mjs',['certify','run','--root',root,'--out',path.join(root,'release/certifications/final-master-gate.json')],'final-master-package/run');
invoke('release/templates/final-master-gate-certifier.mjs',['certify','verify','--root',root,'--certificate',path.join(root,'release/certifications/final-master-gate.json')],'final-master-package/verify');
changed.push('release/certifications/final-master-gate.json');
invoke('release/engine/v1-release.mjs',['master','matrix','--project-root',root],'master/matrix-package-ready');
console.log('P36_3_PROVENANCE_REISSUED '+JSON.stringify({source_only:true,files:changed.length,release_ready:false,pro_certified:0}));
if(emit){
 for(const file of changed){
  const content=fs.readFileSync(path.join(root,file));
  const data=content.toString('base64'),size=12000,total=Math.ceil(data.length/size);
  console.log('P36_3_PAYLOAD_START '+file+' '+total+' '+shaBytes(content));
  for(let i=0;i<total;i++)console.log('P36_3_PAYLOAD_CHUNK '+file+' '+i+' '+data.slice(i*size,(i+1)*size));
  console.log('P36_3_PAYLOAD_END '+file);
 }
}
