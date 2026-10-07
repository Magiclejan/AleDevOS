import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('.');
const s=fs.readFileSync(path.join(root,'scripts/79-release-closure-recertify.mjs'),'utf8');

test('phase2 runner recertifies exactly the canonical 14 package certificates',()=>{
  const ids=[
    'opencode-portability-p2','codex-portability-p3','claude-code-portability-p4','antigravity-portability-p5','cross-adapter-portability-p6',
    'multimodel-p1','multimodel-p2','multimodel-p3','multimodel-p4',
    'advanced-execution-p1','advanced-execution-p2','advanced-execution-p3','advanced-execution-p4','advanced-execution-p5'
  ];
  for(const id of ids)assert.ok(s.includes("id:'"+id+"'"),id);
  assert.match(s,/if\(certs\.length!==14\)/);
});

test('phase2 runner preserves dependency order before baseline rebuild',()=>{
  const adapter=s.indexOf("3_ADAPTER_CERTIFICATES");
  const mm=s.indexOf("4_MULTIMODEL_CERTIFICATES");
  const adv=s.indexOf("5_ADVANCED_EXECUTION_CERTIFICATES");
  const baseline=s.indexOf("6_REBUILD_PACKAGE_BASELINE");
  const master=s.indexOf("8_REISSUE_MASTER_P1_CERTIFICATE");
  assert.ok(adapter>0&&adapter<mm&&mm<adv&&adv<baseline&&baseline<master);
});

test('phase2 runner requires a clean worktree and runs measured regression before certification',()=>{
  assert.match(s,/RELEASE_CLOSURE_REQUIRES_CLEAN_WORKTREE/);
  assert.match(s,/78-release-closure-prepare\.mjs/);
  assert.match(s,/2_FULL_DETERMINISTIC_REGRESSION/);
  assert.match(s,/RELEASE_CLOSURE_REGRESSION_PASS/);
});

test('phase2 runner accepts canonical verifier shapes without weakening failure semantics',()=>{
  assert.match(s,/vo\.valid===true\|\|String\(vo\.status\|\|' '\)\.endsWith\('_VALID'\)/);
  assert.match(s,/RELEASE_CERTIFICATION_VERIFY_FAILED/);
  assert.match(s,/RELEASE_CERTIFICATION_NOT_CERTIFIED/);
});

test('phase2 runner rebuilds and verifies the package baseline before reissuing Master P1',()=>{
  assert.match(s,/RELEASE_CLOSURE_BASELINE_REBUILT/);
  assert.match(s,/master','package'/);
  assert.match(s,/master','certify'/);
  assert.match(s,/master','verify-certificate'/);
  assert.match(s,/RELEASE_CLOSURE_PHASE2_PASS/);
});
