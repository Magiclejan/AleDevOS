#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(here, '..');
const args = process.argv.slice(2);
const [group, cmd] = args;
const HASH = /^[a-f0-9]{64}$/;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function take(flag, fallback = null) {
  const i = args.indexOf(flag);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
}
function fail(status, code = 1, obj = null) {
  process.stdout.write(JSON.stringify(obj || { status }, null, 2) + '\n');
  process.exit(code);
}
function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
}
function writeJson(p, v) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n', 'utf8');
}
function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) {
      if (!['plan_sha256', 'run_sha256', 'integrity_sha256', 'contract_sha256', 'review_sha256'].includes(k)) {
        o[k] = stable(v[k]);
      }
    }
    return o;
  }
  return v;
}
function sha(v) {
  return crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(stable(v))).digest('hex');
}
function fileSha(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}
function norm(p) {
  return String(p || '').replaceAll('\\', '/').replace(/^\.\//, '');
}
function rootOf(p) {
  const r = path.resolve(p || process.cwd());
  if (!fs.existsSync(r) || !fs.statSync(r).isDirectory()) fail('PROJECT_ROOT_INVALID', 90);
  return r;
}
function inside(root, p) {
  const rr = path.resolve(root) + path.sep;
  const aa = path.resolve(p);
  return aa === path.resolve(root) || aa.startsWith(rr);
}
function safeRel(v) {
  const n = norm(v);
  return !!n && !path.isAbsolute(v) && !n.split('/').includes('..') && !n.startsWith('/');
}
function idOk(v, re) {
  return typeof v === 'string' && new RegExp(re).test(v);
}
function policy() {
  return readJson(path.join(distRoot, 'policies', 'visualqa-policy.json')).phase1;
}
function validSeal(o, field) {
  return !!o && typeof o[field] === 'string' && HASH.test(o[field]) && o[field] === sha(o);
}
function asProjectRel(root, abs) {
  return norm(path.relative(root, abs));
}
function pngOk(p) {
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return false;
  const b = fs.readFileSync(p);
  return b.length >= 8 && b.subarray(0, 8).equals(PNG);
}
function relativeWithin(root, rel) {
  if (!safeRel(rel)) return null;
  const a = path.resolve(root, rel);
  return inside(root, a) ? a : null;
}

function readResponsive(root) {
  const p = policy();
  const fp = path.join(root, p.responsive_policy_path);
  if (!fs.existsSync(fp)) fail('RESPONSIVE_POLICY_MISSING', 91);
  let o;
  try { o = readJson(fp); } catch { fail('RESPONSIVE_POLICY_UNREADABLE', 92); }
  if (p.require_active_responsive_policy && o.status !== 'ACTIVE') {
    fail('RESPONSIVE_POLICY_NOT_ACTIVE', 93, { status: 'RESPONSIVE_POLICY_NOT_ACTIVE', current_status: o.status || null });
  }
  if (!Array.isArray(o.viewports) || !o.viewports.length) fail('RESPONSIVE_VIEWPORTS_MISSING', 94);
  if (typeof o.integrity_sha256 !== 'string' || !HASH.test(o.integrity_sha256)) fail('RESPONSIVE_POLICY_UNSEALED', 95);
  return { path: fp, obj: o, file_sha256: fileSha(fp) };
}

function sourceSnapshot(root, files, max) {
  const out = [];
  const seen = new Set();
  for (const raw of files || []) {
    const rel = norm(raw);
    if (seen.has(rel)) fail('CHANGED_FILE_DUPLICATE', 96, { status: 'CHANGED_FILE_DUPLICATE', path: rel });
    seen.add(rel);
    if (out.length >= max) fail('CHANGED_FILE_LIMIT', 97);
    const abs = relativeWithin(root, rel);
    if (!abs) fail('CHANGED_FILE_PATH_INVALID', 98, { status: 'CHANGED_FILE_PATH_INVALID', path: raw });
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) fail('CHANGED_FILE_MISSING', 99, { status: 'CHANGED_FILE_MISSING', path: rel });
    out.push({ path: rel, sha256: fileSha(abs), bytes: fs.statSync(abs).size });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

function validateBaseUrl(v, p) {
  let u;
  try { u = new URL(v); } catch { return 'base_url_invalid'; }
  if (!p.allowed_protocols.includes(u.protocol)) return 'base_url_protocol_forbidden';
  if (!p.default_allowed_hosts.includes(u.hostname)) return 'base_url_host_not_allowlisted';
  if (u.username || u.password) return 'base_url_credentials_forbidden';
  return null;
}

function readStateContract(root, rel) {
  if (!rel) return null;
  const abs = relativeWithin(root, rel);
  if (!abs || !fs.existsSync(abs)) fail('STATE_CONTRACT_MISSING', 100, { status: 'STATE_CONTRACT_MISSING', path: rel });
  const o = readJson(abs);
  if (typeof o.contract_sha256 !== 'string' || !HASH.test(o.contract_sha256)) {
    fail('STATE_CONTRACT_UNSEALED', 101, { status: 'STATE_CONTRACT_UNSEALED', path: rel });
  }
  return { path: rel, obj: o, file_sha256: fileSha(abs) };
}

function contractSurfaceStates(contract, surfaceId) {
  if (!contract) return null;
  const s = (contract.obj.surfaces || []).find(x => x.id === surfaceId);
  if (!s) fail('STATE_CONTRACT_SURFACE_MISSING', 102, { status: 'STATE_CONTRACT_SURFACE_MISSING', surface_id: surfaceId });
  const req = Array.isArray(s.required_states) ? s.required_states : [];
  const ev = Array.isArray(s.evidence) ? s.evidence.map(x => x.state) : [];
  return new Set([...req, ...ev].map(String));
}

function caseId(surface, state, viewport) {
  return `${surface}--${state}--${viewport}`.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
}

function createPlan(root, inputPath, outPath) {
  const p = policy();
  const q = readJson(inputPath);
  const errors = [];
  if (!idOk(q.task_id, p.task_id_pattern)) errors.push('task_id_invalid');
  if (q.evidence_id != null && !idOk(q.evidence_id, p.evidence_id_pattern || p.task_id_pattern)) errors.push('evidence_id_invalid');
  const urlErr = validateBaseUrl(q.base_url, p);
  if (urlErr) errors.push(urlErr);
  const surfaces = Array.isArray(q.surfaces) ? q.surfaces : [];
  if (!surfaces.length) errors.push('surfaces_required');
  if (surfaces.length > p.max_surfaces) errors.push('surface_limit_exceeded');
  if (errors.length) fail('CAPTURE_REQUEST_INVALID', 110, { status: 'CAPTURE_REQUEST_INVALID', errors });

  const responsive = readResponsive(root);
  const vpMap = new Map((responsive.obj.viewports || []).map(v => [v.id, v]));
  const seenSurface = new Set();
  const seenCase = new Set();
  const cases = [];

  for (const s of surfaces) {
    if (!idOk(s.id, p.surface_id_pattern)) errors.push(`surface_id_invalid:${s.id ?? ''}`);
    if (seenSurface.has(s.id)) errors.push(`surface_duplicate:${s.id}`);
    seenSurface.add(s.id);
    if (typeof s.route !== 'string' || !s.route.startsWith('/') || s.route.startsWith('//') || s.route.includes('://')) errors.push(`route_invalid:${s.id}`);

    const vps = Array.isArray(s.viewport_ids) ? s.viewport_ids : [];
    const states = Array.isArray(s.states) ? s.states : [];
    if (!vps.length) errors.push(`viewport_required:${s.id}`);
    if (vps.length > p.max_viewports_per_surface) errors.push(`viewport_limit:${s.id}`);
    if (!states.length) errors.push(`state_required:${s.id}`);
    if (states.length > p.max_states_per_surface) errors.push(`state_limit:${s.id}`);
    if (new Set(vps).size !== vps.length) errors.push(`viewport_duplicate:${s.id}`);
    if (new Set(states).size !== states.length) errors.push(`state_duplicate:${s.id}`);

    const contract = s.state_contract_path ? readStateContract(root, s.state_contract_path) : null;
    const allowedStates = contractSurfaceStates(contract, s.id);
    for (const st of states) {
      if (!idOk(st, p.state_id_pattern)) errors.push(`state_id_invalid:${s.id}:${st}`);
      if (allowedStates && !allowedStates.has(st)) errors.push(`state_not_in_contract:${s.id}:${st}`);
    }

    for (const vid of vps) {
      const vp = vpMap.get(vid);
      if (!vp) {
        errors.push(`viewport_unknown:${s.id}:${vid}`);
        continue;
      }
      for (const st of states) {
        const cid = caseId(s.id, st, vid);
        if (seenCase.has(cid)) {
          errors.push(`case_id_collision:${cid}`);
          continue;
        }
        seenCase.add(cid);
        const rel = norm(path.join(p.artifacts_root, q.task_id, ...(q.evidence_id ? [q.evidence_id] : []), `${cid}${p.artifact_extension}`));
        cases.push({
          case_id: cid,
          surface_id: s.id,
          route: s.route,
          state: st,
          viewport: { id: vp.id, width: vp.width, height: vp.height ?? null, expectation: vp.expectation ?? null },
          state_contract_path: s.state_contract_path || null,
          expected_screenshot_path: rel
        });
      }
    }
  }

  if (cases.length > p.max_cases) errors.push('case_limit_exceeded');
  if (errors.length) fail('CAPTURE_REQUEST_INVALID', 111, { status: 'CAPTURE_REQUEST_INVALID', errors });

  const plan = {
    schema_version: '1.0',
    phase: 'VISUAL_QA_P1',
    task_id: q.task_id,
    evidence_id: q.evidence_id || null,
    base_url: q.base_url,
    runner_status: 'NOT_EXECUTED_PHASE1',
    claims: { screenshot_capture_executed: false, visual_quality_verified: false, visual_regression_verified: false },
    responsive_policy_path: p.responsive_policy_path,
    responsive_policy_sha256: responsive.file_sha256,
    source_snapshot: sourceSnapshot(root, q.changed_files || [], p.max_changed_files),
    cases: cases.sort((a, b) => a.case_id.localeCompare(b.case_id)),
    plan_sha256: ''
  };
  plan.plan_sha256 = sha(plan);
  const planName = q.evidence_id ? `${q.task_id}--${q.evidence_id}.json` : `${q.task_id}.json`;
  const out = outPath || path.join(root, p.plans_root, planName);
  if (!inside(root, out)) fail('PLAN_OUTPUT_PATH_INVALID', 112);
  writeJson(out, plan);
  return { status: 'CAPTURE_PLAN_READY', path: asProjectRel(root, out), plan };
}

function verifyPlan(root, planPath) {
  const p = policy();
  const errors = [];
  const abs = path.resolve(planPath);
  if (!inside(root, abs) || !fs.existsSync(abs)) return { status: 'CAPTURE_PLAN_INVALID', valid: false, errors: ['plan_missing_or_external'] };
  let o;
  try { o = readJson(abs); } catch { return { status: 'CAPTURE_PLAN_INVALID', valid: false, errors: ['plan_unreadable'] }; }
  if (!validSeal(o, 'plan_sha256')) errors.push('plan_integrity_mismatch');

  let responsive = null;
  try { responsive = readResponsive(root); } catch { errors.push('responsive_policy_unavailable'); }
  if (responsive && o.responsive_policy_sha256 !== responsive.file_sha256) errors.push('responsive_policy_drift');

  for (const s of o.source_snapshot || []) {
    const a = relativeWithin(root, s.path);
    if (!a || !fs.existsSync(a)) errors.push(`source_missing:${s.path}`);
    else if (fileSha(a) !== s.sha256) errors.push(`source_drift:${s.path}`);
  }
  const seen = new Set();
  for (const c of o.cases || []) {
    if (seen.has(c.case_id)) errors.push(`case_duplicate:${c.case_id}`);
    seen.add(c.case_id);
    if (!safeRel(c.expected_screenshot_path) || !norm(c.expected_screenshot_path).startsWith(norm(p.artifacts_root) + '/')) {
      errors.push(`artifact_path_invalid:${c.case_id}`);
    }
  }
  return { status: errors.length ? 'CAPTURE_PLAN_INVALID' : 'CAPTURE_PLAN_VALID', valid: errors.length === 0, errors, plan: o, path: asProjectRel(root, abs) };
}

function sealRun(root, planPath, inputPath, outPath) {
  const p = policy();
  const pv = verifyPlan(root, planPath);
  if (!pv.valid) fail('CAPTURE_PLAN_INVALID', 120, pv);
  const q = readJson(inputPath);
  const errors = [];
  if (q.task_id !== pv.plan.task_id) errors.push('task_id_mismatch');
  const results = Array.isArray(q.results) ? q.results : [];
  const byCase = new Map();
  for (const r of results) {
    if (byCase.has(r.case_id)) errors.push(`result_duplicate:${r.case_id}`);
    byCase.set(r.case_id, r);
  }

  const captures = [];
  for (const c of pv.plan.cases) {
    const r = byCase.get(c.case_id);
    if (!r) {
      errors.push(`capture_missing:${c.case_id}`);
      continue;
    }
    if (norm(r.screenshot_path) !== norm(c.expected_screenshot_path)) errors.push(`capture_path_mismatch:${c.case_id}`);
    const abs = relativeWithin(root, r.screenshot_path);
    if (!abs || !norm(r.screenshot_path).startsWith(norm(p.artifacts_root) + '/')) {
      errors.push(`capture_path_invalid:${c.case_id}`);
      continue;
    }
    if (!fs.existsSync(abs)) {
      errors.push(`capture_file_missing:${c.case_id}`);
      continue;
    }
    if (p.require_png_signature && !pngOk(abs)) {
      errors.push(`capture_not_png:${c.case_id}`);
      continue;
    }
    captures.push({ case_id: c.case_id, screenshot_path: norm(r.screenshot_path), sha256: fileSha(abs), bytes: fs.statSync(abs).size });
  }
  for (const id of byCase.keys()) {
    if (!pv.plan.cases.some(c => c.case_id === id)) errors.push(`unexpected_capture:${id}`);
  }

  const run = {
    schema_version: '1.0',
    phase: 'VISUAL_QA_P1',
    task_id: pv.plan.task_id,
    evidence_id: pv.plan.evidence_id || null,
    status: errors.length ? 'CAPTURE_EVIDENCE_BLOCKED' : 'CAPTURE_EVIDENCE_COMPLETE',
    claims: { screenshot_bytes_verified: errors.length === 0, render_execution_attested: false, visual_quality_verified: false, visual_regression_verified: false },
    plan_path: asProjectRel(root, path.resolve(planPath)),
    plan_sha256: pv.plan.plan_sha256,
    source_snapshot: pv.plan.source_snapshot,
    captures: captures.sort((a, b) => a.case_id.localeCompare(b.case_id)),
    errors,
    run_sha256: ''
  };
  run.run_sha256 = sha(run);
  const runName = pv.plan.evidence_id ? `${pv.plan.task_id}--${pv.plan.evidence_id}.json` : `${pv.plan.task_id}.json`;
  const out = outPath || path.join(root, p.runs_root, runName);
  if (!inside(root, out)) fail('RUN_OUTPUT_PATH_INVALID', 121);
  writeJson(out, run);
  if (errors.length) fail('CAPTURE_EVIDENCE_BLOCKED', 122, run);
  return { status: 'CAPTURE_EVIDENCE_COMPLETE', path: asProjectRel(root, out), run };
}

function verifyRun(root, runPath) {
  const errors = [];
  const abs = path.resolve(runPath);
  if (!inside(root, abs) || !fs.existsSync(abs)) return { status: 'CAPTURE_RUN_INVALID', valid: false, errors: ['run_missing_or_external'] };
  let o;
  try { o = readJson(abs); } catch { return { status: 'CAPTURE_RUN_INVALID', valid: false, errors: ['run_unreadable'] }; }
  if (!validSeal(o, 'run_sha256')) errors.push('run_integrity_mismatch');

  const planAbs = relativeWithin(root, o.plan_path);
  if (!planAbs || !fs.existsSync(planAbs)) errors.push('plan_missing');
  else {
    const pv = verifyPlan(root, planAbs);
    if (!pv.valid) errors.push(...pv.errors.map(x => `plan:${x}`));
    else if (o.plan_sha256 !== pv.plan.plan_sha256) errors.push('plan_hash_mismatch');
  }
  for (const s of o.source_snapshot || []) {
    const a = relativeWithin(root, s.path);
    if (!a || !fs.existsSync(a)) errors.push(`source_missing:${s.path}`);
    else if (fileSha(a) !== s.sha256) errors.push(`source_drift:${s.path}`);
  }
  for (const c of o.captures || []) {
    const a = relativeWithin(root, c.screenshot_path);
    if (!a || !fs.existsSync(a)) errors.push(`capture_missing:${c.case_id}`);
    else {
      if (!pngOk(a)) errors.push(`capture_not_png:${c.case_id}`);
      if (fileSha(a) !== c.sha256) errors.push(`capture_drift:${c.case_id}`);
    }
  }
  if (o.claims?.visual_quality_verified !== false) errors.push('phase1_visual_quality_claim_forbidden');
  if (o.claims?.visual_regression_verified !== false) errors.push('phase1_regression_claim_forbidden');
  return { status: errors.length ? 'CAPTURE_RUN_INVALID' : 'CAPTURE_RUN_VALID', valid: errors.length === 0, errors, run: o, path: asProjectRel(root, abs) };
}

function systemStatus(root) {
  const p = policy();
  const fp = path.join(root, p.responsive_policy_path);
  let responsive = 'MISSING';
  let viewports = [];
  if (fs.existsSync(fp)) {
    try {
      const o = readJson(fp);
      responsive = o.status || 'UNKNOWN';
      viewports = (o.viewports || []).map(v => v.id);
    } catch { responsive = 'UNREADABLE'; }
  }
  return {
    status: 'VISUAL_QA_P1_READY',
    phase: 'Capture Contracts + Evidence Integrity',
    responsive_status: responsive,
    viewport_ids: viewports,
    render_execution: 'DEFERRED_PHASE2',
    visual_quality_judgment: 'DEFERRED',
    visual_regression: 'DEFERRED'
  };
}

const projectRoot = rootOf(take('--project-root', process.cwd()));
try {
  if (group === 'system' && cmd === 'status') {
    process.stdout.write(JSON.stringify(systemStatus(projectRoot), null, 2) + '\n');
    process.exit(0);
  }
  if (group === 'plan' && cmd === 'create') {
    const input = take('--input');
    const out = take('--out');
    if (!input) fail('INPUT_REQUIRED', 2);
    const r = createPlan(projectRoot, path.resolve(input), out ? path.resolve(out) : null);
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    process.exit(0);
  }
  if (group === 'plan' && cmd === 'verify') {
    const plan = take('--plan');
    if (!plan) fail('PLAN_REQUIRED', 2);
    const r = verifyPlan(projectRoot, path.resolve(plan));
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    process.exit(r.valid ? 0 : 3);
  }
  if (group === 'run' && cmd === 'seal') {
    const plan = take('--plan');
    const input = take('--input');
    const out = take('--out');
    if (!plan || !input) fail('PLAN_AND_INPUT_REQUIRED', 2);
    const r = sealRun(projectRoot, path.resolve(plan), path.resolve(input), out ? path.resolve(out) : null);
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    process.exit(0);
  }
  if (group === 'run' && cmd === 'verify') {
    const runp = take('--run');
    if (!runp) fail('RUN_REQUIRED', 2);
    const r = verifyRun(projectRoot, path.resolve(runp));
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    process.exit(r.valid ? 0 : 3);
  }
  fail('VISUAL_QA_COMMAND_UNKNOWN', 2, {
    status: 'VISUAL_QA_COMMAND_UNKNOWN',
    usage: [
      'system status',
      'plan create --input <json> [--out <json>]',
      'plan verify --plan <json>',
      'run seal --plan <json> --input <results.json> [--out <json>]',
      'run verify --run <json>'
    ]
  });
} catch (e) {
  if (e?.message && e.message.startsWith('Unexpected token')) fail('JSON_INVALID', 89);
  throw e;
}
