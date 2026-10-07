import http from 'node:http';
const s=http.createServer((req,res)=>{res.statusCode=200;res.setHeader('content-type','text/html');res.end('<!doctype html><html><body><main data-vqa-state="LOADING">ok</main></body></html>')});
s.listen(0,'127.0.0.1',()=>{process.stdout.write(String(s.address().port)+'\n')});
process.on('SIGTERM',()=>s.close(()=>process.exit(0)));
