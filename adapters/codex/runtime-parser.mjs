function safeNumber(v){return typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null}
function jsonLines(text){const out=[];for(const line of String(text||'').split(/\r?\n/)){const s=line.trim();if(!s)continue;try{out.push(JSON.parse(s))}catch{}}return out}
function nested(obj,paths){for(const p of paths){let v=obj;for(const k of p.split('.'))v=v?.[k];if(v!==undefined&&v!==null)return v}return null}
function tokenPair(obj){if(!obj||typeof obj!=='object')return null;const input=safeNumber(nested(obj,['input_tokens','inputTokens','input']));const output=safeNumber(nested(obj,['output_tokens','outputTokens','output']));if(input===null&&output===null)return null;return{input,output}}

export function parseRuntimeOutput(text){
  const rows=jsonLines(text),calls=new Set(),reads=new Set();let usage=null,model=null;
  for(const row of rows){if(row?.type==='turn.completed'){const tp=tokenPair(row.usage??row?.turn?.usage);if(tp)usage=tp}model=model||nested(row,['model','turn.model','item.model']);const item=row?.item??null;if(item&&['item.started','item.completed','item.updated'].includes(String(row.type))){const kind=String(item.type??'').toLowerCase();if(/command|tool|mcp|web_search|websearch/.test(kind)){const id=item.id??item.call_id??item.callId;if(id)calls.add(String(id));if(id&&/read_file|readfile|file_read/.test(kind))reads.add(String(id))}}}
  return{parser:'codex-jsonl',input_tokens:usage?.input??null,output_tokens:usage?.output??null,tool_calls:calls.size,files_read:reads.size,model:model?String(model):null,usage_source:usage?'turn.completed':'unavailable'};
}
