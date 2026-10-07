#!/usr/bin/env node
// Full inventory runner: every *.test.mjs executes, no exclusions or skipped files.
// Stream test output so Windows Git subprocess stalls show the last completed test.
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';

const root=process.cwd();
const testsDir=path.join(root,'tests');
const timeoutMs=Number(process.env.ALEDEVOS_TEST_FILE_TIMEOUT_MS||120000);
if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1000){
  console.error('FULL_REGRESSION_INVALID_FILE_TIMEOUT');
  process.exit(2);
}
if(!fs.existsSync(testsDir)){
  console.error('FULL_REGRESSION_TEST_DIR_MISSING');
  process.exit(2);
}
const files=fs.readdirSync(testsDir).filter(x=>x.endsWith('.test.mjs')).sort();
if(files.length===0){
  console.error('FULL_REGRESSION_NO_TESTS');
  process.exit(2);
}
const results=[];
function runOne(name){
  return new Promise(resolve=>{
    const started=Date.now(),file=path.join(testsDir,name);
    process.stdout.write('\n===== FULL REGRESSION: '+name+' =====\n');
    let timedOut=false, spawnError=null,finished=false;
    const child=spawn(process.execPath,['--test','--test-reporter=tap',file],{
      cwd:root,stdio:['ignore','inherit','inherit'],windowsHide:true,
      // windowsHide is only UI; launch without shell to preserve exact argv.
      shell:false
    });
    function terminate(){
      if(finished)return;
      timedOut=true;
      console.error('FULL_REGRESSION_FILE_TIMEOUT file='+name+' elapsed_ms='+(Date.now()-started)+' timeout_ms='+timeoutMs);
      // Terminate the process subtree on Windows; otherwise a hung grandchild may
      // continue holding a Git worktree lock after the runner exits.
      if(process.platform==='win32'&&child.pid){
        const r=spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:10000});
        if(r.error)console.error('FULL_REGRESSION_TASKKILL_ERROR '+r.error.code);
      }else{try{child.kill('SIGKILL')}catch{}}
    }
    const timer=setTimeout(terminate,timeoutMs);
    child.once('error',e=>{spawnError=e;console.error('FULL_REGRESSION_SPAWN_ERROR file='+name+' code='+String(e.code||e.message))});
    child.once('close',(code,signal)=>{
      finished=true;clearTimeout(timer);
      const elapsed=Date.now()-started;
      const status=timedOut?'TIMEOUT':spawnError?'ERROR':code===0?'PASS':'FAIL';
      const result={file:name,status,exit_code:code,signal:signal||null,duration_ms:elapsed};
      console.log('FULL_REGRESSION_FILE_RESULT '+JSON.stringify(result));
      resolve(result);
    });
  });
}
for(const name of files){
  const result=await runOne(name);
  results.push(result);
  if(result.status!=='PASS'){
    console.error(JSON.stringify({
      status:'FULL_REGRESSION_FAILED',
      failed_file:name,
      reason:result.status==='TIMEOUT'?'TEST_FILE_TIMEOUT':result.status==='ERROR'?'SPAWN_ERROR':'TEST_FILE_FAILED',
      timeout_ms:timeoutMs,
      results
    },null,2));
    process.exit(result.status==='TIMEOUT'?124:1);
  }
}
console.log(JSON.stringify({status:'FULL_REGRESSION_PASS',total:files.length,passed:results.length,timeout_ms:timeoutMs,results},null,2));
