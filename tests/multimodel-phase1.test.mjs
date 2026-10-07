import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const engine=path.join(root,'multimodel/engine/multimodel.mjs');
const run=(args,cwd=root)=>spawnSync(process.execPath,[engine,...args],{cwd,encoding:'utf8'});
const json=r=>JSON.parse(r.stdout||'{}');
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-mm-p1-'));
function setup({primaryReady=true,secondaryReady=true,sameModel=false,secondaryImage=true}={}){
 const d=tmp();
 const binding={schema_version:'1.0',binding_id:'test-binding',target_runtime:'TEST_RUNTIME',slots:{
  primary:{provider_id:'provider-a',model_id:'model-a',provider_family:'family-a',modalities:['text','image'],context_window_tokens:131072,cost_class:'local',runtime_ready:primaryReady,runtime_evidence:primaryReady?'test://primary':null},
  secondary:{provider_id:sameModel?'provider-a':'provider-b',model_id:sameModel?'model-a':'model-b',provider_family:sameModel?'family-a':'family-b',modalities:secondaryImage?['text','image']:['text'],context_window_tokens:262144,cost_class:'standard',runtime_ready:secondaryReady,runtime_evidence:secondaryReady?'test://secondary':null}
 }};
 fs.writeFileSync(path.join(d,'binding.json'),JSON.stringify(binding,null,2));
 fs.writeFileSync(path.join(d,'input.json'),JSON.stringify({task:'immutable-input'},null,2));
 fs.writeFileSync(path.join(d,'rubric.json'),JSON.stringify({threshold:90,rule:'same rubric'},null,2));
 const sub=(outcome='PASS',score=95,role='quality')=>({task_id:'TASK-MM-1',judge_role:role,outcome,score,blockers:outcome==='PASS'?0:1,unverified:0,summary:'bounded summary'});
 fs.writeFileSync(path.join(d,'primary-sub.json'),JSON.stringify(sub(),null,2));
 fs.writeFileSync(path.join(d,'secondary-sub.json'),JSON.stringify(sub(),null,2));
 return{d,binding:path.join(d,'binding.json'),input:path.join(d,'input.json'),rubric:path.join(d,'rubric.json'),pSub:path.join(d,'primary-sub.json'),sSub:path.join(d,'secondary-sub.json'),pEv:path.join(d,'primary.json'),sEv:path.join(d,'secondary.json'),cmp:path.join(d,'comparison.json'),sub};
}
const seal=(x,slot,submission,out)=>run(['evidence','seal','--binding',x.binding,'--slot',slot,'--input',x.input,'--rubric',x.rubric,'--submission',submission,'--out',out],x.d);

// Registry contract.
test('P1 registry is valid',()=>{const r=run(['registry','verify']);assert.equal(r.status,0);assert.equal(json(r).status,'MODEL_REGISTRY_VALID')});
test('registry is adapter independent',()=>assert.equal(JSON.parse(fs.readFileSync('multimodel/registry/model-registry.json')).adapter_independent,true));
test('registry has exactly primary and secondary Judge slots',()=>assert.deepEqual(JSON.parse(fs.readFileSync('multimodel/registry/model-registry.json')).judge_slots.map(x=>x.slot),['primary','secondary']));
test('both slots require explicit target binding',()=>{for(const x of JSON.parse(fs.readFileSync('multimodel/registry/model-registry.json')).judge_slots)assert.equal(x.binding_required,true)});
test('model metadata includes context cost and modality',()=>{for(const x of JSON.parse(fs.readFileSync('multimodel/registry/model-registry.json')).judge_slots)for(const k of ['context_window_tokens','cost_class','modalities'])assert.ok(x.metadata_required.includes(k))});
test('visual role declares image capability requirement',()=>{for(const x of JSON.parse(fs.readFileSync('multimodel/registry/model-registry.json')).judge_slots)assert.deepEqual(x.visual_role_requires,['image'])});
test('router is explicitly deferred to P2',()=>assert.equal(JSON.parse(fs.readFileSync('multimodel/registry/model-registry.json')).rules.routing_deferred_to,'MULTIMODEL_P2_MODEL_ROUTER'));
test('Judge diversity is explicitly deferred to P3',()=>assert.equal(JSON.parse(fs.readFileSync('multimodel/registry/model-registry.json')).rules.provider_diversity_deferred_to,'MULTIMODEL_P3_JUDGE_DIVERSITY'));
test('fallback is explicitly deferred to P4',()=>assert.equal(JSON.parse(fs.readFileSync('multimodel/registry/model-registry.json')).rules.fallback_deferred_to,'MULTIMODEL_P4_MODEL_FALLBACK'));
test('P1 does not prematurely require provider diversity',()=>assert.equal(JSON.parse(fs.readFileSync('multimodel/registry/model-registry.json')).rules.provider_diversity_required,false));
test('final decision authority remains deterministic AleDevOS gate',()=>assert.equal(JSON.parse(fs.readFileSync('multimodel/registry/model-registry.json')).rules.final_decision_authority,'ALEDEVOS_DETERMINISTIC_GATE'));

