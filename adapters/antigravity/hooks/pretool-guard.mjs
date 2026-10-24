#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const raw=fs.readFileSync(0,'utf8');
let input;try{input=JSON.parse(raw)}catch{process.stderr.write('AleDevOS Antigravity guard: invalid hook input\n');process.exit(2)}
const call=input.toolCall||{};const tool=String(call.name||'');const args=call.args||{};
const ws=(input.workspacePaths||[]).map(x=>path.resolve(String(x)));
if(ws.length===0)ws.push(path.resolve(process.cwd()));
const norm=p=>path.resolve(String(p||'')).replaceAll('\\','/');
const within=(p,r)=>{const a=norm(p),b=norm(r).replace(/\/$/,'');return a===b||a.startsWith(b+'/')};
const protectedRel=['.aledevos','.agents','.git','AGENTS.md'];
const external=p=>ws.length===0||!ws.some(w=>within(p,w));
const allow=(reason,permissionOverrides=[])=>({decision:'allow',reason,permissionOverrides});
const deny=reason=>({decision:'deny',reason});
const governed=[
 /^git\s+/,
 /^gh\s+/,
 /^docker(?:\s+|$)/,
 /^docker-compose(?:\s+|$)/,
 /^node\s+\.aledevos\/runtime\/aledevos\.mjs(?:\s+|$)/,
 /^node\s+\.aledevos\/contextos\/runtime\/contextos\.mjs(?:\s+|$)/,
 /^node\s+\.aledevos\/skillsystem\/runtime\/(?:skillsystem|acquisition)\.mjs(?:\s+|$)/,
 /^node\s+\.aledevos\/uxui\/runtime\/(?:uxui|component-registry|design-bootstrap|design-review|motion|ui-quality)\.mjs(?:\s+|$)/,
 /^node\s+\.aledevos\/visualqa\/runtime\/(?:visualqa|browser-runner|regression|runtime-audit|visual-judge)\.mjs(?:\s+|$)/,
 /^node\s+\.aledevos\/efficiency\/runtime\/efficiency-governor\.mjs(?:\s+|$)/,
 /^node\s+\.aledevos\/release\/runtime\/v1-release\.mjs(?:\s+|$)/
];

