#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(here, '..');
const args = process.argv.slice(2);
const [group, cmd] = args;
const HASH = /^[a-f0-9]{64}$/;

function take(flag, fallback = null) { const i = args.indexOf(flag); return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback; }
function out(v) { process.stdout.write(JSON.stringify(v, null, 2) + '\n'); }
function die(status, code = 1, extra = {}) { out({ status, ...extra }); process.exit(code); }
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')); }
function writeJson(p, v) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n', 'utf8'); }
function norm(p) { return String(p || '').replaceAll('\\', '/').replace(/^\.\//, ''); }
function rootOf(p) { const r = path.resolve(p || process.cwd()); if (!fs.existsSync(r) || !fs.statSync(r).isDirectory()) die('PROJECT_ROOT_INVALID', 90); return r; }
function inside(root, p) { const rr = path.resolve(root) + path.sep, aa = path.resolve(p); return aa === path.resolve(root) || aa.startsWith(rr); }
function rel(root, abs) { return norm(path.relative(root, abs)); }
function safeRel(v) { const n = norm(v); return !!n && !path.isAbsolute(v) && !n.split('/').includes('..') && !n.startsWith('/'); }
function relWithin(root, p) { if (!safeRel(p)) return null; const a = path.resolve(root, p); return inside(root, a) ? a : null; }
function fileSha(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) {
      if (!['evidence_sha256', 'report_sha256', 'preflight_sha256'].includes(k)) o[k] = stable(v[k]);
    }
    return o;
  }
  return v;
}
function sha(v) { return crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex'); }
function validSeal(o, field) { return !!o && HASH.test(String(o[field] || '')) && o[field] === sha(o); }
function policy() { return readJson(path.join(distRoot, 'policies', 'v1-release-policy.json')); }
function packageVersion(root) {
  const candidates = [path.join(root, 'VERSION.txt'), path.join(root, '.aledevos', 'release', 'VERSION.txt'), path.resolve(distRoot, '..', 'VERSION.txt')];
  for (const p of candidates) if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  return null;
}
function command(name, argv = [], cwd = process.cwd()) {
  const r = spawnSync(name, argv, { cwd, encoding: 'utf8', windowsHide: true, shell: false });
  return { ok: r.status === 0, status: r.status, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim(), error: r.error?.message || null };
}
function nodeRuntime(root, relPath, argv) {
  const p = path.join(root, '.aledevos', relPath);
  if (!fs.existsSync(p)) return { ok: false, status: null, obj: null, stdout: '', stderr: '', reason: `runtime_missing:${norm(relPath)}` };
  const r = command(process.execPath, [p, ...argv, '--project-root', root], root);
  let obj = null; try { obj = JSON.parse(r.stdout || '{}'); } catch {}
  return { ...r, obj };
}
function requiredCheck(id) { return policy().required_checks.find(x => x.id === id) || null; }
function artifactMap(e) { return new Map((e.artifacts || []).map(x => [x.role, x])); }
function artifactAbs(root, a) { const p = relWithin(root, a?.path); return p && fs.existsSync(p) && fs.statSync(p).isFile() ? p : null; }
function requireArtifact(root, m, role, errors) {
  const a = m.get(role); const p = artifactAbs(root, a);
  if (!a) errors.push(`artifact_missing:${role}`);
  else if (!p) errors.push(`artifact_path_invalid_or_missing:${role}`);
  return p;
}
function parseFrontmatterModel(agentPath) {
  if (!fs.existsSync(agentPath)) return null;
  const s = fs.readFileSync(agentPath, 'utf8');
  const m = s.match(/^model:\s*([^\r\n]+)$/m);
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null;
}
function resolveModelCapability(root) {
  const cfgPath = path.join(root, 'opencode.json');
  if (!fs.existsSync(cfgPath)) return { ok: false, reason: 'opencode_config_missing', model_ref: null, input: [] };
  let cfg; try { cfg = readJson(cfgPath); } catch { return { ok: false, reason: 'opencode_config_invalid', model_ref: null, input: [] }; }
  const agentModel = parseFrontmatterModel(path.join(root, '.opencode', 'agents', 'visual-judge.md'));
  const modelRef = agentModel || cfg.model || null;
  if (!modelRef || !String(modelRef).includes('/')) return { ok: false, reason: 'visual_judge_model_unresolved', model_ref: modelRef, input: [] };
  const [providerId, ...rest] = String(modelRef).split('/');
  const modelId = rest.join('/');
  const provider = cfg.providers?.[providerId];
  const model = provider?.models?.[modelId];
  const input = Array.isArray(model?.capabilities?.input) ? model.capabilities.input : [];
  return { ok: input.includes('image'), reason: input.includes('image') ? null : 'native_image_input_not_declared', model_ref: modelRef, input };
}
function securityInspection(root) {
  const errors = [];
  const cfgPath = path.join(root, 'opencode.json');
  if (!fs.existsSync(cfgPath)) return { ok: false, errors: ['opencode_config_missing'] };
  let cfg; try { cfg = readJson(cfgPath); } catch { return { ok: false, errors: ['opencode_config_invalid'] }; }
  const perms = cfg.permissions || [];
  for (const action of ['external_directory', 'webfetch', 'websearch', 'execute']) {
    if (!perms.some(x => x.action === action && x.resource === '*' && x.effect === 'deny')) errors.push(`global_deny_missing:${action}`);
  }
  const ep = cfg.experimental?.policies || [];
  for (const resource of ['shell:git push *', 'shell:git reset --hard *', 'shell:git clean *', 'shell:git commit *', 'shell:git rebase *', 'shell:git checkout *', 'shell:git switch *', 'shell:git add *', 'shell:npm publish *', 'shell:sudo *', 'shell:runas *']) {
    if (!ep.some(x => x.action === 'permission' && x.resource === resource && x.effect === 'deny')) errors.push(`dangerous_deny_missing:${resource}`);
  }
  const agents = ['visual-judge', 'visual-repair-controller', 'visual-capture-runner', 'visual-runtime-audit-runner'];
  for (const name of agents) {
    const fp = path.join(root, '.opencode', 'agents', `${name}.md`);
    if (!fs.existsSync(fp)) { errors.push(`agent_missing:${name}`); continue; }
    const s = fs.readFileSync(fp, 'utf8');
    if (!/action:\s*edit[\s\S]*?resource:\s*"\*"[\s\S]*?effect:\s*deny/.test(s)) errors.push(`agent_global_edit_deny_missing:${name}`);
  }
  const vj = path.join(root, '.opencode', 'agents', 'visual-judge.md');
  if (fs.existsSync(vj) && /browser-runner\.mjs run execute/.test(fs.readFileSync(vj, 'utf8'))) errors.push('visual_judge_capture_execution_forbidden');
  const vc = path.join(root, '.opencode', 'agents', 'visual-capture-runner.md');
  if (fs.existsSync(vc) && /visual-judge\.mjs judgment seal/.test(fs.readFileSync(vc, 'utf8'))) errors.push('visual_capture_self_judgment_forbidden');
  return { ok: errors.length === 0, errors };
}

function preflight(root) {
  const p = policy();
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const git = command('git', ['--version'], root);
  const oc = command('opencode', ['--version'], root);
  const p2 = nodeRuntime(root, 'visualqa/runtime/browser-runner.mjs', ['doctor']);
  const p4 = nodeRuntime(root, 'visualqa/runtime/runtime-audit.mjs', ['doctor']);
  const vision = resolveModelCapability(root);
  const security = securityInspection(root);
  const checks = {
    node: { status: nodeMajor >= p.minimum_node_major ? 'PASS' : 'BLOCKED', version: process.versions.node, minimum_major: p.minimum_node_major },
    git: { status: git.ok ? 'PASS' : 'BLOCKED', version: git.stdout || null, error: git.error || git.stderr || null },
    opencode: { status: oc.ok ? 'PASS' : 'BLOCKED', version: oc.stdout || null, error: oc.error || oc.stderr || null },
    playwright_capture_provider: { status: p2.ok && p2.obj?.status === 'BROWSER_RUNNER_READY' ? 'PASS' : 'BLOCKED', provider: p2.obj?.provider || null, reason: p2.obj?.provider?.status || p2.reason || p2.stderr || null },
    playwright_runtime_audit: { status: p4.ok && p4.obj?.status === 'RUNTIME_AUDIT_READY' ? 'PASS' : 'BLOCKED', provider: p4.obj?.provider || null, reason: p4.obj?.provider?.status || p4.reason || p4.stderr || null },
    native_image_visual_judge: { status: vision.ok ? 'PASS' : 'BLOCKED', model_ref: vision.model_ref, declared_input: vision.input, reason: vision.reason },
    security_permissions: { status: security.ok ? 'PASS' : 'BLOCKED', errors: security.errors }
  };
  const blockers = Object.entries(checks).filter(([, v]) => v.status !== 'PASS').map(([id, v]) => ({ id, reason: v.reason || v.error || v.errors || 'not_ready' }));
  const report = { schema_version: '1.0', phase: 'ALEDEVOS_V1_TARGET_PREFLIGHT', status: blockers.length ? 'TARGET_RUNTIME_BLOCKED' : 'TARGET_RUNTIME_READY', package_version: packageVersion(root), platform: { platform: process.platform, arch: process.arch }, checks, blockers, created_at: new Date().toISOString(), preflight_sha256: '' };
  report.preflight_sha256 = sha(report);
  const outPath = path.join(root, p.preflight_root, 'latest.json');
  writeJson(outPath, report);
  return { ...report, path: rel(root, outPath) };
}

function validateCheck(root, e) {
  const errors = [], details = {};
  if (e.status !== 'PASS') return { ok: true, errors, details: { declared_nonpass: true } };
  const m = artifactMap(e);
  if (e.check_id === 'real_playwright_capture') {
    const fp = requireArtifact(root, m, 'phase2_receipt', errors);
    if (fp) {
      const r = nodeRuntime(root, 'visualqa/runtime/browser-runner.mjs', ['run', 'verify', '--receipt', fp]);
      if (!r.ok || !r.obj?.valid) errors.push('phase2_receipt_invalid');
      const rec = r.obj?.receipt;
      if (!['playwright', 'playwright-core'].includes(rec?.provider?.package_id)) errors.push('real_playwright_package_not_attested');
      if (rec?.provider?.id !== 'playwright' || rec?.provider?.browser !== 'chromium') errors.push('target_browser_provider_mismatch');
      if (rec?.provider?.provenance !== 'ADAPTER_PROVIDER') errors.push('controlled_test_provider_not_allowed');
      if (typeof rec?.provider?.browser_version !== 'string' || !rec.provider.browser_version.trim()) errors.push('browser_version_missing');
      details.provider = rec?.provider || null;
    }
  } else if (e.check_id === 'real_runtime_audit') {
    const fp = requireArtifact(root, m, 'phase4_report', errors);
    if (fp) {
      const r = nodeRuntime(root, 'visualqa/runtime/runtime-audit.mjs', ['audit', 'verify', '--report', fp]);
      if (!r.ok || !r.obj?.valid) errors.push('phase4_report_invalid');
      const rep = r.obj?.report;
      if (rep?.status !== 'VISUAL_RUNTIME_AUDIT_PASS') errors.push('phase4_not_pass');
      if (!['playwright', 'playwright-core'].includes(rep?.provider?.package_id)) errors.push('real_playwright_package_not_attested');
      if (typeof rep?.provider?.browser_version !== 'string' || !rep.provider.browser_version.trim()) errors.push('browser_version_missing');
      if (rep?.provider?.provenance !== 'ADAPTER_PROVIDER') errors.push('controlled_test_provider_not_allowed');
      details.provider = rep?.provider || null;
    }
  } else if (e.check_id === 'native_image_visual_judge') {
    const fp = requireArtifact(root, m, 'phase5_judgment', errors);
    if (fp) {
      const r = nodeRuntime(root, 'visualqa/runtime/visual-judge.mjs', ['judgment', 'verify', '--judgment', fp]);
      if (!r.ok || !r.obj?.valid) errors.push('phase5_judgment_invalid');
      const j = r.obj?.judgment;
      if (!['VISUAL_JUDGMENT_PASS', 'VISUAL_JUDGMENT_FAIL'].includes(j?.status)) errors.push('native_judgment_must_be_observed_not_blocked');
      if (j?.claims?.native_visual_observation_attested !== true) errors.push('native_visual_observation_not_attested');
      if (j?.judge?.observation_mode !== policy().required_visual_observation_mode) errors.push('observation_mode_mismatch');
      if (typeof j?.judge?.model_ref !== 'string' || j.judge.model_ref.trim().length < 2) errors.push('judge_model_ref_missing');
      details.judge = j?.judge || null;
    }
  } else if (e.check_id === 'visual_fail_repair_pass') {
    const before = requireArtifact(root, m, 'before_judgment', errors);
    const cycle = requireArtifact(root, m, 'repair_cycle', errors);
    const acceptance = requireArtifact(root, m, 'acceptance', errors);
    if (before) {
      const r = nodeRuntime(root, 'visualqa/runtime/visual-judge.mjs', ['judgment', 'verify', '--judgment', before]);
      if (!r.ok || !r.obj?.valid || r.obj?.judgment?.status !== 'VISUAL_JUDGMENT_FAIL') errors.push('controlled_before_judgment_not_fail');
    }
    if (cycle) {
      const r = nodeRuntime(root, 'visualqa/runtime/visual-judge.mjs', ['cycle', 'verify', '--cycle', cycle]);
      if (!r.ok || !r.obj?.valid) errors.push('repair_cycle_invalid');
      if (r.obj?.cycle?.status !== 'VISUAL_REPAIR_CYCLE_PASS') errors.push('repair_cycle_not_pass');
      if (r.obj?.cycle?.attempt !== 1) errors.push('expected_repair_attempt_1');
      details.cycle_status = r.obj?.cycle?.status || null;
    }
    if (acceptance) {
      const r = nodeRuntime(root, 'visualqa/runtime/visual-judge.mjs', ['acceptance', 'verify', '--acceptance', acceptance]);
      if (!r.ok || !r.obj?.valid || r.obj?.acceptance?.status !== 'VISUAL_QA_PASS') errors.push('visual_acceptance_invalid');
    }
  } else if (e.check_id === 'visual_two_repair_exhaustion') {
    const cycle = requireArtifact(root, m, 'repair_cycle', errors);
    const state = requireArtifact(root, m, 'global_state', errors);
    const probe = requireArtifact(root, m, 'third_repair_probe', errors);
    if (cycle) {
      const r = nodeRuntime(root, 'visualqa/runtime/visual-judge.mjs', ['cycle', 'verify', '--cycle', cycle, '--state', state || path.join(root, '.aledevos/state/current.json')]);
      if (!r.ok || !r.obj?.valid) errors.push('exhaustion_cycle_invalid');
      if (r.obj?.cycle?.status !== 'VISUAL_REPAIR_EXHAUSTED' || r.obj?.cycle?.attempt !== 2) errors.push('two_repair_exhaustion_not_proven');
    }
    if (state) {
      let s = null; try { s = readJson(state); } catch { errors.push('global_state_unreadable'); }
      if (s) {
        if (s.repair_count !== 2 || s.max_repairs !== 2) errors.push('global_two_repair_cap_not_reached');
        const starts = (s.history || []).filter(x => x.type === 'REPAIR_START');
        if (starts.length !== 2) errors.push('repair_start_history_not_exactly_two');
        if (s.final_state !== 'FAILED') errors.push('exhaustion_global_state_not_failed');
      }
    }
    if (probe) {
      let q = null; try { q = readJson(probe); } catch { errors.push('third_repair_probe_unreadable'); }
      if (q && !(q.exit_code === 4 && q.stdout === 'MAX_REPAIRS_REACHED')) errors.push('third_repair_rejection_not_proven');
    }
  } else if (e.check_id === 'full_stack_real_project') {
    const state = requireArtifact(root, m, 'global_state', errors);
    if (state) {
      let s = null; try { s = readJson(state); } catch { errors.push('global_state_unreadable'); }
      if (s) {
        if (s.final_state !== 'PASS') errors.push('full_stack_final_state_not_pass');
        for (const g of ['scope', 'integrity', 'canonical']) if (s.gates?.[g]?.status !== 'PASS') errors.push(`gate_not_pass:${g}`);
        for (const j of ['requirements', 'regression', 'quality']) {
          const x = s.judges?.[j]; if (!x || x.score < 90 || x.blockers !== 0 || x.unverified !== 0) errors.push(`judge_not_pass:${j}`);
        }
        if ((s.acceptance_criteria || []).some(x => x.status !== 'VERIFIED')) errors.push('acceptance_criteria_not_all_verified');
      }
    }
  } else if (e.check_id === 'security_permissions_target') {
    const r = securityInspection(root); if (!r.ok) errors.push(...r.errors); details.inspection = r;
  } else if (e.check_id === 'deterministic_regression') {
    const fp = requireArtifact(root, m, 'regression_summary', errors);
    if (fp) {
      let q = null; try { q = readJson(fp); } catch { errors.push('regression_summary_unreadable'); }
      if (q) {
        const min=policy().deterministic_regression_minimums||{tests_passed:600,mjs_syntax_passed:53,json_parse_passed:124,failures:0};
        if (Number(q.failures) !== Number(min.failures||0)) errors.push('regression_failures_nonzero');
        if (Number(q.tests_passed) < Number(min.tests_passed||552)) errors.push('regression_test_count_below_frozen_baseline');
        if (Number(q.mjs_syntax_passed) < Number(min.mjs_syntax_passed||47)) errors.push('mjs_syntax_count_below_frozen_baseline');
        if (Number(q.json_parse_passed) < Number(min.json_parse_passed||112)) errors.push('json_parse_count_below_frozen_baseline');
        details.summary = q;
      }
    }
  } else errors.push('unknown_check_id');
  return { ok: errors.length === 0, errors, details };
}

function sealEvidence(root, inputPath, outPath) {
  const p = policy();
  let q; try { q = readJson(path.resolve(inputPath)); } catch { die('EVIDENCE_INPUT_INVALID', 120); }
  if (!requiredCheck(q.check_id)) die('EVIDENCE_CHECK_UNKNOWN', 121, { check_id: q.check_id });
  if (!['PASS', 'BLOCKED', 'FAIL'].includes(q.status)) die('EVIDENCE_STATUS_INVALID', 122);
  const artifacts = [];
  for (const a of Array.isArray(q.artifacts) ? q.artifacts : []) {
    if (!a?.role || !safeRel(a.path)) die('EVIDENCE_ARTIFACT_PATH_INVALID', 123, { artifact: a });
    const abs = relWithin(root, a.path);
    if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) die('EVIDENCE_ARTIFACT_MISSING', 124, { role: a.role, path: a.path });
    artifacts.push({ role: a.role, path: norm(a.path), sha256: fileSha(abs) });
  }
  const candidate = { schema_version: '1.0', phase: 'ALEDEVOS_V1_FINAL_VALIDATION', check_id: q.check_id, status: q.status, target: q.target || {}, artifacts, claims: q.claims || {}, notes: Array.isArray(q.notes) ? q.notes.map(String) : [], observed_at: q.observed_at || new Date().toISOString(), validation: {}, evidence_sha256: '' };
  const validation = validateCheck(root, candidate);
  candidate.validation = validation;
  if (candidate.status === 'PASS' && !validation.ok) die('TARGET_EVIDENCE_VALIDATION_FAILED', 125, { check_id: q.check_id, errors: validation.errors });
  candidate.evidence_sha256 = sha(candidate);
  const fp = outPath ? path.resolve(outPath) : path.join(root, p.evidence_root, `${q.check_id}.json`);
  if (!inside(root, fp)) die('EVIDENCE_OUTPUT_PATH_INVALID', 126);
  writeJson(fp, candidate);
  return { status: 'TARGET_EVIDENCE_SEALED', path: rel(root, fp), evidence: candidate };
}

