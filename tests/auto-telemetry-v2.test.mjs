import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {
  parseOpenCodeJsonl,parseOpenCodeExport,parseCodexJsonl,parseClaudeStreamJson,
  parseAntigravityText,buildInvocation,cliLaunchStrategy,encodeWindowsTransportArg
} from '../core/agent-runtime/agent-runtime.mjs';
import {startTaskTelemetry,emitAgentCallTelemetry,finishTaskTelemetry} from '../core/engine/telemetry-bridge.mjs';

const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'aledevos-tel-v2-'));

test('OpenCode JSONL parser captures reported tokens, tool calls, reads and session id',()=>{
  const input=[
    {type:'step_finish',sessionID:'ses_1',part:{type:'step-finish',tokens:{input:120,output:30}}},
    {type:'tool_use',sessionID:'ses_1',part:{type:'tool',callID:'c1',tool:'read'}},
    {type:'tool_use',sessionID:'ses_1',part:{type:'tool',callID:'c2',tool:'grep'}}
  ].map(JSON.stringify).join('\n');
  const r=parseOpenCodeJsonl(input);
  assert.equal(r.session_id,'ses_1');
  assert.equal(r.input_tokens,120);
  assert.equal(r.output_tokens,30);
  assert.equal(r.tool_calls,2);
  assert.equal(r.files_read,1);
  assert.equal(r.usage_source,'step_finish');
});

test('OpenCode JSONL parser exposes only safe structured error identity',()=>{
  const input=JSON.stringify({type:'error',sessionID:'ses_err',error:{name:'ProviderError',data:{code:'ECONNREFUSED',message:'sensitive provider message'}}});
  const r=parseOpenCodeJsonl(input);
  assert.equal(r.error_type,'ProviderError');
  assert.equal(r.error_code,'ECONNREFUSED');
  assert.doesNotMatch(JSON.stringify(r),/sensitive provider message/);
});

test('OpenCode sanitized export fallback extracts usage without requiring transcript storage',()=>{
  const doc={messages:[{info:{role:'assistant',providerID:'fixture-provider',modelID:'fixture-model'},parts:[
    {type:'step-finish',tokens:{input:80,output:20}},
    {type:'tool',callID:'x1',tool:'read',state:{status:'completed',output:'[redacted]'}}
  ]}]};
  const r=parseOpenCodeExport(JSON.stringify(doc));
  assert.equal(r.input_tokens,80);
  assert.equal(r.output_tokens,20);
  assert.equal(r.tool_calls,1);
  assert.equal(r.files_read,1);
  assert.equal(r.model,'fixture-provider/fixture-model');
  assert.equal(r.usage_source,'sanitized_session_export');
});

test('Codex JSONL parser uses turn.completed usage and structured tool items',()=>{
  const input=[
    {type:'thread.started',thread_id:'t1'},
    {type:'item.completed',item:{id:'i1',type:'command_execution'}},
    {type:'turn.completed',usage:{input_tokens:222,output_tokens:44}}
  ].map(JSON.stringify).join('\n');
  const r=parseCodexJsonl(input);
  assert.equal(r.input_tokens,222);
  assert.equal(r.output_tokens,44);
  assert.equal(r.tool_calls,1);
  assert.equal(r.usage_source,'turn.completed');
});

test('Claude stream-json parser uses result usage when present and counts tool_use blocks',()=>{
  const input=[
    {type:'system',subtype:'init',model:'claude-sonnet'},
    {type:'assistant',message:{model:'claude-sonnet',usage:{input_tokens:100,output_tokens:10},content:[{type:'tool_use',id:'t1',name:'Read'}]}},
    {type:'result',usage:{input_tokens:105,output_tokens:12}}
  ].map(JSON.stringify).join('\n');
  const r=parseClaudeStreamJson(input);
  assert.equal(r.input_tokens,105);
  assert.equal(r.output_tokens,12);
  assert.equal(r.tool_calls,1);
  assert.equal(r.files_read,1);
  assert.equal(r.model,'claude-sonnet');
});

