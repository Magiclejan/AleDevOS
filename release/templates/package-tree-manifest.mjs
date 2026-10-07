#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const packageRoot=path.resolve(here,'../..');
const args=process.argv.slice(2),[cmd]=args;
const take=(f,d=null)=>{const i=args.indexOf(f);return i>=0&&i+1<args.length?args[i+1]:d};
const norm=p=>String(p).replaceAll('\\','/').replace(/^\.\//,'');
const fileSha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())if(k!=='manifest_sha256')o[k]=stable(v[k]);return o}return v}
const sha=v=>crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
function excluded(rel){
  rel=norm(rel); const top=rel.split('/')[0];
  if(top==='.git'||top==='node_modules'||top==='.aledevos'||top.startsWith('.aledev'))return true;
  if(rel==='MANIFEST.txt')return true;
  if(rel==='release/templates/package-tree-manifest.json')return true;
  if(rel==='release/templates/master-validation-package-baseline.json')return true;
  if(rel.startsWith('release/certifications/'))return true;
  return false;
}
function entries(root){const out=[];function rec(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const abs=path.join(dir,e.name),rel=norm(path.relative(root,abs));if(excluded(rel))continue;if(e.isSymbolicLink())continue;if(e.isDirectory())rec(abs);else if(e.isFile())out.push({path:rel,sha256:fileSha(abs),size:fs.statSync(abs).size});}}rec(root);return out.sort((a,b)=>a.path.localeCompare(b.path));}
function build(root){const es=entries(root);const q={schema_version:'1.0',phase:'ALEDEVOS_PACKAGE_TREE_INTEGRITY',algorithm:'SHA-256',exclusions:['.git/**','node_modules/**','.aledevos/**','.aledev*/**','MANIFEST.txt','release/templates/package-tree-manifest.json','release/templates/master-validation-package-baseline.json','release/certifications/**'],file_count:es.length,entries:es,tree_sha256:crypto.createHash('sha256').update(JSON.stringify(es)).digest('hex'),manifest_sha256:''};q.manifest_sha256=sha(q);return q}
function verify(root,pth){const errors=[];let saved;try{saved=JSON.parse(fs.readFileSync(pth,'utf8').replace(/^\uFEFF/,''))}catch{return{status:'PACKAGE_TREE_MANIFEST_INVALID',valid:false,errors:['manifest_unreadable']}};if(saved.manifest_sha256!==sha(saved))errors.push('manifest_integrity_mismatch');const cur=build(root);if(saved.file_count!==cur.file_count)errors.push('file_count_drift');if(saved.tree_sha256!==cur.tree_sha256)errors.push('tree_sha256_drift');if(JSON.stringify(saved.entries)!==JSON.stringify(cur.entries))errors.push('tree_entries_drift');return{status:errors.length?'PACKAGE_TREE_MANIFEST_INVALID':'PACKAGE_TREE_MANIFEST_VALID',valid:errors.length===0,errors,file_count:cur.file_count,tree_sha256:cur.tree_sha256,manifest_sha256:saved.manifest_sha256,current_manifest_sha256:cur.manifest_sha256}}
const root=path.resolve(take('--root',packageRoot)),out=path.resolve(take('--out',path.join(root,'release/templates/package-tree-manifest.json')));
if(cmd==='generate'){const q=build(root);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(q,null,2)+'\n');console.log(JSON.stringify({status:'PACKAGE_TREE_MANIFEST_GENERATED',file_count:q.file_count,tree_sha256:q.tree_sha256,manifest_sha256:q.manifest_sha256,path:norm(path.relative(root,out))},null,2));process.exit(0)}
if(cmd==='verify'){const r=verify(root,out);console.log(JSON.stringify(r,null,2));process.exit(r.valid?0:4)}
console.log(JSON.stringify({status:'PACKAGE_TREE_MANIFEST_COMMAND_UNKNOWN'}));process.exit(2);
