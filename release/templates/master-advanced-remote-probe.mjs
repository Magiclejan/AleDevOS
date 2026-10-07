#!/usr/bin/env node
import os from 'node:os';
import crypto from 'node:crypto';
const args=process.argv.slice(2);
const take=(f,d=null)=>{const i=args.indexOf(f);return i>=0&&i+1<args.length?args[i+1]:d};
const nonce=take('--nonce'),payload64=take('--payload-base64'),expected=take('--payload-sha256'),machineId=take('--machine-id');
const fp=()=>crypto.createHash('sha256').update([os.platform(),os.arch(),os.release(),process.version,os.hostname()].join('|')).digest('hex');
if(!nonce||!payload64||!expected||!machineId){console.log(JSON.stringify({status:'REMOTE_ENDPOINT_INVALID',error:'required_args_missing'}));process.exit(2)}
let payload;try{payload=Buffer.from(payload64,'base64')}catch{console.log(JSON.stringify({status:'REMOTE_ENDPOINT_INVALID',error:'payload_invalid'}));process.exit(3)}
const actual=crypto.createHash('sha256').update(payload).digest('hex');
if(actual!==expected){console.log(JSON.stringify({status:'REMOTE_ENDPOINT_INVALID',error:'payload_sha256_mismatch'}));process.exit(4)}
console.log(JSON.stringify({schema_version:'1.0',phase:'MASTER_VALIDATION_P5_REMOTE_ENDPOINT',status:'REMOTE_ENDPOINT_OK',nonce,payload_sha256:actual,payload_size:payload.length,machine_id:machineId,hostname:os.hostname(),platform:os.platform(),arch:os.arch(),node_version:process.version,remote_fingerprint_sha256:fp()}));