// Target bindings.
test('valid two-model target binding passes',()=>{const x=setup(),r=run(['binding','verify','--binding',x.binding],x.d);assert.equal(r.status,0);assert.equal(json(r).status,'MODEL_BINDING_VALID')});
test('same provider+model identity is rejected',()=>{const x=setup({sameModel:true}),r=run(['binding','verify','--binding',x.binding],x.d);assert.equal(r.status,3);assert.ok(json(r).errors.includes('model_identity_not_distinct'))});
test('missing secondary slot is rejected',()=>{const x=setup(),o=JSON.parse(fs.readFileSync(x.binding));delete o.slots.secondary;fs.writeFileSync(x.binding,JSON.stringify(o));const r=run(['binding','verify','--binding',x.binding],x.d);assert.equal(r.status,3);assert.ok(json(r).errors.includes('secondary_slot_missing'))});
test('missing model provenance is rejected',()=>{const x=setup(),o=JSON.parse(fs.readFileSync(x.binding));delete o.slots.secondary.provider_id;fs.writeFileSync(x.binding,JSON.stringify(o));const r=run(['binding','verify','--binding',x.binding],x.d);assert.equal(r.status,3);assert.ok(json(r).errors.includes('secondary_provider_id_missing'))});
test('text capability is mandatory for both Judge slots',()=>{const x=setup(),o=JSON.parse(fs.readFileSync(x.binding));o.slots.secondary.modalities=['image'];fs.writeFileSync(x.binding,JSON.stringify(o));const r=run(['binding','verify','--binding',x.binding],x.d);assert.equal(r.status,3);assert.ok(json(r).errors.includes('secondary_text_capability_missing'))});
test('require-ready binding rejects unavailable model',()=>{const x=setup({secondaryReady:false}),r=run(['binding','verify','--binding',x.binding,'--require-ready','true'],x.d);assert.equal(r.status,3);assert.ok(json(r).errors.includes('secondary_runtime_not_ready'))});
test('readiness separates package support from target readiness',()=>{const x=setup({secondaryReady:false}),r=run(['readiness','check','--binding',x.binding],x.d);assert.equal(r.status,5);const o=json(r);assert.equal(o.package_support,true);assert.equal(o.target_runtime_ready,false);assert.equal(o.status,'SECONDARY_JUDGE_MODEL_NOT_READY')});
test('fully ready binding reaches MULTIMODEL_TARGET_READY',()=>{const x=setup(),r=run(['readiness','check','--binding',x.binding],x.d);assert.equal(r.status,0);assert.equal(json(r).status,'MULTIMODEL_TARGET_READY')});
test('unbound secondary is fail-closed',()=>{const x=setup(),o=JSON.parse(fs.readFileSync(x.binding));o.slots.secondary.model_id='SECOND_MODEL_ID';fs.writeFileSync(x.binding,JSON.stringify(o));const r=run(['readiness','check','--binding',x.binding],x.d);assert.equal(r.status,5);assert.equal(json(r).status,'SECONDARY_JUDGE_MODEL_UNBOUND')});