function verifyEvidence(root, evidencePath) {
  const errors = [];
  const fp = path.resolve(evidencePath);
  if (!inside(root, fp) || !fs.existsSync(fp)) return { status: 'TARGET_EVIDENCE_INVALID', valid: false, errors: ['evidence_missing_or_external'] };
  let e; try { e = readJson(fp); } catch { return { status: 'TARGET_EVIDENCE_INVALID', valid: false, errors: ['evidence_unreadable'] }; }
  if (!validSeal(e, 'evidence_sha256')) errors.push('evidence_integrity_mismatch');
  if (!requiredCheck(e.check_id)) errors.push('check_unknown');
  for (const a of e.artifacts || []) {
    const abs = relWithin(root, a.path);
    if (!abs || !fs.existsSync(abs)) errors.push(`artifact_missing:${a.role}`);
    else if (fileSha(abs) !== a.sha256) errors.push(`artifact_drift:${a.role}`);
  }
  if (!errors.length) {
    const v = validateCheck(root, e);
    if (e.status === 'PASS' && !v.ok) errors.push(...v.errors.map(x => `validation:${x}`));
  }
  return { status: errors.length ? 'TARGET_EVIDENCE_INVALID' : 'TARGET_EVIDENCE_VALID', valid: errors.length === 0, errors, evidence: e, path: rel(root, fp) };
}

