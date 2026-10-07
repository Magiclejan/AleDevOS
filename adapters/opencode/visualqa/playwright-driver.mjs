import fs from 'node:fs';
import path from 'node:path';

async function loadPlaywright() {
  for (const id of ['playwright', 'playwright-core']) {
    try { return { mod: await import(id), package_id: id }; } catch {}
  }
  const e = new Error('PLAYWRIGHT_PROVIDER_MISSING');
  e.code = 'PLAYWRIGHT_PROVIDER_MISSING';
  throw e;
}

export async function doctor(config = {}) {
  try {
    const { mod, package_id } = await loadPlaywright();
    const browserName = config.browser || 'chromium';
    if (!mod[browserName]) return { ok: false, status: 'BROWSER_ENGINE_UNAVAILABLE', package_id, browser: browserName };
    return { ok: true, status: 'BROWSER_PROVIDER_READY', package_id, browser: browserName, runtime_audit: true };
  } catch (e) {
    return { ok: false, status: e?.code || 'PLAYWRIGHT_PROVIDER_MISSING', package_id: null, browser: config.browser || 'chromium', runtime_audit: false };
  }
}

async function openPage(browser, config, c) {
  const context = await browser.newContext({
    viewport: { width: c.viewport.width, height: c.viewport.height },
    deviceScaleFactor: config.device_scale_factor ?? 1,
    locale: config.locale || 'en-US',
    timezoneId: config.timezone_id || 'UTC',
    colorScheme: config.color_scheme || 'light',
    reducedMotion: config.reduced_motion || 'reduce',
    serviceWorkers: config.service_workers || 'block'
  });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e?.message || e)));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  const started = Date.now();
  const response = await page.goto(c.url, { waitUntil: config.navigation_wait_until || 'domcontentloaded', timeout: config.navigation_timeout_ms || 20000 });
  if (c.ready_selector) await page.locator(c.ready_selector).waitFor({ state: 'visible', timeout: config.selector_timeout_ms || 8000 });
  if (config.wait_for_fonts) await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
  if (config.freeze_animations) await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}html{caret-color:transparent!important}' });
  if (config.stable_ms > 0) await page.waitForTimeout(config.stable_ms);
  if (config.fail_on_page_error && pageErrors.length) { const e = new Error('PAGE_RUNTIME_ERROR'); e.code = 'PAGE_RUNTIME_ERROR'; e.details = pageErrors; throw e; }
  if (config.fail_on_console_error && consoleErrors.length) { const e = new Error('PAGE_CONSOLE_ERROR'); e.code = 'PAGE_CONSOLE_ERROR'; e.details = consoleErrors; throw e; }
  return {context,page,response,pageErrors,consoleErrors,started};
}

function publicResult(page,response,pageErrors,consoleErrors,started,c,extra={}) {
  return {ok:true,navigation_status:response?.status?.()??null,final_url:page.url(),page_error_count:pageErrors.length,console_error_count:consoleErrors.length,state_attestation:c.ready_selector?'READY_SELECTOR_VISIBLE':'DEFAULT_ROUTE',duration_ms:Date.now()-started,...extra};
}

