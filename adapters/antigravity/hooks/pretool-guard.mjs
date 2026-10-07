#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const raw=fs.readFileSync(0,'utf8');
let input;try{input=JSON.parse(raw)}catch{process.stderr.write('AleDevOS Antigravity guard: invalid hook input\n');process.exit(2)}
const call=input.toolCall||{};const tool=String(call.name||'');const args=call.args||{};
const ws=(input.workspacePaths||[]).map(x=>path.resolve(String(x)));
const norm=p=>path.resolve(String(p||'')).replaceAll('\\','/');
const within=(p,r)=>{const a=norm(p),b=norm(r).replace(/\/$/,'');return a===b||a.startsWith(b+'/')};
const protectedRel=['.aledevos','.agents','.git','AGENTS.md'];
const protectedPath=p=>ws.some(w=>protectedRel.some(r=>within(p,path.join(w,r))));
const external=p=>ws.length===0||!ws.some(w=>within(p,w));
const allow=(reason,permissionOverrides=[])=>({decision:'allow',reason,permissionOverrides});
const deny=reason=>({decision:'deny',reason});
const governed=[
 /^node\s+\.aledevos\/runtime\/aledevos\.mjs\s+/,
 /^node\s+\.aledevos\/contextos\/runtime\/contextos\.mjs\s+/,
 /^node\s+\.aledevos\/skillsystem\/runtime\/(?:skillsystem|acquisition)\.mjs\s+/,
 /^node\s+\.aledevos\/uxui\/runtime\/(?:uxui|component-registry|design-bootstrap|design-review|motion|ui-quality)\.mjs\s+/,
 /^node\s+\.aledevos\/visualqa\/runtime\/(?:visualqa|browser-runner|regression|runtime-audit|visual-judge)\.mjs\s+/,
 /^node\s+\.aledevos\/efficiency\/runtime\/efficiency-governor\.mjs\s+/,
 /^node\s+\.aledevos\/release\/runtime\/v1-release\.mjs\s+/
];
let out;
if(tool==='run_command'){
 const cmd=String(args.CommandLine||'').trim().replaceAll('\\','/');
 out=governed.some(r=>r.test(cmd))?allow('AleDevOS governed runtime command',[`command(${cmd})`]):deny('AleDevOS denies arbitrary shell; only governed .aledevos runtime commands are allowed.');
}else if(['write_to_file','replace_file_content','multi_replace_file_content'].includes(tool)){
 const target=args.TargetFile||args.AbsolutePath||'';
 out=!target?deny('Missing target path.'):external(target)?deny('AleDevOS denies writes outside active workspace.'):protectedPath(target)?deny('AleDevOS control plane is immutable to product writers.'):allow('Product write inside workspace.');
}else if(['view_file','list_dir','find_by_name','grep_search'].includes(tool)){
 const target=args.AbsolutePath||args.DirectoryPath||args.SearchDirectory||args.SearchPath||'';
 out=target&&external(target)?deny('AleDevOS denies reads outside active workspace.'):allow('Workspace read.');
}else if(['search_web','read_url_content'].includes(tool)||tool.startsWith('browser_')){
 out=deny('AleDevOS adapter denies direct network/browser tools; use governed research/browser evidence flows.');
}else if(tool==='define_subagent'){
 out=deny('Dynamic subagent definitions are not permitted; use certified .agents/agents roles.');
}else{
 // invoke_subagent is not security-gated here because upstream versions have had a hook-bypass bug.
 // The orchestrator role is the only canonical role that receives invoke_subagent.
 out=allow('Tool is governed by role allowlist and Antigravity permissions.');
}
process.stdout.write(JSON.stringify(out));