function gateEvaluate(root, outPath) {
  const p = policy();
  const checks = [];
  let failed = 0, blocked = 0, passed = 0;
  for (const def of p.required_checks) {
    const fp = path.join(root, p.evidence_root, `${def.id}.json`);
    if (!fs.existsSync(fp)) { checks.push({ id: def.id, status: 'MISSING', valid: false, evidence_path: null, errors: ['required_evidence_missing'] }); blocked++; continue; }
    const v = verifyEvidence(root, fp);
    if (!v.valid) { checks.push({ id: def.id, status: 'INVALID', valid: false, evidence_path: rel(root, fp), errors: v.errors }); failed++; continue; }
    const s = v.evidence.status;
    checks.push({ id: def.id, status: s, valid: true, evidence_path: rel(root, fp), evidence_sha256: v.evidence.evidence_sha256, errors: [] });
    if (s === 'PASS') passed++; else if (s === 'FAIL') failed++; else blocked++;
  }
  const status = failed ? 'V1_RELEASE_FAILED' : blocked ? 'V1_RELEASE_BLOCKED' : 'V1_RELEASE_READY';
  const report = { schema_version: '1.0', phase: 'ALEDEVOS_V1_RELEASE_GATE', status, package_version: packageVersion(root), required_checks: checks, summary: { total: p.required_checks.length, passed, blocked, failed, missing_or_invalid: checks.filter(x => ['MISSING', 'INVALID'].includes(x.status)).length }, non_claims: { dynamic_motion_quality: true, full_wcag_conformance: true }, created_at: new Date().toISOString(), report_sha256: '' };
  report.report_sha256 = sha(report);
  const fp = outPath ? path.resolve(outPath) : path.join(root, p.reports_root, 'latest.json');
  if (!inside(root, fp)) die('RELEASE_REPORT_OUTPUT_PATH_INVALID', 140);
  writeJson(fp, report);
  return { ...report, path: rel(root, fp) };
}

