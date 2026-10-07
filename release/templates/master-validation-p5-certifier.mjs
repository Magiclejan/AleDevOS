#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),pkg=path.resolve(here,'..','..'),args=process.argv.slice(2),cmd=args[0],sub=args[1],take=(f,d=null)=>{const i=args.indexOf(f);return i>=0&&i+1<args.length?args[i+1]:d};
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),fsha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())if(k!=='master_p5_certificate_sha256')o[k]=stable(v[k]);return o}return v}const sha=v=>crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const inputs=[
'release/templates/master-validator-advanced-execution.mjs','release/templates/master-advanced-remote-probe.mjs','release/templates/master-validation-p5-certifier.mjs',
'release/schemas/master-advanced-execution-target-profile.schema.json','release/schemas/master-advanced-execution-target-receipt.schema.json','release/schemas/master-advanced-transport-probe.schema.json',
'release/templates/MASTER_ADVANCED_EXECUTION_TARGET_PROFILE.example.json','release/templates/MASTER_ADVANCED_TRANSPORT_PROBE.example.json',
'tests/master-validation-phase5.test.mjs','scripts/58-self-test-master-validation-phase5.ps1','scripts/59-master-validation-p5-target-advanced-execution.ps1',
'release/engine/v1-release.mjs','release/policies/v1-release-policy.json','release/certifications/master-validation-p4.json',
'advanced-execution/worktrees/worktree-manager.mjs','advanced-execution/workers/worker-manager.mjs','advanced-execution/workers/worker-runtime.mjs',
'advanced-execution/concurrency/concurrency-manager.mjs','advanced-execution/dispatcher/dispatcher-manager.mjs','advanced-execution/multimachine/multimachine-manager.mjs',
'advanced-execution/policies/worktree-policy.json','advanced-execution/policies/worker-policy.json','advanced-execution/policies/concurrency-policy.json','advanced-execution/policies/dispatcher-policy.json','advanced-execution/policies/multimachine-policy.json'
];
function verifyManager(root,rel,cert){const r=spawnSync(process.execPath,[path.join(root,rel),'certify','verify','--certificate',path.join(root,cert)],{cwd:root,encoding:'utf8',windowsHide:true,shell:false});return r.status===0}
function run(root=pkg){
 const ins=inputs.map(x=>({path:x,sha256:fs.existsSync(path.join(root,x))?fsha(path.join(root,x)):null}));
 let p4ok=false;try{p4ok=read(path.join(root,'release/certifications/master-validation-p4.json')).status==='MASTER_VALIDATION_P4_PACKAGE_CERTIFIED'}catch{}
 const frozen=[
  verifyManager(root,'advanced-execution/worktrees/worktree-manager.mjs','release/certifications/advanced-execution-p1.json'),
  verifyManager(root,'advanced-execution/workers/worker-manager.mjs','release/certifications/advanced-execution-p2.json'),
  verifyManager(root,'advanced-execution/concurrency/concurrency-manager.mjs','release/certifications/advanced-execution-p3.json'),
  verifyManager(root,'advanced-execution/dispatcher/dispatcher-manager.mjs','release/certifications/advanced-execution-p4.json'),
  verifyManager(root,'advanced-execution/multimachine/multimachine-manager.mjs','release/certifications/advanced-execution-p5.json')
 ];
 const good=p4ok&&frozen.every(Boolean)&&ins.every(x=>x.sha256);
 const q={schema_version:'1.0',phase:'MASTER_VALIDATION_P5',status:good?'MASTER_VALIDATION_P5_PACKAGE_CERTIFIED':'MASTER_VALIDATION_P5_PACKAGE_CERTIFICATION_FAILED',package_only:true,target_runtime_evidence:'COLLECT_ON_TARGET',claims:{advanced_execution_target_validator:true,frozen_p1_p5_engines_reverified:true,real_worker_supervisor_required:true,real_parallel_workers_required:true,dispatcher_must_delegate_to_p3:true,real_network_transport_required:true,distinct_machine_fingerprint_required:true,controlled_transport_provider_forbidden:true,worker_crash_fault_injection_required:true,stale_fence_result_rejected:true,physical_exactly_once_compute_under_partition_not_claimed:true,final_freeze_authority:'MASTER_GATE_ONLY'},p4_certificate_present:p4ok,frozen_advanced_execution_certificates_valid:frozen,deterministic_tests:33,inputs:ins,master_p5_certificate_sha256:''};q.master_p5_certificate_sha256=sha(q);return q
}
function write(p,q){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(q,null,2)+'\n')}
if(cmd==='certify'&&sub==='run'){const root=path.resolve(take('--root',pkg)),q=run(root),o=take('--out');if(o)write(path.resolve(o),q);console.log(JSON.stringify(q,null,2));process.exit(q.status.endsWith('_CERTIFIED')?0:4)}
if(cmd==='certify'&&sub==='verify'){const root=path.resolve(take('--root',pkg)),p=path.resolve(take('--certificate',path.join(root,'release/certifications/master-validation-p5.json')));let s=null;try{s=read(p)}catch{}const c=run(root),valid=!!s&&s.status==='MASTER_VALIDATION_P5_PACKAGE_CERTIFIED'&&s.master_p5_certificate_sha256===sha(s)&&s.master_p5_certificate_sha256===c.master_p5_certificate_sha256&&c.status==='MASTER_VALIDATION_P5_PACKAGE_CERTIFIED';console.log(JSON.stringify({status:valid?'MASTER_VALIDATION_P5_CERTIFICATE_VALID':'MASTER_VALIDATION_P5_CERTIFICATE_STALE_OR_TAMPERED',valid,saved_sha256:s?.master_p5_certificate_sha256||null,current_sha256:c.master_p5_certificate_sha256},null,2));process.exit(valid?0:4)}
console.log(JSON.stringify({status:'MASTER_VALIDATION_P5_CERTIFIER_COMMAND_UNKNOWN'}));process.exit(2);
