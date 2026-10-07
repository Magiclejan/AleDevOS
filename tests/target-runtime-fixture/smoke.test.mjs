import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('fixture source exists',()=>{assert.ok(fs.existsSync(new URL('./src/index.html',import.meta.url)))});
