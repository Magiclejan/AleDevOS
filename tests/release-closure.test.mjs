import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('.');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('release closure pins v1.52.0',()=>{
  assert.equal(read('VERSION.txt').trim(),'1.52.0');
  assert.match(read('CHANGELOG.md'),/^# v1\.52\.0/m);
});

test('tracked-file manifest no longer contains removed onboarding artifacts',()=>{
  const m=new Set(read('MANIFEST.txt').split(/\r?\n/).filter(Boolean));
  for(const p of [
    '.gitignore.append.txt',
    'EMPEZAR_AQUI.bat',
    '1_INVENTARIO_MASTER.bat',
    '2_COMPROBAR_RUNTIMES.bat',
    '3_INSTALAR_EN_PROYECTO.bat',
    '4_VALIDACION_FINAL.bat',
    'HOTFIX_WINDOWS_PATHS.txt',
    'LEEME_PRIMERO.txt',
    'LEEME_HOTFIX11.txt',
    'LEEME_HOTFIX12.txt',
    'LEEME_HOTFIX13.txt'
  ]) assert.equal(m.has(p),false,p);
  assert.equal(m.has('START_ALEDEVOS.bat'),true);
  assert.equal(m.has('scripts/78-release-closure-prepare.mjs'),true);
});

test('release closure preparer uses the same package-tree exclusions as the verifier',()=>{
  const prep=read('scripts/78-release-closure-prepare.mjs');
  const engine=read('release/engine/v1-release.mjs');
  for(const token of [
    "MANIFEST.txt",
    "release/templates/package-tree-manifest.json",
    "release/templates/master-validation-package-baseline.json",
    "release/certifications/"
  ]){
    assert.ok(prep.includes(token),token+' missing from preparer');
    assert.ok(engine.includes(token),token+' missing from verifier');
  }
});

test('release closure regression measures tests MJS JSON and TOML fail-closed',()=>{
  const s=read('scripts/78-release-closure-prepare.mjs');
  assert.match(s,/--test-reporter=tap/);
  assert.match(s,/advanced-execution-phase\[2-5\]/);
  assert.match(s,/Math\.max\(requestedTimeout,600000\)/);
  assert.match(s,/RELEASE_TEST_FILE_TIMEOUT/);
  assert.match(s,/tests_passed/);
  assert.match(s,/mjs_syntax_passed/);
  assert.match(s,/json_parse_passed/);
  assert.match(s,/toml_parse_passed/);
  assert.match(s,/RELEASE_TOML_VALIDATOR_UNAVAILABLE/);
  assert.match(s,/failures:fail/);
  assert.match(s,/skipped/);
});

test('baseline rebuild requires clean measured regression and sealed certificates',()=>{
  const s=read('scripts/78-release-closure-prepare.mjs');
  assert.match(s,/RELEASE_REGRESSION_SUMMARY_REQUIRED/);
  assert.match(s,/RELEASE_REGRESSION_SUMMARY_NOT_CLEAN/);
  assert.match(s,/RELEASE_CERTIFICATE_NOT_SEALED/);
  assert.match(s,/package_tree_manifest_sha256/);
  assert.match(s,/baseline_sha256/);
});