// Evidence provenance.
test('primary Judge evidence seals with explicit model provenance',()=>{const x=setup(),r=seal(x,'primary',x.pSub,x.pEv);assert.equal(r.status,0);const o=json(r);assert.equal(o.slot,'primary');assert.equal(o.model.provider_id,'provider-a');assert.equal(o.model.model_id,'model-a');assert.match(o.evidence_sha256,/^[a-f0-9]{64}$/)});
test('secondary Judge evidence seals independently',()=>{const x=setup(),r=seal(x,'secondary',x.sSub,x.sEv);assert.equal(r.status,0);assert.equal(json(r).slot,'secondary')});
test('evidence carries immutable input SHA',()=>{const x=setup(),o=json(seal(x,'primary',x.pSub,x.pEv));assert.match(o.input.sha256,/^[a-f0-9]{64}$/)});
test('evidence carries immutable rubric SHA',()=>{const x=setup(),o=json(seal(x,'primary',x.pSub,x.pEv));assert.match(o.rubric.sha256,/^[a-f0-9]{64}$/)});
test('evidence records context window and cost class',()=>{const x=setup(),o=json(seal(x,'secondary',x.sSub,x.sEv));assert.equal(o.model.context_window_tokens,262144);assert.equal(o.model.cost_class,'standard')});
test('evidence records runtime readiness separately from package support',()=>{const x=setup({secondaryReady:false}),o=json(seal(x,'secondary',x.sSub,x.sEv));assert.equal(o.runtime.package_support,true);assert.equal(o.runtime.runtime_ready,false)});
test('invalid Judge outcome is rejected',()=>{const x=setup(),s=x.sub('MAYBE',50);fs.writeFileSync(x.pSub,JSON.stringify(s));const r=seal(x,'primary',x.pSub,x.pEv);assert.equal(r.status,3);assert.equal(json(r).status,'JUDGE_OUTCOME_INVALID')});
test('out-of-range score is rejected',()=>{const x=setup(),s=x.sub('PASS',101);fs.writeFileSync(x.pSub,JSON.stringify(s));const r=seal(x,'primary',x.pSub,x.pEv);assert.equal(r.status,3);assert.equal(json(r).status,'JUDGE_SCORE_INVALID')});
test('visual Judge requires image-capable primary model',()=>{const x=setup(),o=JSON.parse(fs.readFileSync(x.binding));o.slots.primary.modalities=['text'];fs.writeFileSync(x.binding,JSON.stringify(o));fs.writeFileSync(x.pSub,JSON.stringify(x.sub('PASS',95,'visual')));const r=seal(x,'primary',x.pSub,x.pEv);assert.equal(r.status,3);assert.equal(json(r).status,'VISUAL_JUDGE_MODEL_IMAGE_CAPABILITY_REQUIRED')});
test('visual Judge requires image-capable secondary model',()=>{const x=setup({secondaryImage:false});fs.writeFileSync(x.sSub,JSON.stringify(x.sub('PASS',95,'visual')));const r=seal(x,'secondary',x.sSub,x.sEv);assert.equal(r.status,3);assert.equal(json(r).status,'VISUAL_JUDGE_MODEL_IMAGE_CAPABILITY_REQUIRED')});
test('sealed evidence verifies',()=>{const x=setup();assert.equal(seal(x,'primary',x.pSub,x.pEv).status,0);const r=run(['evidence','verify','--evidence',x.pEv],x.d);assert.equal(r.status,0);assert.equal(json(r).status,'JUDGE_MODEL_EVIDENCE_VALID')});
test('evidence tamper is detected',()=>{const x=setup();seal(x,'primary',x.pSub,x.pEv);const o=JSON.parse(fs.readFileSync(x.pEv));o.result.score=1;fs.writeFileSync(x.pEv,JSON.stringify(o));const r=run(['evidence','verify','--evidence',x.pEv],x.d);assert.equal(r.status,3);assert.ok(json(r).errors.includes('integrity_mismatch'))});