function checkWriteTarget(target){
 if(!target)return deny('Missing target path.');
 if(external(target))return deny('AleDevOS denies writes outside active workspace.');
 const matchedWs=ws.find(w=>within(target,w))||ws[0];
 const normRel=p=>String(p||'').replaceAll('\\','/').replace(/^\.\//,'').replace(/^\//,'');
 const rel=normRel(path.relative(matchedWs,path.resolve(String(target))));

 if(rel==='.git'||rel.startsWith('.git/')||rel==='AGENTS.md'){
  return deny('AleDevOS control plane is immutable to product writers.');
 }

 const isControlPlane=rel==='.aledevos'||rel.startsWith('.aledevos/')||rel==='.agents'||rel.startsWith('.agents/');
 if(isControlPlane){
  const currentStatePath=path.join(matchedWs,'.aledevos','state','current.json');
  if(!fs.existsSync(currentStatePath)){
   return deny('AleDevOS control plane is immutable to product writers.');
  }
  try{
   const cur=JSON.parse(fs.readFileSync(currentStatePath,'utf8').replace(/^\uFEFF/,''));
   const contractRel=cur.task_contract_path;
   if(!contractRel){
    return deny('AleDevOS control plane is immutable to product writers.');
   }
   const contractPath=path.join(matchedWs,contractRel);
   if(!fs.existsSync(contractPath)){
    return deny('AleDevOS control plane is immutable to product writers.');
   }
   const contract=JSON.parse(fs.readFileSync(contractPath,'utf8').replace(/^\uFEFF/,''));
   const approvedScope=Array.isArray(contract.approved_scope)
     ? contract.approved_scope.map(normRel)
     : (Array.isArray(cur.approved_scope)?cur.approved_scope.map(normRel):[]);
   if(!approvedScope.includes(rel)){
    return deny('AleDevOS control plane is immutable to product writers.');
   }
  }catch{
   return deny('AleDevOS control plane is immutable to product writers.');
  }
 }
 return allow('Product write inside workspace.');
}

let out;
if(tool==='run_command'){
 const cmd=String(args.CommandLine||'').trim().replaceAll('\\','/');
 const cliRoleMatch=cmd.match(/--caller-role(?:=|\s+)(?:['"]?)([a-zA-Z0-9_-]+)/);
 const payloadRole=String(input.role||input.caller||input.agent||input.callerRole||input.agent_type||process.env.ALEDEVOS_ROLE||'').trim();
 const caller=payloadRole||cliRoleMatch?.[1]||'orchestrator';

 if(cmd.includes('state judge')){
  const tokenMatch=cmd.match(/--session-token(?:=|\s+)(?:['"]?)([a-fA-F0-9_-]+)/);
  if(!tokenMatch||!tokenMatch[1]){
   out=deny('AleDevOS denies judge execution: caller lacks valid judge session capability token.');
  }
  if(!out){
   const judgeMatch=cmd.match(/--judge(?:=|\s+)(?:['"]?)([a-zA-Z0-9_-]+)/);
   const judgeName=judgeMatch?judgeMatch[1].replace(/^judge-/,''):'';
   const callerJudge=caller.replace(/^judge-/,'');
   const isJudgeRole=['requirements','regression','quality'].includes(callerJudge);
   const isJudgeCmd=Boolean(judgeName);
   if(isJudgeRole||isJudgeCmd){
    if(!judgeName||!isJudgeRole||judgeName!==callerJudge){
     out=deny(`Judge identity mismatch: caller '${caller}' is not authorized to record verdict for judge '${judgeName||'unknown'}'.`);
    }
   }
  }
 }
 if(!out){
  const hasChainedOperator=/[;&|]/.test(cmd);
  const isGitOrGh=/(?:^|[\s;&|\\\/])(?:git|gh)(?:\.exe)?(?:\s+|$)/i.test(cmd);
  const isPublisherCmd=/(?:^|\s)node\s+\.aledevos\/runtime\/aledevos\.mjs\s+publish(?:\s+|$)/i.test(cmd) || /(?:^|\s)node\s+\.aledevos\/runtime\/git-publisher\.mjs(?:\s+|$)/i.test(cmd);

  if(hasChainedOperator&&(isGitOrGh||isPublisherCmd)){
   out=deny('AleDevOS denies chained git/gh shell commands.');
  }else if(isPublisherCmd){
   let authorizedPublisher=(caller.toLowerCase()==='orchestrator');
   if(!authorizedPublisher){
    const tokenMatch=cmd.match(/--orchestrator-token(?:=|\s+)(?:['"]?)([a-fA-F0-9_-]+)/);
    const token=tokenMatch?tokenMatch[1]:null;
    if(token){
     const customStateMatch=cmd.match(/--state(?:=|\s+)(?:['"]?)([^'"\s]+)/);
     const matchedWs=ws.find(w=>within(process.cwd(),w))||ws[0];
     const statePaths=[
      customStateMatch?path.resolve(process.cwd(),customStateMatch[1]):null,
      path.join(matchedWs,'.aledevos','state','current.json')
     ].filter(Boolean);
     for(const sp of statePaths){
      if(fs.existsSync(sp)){
       try{
        const cur=JSON.parse(fs.readFileSync(sp,'utf8').replace(/^\uFEFF/,''));
        const tokenHash=crypto.createHash('sha256').update(token).digest('hex');
        if(cur.orchestrator_token_hash&&cur.orchestrator_token_hash===tokenHash){
         authorizedPublisher=true;
         break;
        }else if(cur.orchestrator_token&&cur.orchestrator_token===token){
         authorizedPublisher=true;
         break;
        }
       }catch{}
      }
     }
    }
   }
   if(!authorizedPublisher){
    if(cliRoleMatch&&cliRoleMatch[1].toLowerCase()==='orchestrator'){
     out=deny('AleDevOS denies publish execution: caller lacks valid orchestrator capability token.');
    }else{
     out=deny(`AleDevOS denies shell git/gh and publish execution to subagent role '${caller}'. Use governed orchestrator workflow instead.`);
    }
   }
  }else if(isGitOrGh&&caller.toLowerCase()!=='orchestrator'){
   out=deny(`AleDevOS denies shell git/gh and publish execution to subagent role '${caller}'. Use governed orchestrator workflow instead.`);
  }
 }
 if(!out){
  out=governed.some(r=>r.test(cmd))?allow('AleDevOS governed runtime command',[`command(${cmd})`]):deny('AleDevOS denies arbitrary shell; only governed .aledevos runtime commands are allowed.');
 }
}else if(['write_to_file','replace_file_content','multi_replace_file_content'].includes(tool)){
 const target=args.TargetFile||args.AbsolutePath||'';
 out=checkWriteTarget(target);
}else if(['view_file','list_dir','find_by_name','grep_search'].includes(tool)){
 const target=args.AbsolutePath||args.DirectoryPath||args.SearchDirectory||args.SearchPath||'';
 if(/(?:^|[\\/])\.private(?:[\\/]|$)/i.test(target)){
  out=deny('AleDevOS denies reads to private session secrets.');
 }else{
  out=target&&external(target)?deny('AleDevOS denies reads outside active workspace.'):allow('Workspace read.');
 }
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
