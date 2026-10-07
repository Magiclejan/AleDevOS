#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const argv=process.argv.slice(2), cmd=argv[0], sub=argv[1];
const take=(n,f=null)=>{const i=argv.indexOf(n);return i>=0&&argv[i+1]!==undefined?argv[i+1]:f};
const fail=(m,c=1)=>{console.error(m);process.exit(c)};
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const writeJson=(p,o)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n','utf8')};
const sha256Bytes=b=>crypto.createHash('sha256').update(b).digest('hex');
const sha256File=p=>sha256Bytes(fs.readFileSync(p));
const canonicalInstructionText=s=>String(s).replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
const sha256InstructionFile=p=>sha256Bytes(Buffer.from(canonicalInstructionText(fs.readFileSync(p,'utf8')),'utf8'));
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())o[k]=stable(v[k]);return o;}return v;}
const sha256Object=o=>sha256Bytes(Buffer.from(JSON.stringify(stable(o))));
const withoutIntegrity=o=>{const x=structuredClone(o);delete x.integrity;return x};
const safe=v=>String(v).replace(/[^a-zA-Z0-9._-]/g,'_');
const root=path.resolve(take('--project-root',process.cwd()));
const adapter=take('--adapter','opencode');
const policyPath=path.join(root,'.aledevos','skillsystem','policies','skill-policy.json');
const catalogPath=path.join(root,'.aledevos','skillsystem','acquisition','source-catalog.json');
const registryPath=path.join(root,'.aledevos','skills','registries',`${adapter}.json`);
const stateDir=path.join(root,'.aledevos','state','skills','acquisition');
const receiptDir=path.join(root,'.aledevos','skills','acquisitions');