// Pair comparison.
function makePair(opts={}){const x=setup(opts);assert.equal(seal(x,'primary',x.pSub,x.pEv).status,0);assert.equal(seal(x,'secondary',x.sSub,x.sEv).status,0);return x}
test('same outcomes from ready models compare as AGREE',()=>{const x=makePair(),r=run(['pair','compare','--primary',x.pEv,'--secondary',x.sEv,'--out',x.cmp],x.d);assert.equal(r.status,0);const o=json(r);assert.equal(o.state,'AGREE');assert.equal(o.same_outcome,true)});
test('different outcomes compare as DISAGREE',()=>{const x=setup();fs.writeFileSync(x.sSub,JSON.stringify(x.sub('FAIL',72)));seal(x,'primary',x.pSub,x.pEv);seal(x,'secondary',x.sSub,x.sEv);const o=json(run(['pair','compare','--primary',x.pEv,'--secondary',x.sEv],x.d));assert.equal(o.state,'DISAGREE');assert.equal(o.same_outcome,false)});
test('unready secondary never becomes agreement',()=>{const x=makePair({secondaryReady:false}),o=json(run(['pair','compare','--primary',x.pEv,'--secondary',x.sEv],x.d));assert.equal(o.state,'INCOMPLETE');assert.equal(o.consensus_claimed,false)});
test('comparison never writes final decision',()=>{const x=makePair(),o=json(run(['pair','compare','--primary',x.pEv,'--secondary',x.sEv],x.d));assert.equal(o.final_decision,null);assert.equal(o.final_decision_authority,'ALEDEVOS_DETERMINISTIC_GATE')});
test('comparison does not invoke router prematurely',()=>{const x=makePair(),o=json(run(['pair','compare','--primary',x.pEv,'--secondary',x.sEv],x.d));assert.equal(o.router_used,false)});
test('comparison does not invoke fallback prematurely',()=>{const x=makePair(),o=json(run(['pair','compare','--primary',x.pEv,'--secondary',x.sEv],x.d));assert.equal(o.fallback_used,false)});
test('comparison records score delta deterministically',()=>{const x=setup();fs.writeFileSync(x.sSub,JSON.stringify(x.sub('PASS',91.25)));seal(x,'primary',x.pSub,x.pEv);seal(x,'secondary',x.sSub,x.sEv);assert.equal(json(run(['pair','compare','--primary',x.pEv,'--secondary',x.sEv],x.d)).score_delta,3.75)});
test('comparison records provider diversity without enforcing it',()=>{const x=makePair(),o=json(run(['pair','compare','--primary',x.pEv,'--secondary',x.sEv],x.d));assert.equal(o.provider_diverse,true)});
test('same immutable input is mandatory',()=>{const x=makePair();const alt=path.join(x.d,'input2.json');fs.writeFileSync(alt,'{"changed":true}');assert.equal(seal({...x,input:alt},'secondary',x.sSub,x.sEv).status,0);const r=run(['pair','compare','--primary',x.pEv,'--secondary',x.sEv],x.d);assert.equal(r.status,4);assert.equal(json(r).status,'JUDGE_PAIR_INPUT_MISMATCH')});
test('same immutable rubric is mandatory',()=>{const x=makePair();const alt=path.join(x.d,'rubric2.json');fs.writeFileSync(alt,'{"threshold":1}');assert.equal(seal({...x,rubric:alt},'secondary',x.sSub,x.sEv).status,0);const r=run(['pair','compare','--primary',x.pEv,'--secondary',x.sEv],x.d);assert.equal(r.status,4);assert.equal(json(r).status,'JUDGE_PAIR_RUBRIC_MISMATCH')});
test('primary/secondary slot ordering is mandatory',()=>{const x=makePair();const r=run(['pair','compare','--primary',x.sEv,'--secondary',x.pEv],x.d);assert.equal(r.status,4);assert.equal(json(r).status,'JUDGE_PAIR_SLOT_MISMATCH')});
test('pair comparison seals and verifies',()=>{const x=makePair();assert.equal(run(['pair','compare','--primary',x.pEv,'--secondary',x.sEv,'--out',x.cmp],x.d).status,0);const r=run(['pair','verify','--comparison',x.cmp],x.d);assert.equal(r.status,0);assert.equal(json(r).status,'JUDGE_PAIR_COMPARISON_VALID')});
test('comparison tamper is detected',()=>{const x=makePair();run(['pair','compare','--primary',x.pEv,'--secondary',x.sEv,'--out',x.cmp],x.d);const o=JSON.parse(fs.readFileSync(x.cmp));o.consensus_claimed=true;fs.writeFileSync(x.cmp,JSON.stringify(o));const r=run(['pair','verify','--comparison',x.cmp],x.d);assert.equal(r.status,3);assert.ok(json(r).errors.includes('consensus_forbidden'))});

