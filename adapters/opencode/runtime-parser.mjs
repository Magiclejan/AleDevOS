function safeNumber(v){return typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null}
function addNumber(a,b){return safeNumber(b)===null?a:(a??0)+b}
function jsonLines(text){const out=[];for(const line of String(text||'').split(/\r?\n/)){const s=line.trim();if(!s)continue;try{out.push(JSON.parse(s))}catch{}}return out}
function nested(obj,paths){for(const p of paths){let v=obj;for(const k of p.split('.'))v=v?.[k];if(v!==undefined&&v!==null)return v}return null}
function tokenPair(obj){if(!obj||typeof obj!=='object')return null;const input=safeNumber(nested(obj,['input_tokens','inputTokens','input']));const output=safeNumber(nested(obj,['output_tokens','outputTokens','output']));if(input===null&&output===null)return null;return{input,output}}
function modelString(provider,model){if(!model)return null;return provider?String(provider)+'/'+String(model):String(model)}
function safeDiagnostic(v){if(v===undefined||v===null)return null;const s=String(v).replace(/[^A-Za-z0-9._:-]/g,'_').slice(0,120);return s||null}

export function parseRuntimeOutput(text){
  const rows=jsonLines(text),calls=new Set(),reads=new Set();let sessionId=null,model=null,stepInput=null,stepOutput=null,lastMessageUsage=null,errorType=null,errorCode=null;
  for(const row of rows){
    sessionId=sessionId||nested(row,['sessionID','sessionId','properties.sessionID','part.sessionID']);
    const part=row?.part??row?.properties?.part??null,info=row?.properties?.info??row?.message??null;
    if(row?.type==='error'){
      const err=row?.error??row?.properties?.error??null;
      errorType=errorType||safeDiagnostic(err?.name??err?.type);
      errorCode=errorCode||safeDiagnostic(err?.code??err?.data?.code??err?.data?.statusCode??err?.data?.status);
    }
    if(info?.role==='assistant'){const tp=tokenPair(info.tokens);if(tp)lastMessageUsage=tp;model=model||modelString(info.providerID??info.provider_id,info.modelID??info.model_id)}
    const isStep=row?.type==='step_finish'||row?.type==='step-finish'||part?.type==='step-finish'||part?.type==='step_finish';
    if(isStep){const tp=tokenPair(part?.tokens??row?.tokens);if(tp){stepInput=addNumber(stepInput,tp.input);stepOutput=addNumber(stepOutput,tp.output)}}
    const candidate=part?.type==='tool'?part:(row?.type==='tool_use'||row?.type==='tool-use'?row:null);
    if(candidate){const id=candidate.callID??candidate.callId??candidate.id;if(id)calls.add(String(id));const tool=String(candidate.tool??candidate.name??'').toLowerCase();if(id&&['read','read_file','readfile'].includes(tool))reads.add(String(id))}
  }
  const useSteps=stepInput!==null||stepOutput!==null;
  return{parser:'opencode-jsonl',session_id:sessionId?String(sessionId):null,model,input_tokens:useSteps?stepInput:lastMessageUsage?.input??null,output_tokens:useSteps?stepOutput:lastMessageUsage?.output??null,tool_calls:calls.size,files_read:reads.size,usage_source:useSteps?'step_finish':lastMessageUsage?'assistant_message':'unavailable',error_type:errorType,error_code:errorCode};
}

export function parseFallback(text){
  let doc;try{doc=JSON.parse(String(text||''))}catch{return{parser:'opencode-sanitized-export',input_tokens:null,output_tokens:null,tool_calls:null,files_read:null,model:null,usage_source:'unavailable'}}
  let input=null,output=null,model=null;const calls=new Set(),reads=new Set();
  for(const msg of doc?.messages??[]){const info=msg?.info??{};if(info.role==='assistant')model=model||modelString(info.providerID??info.provider_id,info.modelID??info.model_id);for(const part of msg?.parts??[]){if(part?.type==='step-finish'||part?.type==='step_finish'){const tp=tokenPair(part.tokens);if(tp){input=addNumber(input,tp.input);output=addNumber(output,tp.output)}}if(part?.type==='tool'){const id=part.callID??part.callId??part.id;if(id)calls.add(String(id));const tool=String(part.tool??part.name??'').toLowerCase();if(id&&['read','read_file','readfile'].includes(tool))reads.add(String(id))}}}
  return{parser:'opencode-sanitized-export',input_tokens:input,output_tokens:output,tool_calls:calls.size,files_read:reads.size,model,usage_source:(input!==null||output!==null)?'sanitized_session_export':'unavailable'};
}
