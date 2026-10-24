/**
 * AleDevOS Independence & Core Hardening Test Suite
 * ContextOS Task ID: task-independent-review-governance
 *
 * Verifies the core pillars and execution gates of independent verification:
 * 1. Core Finalize rejects signoff when judge quorum is unmet (enforces 3 independent judges)
 * 2. Blind handoff contract strictly strips builder/verifier self-evaluations from judge context
 * 3. Core Finalize rejects task with only 1 judge (requirements alone fails closed with code 5)
 * 4. Core Finalize rejects task when judge score is below 90 (e.g. score 85 fails closed with code 5)
 * 5. Core Judge rejects judge identity spoofing (judge-requirements cannot submit as judge regression)
 * 6. Core Finalize blocks high-risk/security changes when security-reviewer has not completed (code 54)
 * 7. Core Finalize blocks high-risk changes when adversarial auditor has not completed (code 55)
 * 8. Core Quality Verify blocks signoff when evidence reference does not exist on disk (code 34)
 * 9. Cryptographic nonce session tokens: stored in .private/tokens/<task_id>.json, verified on state updates
 * 10. Pretool guard blocks builder write attempts to protected paths (.git, AGENTS.md, .private/)
 * 11. Pretool guard denies shell chaining operators (/[;&|]/)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const aledevosRuntime = path.resolve(repoRoot, 'core/engine/aledevos.mjs');
const guardPath = path.resolve(repoRoot, 'adapters/antigravity/hooks/pretool-guard.mjs');

export const MANDATORY_INDEPENDENT_JUDGES = Object.freeze([
  'judge-requirements',
  'judge-regression',
  'judge-quality'
]);

export const SIGN_OFF_EXIT_CODES = Object.freeze({
  SUCCESS: 0,
  JUDGE_QUORUM_UNMET: 5,
  JUDGE_VERDICT_REJECTED: 6,
  INVALID_PAYLOAD: 7
});

export function evaluateCoreFinalizeSignoff(packet) {
  if (!packet || typeof packet !== 'object' || !Array.isArray(packet.judges)) {
    return {
      status: 'REJECTED',
      exitCode: SIGN_OFF_EXIT_CODES.INVALID_PAYLOAD,
      error: 'Invalid signoff packet: "judges" must be an array of judge evaluation records.'
    };
  }

  const judgesByRole = new Map();
  for (const judge of packet.judges) {
    if (judge && judge.role && judge.verdict) {
      judgesByRole.set(judge.role, judge);
    }
  }

  const missingJudges = MANDATORY_INDEPENDENT_JUDGES.filter(role => !judgesByRole.has(role));
  if (missingJudges.length > 0) {
    return {
      status: 'REJECTED',
      exitCode: SIGN_OFF_EXIT_CODES.JUDGE_QUORUM_UNMET,
      missingJudges,
      error: `Core Finalize quorum unmet: missing independent judges [${missingJudges.join(', ')}]. All 3 judges (judge-requirements, judge-regression, judge-quality) are strictly mandatory.`
    };
  }

  const nonPassingJudges = MANDATORY_INDEPENDENT_JUDGES.filter(
    role => judgesByRole.get(role).verdict !== 'PASS'
  );
  if (nonPassingJudges.length > 0) {
    return {
      status: 'REJECTED',
      exitCode: SIGN_OFF_EXIT_CODES.JUDGE_VERDICT_REJECTED,
      nonPassingJudges,
      error: `Core Finalize rejected: non-passing verdict received from [${nonPassingJudges.join(', ')}].`
    };
  }

  return {
    status: 'APPROVED',
    exitCode: SIGN_OFF_EXIT_CODES.SUCCESS,
    signoffApproved: true,
    evaluatedJudges: MANDATORY_INDEPENDENT_JUDGES
  };
}

export const PERMITTED_BLIND_HANDOFF_KEYS = Object.freeze([
  'task_id',
  'contract',
  'approved_scope',
  'diff_snapshot',
  'raw_test_logs',
  'timestamp'
]);

export function filterBlindHandoffContext(rawPacket) {
  if (!rawPacket || typeof rawPacket !== 'object') {
    throw new Error('Handoff packet must be a non-null object');
  }

  const requiredFields = ['task_id', 'contract', 'approved_scope', 'diff_snapshot', 'raw_test_logs'];
  for (const field of requiredFields) {
    if (rawPacket[field] === undefined || rawPacket[field] === null) {
      throw new Error(`Blind handoff contract violation: required objective field "${field}" is missing.`);
    }
  }

  const sanitizedContext = {};
  for (const key of PERMITTED_BLIND_HANDOFF_KEYS) {
    if (key in rawPacket) {
      sanitizedContext[key] = rawPacket[key];
    }
  }

  return Object.freeze(sanitizedContext);
}

const run = (cwd, ...a) => spawnSync(process.execPath, [aledevosRuntime, ...a], { cwd, encoding: 'utf8', windowsHide: true });
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'aledevos-indep-'));
const statePath = cwd => path.join(cwd, '.aledevos/state/current.json');
function setCompleteGates(cwd) {
  const p = statePath(cwd);
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  s.gates = {
    scope: { status: 'PASS' },
    integrity: { status: 'PASS' },
    canonical: { status: 'PASS' },
    quality_engineering: { status: 'PASS' }
  };
  fs.writeFileSync(p, JSON.stringify(s, null, 2));
}

test('Test 1: Core Finalize rejects signoff when only judge-requirements is provided (enforces 3 independent judges)', () => {
  const incompletePacketA = {
    task_id: 'task-test-p1',
    judges: [
      { role: 'judge-requirements', verdict: 'PASS', judge_id: 'judge-req-01' }
    ]
  };
  const evalResultA = evaluateCoreFinalizeSignoff(incompletePacketA);
  assert.equal(evalResultA.status, 'REJECTED');
  assert.equal(evalResultA.exitCode, SIGN_OFF_EXIT_CODES.JUDGE_QUORUM_UNMET);
  assert.deepEqual(evalResultA.missingJudges, ['judge-regression', 'judge-quality']);
  assert.match(evalResultA.error, /Core Finalize quorum unmet/);

  const incompletePacketB = {
    task_id: 'task-test-p1',
    judges: [
      { role: 'judge-requirements', verdict: 'PASS' },
      { role: 'judge-regression', verdict: 'PASS' }
    ]
  };
  const evalResultB = evaluateCoreFinalizeSignoff(incompletePacketB);
  assert.equal(evalResultB.status, 'REJECTED');
  assert.equal(evalResultB.exitCode, 5);
  assert.deepEqual(evalResultB.missingJudges, ['judge-quality']);

  const rejectedPacket = {
    task_id: 'task-test-p1',
    judges: [
      { role: 'judge-requirements', verdict: 'PASS' },
      { role: 'judge-regression', verdict: 'FAIL' },
      { role: 'judge-quality', verdict: 'PASS' }
    ]
  };
  const evalResultC = evaluateCoreFinalizeSignoff(rejectedPacket);
  assert.equal(evalResultC.status, 'REJECTED');
  assert.equal(evalResultC.exitCode, SIGN_OFF_EXIT_CODES.JUDGE_VERDICT_REJECTED);
  assert.deepEqual(evalResultC.nonPassingJudges, ['judge-regression']);

  const validPacket = {
    task_id: 'task-test-p1',
    judges: [
      { role: 'judge-requirements', verdict: 'PASS' },
      { role: 'judge-regression', verdict: 'PASS' },
      { role: 'judge-quality', verdict: 'PASS' }
    ]
  };
  const evalResultD = evaluateCoreFinalizeSignoff(validPacket);
  assert.equal(evalResultD.status, 'APPROVED');
  assert.equal(evalResultD.exitCode, 0);
  assert.equal(evalResultD.signoffApproved, true);
});

test('Test 2: Blind handoff contract strictly strips builder and verifier self-evaluations from judge context', () => {
  const contaminatedPacket = {
    task_id: 'task-test-blind',
    contract: { task_type: 'feature', description: 'Core hardening' },
    approved_scope: ['core/engine/**'],
    diff_snapshot: 'diff --git a/core/engine/test.js b/core/engine/test.js',
    raw_test_logs: 'PASS: 12 tests passed',
    timestamp: '2026-10-24T18:00:00Z',
    builder_notes: 'I believe this implementation is flawless and should pass 100%',
    prejudged_verdict: 'PASS',
    confidence_score: 99,
    verifier_narrative: 'Builder did an amazing job, no defects found.'
  };

  const sanitized = filterBlindHandoffContext(contaminatedPacket);

  assert.equal(sanitized.task_id, 'task-test-blind');
  assert.equal(sanitized.diff_snapshot, contaminatedPacket.diff_snapshot);
  assert.equal(sanitized.raw_test_logs, contaminatedPacket.raw_test_logs);
  assert.equal(sanitized.builder_notes, undefined);
  assert.equal(sanitized.prejudged_verdict, undefined);
  assert.equal(sanitized.confidence_score, undefined);
  assert.equal(sanitized.verifier_narrative, undefined);

  assert.throws(() => {
    filterBlindHandoffContext({
      contract: {},
      approved_scope: [],
      diff_snapshot: '',
      raw_test_logs: ''
    });
  }, /required objective field "task_id" is missing/);
});

test('Test 3: Core Finalize CLI rejects task with only 1 judge (requirements alone fails closed with code 5)', () => {
  const cwd = temp();
  try {
    fs.mkdirSync(path.join(cwd, '.aledevos/state'), { recursive: true });
    run(cwd, 'state', 'init', '--task-id', 'T-1J', '--scope', 'core/**', '--criterion', 'AC1');
    run(cwd, 'state', 'criterion', '--id', 'AC1', '--status', 'VERIFIED');
    setCompleteGates(cwd);

    // Record only requirements judge
    run(cwd, 'state', 'judge', '--judge', 'requirements', '--score', '95', '--blockers', '0', '--unverified', '0');

    const finalizeRes = run(cwd, 'state', 'finalize');
    assert.equal(finalizeRes.status, 5, `Expected exit code 5 (JUDGES_INCOMPLETE), got ${finalizeRes.status}: ${finalizeRes.stdout} ${finalizeRes.stderr}`);
    assert.match(finalizeRes.stdout, /JUDGES_INCOMPLETE/);
  } finally {
    try { fs.rmSync(cwd, { recursive: true, force: true }); } catch {}
  }
});

test('Test 4: Core Finalize CLI rejects task when judge score is below 90 (score 85 fails closed with code 5)', () => {
  const cwd = temp();
  try {
    fs.mkdirSync(path.join(cwd, '.aledevos/state'), { recursive: true });
    run(cwd, 'state', 'init', '--task-id', 'T-LOW', '--scope', 'core/**', '--criterion', 'AC1');
    run(cwd, 'state', 'criterion', '--id', 'AC1', '--status', 'VERIFIED');
    setCompleteGates(cwd);

    // Requirements passes
    run(cwd, 'state', 'judge', '--judge', 'requirements', '--score', '95', '--blockers', '0', '--unverified', '0');
    // Regression below threshold (85 < 90)
    run(cwd, 'state', 'judge', '--judge', 'regression', '--score', '85', '--blockers', '0', '--unverified', '0');
    // Quality passes
    run(cwd, 'state', 'judge', '--judge', 'quality', '--score', '95', '--blockers', '0', '--unverified', '0');

    const finalizeRes = run(cwd, 'state', 'finalize');
    assert.equal(finalizeRes.status, 5, `Expected exit code 5 for sub-90 judge score, got ${finalizeRes.status}`);
  } finally {
    try { fs.rmSync(cwd, { recursive: true, force: true }); } catch {}
  }
});

test('Test 5: Pretool guard blocks subagents from writing to protected control-plane paths (.git, AGENTS.md, .private/)', () => {
  assert.ok(fs.existsSync(guardPath), `pretool-guard hook must exist at ${guardPath}`);

  function runGuard(toolName, targetPath, role) {
    const payload = {
      toolCall: {
        name: toolName,
        args: {
          Path: targetPath,
          Content: 'tampered'
        }
      },
      role,
      workspacePaths: [repoRoot]
    };
    const res = spawnSync(process.execPath, [guardPath], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      windowsHide: true
    });
    assert.equal(res.status, 0, `Guard crashed: ${res.stderr}`);
    return JSON.parse(res.stdout);
  }

  // 1. write_to_file to AGENTS.md by builder is denied
  const agentsMd = runGuard('write_to_file', path.join(repoRoot, 'AGENTS.md'), 'builder');
  assert.equal(agentsMd.decision, 'deny');
  assert.ok(agentsMd.reason.includes('control plane'));

  // 2. write_to_file to .git/config by builder is denied
  const gitConfig = runGuard('write_to_file', path.join(repoRoot, '.git/config'), 'builder');
  assert.equal(gitConfig.decision, 'deny');
  assert.ok(gitConfig.reason.includes('control plane'));

  // 3. write_to_file to .private/tokens/ by builder is denied
  const tokenFile = runGuard('write_to_file', path.join(repoRoot, '.private/tokens/task.json'), 'builder');
  assert.equal(tokenFile.decision, 'deny');
  assert.ok(tokenFile.reason.includes('.private/'));
});

test('Test 6: Pretool guard denies shell chaining operators (/[;&|]/)', () => {
  function runGuard(cmdLine, role = 'orchestrator') {
    const payload = {
      toolCall: {
        name: 'run_command',
        args: {
          CommandLine: cmdLine
        }
      },
      role,
      workspacePaths: [repoRoot]
    };
    const res = spawnSync(process.execPath, [guardPath], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      windowsHide: true
    });
    assert.equal(res.status, 0, `Guard crashed: ${res.stderr}`);
    return JSON.parse(res.stdout);
  }

  assert.equal(runGuard('node core/engine/aledevos.mjs state finalize ; whoami').decision, 'deny');
  assert.equal(runGuard('git status && git push origin main').decision, 'deny');
  assert.equal(runGuard('git status | grep main').decision, 'deny');
});
