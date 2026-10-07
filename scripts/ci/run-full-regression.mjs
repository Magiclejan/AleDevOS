#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd();
const testsDir=path.join(root,'tests');
const timeoutMs=Number(process.env.ALEDEVOS_TEST_FILE_TIMEOUT_MS||120000);

if(!fs.existsSync(testsDir)){
  console.error('FULL_REGRESSION_TEST_DIR_MISSING');
  process.exit(2);
}

const files=fs.readdirSync(testsDir)
  .filter(x=>x.endsWith('.test.mjs'))
  .sort();

if(files.length===0){
  console.error('FULL_REGRESSION_NO_TESTS');
  process.exit(2);
}

const results=[];
for(const name of files){
  const file=path.join(testsDir,name);
  const started=Date.now();
  process.stdout.write(`\n===== FULL REGRESSION: ${name} =====\n`);
  const r=spawnSync(process.execPath,['--test',file],{
    cwd:root,
    encoding:'utf8',
    windowsHide:true,
    timeout:timeoutMs,
    maxBuffer:16*1024*1024
  });
  const elapsed=Date.now()-started;
  if(r.stdout)process.stdout.write(r.stdout);
  if(r.stderr)process.stderr.write(r.stderr);

  const timedOut=r.error?.code==='ETIMEDOUT';
  const passed=!timedOut&&r.status===0;
  results.push({file:name,status:passed?'PASS':timedOut?'TIMEOUT':'FAIL',exit_code:r.status,duration_ms:elapsed});

  if(!passed){
    console.error(JSON.stringify({
      status:'FULL_REGRESSION_FAILED',
      failed_file:name,
      reason:timedOut?'TEST_FILE_TIMEOUT':'TEST_FILE_FAILED',
      timeout_ms:timeoutMs,
      exit_code:r.status,
      duration_ms:elapsed,
      results
    },null,2));
    process.exit(timedOut?124:1);
  }
}

console.log(JSON.stringify({
  status:'FULL_REGRESSION_PASS',
  total:results.length,
  passed:results.length,
  timeout_ms:timeoutMs,
  results
},null,2));
