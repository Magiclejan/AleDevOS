import fs from 'node:fs';
import path from 'node:path';
const base=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const changed=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4////fwAJ+wP99djxmgAAAABJRU5ErkJggg==','base64');
const minor=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgZWX9DwABMQEPYuuPPQAAAABJRU5ErkJggg==','base64');
const dimension=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADklEQVR42mNgYGD4DwIADvoE/FjYU/0AAAAASUVORK5CYII=','base64');
export async function doctor(config={}){return {ok:true,status:'FIXTURE_READY',browser:config.browser||'chromium',package_id:'fixture'}}
export async function createSession(config={}){
  return {metadata:{package_id:'fixture',browser_version:'fixture-1'},async capture(c){
    if(process.env.VQA_FIXTURE_MODE==='fail') return {ok:false,status:'FIXTURE_CAPTURE_FAIL'};
    fs.mkdirSync(path.dirname(c.output_path),{recursive:true});
    const mode=process.env.VQA_FIXTURE_MODE;
    if(mode==='nonpng') fs.writeFileSync(c.output_path,'not-png');
    else fs.writeFileSync(c.output_path,mode==='changed'?changed:mode==='minor'?minor:mode==='dimension'?dimension:base);
    let finalUrl=c.url;if(mode==='redirect-origin')finalUrl='http://example.invalid/';if(mode==='redirect-path')finalUrl=new URL('/other',c.url).toString();return {ok:true,navigation_status:200,final_url:finalUrl,page_error_count:0,console_error_count:0,state_attestation:c.ready_selector?'READY_SELECTOR_VISIBLE':'DEFAULT_ROUTE',duration_ms:7};
  },async close(){}};
}
