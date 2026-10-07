import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const argv=process.argv.slice(2);
const take=(f,d=null)=>{const i=argv.indexOf(f);return i>=0&&i+1<argv.length?argv[i+1]:d};
const port=Number(take('--port','0'));
const portFile=take('--port-file');
const template=fs.readFileSync(path.join(here,'src','index.html'),'utf8');
const server=http.createServer((req,res)=>{
  const u=new URL(req.url||'/',`http://${req.headers.host||'127.0.0.1'}`);
  if(u.pathname!=='/'&&u.pathname!=='/health'){res.writeHead(404,{'content-type':'text/plain'});res.end('not found');return}
  if(u.pathname==='/health'){res.writeHead(200,{'content-type':'text/plain'});res.end('ok');return}
  const state=String(u.searchParams.get('vqaState')||'default').toLowerCase();
  const html=template.replace('<!--STATE-->',state==='loading'?'<div class="state" data-vqa-state="LOADING" role="status">Loading fixture</div>':'<div class="state" data-vqa-state="DEFAULT">Default fixture</div>');
  res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html);
});
server.listen(port,'127.0.0.1',()=>{const a=server.address();const p=typeof a==='object'&&a?a.port:null;if(portFile)fs.writeFileSync(portFile,String(p));process.stdout.write(String(p)+'\n')});
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>server.close(()=>process.exit(0)));
