function safeNumber(v){return typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null}
function addNumber(a,b){return safeNumber(b)===null?a:(a??0)+b}
function jsonLines(text){const out=[];for(const line of String(text||'').split(/\r?\n/)){const s=line.trim();if(!s)continue;try{out.push(JSON.parse(s))}catch{}}return out}
function nested(obj,paths){for(const p of paths){let v=obj;for(const k of p.split('.'))v=v?.[k];if(v!==undefined&&v!==null)return v}return null}
function tokenPair(obj){if(!obj||typeof obj!=='object')return null;const input=safeNumber(nested(obj,['input_tokens','inputTokens','input']));const output=safeNumber(nested(obj,['output_tokens','outputTokens','output']));if(input===null&&output===null)return null;return{input,output}}

export function parseRuntimeOutput(text){
  const rows=jsonLines(text),calls=new Set(),reads=new Set();let sumInput=null,sumOutput=null,resultUsage=null,model=null;
  for(const row of rows){model=model||nested(row,['model','message.model']);if(row?.type==='assistant'&&row?.message){const tp=tokenPair(row.message.usage);if(tp){sumInput=addNumber(sumInput,tp.input);sumOutput=addNumber(sumOutput,tp.output)}for(const block of row.message.content??[]){if(block?.type!=='tool_use')continue;const id=block.id??block.tool_use_id;if(id)calls.add(String(id));const tool=String(block.name??'').toLowerCase();if(id&&['read','read_file','readfile'].includes(tool))reads.add(String(id))}}if(row?.type==='result'){const tp=tokenPair(row.usage);if(tp)resultUsage=tp}}
  return{parser:'claude-stream-json',input_tokens:resultUsage?.input??sumInput,output_tokens:resultUsage?.output??sumOutput,tool_calls:calls.size,files_read:reads.size,model:model?String(model):null,usage_source:resultUsage?'result':(sumInput!==null||sumOutput!==null)?'assistant_messages':'unavailable'};
}