function policy(){if(!fs.existsSync(policyPath))fail('SKILL_POLICY_NOT_FOUND',20);const p=readJson(policyPath);if(!p.acquisition?.enabled)fail('SKILL_ACQUISITION_DISABLED',21);return p;}
function catalog(){if(!fs.existsSync(catalogPath))fail('SKILL_SOURCE_CATALOG_NOT_FOUND',22);const c=readJson(catalogPath);if(c.schema_version!=='1.0'||!Array.isArray(c.entries))fail('INVALID_SKILL_SOURCE_CATALOG',23);return c;}
function registry(){if(!fs.existsSync(registryPath))fail('SKILL_REGISTRY_NOT_FOUND',24);return readJson(registryPath)}
function findSkill(id){return (registry().skills||[]).find(x=>x.id===id)||null}
function sourceFor(id){const c=catalog();return c.entries.find(x=>x.skill_id===id&&(!x.adapters||x.adapters.includes(adapter)))||null}
function plan(id){const p=policy(),s=findSkill(id);if(!s)fail(`UNKNOWN_SKILL:${id}`,25);if(s.runtime?.usable){const out={schema_version:'1.0',skill_id:id,adapter,status:'ALREADY_AVAILABLE',source:null,approval_required:false,reason:'registry_usable',created_at:new Date().toISOString(),integrity:{algorithm:'sha256',payload_sha256:''}};out.integrity.payload_sha256=sha256Object(withoutIntegrity(out));return out}
  const src=sourceFor(id);let status,approval=false,reason;
  if(src){const trusted=(p.acquisition.trusted_source_classes||[]).includes(src.source_class);status=trusted?'ACQUISITION_AUTO_APPROVED':'ACQUISITION_APPROVAL_REQUIRED';approval=!trusted;reason=trusted?'trusted_catalog_source':'catalog_source_requires_approval';}
  else {status='ACQUISITION_SOURCE_RESOLUTION_REQUIRED';approval=true;reason='no_catalog_source';}
  const out={schema_version:'1.0',skill_id:id,adapter,status,source:src,approval_required:approval,reason,created_at:new Date().toISOString(),integrity:{algorithm:'sha256',payload_sha256:''}};
  out.integrity.payload_sha256=sha256Object(withoutIntegrity(out));writeJson(path.join(stateDir,`${safe(id)}.plan.json`),out);return out;
}
function verifyPlan(id){const f=path.join(stateDir,`${safe(id)}.plan.json`);if(!fs.existsSync(f))return{valid:false,errors:['plan_missing']};const x=readJson(f),e=[];if(x.integrity?.payload_sha256!==sha256Object(withoutIntegrity(x)))e.push('plan_integrity_mismatch');if(x.skill_id!==id)e.push('skill_id_mismatch');if(x.adapter!==adapter)e.push('adapter_mismatch');return{valid:e.length===0,errors:e,artifact:x};}
function record(req){const p=policy(),id=req.skill_id;if(!id)fail('MISSING_SKILL_ID',30);const planv=verifyPlan(id);if(!planv.valid)fail(`ACQUISITION_PLAN_INVALID:${planv.errors.join(',')}`,31);if(planv.artifact.approval_required&&!req.approved)fail('ACQUISITION_APPROVAL_REQUIRED',32);if(req.status!=='INSTALLED')fail('ACQUISITION_NOT_INSTALLED',33);if(!req.instruction_path)fail('MISSING_INSTRUCTION_PATH',34);const abs=path.resolve(root,req.instruction_path);if(!abs.startsWith(root+path.sep)||!fs.existsSync(abs))fail('INSTALLED_SKILL_SOURCE_MISSING',35);const actual=sha256InstructionFile(abs);if(req.instruction_sha256&&req.instruction_sha256!==actual)fail('INSTALLED_SKILL_HASH_MISMATCH',36);
  const s=findSkill(id);if(!s?.runtime?.usable)fail('REGISTRY_NOT_USABLE_AFTER_ACQUISITION',37);
  const out={schema_version:'1.0',skill_id:id,adapter,status:'ACQUISITION_VERIFIED',source:req.source||planv.artifact.source||null,approved:!!req.approved,instruction_path:req.instruction_path,instruction_sha256:actual,registry_status:s.runtime.status,registry_usable:true,installed_at:new Date().toISOString(),integrity:{algorithm:'sha256',payload_sha256:''}};
  out.integrity.payload_sha256=sha256Object(withoutIntegrity(out));writeJson(path.join(receiptDir,`${safe(id)}.json`),out);return out;
}
function verifyReceipt(id){const f=path.join(receiptDir,`${safe(id)}.json`);if(!fs.existsSync(f))return{valid:false,errors:['receipt_missing']};const x=readJson(f),e=[];if(x.integrity?.payload_sha256!==sha256Object(withoutIntegrity(x)))e.push('receipt_integrity_mismatch');const abs=path.resolve(root,x.instruction_path||'');if(!fs.existsSync(abs))e.push('installed_source_missing');else if(sha256InstructionFile(abs)!==x.instruction_sha256)e.push('installed_source_drift');const s=findSkill(id);if(!s?.runtime?.usable)e.push('registry_not_usable');return{valid:e.length===0,errors:e,artifact:x};}

if(cmd==='acquire'&&sub==='plan'){const id=take('--skill-id');if(!id)fail('Missing --skill-id',2);const o=plan(id);console.log(JSON.stringify(o,null,2));if(o.status==='ACQUISITION_SOURCE_RESOLUTION_REQUIRED')process.exit(41);if(o.status==='ACQUISITION_APPROVAL_REQUIRED')process.exit(42);}
else if(cmd==='acquire'&&sub==='verify-plan'){const id=take('--skill-id');if(!id)fail('Missing --skill-id',2);const o=verifyPlan(id);console.log(JSON.stringify(o,null,2));if(!o.valid)process.exit(43);}
else if(cmd==='acquire'&&sub==='record'){const f=take('--request');if(!f)fail('Missing --request',2);const o=record(readJson(path.resolve(f)));console.log(JSON.stringify(o,null,2));}
else if(cmd==='acquire'&&sub==='verify'){const id=take('--skill-id');if(!id)fail('Missing --skill-id',2);const o=verifyReceipt(id);console.log(JSON.stringify(o,null,2));if(!o.valid)process.exit(44);}
else {console.log(`AleDevOS Skill Acquisition 1.0\n\nCommands:\n  acquire plan --project-root <path> --adapter <id> --skill-id <id>\n  acquire verify-plan --project-root <path> --adapter <id> --skill-id <id>\n  acquire record --project-root <path> --adapter <id> --request <receipt-request.json>\n  acquire verify --project-root <path> --adapter <id> --skill-id <id>\n\nCore plans and verifies acquisition. Runtime-specific network/download/install mechanics are adapter responsibilities.`);if(cmd)process.exit(2)}
