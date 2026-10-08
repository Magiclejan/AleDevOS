#!/usr/bin/env node
// Issue package-only P1–P5 evidence after approved source drift.
// This never attests target-runtime execution or overrides release gates.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=process.cwd();
const phases=[
 'advanced-execution/worktrees/worktree-manager.mjs',
 'advanced-execution/workers/worker-manager.mjs',
 'advanced-execution/concurrency/concurrency-manager.mjs',
 'advanced-execution/dispatcher/dispatcher-manager.mjs',
 'advanced-execution/multimachine/multimachine-manager.mjs'
];
const write=process.argv.includes('--write'),emit=process.argv.includes('--emit-contents');
const outputs=[];
for(let i=0;i<phases.length;i++){
 const p=i+1,cert='release/certifications/advanced-execution-p'+p+'.json';
 const opts=write?['certify','run','--out',path.join(root,cert)]:['certify','verify','--certificate',path.join(root,cert)];
 const r=spawnSync(process.execPath,[path.join(root,phases[i]),...opts],{cwd:root,encoding:'utf8',timeout:90000});
 if(r.status!==0){console.error('ADVANCED_CERT_PHASE_'+p+'_FAILED '+(r.stdout||r.stderr||r.error?.message));process.exit(r.status||4)}
 if(write){
  const v=spawnSync(process.execPath,[path.join(root,phases[i]),'certify','verify','--certificate',path.join(root,cert)],{cwd:root,encoding:'utf8',timeout:90000});
  if(v.status!==0){console.error('ADVANCED_CERT_PHASE_'+p+'_VERIFY_FAILED '+(v.stdout||v.stderr||v.error?.message));process.exit(v.status||4)}
 }
 const content=fs.readFileSync(path.join(root,cert),'utf8');
 const doc=JSON.parse(content);
 if(doc.package_only!==true||doc.target_runtime_validation!=='DEFERRED'||!doc.status.endsWith('PACKAGE_CERTIFIED'))throw Error('ADVANCED_CERT_FALSE_RUNTIME_CLAIM_OR_STATUS:'+p);
 const digest=crypto.createHash('sha256').update(content).digest('hex');
 outputs.push({phase:p,path:cert,digest,doc:emit?doc:undefined});
 console.log('ADVANCED_CERT_PHASE_'+p+'_PACKAGE_ONLY_VERIFIED sha256='+digest);
}
console.log('ADVANCED_CERT_REFRESH_RESULT '+JSON.stringify({status:'PACKAGE_ONLY_CHAINS_VALID',count:outputs.length,targets_deferred:true,outputs:outputs.map(({doc,...rest})=>rest)}));
if(emit)console.log('ADVANCED_CERT_REFRESH_PAYLOAD '+JSON.stringify(outputs.map(x=>({path:x.path,content:JSON.stringify(x.doc,null,2)+'\n'}))));
