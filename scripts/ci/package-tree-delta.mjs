#!/usr/bin/env node
// Diagnostic: diff the immutable source package manifest against actual checkout bytes.
// No writes, no release or runtime PASS, machine-readable change ledger.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.cwd();
const manifest=JSON.parse(fs.readFileSync('release/templates/package-tree-manifest.json','utf8'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function excluded(rel){
 const top=rel.split('/')[0];
 return top==='.git'||top==='node_modules'||top==='.aledevos'||top.startsWith('.aledev')||
  rel==='MANIFEST.txt'||rel==='release/templates/package-tree-manifest.json'||
  rel==='release/templates/master-validation-package-baseline.json'||
  rel.startsWith('release/certifications/');
}
const entries=[];
function walk(dir){
 for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  const absolute=path.join(dir,e.name),rel=path.relative(root,absolute).replaceAll('\\','/');
  if(excluded(rel)||e.isSymbolicLink())continue;
  if(e.isDirectory())walk(absolute);
  else if(e.isFile())entries.push({path:rel,sha256:sha(fs.readFileSync(absolute)),size:fs.statSync(absolute).size});
 }
}
walk(root);entries.sort((a,b)=>a.path.localeCompare(b.path));
const earlier=new Map(manifest.entries.map(x=>[x.path,x]));
const current=new Map(entries.map(x=>[x.path,x]));
const changed=entries.filter(x=>!earlier.has(x.path)||earlier.get(x.path).sha256!==x.sha256||earlier.get(x.path).size!==x.size);
const removed=manifest.entries.filter(x=>!current.has(x.path)).map(x=>x.path);
console.log('PACKAGE_TREE_DELTA '+JSON.stringify({
 old_count:manifest.entries.length,new_count:entries.length,changed,removed,
 target_tree_sha256:sha(JSON.stringify(entries)),
 target_package_only:true
}));
