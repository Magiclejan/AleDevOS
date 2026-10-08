import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {reviewP37_3} from '../certification/pro/engine/p37-signoff.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('P37.3 refuses incomplete or blocked observations and reports missing matrix evidence',()=>{
  const report=reviewP37_3(root);
  assert.equal(report.phase,'P37.3');
  assert.equal(report.pro_certified,false);
  assert.equal(report.independent_signoff,'P37_3_SIGNOFF_FAIL');
  assert.equal(report.complete_matrix,false);
  assert.ok(report.issues.some(x=>x.code==='MISSING_SCENARIO'));
});
