function baseEvidence(){return {
  document:{client_width:390,scroll_width:390,client_height:844,scroll_height:844,horizontal_overflow_px:0},
  layout:{viewport_escape_count:0,viewport_escapes:[],clipped_focusable_count:0,clipped_focusables:[]},
  accessibility:{dom_node_count:20,scan_truncated:false,focusable_count:1,focus_scan_truncated:false,unnamed_control_count:0,unnamed_controls:[],image_alt_missing_count:0,images_missing_alt:[],targets_total:1,targets:[{node_id:'f0',selector:'#ok',tag:'button',role:'button',width:44,height:44,inline_exception:false,spacing_exception:true,user_agent_exception:false}],target_size_violation_count:0,target_size_violations:[],text_contrast_total:1,text_contrast:[{selector:'main',text_sample:'ok',font_size_px:16,font_weight:400,large_text:false,measurable:true,ratio:7,reason:null}],text_contrast_violation_count:0,text_contrast_violations:[],text_contrast_unmeasurable_count:0,text_contrast_unmeasurable:[],keyboard_focus:{visited_count:1,cycle_detected:true,unreachable_count:0,unreachable:[],missing_indicator_count:0,missing_indicator:[],obscured_count:0,obscured:[],order:[{node_id:'f0'}]}}
}}
function mutate(e,mode){
  const a=e.accessibility,l=e.layout;
  if(mode==='overflow'){e.document.scroll_width=430;e.document.horizontal_overflow_px=40}
  if(mode==='escape'){l.viewport_escape_count=1;l.viewport_escapes=[{node_id:'f0',selector:'#wide'}]}
  if(mode==='clipped'){l.clipped_focusable_count=1;l.clipped_focusables=[{node_id:'f0',selector:'#clip'}]}
  if(mode==='unnamed'){a.unnamed_control_count=1;a.unnamed_controls=[{node_id:'f0',selector:'#nameless',tag:'button'}]}
  if(mode==='alt'){a.image_alt_missing_count=1;a.images_missing_alt=[{selector:'#hero'}]}
  if(mode==='target'){a.target_size_violation_count=1;a.target_size_violations=[{node_id:'f0',selector:'#tiny',width:16,height:16,inline_exception:false,spacing_exception:false,user_agent_exception:false}]}
  if(mode==='contrast'){a.text_contrast_violation_count=1;a.text_contrast_violations=[{selector:'p',text_sample:'bad',font_size_px:16,font_weight:400,large_text:false,measurable:true,ratio:2.1,required_ratio:4.5}]}
  if(mode==='unmeasurable'){a.text_contrast_unmeasurable_count=1;a.text_contrast_unmeasurable=[{selector:'p',reason:'background_image_or_gradient'}]}
  if(mode==='focus'){a.keyboard_focus.missing_indicator_count=1;a.keyboard_focus.missing_indicator=[{node_id:'f0',selector:'#focusless'}]}
  if(mode==='obscured'){a.keyboard_focus.obscured_count=1;a.keyboard_focus.obscured=[{node_id:'f0',selector:'#covered'}]}
  if(mode==='unreachable'){a.keyboard_focus.unreachable_count=1;a.keyboard_focus.unreachable=[{node_id:'f1'}]}
  if(mode==='focus-truncated'){a.focus_scan_truncated=true}
  if(mode==='dom-truncated'){a.scan_truncated=true}
  return e;
}
export async function doctor(config={}){return {ok:true,status:'FIXTURE_RUNTIME_READY',browser:config.browser||'chromium',package_id:'runtime-fixture',runtime_audit:true}}
export async function createSession(){return {metadata:{package_id:'runtime-fixture',browser_version:'fixture-1'},async audit(c){const mode=process.env.VQA_RUNTIME_MODE||'';if(mode==='fail')return {ok:false,status:'FIXTURE_AUDIT_FAIL'};let final_url=c.url;if(mode==='redirect-origin')final_url='http://example.invalid/';if(mode==='redirect-path')final_url=new URL('/other',c.url).toString();return {ok:true,navigation_status:200,final_url,page_error_count:0,console_error_count:0,state_attestation:c.ready_selector?'READY_SELECTOR_VISIBLE':'DEFAULT_ROUTE',duration_ms:9,evidence:mutate(baseEvidence(),mode)}} ,async close(){}}}