test('Antigravity parser truthfully leaves unavailable usage null',()=>{
  const r=parseAntigravityText('answer');
  assert.equal(r.input_tokens,null);
  assert.equal(r.output_tokens,null);
  assert.equal(r.tool_calls,null);
  assert.equal(r.files_read,null);
  assert.equal(r.usage_source,'unavailable_by_runtime');
});

test('runtime profiles build fixed invocations and do not invent native agent flags',()=>{
  const open=JSON.parse(fs.readFileSync(path.resolve('adapters/opencode/runtime-profile.json'),'utf8'));
  const codex=JSON.parse(fs.readFileSync(path.resolve('adapters/codex/runtime-profile.json'),'utf8'));
  const claude=JSON.parse(fs.readFileSync(path.resolve('adapters/claude-code/runtime-profile.json'),'utf8'));
  assert.deepEqual(
    buildInvocation(open,{agent:'orchestrator',model:'fixture-provider/fixture-model',prompt:'PING'}).args,
    ['run','--standalone','--format','json','--agent','orchestrator','--model','fixture-provider/fixture-model','PING']
  );
  assert.deepEqual(
    buildInvocation(codex,{agent:'orchestrator',model:'gpt-x',prompt:'PING'}).args,
    ['exec','--json','--config','model_reasoning_effort=low','--model','gpt-x','PING']
  );
  assert.deepEqual(
    buildInvocation(claude,{agent:'orchestrator',model:'sonnet',prompt:'PING'}).args,
    ['--output-format','stream-json','--verbose','--model','sonnet','-p','PING']
  );
});

test('Windows runtime uses a Base64 argv transport without shell:true',()=>{
  assert.equal(cliLaunchStrategy('win32'),'powershell-base64-argv');
  assert.equal(cliLaunchStrategy('linux'),'direct');
  assert.equal(Buffer.from(encodeWindowsTransportArg('hello world'),'base64').toString('utf8'),'hello world');
  const entry=fs.readFileSync(path.resolve('core/agent-runtime/agent-runtime.mjs'),'utf8');
  const src=fs.readFileSync(path.resolve('runtime-bridges/agent-runtime.mjs'),'utf8');
  assert.match(entry,/runtime-bridges\/agent-runtime\.mjs/);
  assert.match(src,/windows-cli-launcher\.ps1/);
  assert.doesNotMatch(src,/shell\s*:\s*true/);
});

test('Windows launcher preserves argument boundaries including spaces and --flags',{skip:process.platform!=='win32'},()=>{
  const dir=temp();
  const fake=path.join(dir,'fake-cli.ps1');
  fs.writeFileSync(fake,"$ErrorActionPreference='Stop'\n[Console]::Out.Write(($args | ConvertTo-Json -Compress))\n",'utf8');
  const launcher=path.resolve('core/agent-runtime/windows-cli-launcher.ps1');
  const original=['run','--standalone','--format','json','Reply exactly: ALEDEVOS TELEMETRY V2 OK.'];
  const encoded=[fake,...original].map(encodeWindowsTransportArg);
  const r=spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',launcher,...encoded],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr||r.stdout);
  const received=JSON.parse(r.stdout);
  assert.deepEqual(received,original);
});