function gateVerify(root, reportPath) {
  const errors = [];
  const fp = path.resolve(reportPath);
  if (!inside(root, fp) || !fs.existsSync(fp)) return { status: 'V1_RELEASE_REPORT_INVALID', valid: false, errors: ['report_missing_or_external'] };
  let r; try { r = readJson(fp); } catch { return { status: 'V1_RELEASE_REPORT_INVALID', valid: false, errors: ['report_unreadable'] }; }
  if (!validSeal(r, 'report_sha256')) errors.push('report_integrity_mismatch');
  const current = gateEvaluate(root, path.join(root, policy().reports_root, '.verify-current.tmp.json'));
  try { fs.rmSync(path.join(root, policy().reports_root, '.verify-current.tmp.json'), { force: true }); } catch {}
  for (const k of ['status', 'package_version', 'required_checks', 'summary', 'non_claims']) if (JSON.stringify(r[k]) !== JSON.stringify(current[k])) errors.push(`report_field_drift:${k}`);
  return { status: errors.length ? 'V1_RELEASE_REPORT_INVALID' : 'V1_RELEASE_REPORT_VALID', valid: errors.length === 0, errors, report: r, path: rel(root, fp) };
}


function masterPolicy() { return policy().master_validation || null; }
function masterCheck(id) { return masterPolicy()?.checks?.find(x => x.id === id) || null; }
function masterPaths(root) {
  const m = masterPolicy();
  return {
    state: path.join(root, m.state_root),
    evidence: path.join(root, m.evidence_root),
    reports: path.join(root, m.reports_root),
    inputs: path.join(root, m.inputs_root),
    baseline: path.join(distRoot, 'templates', 'master-validation-package-baseline.json')
  };
}
function masterStable(v) {
  if (Array.isArray(v)) return v.map(masterStable);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) {
      if (!['master_evidence_sha256', 'master_report_sha256', 'master_certificate_sha256', 'baseline_sha256', 'manifest_sha256'].includes(k)) o[k] = masterStable(v[k]);
    }
    return o;
  }
  return v;
}
function masterSha(v) { return crypto.createHash('sha256').update(JSON.stringify(masterStable(v))).digest('hex'); }
function masterSealValid(o, field) { return !!o && HASH.test(String(o[field] || '')) && o[field] === masterSha(o); }
function masterPolicyValidate() {
  const m = masterPolicy(); const errors = [];
  if (!m || m.schema_version !== '1.0') errors.push('master_policy_missing_or_version_invalid');
  const checks = Array.isArray(m?.checks) ? m.checks : [];
  const ids = checks.map(x => x.id);
  if (ids.length !== new Set(ids).size) errors.push('duplicate_check_id');
  const known = new Set(ids);
  for (const c of checks) {
    if (!c.id || !c.group || !c.validator || !Array.isArray(c.depends_on)) errors.push(`check_shape_invalid:${c.id || 'unknown'}`);
    for (const d of c.depends_on || []) if (!known.has(d)) errors.push(`unknown_dependency:${c.id}:${d}`);
    if ((c.depends_on || []).includes(c.id)) errors.push(`self_dependency:${c.id}`);
  }
  const visiting = new Set(), done = new Set();
  function visit(id) {
    if (done.has(id)) return;
    if (visiting.has(id)) { errors.push(`dependency_cycle:${id}`); return; }
    visiting.add(id);
    const c = checks.find(x => x.id === id);
    for (const d of c?.depends_on || []) visit(d);
    visiting.delete(id); done.add(id);
  }
  for (const id of ids) visit(id);
  const auto = checks.filter(x => x.automatic);
  if (auto.length !== 1 || auto[0]?.id !== 'package_certifications_current') errors.push('automatic_check_contract_invalid');
  return { status: errors.length ? 'MASTER_VALIDATION_POLICY_INVALID' : 'MASTER_VALIDATION_POLICY_VALID', valid: errors.length === 0, check_count: checks.length, groups: [...new Set(checks.map(x => x.group))], errors, policy_sha256: m ? masterSha(m) : null };
}
function packageTreeManifestVerify(packageRoot) {
  const errors=[], mp=path.join(packageRoot,'release','templates','package-tree-manifest.json');
  if(!fs.existsSync(mp)) return {status:'PACKAGE_TREE_MANIFEST_INVALID',valid:false,errors:['package_tree_manifest_missing'],path:norm(path.relative(packageRoot,mp))};
  let saved; try{saved=readJson(mp)}catch{return{status:'PACKAGE_TREE_MANIFEST_INVALID',valid:false,errors:['package_tree_manifest_unreadable'],path:norm(path.relative(packageRoot,mp))}};
  function excluded(relp){const r=norm(relp),top=r.split('/')[0];if(top==='.git'||top==='node_modules'||top==='.aledevos'||top.startsWith('.aledev'))return true;if(r==='MANIFEST.txt'||r==='release/templates/package-tree-manifest.json'||r==='release/templates/master-validation-package-baseline.json'||r.startsWith('release/certifications/'))return true;return false}
  const entries=[];function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const a=path.join(d,e.name),r=norm(path.relative(packageRoot,a));if(excluded(r))continue;if(e.isSymbolicLink())continue;if(e.isDirectory())walk(a);else if(e.isFile())entries.push({path:r,sha256:fileSha(a),size:fs.statSync(a).size});}}walk(packageRoot);entries.sort((a,b)=>a.path.localeCompare(b.path));
  const curTree=crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex');
  const cur={...saved,entries,file_count:entries.length,tree_sha256:curTree,manifest_sha256:''};cur.manifest_sha256=masterSha(cur);
  if(!masterSealValid(saved,'manifest_sha256'))errors.push('package_tree_manifest_integrity_mismatch');
  if(saved.file_count!==entries.length)errors.push('package_tree_file_count_drift');
  if(saved.tree_sha256!==curTree)errors.push('package_tree_sha256_drift');
  if(JSON.stringify(saved.entries)!==JSON.stringify(entries))errors.push('package_tree_entries_drift');
  return {status:errors.length?'PACKAGE_TREE_MANIFEST_INVALID':'PACKAGE_TREE_MANIFEST_VALID',valid:errors.length===0,errors,path:norm(path.relative(packageRoot,mp)),file_count:entries.length,tree_sha256:curTree,manifest_sha256:saved.manifest_sha256,file_sha256:fileSha(mp)};
}
function baselineVerify(root) {
  const errors = [], pth = masterPaths(root).baseline;
  if (!fs.existsSync(pth)) return { status: 'MASTER_PACKAGE_BASELINE_INVALID', valid: false, errors: ['baseline_missing'], path: rel(root, pth) };
  let b; try { b = readJson(pth); } catch { return { status: 'MASTER_PACKAGE_BASELINE_INVALID', valid: false, errors: ['baseline_unreadable'], path: rel(root, pth) }; }
  if (!masterSealValid(b, 'baseline_sha256')) errors.push('baseline_integrity_mismatch');
  if (b.schema_version !== '1.0') errors.push('baseline_schema_version_invalid');
  if (b.package_version !== packageVersion(root)) errors.push('baseline_package_version_mismatch');
  if (!Array.isArray(b.certificates) || !b.certificates.length) errors.push('certificate_inventory_missing');
  if (Number(b.certificate_count) !== Number((b.certificates || []).length)) errors.push('certificate_count_mismatch');
  const packageRoot = path.resolve(distRoot, '..');
  const sourceMode = fs.existsSync(path.join(packageRoot, 'release', 'certifications')) && fs.existsSync(path.join(packageRoot, 'adapters'));
  const certDetails = [];
  let packageTree = null;
  if (sourceMode) {
    packageTree=packageTreeManifestVerify(packageRoot);
    if(!packageTree.valid) errors.push(...packageTree.errors);
    if(!b.package_tree_manifest_sha256) errors.push('package_tree_manifest_sha_missing');
    else if(packageTree.file_sha256!==b.package_tree_manifest_sha256) errors.push('package_tree_manifest_sha_drift');
    for (const c of b.certificates || []) {
      const fp = relWithin(packageRoot, c.path);
      if (!fp || !fs.existsSync(fp)) { errors.push(`certificate_missing:${c.id}`); certDetails.push({id:c.id,status:'MISSING'}); continue; }
      let q = null; try { q = readJson(fp); } catch { errors.push(`certificate_unreadable:${c.id}`); certDetails.push({id:c.id,status:'INVALID'}); continue; }
      const ev = q.evidence_sha256 || null;
      const st = q.status || null;
      if (ev !== c.evidence_sha256) errors.push(`certificate_evidence_drift:${c.id}`);
      if (st !== c.status) errors.push(`certificate_status_drift:${c.id}`);
      for (const inp of q.inputs || []) {
        if (!inp.path || !inp.sha256) continue;
        const inputRel = c.input_base ? norm(path.posix.join(c.input_base, norm(inp.path))) : norm(inp.path);
        const ip = relWithin(packageRoot, inputRel);
        if (!ip || !fs.existsSync(ip)) errors.push(`certificate_input_missing:${c.id}:${inp.path}`);
        else if (fileSha(ip) !== inp.sha256) errors.push(`certificate_input_drift:${c.id}:${inp.path}`);
      }
      certDetails.push({id:c.id,status:errors.some(e=>e.includes(`:${c.id}`))?'DRIFT':'PASS',evidence_sha256:ev});
    }
  }
  return { status: errors.length ? 'MASTER_PACKAGE_BASELINE_INVALID' : 'MASTER_PACKAGE_BASELINE_VALID', valid: errors.length === 0, source_mode: sourceMode, package_version: packageVersion(root), certificates: certDetails, package_tree: packageTree, errors, baseline_sha256: b.baseline_sha256, path: sourceMode ? norm(path.relative(packageRoot,pth)) : norm(path.relative(root,pth)) };
}
function masterValidatorModule(name) {
  if (['PACKAGE_CERTIFICATES','DETERMINISTIC_REGRESSION'].includes(name)) return { implemented: true, builtin: true, path: null };
  const file = path.join(distRoot, 'templates', `master-validator-${String(name).toLowerCase().replaceAll('_','-')}.mjs`);
  return { implemented: fs.existsSync(file), builtin: false, path: file };
}
function validateRegressionSummary(q) {
  const min = masterPolicy().minimums || {}, errors = [];
  if (Number(q.failures) !== Number(min.failures || 0)) errors.push('regression_failures_nonzero');
  for (const [k,field] of [['tests_passed','tests_passed'],['mjs_syntax_passed','mjs_syntax_passed'],['json_parse_passed','json_parse_passed'],['toml_parse_passed','toml_parse_passed']]) {
    if (Number(q[field]) < Number(min[k] || 0)) errors.push(`${field}_below_master_baseline`);
  }
  return { ok: errors.length === 0, errors, minimums: min };
}
async function masterExternalValidate(root, check, evidence) {
  const info = masterValidatorModule(check.validator);
  if (!info.implemented) return { ok: false, deferred: true, errors: [`validator_not_implemented:${check.validator}`], details: {} };
  if (info.builtin) return { ok: false, deferred: false, errors: ['builtin_validator_dispatched_externally'], details: {} };
  try {
    const mod = await import(pathToFileURL(info.path).href + `?v=${fileSha(info.path)}`);
    if (typeof mod.validate !== 'function') return { ok:false,deferred:false,errors:['validator_export_missing'],details:{} };
    const r = await mod.validate({ root, check, evidence, helpers: { readJson, fileSha, relWithin, inside, norm, sha: masterSha } });
    return { ok: !!r?.ok, deferred: false, errors: Array.isArray(r?.errors)?r.errors:[], details:r?.details||{} };
  } catch (e) { return { ok:false,deferred:false,errors:[`validator_runtime_error:${e?.message||String(e)}`],details:{} }; }
}
function masterArtifactMap(e) { return new Map((e.artifacts || []).map(x => [x.role, x])); }
async function masterValidateEvidence(root, e) {
  const check = masterCheck(e.check_id); const errors = [], details = {};
  if (!check) return { ok:false,deferred:false,errors:['check_unknown'],details };
  if (e.status !== 'PASS') return { ok:true,deferred:false,errors,details:{declared_nonpass:true} };
  if (check.validator === 'PACKAGE_CERTIFICATES') {
    const r = baselineVerify(root); if (!r.valid) errors.push(...r.errors); details.package = r; return {ok:errors.length===0,deferred:false,errors,details};
  }
  if (check.validator === 'DETERMINISTIC_REGRESSION') {
    const m = masterArtifactMap(e), a = m.get('regression_summary');
    if (!a) errors.push('artifact_missing:regression_summary');
    else {
      const fp = relWithin(root,a.path);
      if (!fp || !fs.existsSync(fp)) errors.push('artifact_path_invalid_or_missing:regression_summary');
      else { let q=null; try{q=readJson(fp)}catch{errors.push('regression_summary_unreadable')}; if(q){const r=validateRegressionSummary(q);errors.push(...r.errors);details.summary=q;details.minimums=r.minimums;} }
    }
    return {ok:errors.length===0,deferred:false,errors,details};
  }
  return await masterExternalValidate(root, check, e);
}
async function masterEvidenceSeal(root, inputPath, outPath) {
  let q; try { q=readJson(path.resolve(inputPath)); } catch { die('MASTER_EVIDENCE_INPUT_INVALID',160); }
  const check=masterCheck(q.check_id); if(!check) die('MASTER_EVIDENCE_CHECK_UNKNOWN',161,{check_id:q.check_id});
  if(!['PASS','BLOCKED','FAIL'].includes(q.status)) die('MASTER_EVIDENCE_STATUS_INVALID',162);
  const artifacts=[];
  for(const a of Array.isArray(q.artifacts)?q.artifacts:[]){if(!a?.role||!safeRel(a.path))die('MASTER_EVIDENCE_ARTIFACT_PATH_INVALID',163,{artifact:a});const abs=relWithin(root,a.path);if(!abs||!fs.existsSync(abs)||!fs.statSync(abs).isFile())die('MASTER_EVIDENCE_ARTIFACT_MISSING',164,{role:a.role,path:a.path});artifacts.push({role:a.role,path:norm(a.path),sha256:fileSha(abs)});}
  const candidate={schema_version:'1.0',phase:'ALEDEVOS_V1_MASTER_VALIDATION',check_id:q.check_id,group:check.group,validator:check.validator,status:q.status,target:q.target||{},artifacts,claims:q.claims||{},notes:Array.isArray(q.notes)?q.notes.map(String):[],observed_at:q.observed_at||new Date().toISOString(),validation:{},master_evidence_sha256:''};
  const validation=await masterValidateEvidence(root,candidate); candidate.validation=validation;
  if(candidate.status==='PASS'&&!validation.ok){if(validation.deferred)die('MASTER_CHECK_VALIDATOR_NOT_IMPLEMENTED',165,{check_id:q.check_id,validator:check.validator,errors:validation.errors});die('MASTER_EVIDENCE_VALIDATION_FAILED',166,{check_id:q.check_id,errors:validation.errors});}
  candidate.master_evidence_sha256=masterSha(candidate);
  const fp=outPath?path.resolve(outPath):path.join(root,masterPolicy().evidence_root,`${q.check_id}.json`);if(!inside(root,fp))die('MASTER_EVIDENCE_OUTPUT_PATH_INVALID',167);writeJson(fp,candidate);return{status:'MASTER_EVIDENCE_SEALED',path:rel(root,fp),evidence:candidate};
}
async function masterEvidenceVerify(root,evidencePath){
  const errors=[];const fp=path.resolve(evidencePath);if(!inside(root,fp)||!fs.existsSync(fp))return{status:'MASTER_EVIDENCE_INVALID',valid:false,errors:['evidence_missing_or_external']};let e;try{e=readJson(fp)}catch{return{status:'MASTER_EVIDENCE_INVALID',valid:false,errors:['evidence_unreadable']}};
  if(!masterSealValid(e,'master_evidence_sha256'))errors.push('evidence_integrity_mismatch');const check=masterCheck(e.check_id);if(!check)errors.push('check_unknown');
  if(check&&(e.group!==check.group||e.validator!==check.validator))errors.push('check_contract_drift');
  for(const a of e.artifacts||[]){const abs=relWithin(root,a.path);if(!abs||!fs.existsSync(abs))errors.push(`artifact_missing:${a.role}`);else if(fileSha(abs)!==a.sha256)errors.push(`artifact_drift:${a.role}`)}
  if(!errors.length&&e.status==='PASS'){const v=await masterValidateEvidence(root,e);if(!v.ok)errors.push(...v.errors.map(x=>`validation:${x}`));}
  return{status:errors.length?'MASTER_EVIDENCE_INVALID':'MASTER_EVIDENCE_VALID',valid:errors.length===0,errors,evidence:e,path:rel(root,fp)};
}

