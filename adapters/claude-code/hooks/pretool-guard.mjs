#!/usr/bin/env node
import fs from 'node:fs';
const raw=fs.readFileSync(0,'utf8');
let input;try{input=JSON.parse(raw)}catch{process.stderr.write('AleDevOS guard: invalid hook input\n');process.exit(2)}
const tool=String(input.tool_name||'');
const cmd=String(input.tool_input?.command||'').trim().replaceAll('\\','/');
const approved=["node .aledevos/runtime/aledevos.mjs *","node .aledevos/contextos/runtime/contextos.mjs *","node .aledevos/skillsystem/runtime/skillsystem.mjs *","node .aledevos/uxui/runtime/uxui.mjs *","node .aledevos/visualqa/runtime/browser-runner.mjs *","node .aledevos/visualqa/runtime/regression.mjs *","node .aledevos/visualqa/runtime/runtime-audit.mjs *","node .aledevos/visualqa/runtime/visual-judge.mjs *","node .aledevos/efficiency/runtime/efficiency-governor.mjs *","node .aledevos/release/runtime/v1-release.mjs *"];
const ok=(tool==='Bash'||tool==='PowerShell') && approved.some(p=>{const q=p.replaceAll('\\','/');const star=q.endsWith(' *');const base=star?q.slice(0,-2):q;return star?(cmd===base||cmd.startsWith(base+' ')):cmd===base});
if(ok){process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'allow',permissionDecisionReason:'AleDevOS governed runtime command'}}));process.exit(0)}
process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:'AleDevOS denies arbitrary shell; use governed runtime commands only'}}));process.exit(0);