export async function createSession(config = {}) {
  const { mod, package_id } = await loadPlaywright();
  const browserName = config.browser || 'chromium';
  const engine = mod[browserName];
  if (!engine) throw Object.assign(new Error('BROWSER_ENGINE_UNAVAILABLE'), { code: 'BROWSER_ENGINE_UNAVAILABLE' });
  const browser = await engine.launch({ headless: true });
  const version = typeof browser.version === 'function' ? browser.version() : null;

  return {
    metadata: { provider: 'playwright', package_id, browser: browserName, browser_version: version },
    async capture(c) {
      fs.mkdirSync(path.dirname(c.output_path), { recursive: true });
      let opened;
      try {
        opened = await openPage(browser,config,c);
        const {context,page,response,pageErrors,consoleErrors,started}=opened;
        await page.screenshot({path:c.output_path,fullPage:!!config.full_page,animations:'disabled',caret:config.hide_caret?'hide':'initial',scale:config.screenshot_scale||'css'});
        return publicResult(page,response,pageErrors,consoleErrors,started,c);
      } finally { try { await opened?.context?.close(); } catch {} }
    },
    async audit(c) {
      let opened;
      try {
        opened=await openPage(browser,config,c);
        const {page,response,pageErrors,consoleErrors,started}=opened;
        const profile=c.profile||config.audit_profile||{};
        const staticEvidence=await page.evaluate(({maxNodes,maxSamples,targetMin,normalContrast,largeContrast,largePx,largeBoldPx,boldMin})=>{
          const all=[...document.querySelectorAll('*')];
          const scanTruncated=all.length>maxNodes;
          const nodes=all.slice(0,maxNodes);
          const sample=(a)=>a.slice(0,maxSamples);
          const rect=o=>({x:Number(o.x.toFixed(3)),y:Number(o.y.toFixed(3)),width:Number(o.width.toFixed(3)),height:Number(o.height.toFixed(3)),top:Number(o.top.toFixed(3)),right:Number(o.right.toFixed(3)),bottom:Number(o.bottom.toFixed(3)),left:Number(o.left.toFixed(3))});
          const styleVisible=(el)=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&r.width>0&&r.height>0&&!el.closest('[hidden],[inert],[aria-hidden="true"]')};
          const selector=(el)=>{if(el.id)return `#${CSS.escape(el.id)}`;const test=el.getAttribute('data-testid');if(test)return `[data-testid="${String(test).replaceAll('"','\\"')}"]`;const parts=[];let n=el;for(let d=0;n&&n.nodeType===1&&d<5;d++,n=n.parentElement){let p=n.tagName.toLowerCase();if(n.parentElement){const sib=[...n.parentElement.children].filter(x=>x.tagName===n.tagName);if(sib.length>1)p+=`:nth-of-type(${sib.indexOf(n)+1})`}parts.unshift(p)}return parts.join('>')};
          const role=(el)=>el.getAttribute('role')||({A:'link',BUTTON:'button',INPUT:'input',SELECT:'select',TEXTAREA:'textbox',SUMMARY:'button'}[el.tagName]||null);
          const name=(el)=>{const aria=el.getAttribute('aria-label');if(aria?.trim())return aria.trim();const ids=(el.getAttribute('aria-labelledby')||'').trim().split(/\s+/).filter(Boolean);if(ids.length){const t=ids.map(id=>document.getElementById(id)?.textContent||'').join(' ').trim();if(t)return t}if(el.labels?.length){const t=[...el.labels].map(x=>x.textContent||'').join(' ').trim();if(t)return t}const alt=el.getAttribute('alt');if(alt?.trim())return alt.trim();if(el.tagName==='INPUT'&&['submit','button','reset'].includes((el.getAttribute('type')||'').toLowerCase())){const v=el.value||el.getAttribute('value');if(v?.trim())return v.trim()}const t=(el.textContent||'').replace(/\s+/g,' ').trim();if(t)return t.slice(0,160);const title=el.getAttribute('title');return title?.trim()||''};
          const focusSelector='a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[contenteditable="true"],[tabindex]:not([tabindex="-1"])';
          const focusables=[...document.querySelectorAll(focusSelector)].filter(styleVisible).filter(el=>!el.matches('[disabled],[aria-disabled="true"]'));
          focusables.forEach((el,i)=>el.setAttribute('data-vqa-audit-id',`f${i}`));
          const clipInfo=(el)=>{const er=el.getBoundingClientRect();let l=0,t=0,r=innerWidth,b=innerHeight;for(let a=el.parentElement;a;a=a.parentElement){const s=getComputedStyle(a),ar=a.getBoundingClientRect();if(['hidden','clip','auto','scroll'].includes(s.overflowX)){l=Math.max(l,ar.left);r=Math.min(r,ar.right)}if(['hidden','clip','auto','scroll'].includes(s.overflowY)){t=Math.max(t,ar.top);b=Math.min(b,ar.bottom)}}const iw=Math.max(0,Math.min(er.right,r)-Math.max(er.left,l)),ih=Math.max(0,Math.min(er.bottom,b)-Math.max(er.top,t));return {clipped:iw+0.5<er.width||ih+0.5<er.height,visible_width:Number(iw.toFixed(3)),visible_height:Number(ih.toFixed(3))}};
          const escape=[];const clipped=[];for(const el of focusables){const r=el.getBoundingClientRect(),info={node_id:el.getAttribute('data-vqa-audit-id'),selector:selector(el),tag:el.tagName.toLowerCase(),role:role(el),rect:rect(r)};if(r.left<-0.5||r.right>innerWidth+0.5)escape.push(info);const ci=clipInfo(el);if(ci.clipped)clipped.push({...info,...ci})}
          const interactive=focusables.filter(el=>el.matches('a[href],button,input,select,textarea,summary,[role="button"],[role="link"],[role="checkbox"],[role="radio"],[role="switch"],[role="tab"],[contenteditable="true"]'));
          const unnamed=interactive.filter(el=>!name(el)).map(el=>({node_id:el.getAttribute('data-vqa-audit-id'),selector:selector(el),tag:el.tagName.toLowerCase(),role:role(el)}));
          const missingAlt=nodes.filter(el=>el.tagName==='IMG'&&styleVisible(el)&&!el.hasAttribute('alt')&&!['presentation','none'].includes(el.getAttribute('role')||'')&&el.getAttribute('aria-hidden')!=='true').map(el=>({selector:selector(el),src:(el.getAttribute('src')||'').slice(0,160)}));
          const targetRects=interactive.map(el=>({el,r:el.getBoundingClientRect()}));
          const targets=targetRects.map(({el,r},i)=>{const s=getComputedStyle(el),inlineException=el.tagName==='A'&&s.display==='inline'&&!!el.parentElement&&((el.parentElement.textContent||'').trim()!==(el.textContent||'').trim());let spacing=true;if(r.width<targetMin||r.height<targetMin){const cx=r.left+r.width/2,cy=r.top+r.height/2;for(let j=0;j<targetRects.length;j++){if(i===j)continue;const q=targetRects[j].r;const dx=Math.max(q.left-cx,0,cx-q.right),dy=Math.max(q.top-cy,0,cy-q.bottom);if(Math.hypot(dx,dy)<targetMin/2){spacing=false;break}}}const ua=['INPUT','SELECT','TEXTAREA'].includes(el.tagName)&&!el.hasAttribute('style');return {node_id:el.getAttribute('data-vqa-audit-id'),selector:selector(el),tag:el.tagName.toLowerCase(),role:role(el),width:Number(r.width.toFixed(3)),height:Number(r.height.toFixed(3)),inline_exception:inlineException,spacing_exception:spacing,user_agent_exception:ua}});
          function rgba(v){const m=String(v||'').match(/rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);return m?{r:+m[1],g:+m[2],b:+m[3],a:m[4]==null?1:+m[4]}:null}
          function blend(f,b){const a=f.a+b.a*(1-f.a);if(a<=0)return {r:255,g:255,b:255,a:1};return {r:(f.r*f.a+b.r*b.a*(1-f.a))/a,g:(f.g*f.a+b.g*b.a*(1-f.a))/a,b:(f.b*f.a+b.b*b.a*(1-f.a))/a,a}}
          function lum(c){const q=[c.r,c.g,c.b].map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*q[0]+.7152*q[1]+.0722*q[2]}
          function contrast(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
          function colors(el){let fg=rgba(getComputedStyle(el).color);if(!fg)return {measurable:false,reason:'foreground_color_unparsed'};let bg={r:255,g:255,b:255,a:1};const chain=[];for(let n=el;n;n=n.parentElement)chain.push(n);for(let i=chain.length-1;i>=0;i--){const s=getComputedStyle(chain[i]);if(s.backgroundImage&&s.backgroundImage!=='none')return {measurable:false,reason:'background_image_or_gradient'};if((s.mixBlendMode&&s.mixBlendMode!=='normal')||(s.filter&&s.filter!=='none')||(s.backdropFilter&&s.backdropFilter!=='none')||Number(s.opacity)<0.999)return {measurable:false,reason:'compositing_effect'};const c=rgba(s.backgroundColor);if(c&&c.a>0)bg=blend(c,bg)}fg=blend(fg,bg);return {measurable:true,ratio:contrast(fg,bg)}}
          const contrastRows=[];const seen=new Set();const walker=document.createTreeWalker(document.body||document.documentElement,NodeFilter.SHOW_TEXT);let tn;while((tn=walker.nextNode())){if(!tn.nodeValue?.trim())continue;const el=tn.parentElement;if(!el||!styleVisible(el)||seen.has(el))continue;seen.add(el);const s=getComputedStyle(el),fs=parseFloat(s.fontSize)||0,fw=parseInt(s.fontWeight,10)||400,col=colors(el),large=fs>=largePx||(fs>=largeBoldPx&&fw>=boldMin);contrastRows.push({selector:selector(el),text_sample:tn.nodeValue.trim().replace(/\s+/g,' ').slice(0,80),font_size_px:Number(fs.toFixed(3)),font_weight:fw,large_text:large,measurable:col.measurable,ratio:col.measurable?Number(col.ratio.toFixed(4)):null,reason:col.reason||null})}
          const targetViolations=targets.filter(x=>(x.width<targetMin||x.height<targetMin)&&!x.inline_exception&&!x.spacing_exception&&!x.user_agent_exception);
          const contrastViolations=contrastRows.filter(x=>x.measurable&&x.ratio<(x.large_text?largeContrast:normalContrast)).map(x=>({...x,required_ratio:x.large_text?largeContrast:normalContrast}));
          const contrastUnmeasurable=contrastRows.filter(x=>!x.measurable);
          const baseFocus={};for(const el of focusables){const s=getComputedStyle(el);baseFocus[el.getAttribute('data-vqa-audit-id')]={outlineStyle:s.outlineStyle,outlineWidth:s.outlineWidth,outlineColor:s.outlineColor,boxShadow:s.boxShadow,borderColor:s.borderColor,backgroundColor:s.backgroundColor}}
          window.__vqaAudit={baseFocus,focusableIds:focusables.map(x=>x.getAttribute('data-vqa-audit-id'))};
          return {document:{client_width:document.documentElement.clientWidth,scroll_width:document.documentElement.scrollWidth,client_height:document.documentElement.clientHeight,scroll_height:document.documentElement.scrollHeight,horizontal_overflow_px:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth)},layout:{viewport_escape_count:escape.length,viewport_escapes:sample(escape),clipped_focusable_count:clipped.length,clipped_focusables:sample(clipped)},accessibility:{dom_node_count:all.length,scan_truncated:scanTruncated,focusable_count:focusables.length,unnamed_control_count:unnamed.length,unnamed_controls:sample(unnamed),image_alt_missing_count:missingAlt.length,images_missing_alt:sample(missingAlt),targets:sample(targets),targets_total:targets.length,target_scan_truncated:targets.length>maxSamples,target_size_violation_count:targetViolations.length,target_size_violations:sample(targetViolations),text_contrast:sample(contrastRows),text_contrast_total:contrastRows.length,contrast_scan_truncated:contrastRows.length>maxSamples,text_contrast_violation_count:contrastViolations.length,text_contrast_violations:sample(contrastViolations),text_contrast_unmeasurable_count:contrastUnmeasurable.length,text_contrast_unmeasurable:sample(contrastUnmeasurable)}};
        },{maxNodes:profile.max_dom_nodes||20000,maxSamples:profile.max_samples_per_category||200,targetMin:profile.target_size_min_px||24,normalContrast:profile.normal_text_contrast_min||4.5,largeContrast:profile.large_text_contrast_min||3,largePx:profile.large_text_px||24,largeBoldPx:profile.large_bold_text_px||18.6667,boldMin:profile.bold_weight_min||700});

        const count=staticEvidence.accessibility.focusable_count||0,maxSteps=profile.max_focus_steps||500;const visited=new Map(),order=[],missing=[],obscured=[];let repeated=false;
        await page.evaluate(()=>{try{document.activeElement?.blur?.()}catch{};window.scrollTo(0,0)});
        const steps=Math.min(maxSteps,count+5);
        for(let i=0;i<steps&&count>0;i++){
          await page.keyboard.press('Tab');
          const f=await page.evaluate(()=>{const el=document.activeElement;if(!el||el===document.body||el===document.documentElement)return null;const id=el.getAttribute('data-vqa-audit-id');if(!id)return {node_id:null};const s=getComputedStyle(el),b=window.__vqaAudit?.baseFocus?.[id]||{};const r=el.getBoundingClientRect();const styleNow={outlineStyle:s.outlineStyle,outlineWidth:s.outlineWidth,outlineColor:s.outlineColor,boxShadow:s.boxShadow,borderColor:s.borderColor,backgroundColor:s.backgroundColor};const outline=parseFloat(s.outlineWidth)>0&&s.outlineStyle!=='none'&&s.outlineStyle!=='hidden';const changed=['outlineStyle','outlineWidth','outlineColor','boxShadow','borderColor','backgroundColor'].some(k=>String(styleNow[k])!==String(b[k]));const pts=[[Math.max(0,Math.min(innerWidth-1,r.left+r.width/2)),Math.max(0,Math.min(innerHeight-1,r.top+r.height/2))],[Math.max(0,Math.min(innerWidth-1,r.left+1)),Math.max(0,Math.min(innerHeight-1,r.top+1))],[Math.max(0,Math.min(innerWidth-1,r.right-1)),Math.max(0,Math.min(innerHeight-1,r.bottom-1))]];let seen=false;for(const [x,y] of pts){const hit=document.elementFromPoint(x,y);if(hit&&(el.contains(hit)||hit.contains(el))){seen=true;break}}return {node_id:id,selector:el.id?`#${CSS.escape(el.id)}`:`[data-vqa-audit-id="${id}"]`,tag:el.tagName.toLowerCase(),focus_indicator_visible:!!(outline||(s.boxShadow&&s.boxShadow!=='none')||changed),obscured:!seen,rect:{x:Number(r.x.toFixed(3)),y:Number(r.y.toFixed(3)),width:Number(r.width.toFixed(3)),height:Number(r.height.toFixed(3))}}});
          if(!f?.node_id)continue;if(visited.has(f.node_id)){repeated=true;break}visited.set(f.node_id,f);order.push(f);if(!f.focus_indicator_visible)missing.push(f);if(f.obscured)obscured.push(f);
        }
        const ids=await page.evaluate(()=>window.__vqaAudit?.focusableIds||[]);const unreachable=ids.filter(id=>!visited.has(id)).map(id=>({node_id:id}));
        staticEvidence.accessibility.focus_scan_truncated=count>maxSteps;
        staticEvidence.accessibility.keyboard_focus={visited_count:visited.size,cycle_detected:repeated,unreachable_count:unreachable.length,unreachable:unreachable.slice(0,profile.max_samples_per_category||200),missing_indicator_count:missing.length,missing_indicator:missing.slice(0,profile.max_samples_per_category||200),obscured_count:obscured.length,obscured:obscured.slice(0,profile.max_samples_per_category||200),order:order.slice(0,profile.max_samples_per_category||200)};
        return publicResult(page,response,pageErrors,consoleErrors,started,c,{evidence:staticEvidence});
      } finally { try { await opened?.context?.close(); } catch {} }
    },
    async close() { await browser.close(); }
  };
}