test('AGENT_CALL bridge aggregates reported metrics without prompt or transcript storage',()=>{
  const cwd=temp(),taskId='TASK-V2';
  const run=startTaskTelemetry({cwd,taskId,adapter:'opencode',benchmarkKey:'auto-telemetry-v2'});
  assert.equal(run.ok,true);
  const ev=emitAgentCallTelemetry({
    cwd,runId:run.run_id,taskId,runtime:'opencode',adapter:'opencode',agent:'orchestrator',model:'fixture-provider/fixture-model',
    metrics:{input_tokens:321,output_tokens:45,context_tokens:null,duration_ms:1234,generation_ms:null,tool_calls:2,files_read:1,bytes_read:null},
    attributes:{call_status:'COMPLETED',usage_status:'REPORTED',metric_provenance:{input_tokens:'REPORTED',duration_ms:'MEASURED'}}
  });
  assert.equal(ev.ok,true);
  const fin=finishTaskTelemetry({cwd,runId:run.run_id,taskId,adapter:'opencode',finalState:'PASS'});
  assert.equal(fin.ok,true);
  assert.equal(fin.summary.agents.orchestrator.calls,1);
  assert.equal(fin.summary.agents.orchestrator.input_tokens,321);
  assert.equal(fin.summary.agents.orchestrator.output_tokens,45);
  assert.equal(fin.summary.agents.orchestrator.tool_calls,2);
  assert.equal(fin.summary.agents.orchestrator.files_read,1);
  const events=fs.readFileSync(path.join(cwd,'.aledevos/state/telemetry/contextos/runs',run.run_id,'events.jsonl'),'utf8');
  assert.doesNotMatch(events,/prompt|transcript|completion_text|raw_content/i);
});

test('consumer E2E remains provider-neutral and uses selected adapter CLI',()=>{
  const s=fs.readFileSync(path.resolve('scripts/72-e2e-auto-telemetry-v2.ps1'),'utf8');
  assert.match(s,/Adapter runtime preflight: native CLI\/auth path/i);
  assert.match(s,/Get-Command/);
  assert.doesNotMatch(s,/Invoke-RestMethod|127\.0\.0\.1:8081/i);
  assert.doesNotMatch(s,/Set-ExecutionPolicy/i);
});
test('installer projects central agent runtime and selected adapter runtime profile',()=>{
  const s=fs.readFileSync(path.resolve('scripts/05-install-into-project.ps1'),'utf8');
  assert.match(s,/core\\agent-runtime\\agent-runtime\.mjs/);
  assert.match(s,/runtime-profile\.json/);
  assert.match(s,/agent-runtime\\adapters/);
});


test('E2E exposes explicit adapter selection and bounded call timeout',()=>{
  const s=fs.readFileSync(path.resolve('scripts/72-e2e-auto-telemetry-v2.ps1'),'utf8');
  assert.match(s,/RequestedAdapter/);
  assert.match(s,/CallTimeoutSeconds/);
  assert.match(s,/--timeout-ms/);
  assert.match(s,/AUTO_TELEMETRY_V2_PROVIDER_FAILURE_PATH_PASS/);
});

test('agent runtime accepts an explicit per-call timeout override',()=>{
  const entry=fs.readFileSync(path.resolve('core/agent-runtime/agent-runtime.mjs'),'utf8');
  const s=fs.readFileSync(path.resolve('runtime-bridges/agent-runtime.mjs'),'utf8');
  assert.match(entry,/runtime-bridges\/agent-runtime\.mjs/);
  assert.match(s,/timeoutMs=null/);
  assert.match(s,/effectiveTimeout/);
  assert.match(s,/--timeout-ms <ms>/);
});


test('Codex repo trust bypass is opt-in and profile-declared',()=>{
  const codex=JSON.parse(fs.readFileSync(path.resolve('adapters/codex/runtime-profile.json'),'utf8'));
  assert.equal(codex.repo_check_bypass_flag,'--skip-git-repo-check');
  assert.deepEqual(
    buildInvocation(codex,{agent:'orchestrator',model:null,prompt:'PING',skipRepoCheck:false}).args,
    ['exec','--json','--config','model_reasoning_effort=low','PING']
  );
  assert.deepEqual(
    buildInvocation(codex,{agent:'orchestrator',model:null,prompt:'PING',skipRepoCheck:true}).args,
    ['exec','--json','--skip-git-repo-check','--config','model_reasoning_effort=low','PING']
  );
});

test('controlled E2E enables repo-check bypass only for Codex',()=>{
  const s=fs.readFileSync(path.resolve('scripts/72-e2e-auto-telemetry-v2.ps1'),'utf8');
  assert.match(s,/if\(\$adapter -eq 'codex'\)\{\$callArgs\+=@\('--skip-repo-check'\)\}/);
});