function masterCertificationInputs() {
  const packageRoot=path.resolve(distRoot,'..');
  const files=[
    'release/engine/v1-release.mjs',
    'release/policies/v1-release-policy.json',
    'release/schemas/master-validation-evidence.schema.json',
    'release/schemas/master-validation-report.schema.json',
    'release/templates/MASTER_VALIDATION_EVIDENCE.example.json',
    'release/templates/master-validation-package-baseline.json',
    'tests/master-validation-phase1.test.mjs',
    'scripts/51-self-test-master-validation-phase1.ps1',
    'adapters/opencode/.opencode/agents/v1-release-validator.md',
    'adapters/codex/.codex/agents/v1-release-validator.toml',
    'adapters/claude-code/.claude/agents/v1-release-validator.md',
    'adapters/antigravity/.agents/agents/v1-release-validator.md'
  ];
  return files.map(p=>({path:p,sha256:fs.existsSync(path.join(packageRoot,p))?fileSha(path.join(packageRoot,p)):null}));
}
function masterCertificationRun(root,outPath){
  const pol=masterPolicyValidate(),bp=baselineVerify(root),inputs=masterCertificationInputs(),missing=inputs.filter(x=>!x.sha256).map(x=>x.path);
  const good=pol.valid&&bp.valid&&missing.length===0;
  const cert={schema_version:'1.0',phase:'MASTER_VALIDATION_P1',status:good?'MASTER_VALIDATION_P1_PACKAGE_CERTIFIED':'MASTER_VALIDATION_P1_PACKAGE_CERTIFICATION_FAILED',package_only:true,target_runtime_validation:'DEFERRED_P2_P8',claims:{current_stack_matrix:true,legacy_gate_retained_non_authoritative:true,required_checks:masterPolicy()?.checks?.length||0,builtin_validators:['PACKAGE_CERTIFICATES','DETERMINISTIC_REGRESSION'],future_validators_fail_closed:true,final_freeze_authority:'MASTER_GATE_ONLY'},policy_status:pol.status,package_baseline_status:bp.status,deterministic_tests:47,inputs,master_certificate_sha256:''};cert.master_certificate_sha256=masterSha(cert);
  if(outPath){const fp=path.resolve(outPath);fs.mkdirSync(path.dirname(fp),{recursive:true});writeJson(fp,cert);}
  return cert;
}
function masterCertificationVerify(root,certPath){if(!fs.existsSync(certPath))return{status:'MASTER_VALIDATION_P1_CERTIFICATE_MISSING',valid:false};let saved;try{saved=readJson(certPath)}catch{return{status:'MASTER_VALIDATION_P1_CERTIFICATE_INVALID',valid:false}};const cur=masterCertificationRun(root,null);const valid=saved.status==='MASTER_VALIDATION_P1_PACKAGE_CERTIFIED'&&masterSealValid(saved,'master_certificate_sha256')&&saved.master_certificate_sha256===cur.master_certificate_sha256&&cur.status==='MASTER_VALIDATION_P1_PACKAGE_CERTIFIED';return{status:valid?'MASTER_VALIDATION_P1_CERTIFICATE_VALID':'MASTER_VALIDATION_P1_CERTIFICATE_STALE_OR_TAMPERED',valid,saved_sha256:saved.master_certificate_sha256||null,current_sha256:cur.master_certificate_sha256};}