// Certification and installer wiring.
test('P1 package certificate can be generated',()=>{const d=tmp(),f=path.join(d,'cert.json'),r=run(['certify','run','--out',f]);assert.equal(r.status,0);assert.equal(json(r).status,'MULTIMODEL_P1_PACKAGE_CERTIFIED');assert.ok(fs.existsSync(f))});
test('fresh P1 package certificate verifies',()=>{const d=tmp(),f=path.join(d,'cert.json');assert.equal(run(['certify','run','--out',f]).status,0);const r=run(['certify','verify','--certificate',f]);assert.equal(r.status,0);assert.equal(json(r).status,'MULTIMODEL_P1_CERTIFICATE_VALID')});
test('certificate explicitly defers target-runtime validation',()=>{const d=tmp(),f=path.join(d,'cert.json');run(['certify','run','--out',f]);const o=JSON.parse(fs.readFileSync(f));assert.equal(o.package_only,true);assert.equal(o.target_runtime_validation,'DEFERRED')});
test('certificate is invalidated by registry drift',()=>{const d=tmp(),f=path.join(d,'cert.json');assert.equal(run(['certify','run','--out',f]).status,0);const reg='multimodel/registry/model-registry.json',bak=fs.readFileSync(reg);try{fs.appendFileSync(reg,'\n ');const r=run(['certify','verify','--certificate',f]);assert.equal(r.status,4);assert.equal(json(r).status,'MULTIMODEL_P1_CERTIFICATE_STALE_OR_TAMPERED')}finally{fs.writeFileSync(reg,bak)}});
test('certificate input paths are portable root-relative paths',()=>{const d=tmp(),f=path.join(d,'cert.json');run(['certify','run','--out',f]);for(const x of JSON.parse(fs.readFileSync(f)).inputs){assert.equal(path.isAbsolute(x.path),false);assert.equal(x.path.includes('..'),false)}});
test('installer projects Multi-Model runtime into installed AleDevOS',()=>{const s=fs.readFileSync('scripts/05-install-into-project.ps1','utf8');assert.match(s,/multimodel/i)});
test('Core contains no model-provider routing table',()=>{const files=fs.readdirSync('core',{recursive:true}).filter(x=>typeof x==='string'&&/\.(json|mjs|md)$/.test(x));const joined=files.map(f=>{try{return fs.readFileSync(path.join('core',f),'utf8')}catch{return''}}).join('\n').toLowerCase();assert.equal(joined.includes('multimodel_p2_model_router'),false)});
test('example binding deliberately refuses to claim target readiness',()=>{const o=JSON.parse(fs.readFileSync('multimodel/templates/target-model-bindings.example.json'));assert.equal(o.slots.primary.runtime_ready,false);assert.equal(o.slots.secondary.runtime_ready,false)});
test('installed .aledevos Multi-Model layout executes the same registry contract',()=>{
 const d=tmp(),mm=path.join(d,'.aledevos/multimodel');
 fs.mkdirSync(path.join(mm,'runtime'),{recursive:true});
 for(const dir of ['registry','policies','schemas','templates'])fs.cpSync(path.join(root,'multimodel',dir),path.join(mm,dir),{recursive:true});
 fs.copyFileSync(engine,path.join(mm,'runtime/multimodel.mjs'));
 const r=spawnSync(process.execPath,[path.join(mm,'runtime/multimodel.mjs'),'registry','verify'],{cwd:d,encoding:'utf8'});
 assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(JSON.parse(r.stdout).status,'MODEL_REGISTRY_VALID');
});
