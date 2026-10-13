import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const strict=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../cli/codex-strict.mjs');
const isWindows=process.platform==='win32';

function fixture({registryOk=true,complete=false}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-strict-test-'));
  const project=path.join(root,'project'), bin=path.join(root,'bin'), a=path.join(project,'.aledevos');
  fs.mkdirSync(path.join(a,'skills','registries'),{recursive:true});
  fs.mkdirSync(path.join(a,'skillsystem','runtime'),{recursive:true});
  fs.mkdirSync(path.join(a,'runtime'),{recursive:true});
  fs.mkdirSync(path.join(project,'.codex','agents'),{recursive:true});
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(a,'project.json'),'{}');
  fs.writeFileSync(path.join(a,'skills','registries','codex.json'),'{}');
  fs.writeFileSync(path.join(project,'.codex','config.toml'),"developer_instructions = '''\nDelegate to the orchestrator.\n'''\n");
  fs.writeFileSync(path.join(project,'.codex','agents','orchestrator.toml'),'name = "orchestrator"\n');
  fs.writeFileSync(path.join(a,'skillsystem','runtime','skillsystem.mjs'),registryOk?'process.exit(0);':'process.exit(9);');
  fs.writeFileSync(path.join(a,'runtime','aledevos.mjs'),`
import fs from 'node:fs';
import path from 'node:path';
const args=process.argv.slice(2);
const stateFile=path.join(process.cwd(),'.aledevos','state','current.json');
if(args[0]==='state'&&args[1]==='init'){
 const task={task_id:'T-fixture',runtime_adapter:'codex',final_state:null,agent_trace:[{agent:'orchestrator',status:'STARTED'}]};
 fs.mkdirSync(path.dirname(stateFile),{recursive:true});
 fs.writeFileSync(stateFile,JSON.stringify(task));
 process.stdout.write('STATE_INITIALIZED\\n');
 process.exit(0);
}
if(args[0]==='state'&&args[1]==='block'){
 const task=JSON.parse(fs.readFileSync(stateFile));task.blocked_reason=args.at(-1);
 fs.writeFileSync(stateFile,JSON.stringify(task));process.exit(0);
}
if(args[0]==='state'&&args[1]==='finalize'){
 const task=JSON.parse(fs.readFileSync(stateFile));task.final_state='BLOCKED';
 fs.writeFileSync(stateFile,JSON.stringify(task));process.exit(6);
}
process.exit(1);
`);
  const mock=`
import fs from 'node:fs';
import path from 'node:path';
const argv=process.argv.slice(2);
if(process.env.MOCK_CODEX_LOG)fs.appendFileSync(process.env.MOCK_CODEX_LOG,argv[0]+'\\n');
if(argv[0]==='--version'){console.log('codex-mock 0.0.0');process.exit(0);}
if(argv[0]==='exec'){
 const cwd=process.cwd(),file=path.join(cwd,'.aledevos','state','current.json');
 if(!fs.existsSync(file))process.exit(13);
 if(process.env.FAKE_COMPLETE==='true'){
  const st=JSON.parse(fs.readFileSync(file));st.final_state='PASS';
  fs.writeFileSync(file,JSON.stringify(st));
 }
 console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'I completed the work.'}}));
 console.log(JSON.stringify({type:'turn.completed'}));
 process.exit(0);
}
process.exit(19);
`;
  const mockPath=path.join(bin,'codex-mock.mjs');fs.writeFileSync(mockPath,mock);
  if(isWindows){
    fs.writeFileSync(path.join(bin,'codex.cmd'),'@echo off\r\nnode "%~dp0codex-mock.mjs" %*\r\n');
  }else{
    const shim=path.join(bin,'codex');
    fs.writeFileSync(shim,'#!/bin/sh\nexec node "'+mockPath+'" "$@"\n');
    fs.chmodSync(shim,0o755);
  }
  return {root,project,log:path.join(root,'codex-calls.txt'),complete};
}
function run(f, extra={}){
  return spawnSync(process.execPath,[strict,'--project',f.project,'--prompt','Inspect project'],{
    encoding:'utf8',env:{...process.env,PATH:path.join(f.root,'bin')+path.delimiter+process.env.PATH,
      MOCK_CODEX_LOG:f.log,FAKE_COMPLETE:extra.complete?'true':'false'}
  });
}

test('rejects a project without installed AleDevOS before invoking Codex',()=>{
 const f=fixture();fs.rmSync(path.join(f.project,'.aledevos','project.json'));
 const r=run(f);assert.equal(r.status,2);assert.match(r.stderr,/MISSING_PROJECT_ASSET/);
 assert.equal(fs.existsSync(f.log),false);
});
test('invalid Skill registry blocks Codex execution before task bootstrap',()=>{
 const f=fixture({registryOk:false});const r=run(f);
 assert.equal(r.status,2);assert.match(r.stderr,/SKILL_REGISTRY_VERIFICATION_FAILED/);
 assert.equal(fs.existsSync(path.join(f.project,'.aledevos','state','current.json')),false);
 assert.equal((fs.readFileSync(f.log,'utf8').trim().split('\n')).length,1);
});
test('Codex root answer without task finalization is rejected fail-closed',()=>{
 const f=fixture();const r=run(f);
 assert.equal(r.status,7,r.stdout+r.stderr);assert.match(r.stderr,/BLOCKED/);
 assert.doesNotMatch(r.stdout,/PASS: verified/);
 const state=JSON.parse(fs.readFileSync(path.join(f.project,'.aledevos','state','current.json')));
 assert.equal(state.final_state,'BLOCKED');
 assert.match(fs.readFileSync(f.log,'utf8'),/exec/);
});
test('even a claimed PASS without real role and route evidence is rejected',()=>{
 const f=fixture();const r=run(f,{complete:true});
 assert.equal(r.status,7,r.stdout+r.stderr);
 assert.doesNotMatch(r.stdout,/PASS: verified/);
});