function masterMatrix(root) {
  const pol = masterPolicyValidate(); const bp=baselineVerify(root); const checks=[]; const m=masterPolicy();
  for(const c of m.checks){const info=masterValidatorModule(c.validator);checks.push({id:c.id,group:c.group,validator:c.validator,validator_implemented:info.implemented,automatic:!!c.automatic,depends_on:c.depends_on,status:c.id==='package_certifications_current'?(bp.valid?'PASS':'FAIL'):'PENDING'});}
  return{schema_version:'1.0',phase:m.phase,status:pol.valid&&bp.valid?'MASTER_VALIDATION_MATRIX_READY':'MASTER_VALIDATION_MATRIX_BLOCKED',package_version:packageVersion(root),check_count:checks.length,policy:pol,package_baseline:{status:bp.status,valid:bp.valid},checks,non_claims:m.non_claims};
}
async function masterGateEvaluate(root,outPath){
  const m=masterPolicy();const policyCheck=masterPolicyValidate();const bp=baselineVerify(root);const results=[];const byId=new Map();let failed=0,blocked=0,passed=0;
  for(const def of m.checks){let row;
    if(def.id==='package_certifications_current'){row={id:def.id,group:def.group,status:bp.valid?'PASS':'FAIL',valid:bp.valid,automatic:true,evidence_path:null,errors:bp.errors||[]};}
    else{const fp=path.join(root,m.evidence_root,`${def.id}.json`);if(!fs.existsSync(fp))row={id:def.id,group:def.group,status:'MISSING',valid:false,automatic:false,evidence_path:null,errors:['required_evidence_missing']};else{const v=await masterEvidenceVerify(root,fp);row={id:def.id,group:def.group,status:v.valid?v.evidence.status:'INVALID',valid:v.valid,automatic:false,evidence_path:rel(root,fp),evidence_sha256:v.evidence?.master_evidence_sha256||null,errors:v.errors};}}
    results.push(row);byId.set(def.id,row);
  }
  for(const def of m.checks){const row=byId.get(def.id);if(row.status==='PASS'){const unmet=def.depends_on.filter(d=>byId.get(d)?.status!=='PASS');if(unmet.length){row.status='INVALID';row.valid=false;row.errors.push(...unmet.map(x=>`dependency_not_pass:${x}`));}}}
  for(const row of results){if(row.status==='PASS')passed++;else if(['FAIL','INVALID'].includes(row.status))failed++;else blocked++;}
  if(!policyCheck.valid){failed++;results.push({id:'master_policy_integrity',group:'CONTROL_PLANE',status:'FAIL',valid:false,automatic:true,evidence_path:null,errors:policyCheck.errors});}
  const status=failed?'V1_RELEASE_FAILED':blocked?'V1_RELEASE_BLOCKED':'V1_RELEASE_READY';
  const groups={};for(const r of results){groups[r.group]??={total:0,passed:0,blocked:0,failed:0};groups[r.group].total++;if(r.status==='PASS')groups[r.group].passed++;else if(['FAIL','INVALID'].includes(r.status))groups[r.group].failed++;else groups[r.group].blocked++;}
  const report={schema_version:'1.0',phase:'ALEDEVOS_V1_MASTER_VALIDATION_GATE',status,package_version:packageVersion(root),master_policy_sha256:policyCheck.policy_sha256,package_baseline_sha256:bp.baseline_sha256||null,required_checks:results,summary:{total:m.checks.length,passed,blocked,failed},groups,non_claims:m.non_claims,legacy_gate_authorizes_v1_freeze:false,created_at:new Date().toISOString(),master_report_sha256:''};report.master_report_sha256=masterSha(report);
  const fp=outPath?path.resolve(outPath):path.join(root,m.reports_root,'latest.json');if(!inside(root,fp))die('MASTER_REPORT_OUTPUT_PATH_INVALID',168);writeJson(fp,report);return{...report,path:rel(root,fp)};
}
async function masterGateVerify(root,reportPath){const errors=[];const fp=path.resolve(reportPath);if(!inside(root,fp)||!fs.existsSync(fp))return{status:'MASTER_RELEASE_REPORT_INVALID',valid:false,errors:['report_missing_or_external']};let r;try{r=readJson(fp)}catch{return{status:'MASTER_RELEASE_REPORT_INVALID',valid:false,errors:['report_unreadable']}};if(!masterSealValid(r,'master_report_sha256'))errors.push('report_integrity_mismatch');const tmp=path.join(root,masterPolicy().reports_root,'.master-verify.tmp.json');const cur=await masterGateEvaluate(root,tmp);try{fs.rmSync(tmp,{force:true})}catch{};for(const k of ['status','package_version','master_policy_sha256','package_baseline_sha256','required_checks','summary','groups','non_claims','legacy_gate_authorizes_v1_freeze'])if(JSON.stringify(r[k])!==JSON.stringify(cur[k]))errors.push(`report_field_drift:${k}`);return{status:errors.length?'MASTER_RELEASE_REPORT_INVALID':'MASTER_RELEASE_REPORT_VALID',valid:errors.length===0,errors,report:r,path:rel(root,fp)}}

