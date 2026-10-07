#!/usr/bin/env node
import fs from 'node:fs';

function deny(reason){
  process.stdout.write(JSON.stringify({
    hookSpecificOutput:{
      hookEventName:'PreToolUse',
      permissionDecision:'deny',
      permissionDecisionReason:reason,
      additionalContext:reason
    }
  }));
}

function readPayload(){
  try{
    const raw=fs.readFileSync(0,'utf8');
    return JSON.parse(raw);
  }catch{
    deny('ALEDEVOS_ROLE_GUARD_INVALID_INPUT');
    process.exit(0);
  }
}

const payload=readPayload();
const role=payload?.agent_type || payload?.subagent?.agent_type || 'root';
const tool=String(payload?.tool_name||'');
const input=payload?.tool_input ?? {};

const writers=new Set([
  'builder',
  'editor-backend',
  'editor-config',
  'editor-database',
  'editor-frontend',
  'editor-tests',
  'repairer'
]);

const controlShellRoles=new Set([
  'orchestrator',
  'verifier',
  'judge-quality',
  'judge-regression',
  'judge-requirements',
  'judge-uxui',
  'visual-capture-runner',
  'visual-judge',
  'visual-regression-runner',
  'visual-repair-controller',
  'visual-runtime-audit-runner',
  'v1-release-validator'
]);

function shellAllowed(command,role){
  const cmd=String(command||'').replaceAll('\\','/').replace(/\s+/g,' ').trim();
  if(!cmd)return false;
  if(/[\r\n;&|\`><]/.test(cmd))return false;

  const p2Probe=/^"?node(?:\.exe)?"?\s+"?MV_P2_SECURITY_PROBE_[a-f0-9]+\.mjs"?$/i;
  if(role==='root'&&p2Probe.test(cmd))return true;

  const nodeAleDevOS=/^"?node(?:\.exe)?"?\s+"?(?:\.\/)?\.aledevos\/[A-Za-z0-9._\/-]+\.mjs"?(?:\s|$)/i;
  if(nodeAleDevOS.test(cmd))return true;

  const gitRead=/^git\s+(?:status|diff|log|show|rev-parse|ls-files)(?:\s|$)/i;
  if(gitRead.test(cmd)&&!/(?:^|\s)(?:--output(?:=|\s)|--ext-diff\b|-o(?:\s|$))/i.test(cmd))return true;

  return false;
}

if(tool==='Bash'){
  const command=input?.command;
  const p2RootProbe=role==='root'&&shellAllowed(command,role)&&/MV_P2_SECURITY_PROBE_/i.test(String(command||''));
  if(!controlShellRoles.has(role)&&!p2RootProbe){
    deny('ALEDEVOS_ROLE_SHELL_DENIED: role='+role);
    process.exit(0);
  }
  if(!shellAllowed(command,role)){
    deny('ALEDEVOS_SHELL_COMMAND_DENIED: role='+role);
    process.exit(0);
  }
  process.exit(0);
}

if(tool==='apply_patch'||tool==='Write'||tool==='Edit'){
  if(!writers.has(role)){
    deny('ALEDEVOS_ROLE_WRITE_DENIED: role='+role+' tool='+tool);
    process.exit(0);
  }

  const text=JSON.stringify(input).replaceAll('\\\\','/').toLowerCase();
  const protectedPath=/(^|[^a-z0-9_.-])(\.aledevos|\.codex|\.agents|\.git)(\/|[^a-z0-9_.-]|$)|agents\.md|agents\.override\.md/;
  if(protectedPath.test(text)){
    deny('ALEDEVOS_CONTROL_PLANE_WRITE_DENIED: role='+role);
    process.exit(0);
  }
}

// No output means the tool call is allowed to continue.
