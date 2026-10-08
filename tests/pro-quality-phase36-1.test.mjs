import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {expectedOutputs,renderSkill,semanticHash} from '../certification/pro/engine/render-pro-skills.mjs';
import {auditP36} from '../certification/pro/engine/pro-quality-audit.mjs';

const source=JSON.parse(fs.readFileSync('certification/pro/content/p36-1-skill-sops.json','utf8'));
const files=expectedOutputs();

test('P36.1 produces a deterministic full projection across all supported adapters',()=>{
  assert.equal(source.skills.length,13);
  assert.equal(files.size,71); // 13 canonical + 4 x 13 adapter files + 4 bindings, catalog and portable pack
  const verifier=spawnSync(process.execPath,['certification/pro/engine/render-pro-skills.mjs','verify'],{encoding:'utf8'});
  assert.equal(verifier.status,0,verifier.stdout+verifier.stderr);
  assert.equal(JSON.parse(verifier.stdout).drifted,0);
  for(const [filename,expected] of files)assert.equal(fs.readFileSync(filename,'utf8').replace(/\r\n/g,'\n'),expected,filename);
});

test('all 13 Skills have distinct entry triggers, exclusions and concrete operational procedures',()=>{
  const ids=new Set(),triggers=new Set();
  for(const s of source.skills){
    assert.ok(!ids.has(s.id),s.id);ids.add(s.id);
    assert.ok(s.trigger.length>45 && s.exclude.length>40,s.id);
    assert.ok(!triggers.has(s.trigger),s.id);triggers.add(s.trigger);
    assert.ok(s.steps.length>=6 && s.decisions.length>=3 && s.failures.length>=3,s.id);
    assert.ok(s.inputs.length>=3 && s.outputs.length>=3 && s.verification.length>=3,s.id);
    assert.ok(s.examples.length>=2 && s.permissions.length>80,s.id);
    assert.ok(/BLOCKED|FAILED|UNVERIFIED/.test(s.failures.join(' ')),s.id);
  }
});

test('Skill headings meet P36 shape without falsely granting PRO_CERTIFIED',()=>{
  const p=JSON.parse(fs.readFileSync('certification/pro/policies/p36-quality.json','utf8'));
  const audit=auditP36();
  assert.equal(audit.summary.bundled_skills,13);
  assert.equal(audit.summary.skill_doc_candidates,13);
  assert.equal(audit.summary.skill_docs_needing_work,0);
  assert.equal(audit.summary.pro_certified,0);
  assert.ok(audit.skills.every(x=>x.status==='DOCUMENTATION_CANDIDATE'&&x.certification==='NOT_CERTIFIED'));
  for(const skill of source.skills){
    const text=fs.readFileSync('core/skills/'+skill.id+'/SKILL.md','utf8');
    for(const section of p.skill_required_sections){
      assert.ok(text.split('\n').some(line=>/^## /.test(line)&&new RegExp(section.pattern,'i').test(line.slice(3))),skill.id+':'+section.id);
    }
  }
});

test('adapter labels may differ but executable procedure must remain semantically identical',()=>{
  const byId=new Map(source.skills.map(s=>[s.id,s]));
  for(const s of byId.values()){
    const canonical=fs.readFileSync('core/skills/'+s.id+'/SKILL.md','utf8');
    for(const [dir,label] of [
      ['adapters/opencode/.opencode/skills','OpenCode V2 adapter'],
      ['adapters/codex/.agents/skills','AleDevOS Core'],
      ['adapters/claude-code/.claude/skills','Claude Code project skill'],
      ['adapters/antigravity/.agents/skills','AleDevOS Core']
    ]){
      const skill=fs.readFileSync(path.join(dir,s.id,'SKILL.md'),'utf8');
      assert.equal(skill,renderSkill(s,source.common,label),s.id+':'+dir);
      assert.equal(semanticHash(skill),semanticHash(canonical),s.id+':'+dir);
    }
  }
});

test('protected safety boundaries and no fabricated proof are present in every procedure',()=>{
  for(const s of source.skills){
    const content=fs.readFileSync('core/skills/'+s.id+'/SKILL.md','utf8');
    assert.match(content,/reference-only procedural guidance/i,s.id);
    assert.match(content,/one specialist at a time/i,s.id);
    assert.match(content,/Never manufacture evidence/i,s.id);
    assert.match(content,/BLOCKED.*FAILED/s,s.id);
    assert.doesNotMatch(content,/\b(?:TBD|LOREM IPSUM|PLACEHOLDER)\b/i,s.id);
  }
});
