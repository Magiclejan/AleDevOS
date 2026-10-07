#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args=process.argv.slice(2);
const take=(flag,def=null)=>{const i=args.indexOf(flag);return i>=0&&i+1<args.length?args[i+1]:def};
const configFile=take('--config');
if(!configFile||!fs.existsSync(configFile))process.exit(21);
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const shaBytes=b=>crypto.createHash('sha256').update(b).digest('hex');
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).filter(k=>k!=='config_sha256').sort().map(k=>[k,stable(v[k])])):v;
const hashObj=v=>shaBytes(Buffer.from(JSON.stringify(stable(v))));
const atomic=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});const t=`${p}.${process.pid}.tmp`;fs.writeFileSync(t,JSON.stringify(v,null,2)+'\n');fs.renameSync(t,p)};
let cfg;try{cfg=read(configFile)}catch{process.exit(22)}
if(cfg?.schema_version!=='1.0'||cfg?.phase!=='ADVANCED_EXECUTION_P2_ISOLATED_WORKERS'||cfg.config_sha256!==hashObj(cfg))process.exit(23);
if(!cfg.worktree_root||!fs.existsSync(cfg.worktree_root)||!cfg.state_dir)process.exit(24);
try{process.chdir(cfg.worktree_root)}catch{process.exit(25)}
const heartbeatFile=path.join(cfg.state_dir,'heartbeat.json');
const controlFile=path.join(cfg.state_dir,'control.json');
const startedAt=new Date().toISOString();
let stopped=false;
const visibleEnvKeys=Object.keys(process.env).sort();
function heartbeat(status='RUNNING',reason=null){
 const h={schema_version:'1.0',phase:'ADVANCED_EXECUTION_P2_ISOLATED_WORKERS',worker_id:cfg.worker_id,task_id:cfg.task_id,pid:process.pid,status,cwd:process.cwd(),runtime_config_sha256:cfg.config_sha256,started_at:startedAt,last_heartbeat_at:new Date().toISOString(),visible_env_keys:visibleEnvKeys,reason,heartbeat_sha256:''};
 h.heartbeat_sha256=shaBytes(Buffer.from(JSON.stringify(Object.fromEntries(Object.keys(h).filter(k=>k!=='heartbeat_sha256').sort().map(k=>[k,h[k]])))));
 atomic(heartbeatFile,h);
}
function finish(reason){if(stopped)return;stopped=true;try{heartbeat('STOPPED',reason)}catch{};setTimeout(()=>process.exit(0),20).unref()}
process.on('SIGTERM',()=>finish('SIGTERM'));
process.on('SIGINT',()=>finish('SIGINT'));
process.on('uncaughtException',()=>{try{heartbeat('FAILED','UNCAUGHT_EXCEPTION')}catch{};process.exit(30)});
heartbeat('RUNNING',null);
const interval=Math.max(100,Number(cfg.heartbeat_interval_ms)||250);
const timer=setInterval(()=>{
 try{
  if(fs.existsSync(controlFile)){
   const c=read(controlFile);
   if(c?.worker_id===cfg.worker_id&&c?.action==='STOP'){clearInterval(timer);finish(String(c.reason||'STOP_REQUESTED'));return}
  }
  heartbeat('RUNNING',null);
 }catch{try{heartbeat('FAILED','HEARTBEAT_LOOP_ERROR')}catch{};clearInterval(timer);process.exit(31)}
},interval);