const root = rootOf(take('--project-root', process.cwd()));
try {
  if (group === 'master' && cmd === 'policy') { const r=masterPolicyValidate(); out(r); process.exit(r.valid?0:4); }
  if (group === 'master' && cmd === 'matrix') { const r=masterMatrix(root); out(r); process.exit(r.status==='MASTER_VALIDATION_MATRIX_READY'?0:4); }
  if (group === 'master' && cmd === 'package') { const r=baselineVerify(root); out(r); process.exit(r.valid?0:4); }
  if (group === 'master' && cmd === 'certify') { const r=masterCertificationRun(root,take('--out')); out(r); process.exit(r.status==='MASTER_VALIDATION_P1_PACKAGE_CERTIFIED'?0:4); }
  if (group === 'master' && cmd === 'verify-certificate') { const c=take('--certificate',path.join(path.resolve(distRoot,'..'),'release','certifications','master-validation-p1.json')); const r=masterCertificationVerify(root,path.resolve(c)); out(r); process.exit(r.valid?0:4); }
  if (group === 'master-evidence' && cmd === 'seal') { const i=take('--input'); if(!i) die('MASTER_EVIDENCE_INPUT_REQUIRED',2); const r=await masterEvidenceSeal(root,i,take('--out')); out(r); process.exit(0); }
  if (group === 'master-evidence' && cmd === 'verify') { const e=take('--evidence'); if(!e) die('MASTER_EVIDENCE_PATH_REQUIRED',2); const r=await masterEvidenceVerify(root,e); out(r); process.exit(r.valid?0:3); }
  if (group === 'master-gate' && cmd === 'evaluate') { const r=await masterGateEvaluate(root,take('--out')); out(r); process.exit(r.status==='V1_RELEASE_READY'?0:r.status==='V1_RELEASE_BLOCKED'?4:7); }
  if (group === 'master-gate' && cmd === 'verify') { const pth=take('--report'); if(!pth) die('MASTER_RELEASE_REPORT_REQUIRED',2); const r=await masterGateVerify(root,pth); out(r); process.exit(r.valid?0:3); }
  if (group === 'system' && cmd === 'preflight') { const r = preflight(root); out(r); process.exit(r.status === 'TARGET_RUNTIME_READY' ? 0 : 4); }
  if (group === 'security' && cmd === 'inspect') { const r = securityInspection(root); out({ status: r.ok ? 'SECURITY_PERMISSIONS_PASS' : 'SECURITY_PERMISSIONS_BLOCKED', ...r }); process.exit(r.ok ? 0 : 4); }
  if (group === 'evidence' && cmd === 'seal') { const i = take('--input'); if (!i) die('EVIDENCE_INPUT_REQUIRED', 2); const r = sealEvidence(root, i, take('--out')); out(r); process.exit(0); }
  if (group === 'evidence' && cmd === 'verify') { const e = take('--evidence'); if (!e) die('EVIDENCE_PATH_REQUIRED', 2); const r = verifyEvidence(root, e); out(r); process.exit(r.valid ? 0 : 3); }
  if (group === 'gate' && cmd === 'evaluate') { const r = gateEvaluate(root, take('--out')); out(r); process.exit(r.status === 'V1_RELEASE_READY' ? 0 : r.status === 'V1_RELEASE_BLOCKED' ? 4 : 7); }
  if (group === 'gate' && cmd === 'verify') { const pth = take('--report'); if (!pth) die('RELEASE_REPORT_REQUIRED', 2); const r = gateVerify(root, pth); out(r); process.exit(r.valid ? 0 : 3); }
  die('V1_RELEASE_COMMAND_UNKNOWN', 2, { usage: ['system preflight', 'security inspect', 'evidence seal --input <json>', 'evidence verify --evidence <json>', 'gate evaluate', 'gate verify --report <json>'] });
} catch (e) {
  die(e?.code || 'V1_RELEASE_RUNTIME_FAILED', e?.exitCode || 199, { message: e?.message || String(e) });
}
