#!/usr/bin/env node
/**
 * AleDevOS Autonomous & Governed Git & GitHub Publisher
 * ContextOS Task ID: task-issue-100-git-publisher
 *
 * Provides a fail-closed, role-governed publishing runtime for Git and GitHub operations.
 * Enforces:
 * 1. Branch protection (main/develop strictly forbidden without explicit allowlisting).
 * 2. Preflight secret scanning (detects private keys, SCRAM tokens, passwords, bearer tokens).
 * 3. Task contract scope validation (blocks staging/committing files outside approved_scope).
 * 4. Protected paths protection (.git and AGENTS.md cannot be staged or modified).
 * 5. Destructive command defense (blocks --force, -f, +ref, reset --hard, clean -fdx, branch -D).
 * 6. Remote commit SHA verification (ls-remote check against local HEAD commit).
 * 7. GitHub CLI authentication checks and draft PR generation without cleartext credential leaks.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const PUBLISHER_EXIT_CODES = Object.freeze({
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  PROTECTED_BRANCH: 60,
  SECRET_LEAK_DETECTED: 61,
  SCOPE_ESCALATION_DETECTED: 62,
  REMOTE_VERIFICATION_FAILED: 63,
  DESTRUCTIVE_COMMAND_BLOCKED: 64,
  GIT_EXECUTION_FAILED: 65,
  GITHUB_AUTH_BLOCKED: 66,
  PUBLISHER_CALLER_UNAUTHORIZED: 67,
  CERTIFICATION_GATE_REQUIRED: 68
});

export class GitPublisherError extends Error {
  constructor(message, code = PUBLISHER_EXIT_CODES.GENERAL_ERROR, details = {}) {
    super(message);
    this.name = 'GitPublisherError';
    this.code = code;
    this.details = details;
  }
}

export function norm(s) {
  return String(s || '').replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
}

export function globRx(g) {
  let r = '^';
  for (const c of g) {
    if (c === '*') r += '.*';
    else if (c === '?') r += '.';
    else r += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(r + '$', process.platform === 'win32' ? 'i' : '');
}

export function matchesScope(file, patterns) {
  const f = norm(file);
  return (patterns || []).some(p => globRx(norm(p)).test(f));
}

export function isProtectedPath(file) {
  const f = norm(file);
  return (
    f === '.git' ||
    f.startsWith('.git/') ||
    f === 'AGENTS.md' ||
    f.endsWith('/AGENTS.md')
  );
}

export function isProtectedBranchTarget(target) {
  if (!target) return false;
  let ref = String(target).trim();
  if (ref.startsWith('+')) {
    ref = ref.slice(1).trim();
  }
  if (ref.includes(':')) {
    ref = ref.split(':').pop().trim();
  }
  ref = ref.replace(/^refs\/heads\//i, '').replace(/^refs\/remotes\/[^\/]+\//i, '').replace(/^origin\//i, '').toLowerCase();
  return ['main', 'develop'].includes(ref);
}

export function getApprovedScope({ cwd = process.cwd(), taskId = null } = {}) {
  const currentPath = path.join(cwd, '.aledevos', 'state', 'current.json');
  if (fs.existsSync(currentPath)) {
    try {
      const cur = JSON.parse(fs.readFileSync(currentPath, 'utf8').replace(/^\uFEFF/, ''));
      if (Array.isArray(cur.approved_scope) && cur.approved_scope.length > 0) {
        return cur.approved_scope.map(norm);
      }
      if (cur.task_contract_path) {
        const cPath = path.resolve(cwd, cur.task_contract_path);
        if (fs.existsSync(cPath)) {
          const c = JSON.parse(fs.readFileSync(cPath, 'utf8').replace(/^\uFEFF/, ''));
          if (Array.isArray(c.approved_scope)) return c.approved_scope.map(norm);
        }
      }
    } catch {}
  }
  if (taskId) {
    const safeId = String(taskId).replace(/[^a-zA-Z0-9._-]/g, '_');
    const taskPath = path.join(cwd, '.aledevos', 'state', 'tasks', safeId, 'task-contract.json');
    if (fs.existsSync(taskPath)) {
      try {
        const c = JSON.parse(fs.readFileSync(taskPath, 'utf8').replace(/^\uFEFF/, ''));
        if (Array.isArray(c.approved_scope)) return c.approved_scope.map(norm);
      } catch {}
    }
  }
  return [];
}

export const DESTRUCTIVE_COMMAND_PATTERNS = Object.freeze([
  /(?:^|\s)--force(?:-[a-z0-9-]+)?(?:\s|$|=)/i,
  /(?:^|\s)-f(?:\s|$)/,
  /(?:^|\s)\+[a-zA-Z0-9_\-\/]+/,
  /\breset\s+--hard\b/i,
  /\bclean\s+-[a-zA-Z]*f[a-zA-Z]*x?\b/i,
  /\bbranch\s+-[dD]\b/i,
  /\bpush\s+.*--delete\b/i,
  /\bpr\s+merge\b/i
]);

export function assertNonDestructive(commandStr = '', argsArr = []) {
  const combined = [commandStr, ...argsArr.map(String)].filter(Boolean).join(' ');
  for (const pattern of DESTRUCTIVE_COMMAND_PATTERNS) {
    if (pattern.test(combined)) {
      throw new GitPublisherError(
        `Destructive command blocked: pattern ${pattern} detected in "${combined}"`,
        PUBLISHER_EXIT_CODES.DESTRUCTIVE_COMMAND_BLOCKED,
        { reason: 'DESTRUCTIVE_COMMAND_BLOCKED', command: combined }
      );
    }
  }
  for (const arg of argsArr) {
    const s = String(arg).trim();
    if (s.startsWith('--force') || s === '-f' || s.startsWith('+')) {
      throw new GitPublisherError(
        `Destructive or force operation blocked by policy: ${s}`,
        PUBLISHER_EXIT_CODES.DESTRUCTIVE_COMMAND_BLOCKED,
        { reason: 'DESTRUCTIVE_COMMAND_BLOCKED', arg: s }
      );
    }
  }
}

export const SECRET_PATTERNS = Object.freeze([
  {
    type: 'PRIVATE_KEY',
    regex: /(?:-----)?BEGIN\s+(?:RSA|EC|OPENSSH|DSA|PGP)?\s*PRIVATE\s+KEY(?:-----)?/i
  },
  {
    type: 'SCRAM_CREDENTIAL',
    regex: /SCRAM-SHA-256\$\d+:[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+/
  },
  {
    type: 'PASSWORD_OR_SECRET',
    regex: /(?:['"]?[\w_]*(?:password|passwd|pwd|client_secret|secret_key|api_key)['"]?)\s*[:=]\s*(?:['"][^'"]{4,}['"]|[^\s#'"]{8,})/i
  },
  {
    type: 'TABULAR_DATABASE_SECRET',
    regex: /set_config\s*\r?\n\s*-{5,}/i
  },
  {
    type: 'BEARER_TOKEN',
    regex: /\bBearer\s+[A-Za-z0-9_\-\.]{20,}\b/i
  },
  {
    type: 'JWT_OR_UNMASKED_TOKEN',
    regex: /\b(?:eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|UNMASKED_RAW_TOKEN_\w+)\b/
  },
  {
    type: 'GITHUB_TOKEN',
    regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{82}\b/
  }
]);

export function scanDiffForSecrets(diffText) {
  const findings = [];
  const lines = String(diffText || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    const content = line.slice(1);

    for (const pat of SECRET_PATTERNS) {
      if (pat.regex.test(content)) {
        if (pat.type === 'PASSWORD_OR_SECRET') {
          const valMatch = content.match(/(?:['"]?[\w_]*(?:password|passwd|pwd|client_secret|secret_key|api_key)['"]?)\s*[:=]\s*(['"][^'"]*['"]|[^\s#'"]+)/i);
          if (valMatch && valMatch[1]) {
            const rawVal = valMatch[1].replace(/^['"]|['"]$/g, '').trim();
            if (
              content.includes('invermind.gotrue_db_password') ||
              content.includes('-match') ||
              content.includes('-notmatch') ||
              /^(?:\[REDACTED\]|REDACTED|\*{3,}|<redacted>|TODO|FIXME|changeme|placeholder|GENERATE_[A-Z0-9_]+)$/i.test(rawVal) ||
              /^\$\{?[A-Z0-9_]+(?::[-?].*)?\}?$/.test(rawVal) ||
              /^:['"]*[A-Za-z0-9_]+['"]*$/.test(rawVal) ||
              /^current_setting\(/i.test(rawVal) ||
              rawVal === '' || rawVal === "''" || rawVal === '""'
            ) {
              continue;
            }
          }
        }
        findings.push({
          type: pat.type,
          line: i + 1,
          matchedSnippet: '[REDACTED_LEAK_CONTENT]'
        });
      }
    }
  }
  return {
    leakDetected: findings.length > 0,
    findings
  };
}

export function getCurrentBranch(cwd = process.cwd()) {
  const scRes = spawnSync('git', ['branch', '--show-current'], { cwd, encoding: 'utf8', windowsHide: true });
  if (scRes.status === 0 && scRes.stdout.trim()) return scRes.stdout.trim();
  const symRes = spawnSync('git', ['symbolic-ref', '--short', 'HEAD'], { cwd, encoding: 'utf8', windowsHide: true });
  if (symRes.status === 0 && symRes.stdout.trim()) return symRes.stdout.trim();
  const brRes = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, encoding: 'utf8', windowsHide: true });
  if (brRes.status === 0 && brRes.stdout.trim() && brRes.stdout.trim() !== 'HEAD') return brRes.stdout.trim();
  return 'UNKNOWN';
}

export function status({ cwd = process.cwd(), taskId = null } = {}) {
  const branch = getCurrentBranch(cwd);

  const shaRes = spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8', windowsHide: true });
  const headSha = (shaRes.status === 0 ? shaRes.stdout.trim() : null);

  const statRes = spawnSync('git', ['status', '--porcelain=v1', '-uall'], { cwd, encoding: 'utf8', windowsHide: true });
  const statusLines = statRes.status === 0 && statRes.stdout ? statRes.stdout.split(/\r?\n/).filter(x => x.trim()) : [];

  const staged = [];
  const unstaged = [];
  const untracked = [];

  for (const line of statusLines) {
    const x = line[0], y = line[1];
    let file = line.slice(3).trim();
    if (file.includes(' -> ')) file = file.split(' -> ').pop();
    file = norm(file.replace(/^"|"$/g, ''));

    if (x === '?' && y === '?') {
      untracked.push(file);
    } else {
      if (x !== ' ' && x !== '?') staged.push(file);
      if (y !== ' ' && y !== '?') unstaged.push(file);
    }
  }

  const isProtected = isProtectedBranchTarget(branch);

  return {
    ok: true,
    branch,
    headSha,
    clean: statusLines.length === 0,
    isProtectedBranch: isProtected,
    staged: [...new Set(staged)],
    unstaged: [...new Set(unstaged)],
    untracked: [...new Set(untracked)]
  };
}

export function checkGitHubAuth({ cwd = process.cwd() } = {}) {
  try {
    const res = spawnSync('gh', ['auth', 'status'], { cwd, encoding: 'utf8', windowsHide: true });
    if (res.status === 0) {
      return { ok: true, status: 'GITHUB_AUTH_OK' };
    }
    return {
      ok: false,
      status: 'GITHUB_AUTH_BLOCKED',
      message: 'GitHub CLI authentication is not available or blocked in this environment'
    };
  } catch (err) {
    return {
      ok: false,
      status: 'GITHUB_AUTH_BLOCKED',
      message: 'GitHub CLI execution failed: ' + (err.message || 'unknown error')
    };
  }
}

export function preflight({
  cwd = process.cwd(),
  taskId = null,
  allowlistBranches = [],
  requireGitHubAuth = false,
  approvedScope = null
} = {}) {
  const branch = getCurrentBranch(cwd);

  if (isProtectedBranchTarget(branch)) {
    throw new GitPublisherError(
      `Direct commit or push to protected branch "${branch}" is forbidden. Work must occur on feature/bugfix branches.`,
      PUBLISHER_EXIT_CODES.PROTECTED_BRANCH,
      { reason: 'PROTECTED_BRANCH_NOT_ALLOWED', branch }
    );
  }

  assertNonDestructive('', []);

  const hasHead = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd, encoding: 'utf8', windowsHide: true }).status === 0;
  const emptyTree = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
  const diffFilesArgs = hasHead ? ['diff', '--cached', '--name-only'] : ['diff', '--cached', '--name-only', emptyTree];
  const diffContentArgs = hasHead ? ['diff', '--cached'] : ['diff', '--cached', emptyTree];
  const diffFilesRes = spawnSync('git', diffFilesArgs, { cwd, encoding: 'utf8', windowsHide: true });
  if (diffFilesRes.status !== 0) {
    throw new GitPublisherError(
      'Failed to inspect cached git diff',
      PUBLISHER_EXIT_CODES.GIT_EXECUTION_FAILED,
      { stderr: diffFilesRes.stderr, stdout: diffFilesRes.stdout }
    );
  }
  const stagedFiles = diffFilesRes.stdout
    ? diffFilesRes.stdout.split(/\r?\n/).map(x => norm(x.trim())).filter(Boolean)
    : [];

  for (const f of stagedFiles) {
    if (isProtectedPath(f)) {
      throw new GitPublisherError(
        `Protected path staged: "${f}" cannot be committed through git publisher.`,
        PUBLISHER_EXIT_CODES.SCOPE_ESCALATION_DETECTED,
        { reason: 'PROTECTED_PATH_STAGED', file: f }
      );
    }
  }

  const scope = approvedScope || getApprovedScope({ cwd, taskId });
  if (stagedFiles.length > 0) {
    if (!scope || scope.length === 0) {
      throw new GitPublisherError(
        `Scope escalation detected: staged files present [${stagedFiles.join(', ')}] but approved_scope is empty.`,
        PUBLISHER_EXIT_CODES.SCOPE_ESCALATION_DETECTED,
        { reason: 'SCOPE_ESCALATION_DETECTED', stagedFiles, approved_scope: [] }
      );
    }
    const outside = stagedFiles.filter(f => !matchesScope(f, scope));
    if (outside.length > 0) {
      throw new GitPublisherError(
        `Scope escalation detected: staged files [${outside.join(', ')}] are outside active approved_scope [${scope.join(', ')}].`,
        PUBLISHER_EXIT_CODES.SCOPE_ESCALATION_DETECTED,
        { reason: 'SCOPE_ESCALATION_DETECTED', outside, approved_scope: scope }
      );
    }
  }

  const diffContentRes = spawnSync('git', diffContentArgs, { cwd, encoding: 'utf8', windowsHide: true });
  if (diffContentRes.status !== 0) {
    throw new GitPublisherError(
      'Failed to inspect cached git diff',
      PUBLISHER_EXIT_CODES.GIT_EXECUTION_FAILED,
      { stderr: diffContentRes.stderr, stdout: diffContentRes.stdout }
    );
  }
  const diffContent = diffContentRes.stdout || '';
  const scan = scanDiffForSecrets(diffContent);
  if (scan.leakDetected) {
    throw new GitPublisherError(
      `Secret leak detected in staged diff: ${scan.findings.map(x => x.type).join(', ')}`,
      PUBLISHER_EXIT_CODES.SECRET_LEAK_DETECTED,
      { reason: 'SECRET_LEAK_DETECTED', findings: scan.findings }
    );
  }

  const ghAuth = checkGitHubAuth({ cwd });
  if (requireGitHubAuth && !ghAuth.ok) {
    throw new GitPublisherError(
      ghAuth.message,
      PUBLISHER_EXIT_CODES.GITHUB_AUTH_BLOCKED,
      { reason: 'GITHUB_AUTH_BLOCKED' }
    );
  }

  return {
    ok: true,
    status: 'PREFLIGHT_PASS',
    branch,
    stagedFiles,
    githubAuth: ghAuth
  };
}

export function stage({
  cwd = process.cwd(),
  taskId = null,
  files = [],
  all = false,
  approvedScope = null
} = {}) {
  const scope = approvedScope || getApprovedScope({ cwd, taskId });

  let filesToStage = [];
  if (all) {
    const statRes = spawnSync('git', ['status', '--porcelain=v1', '-uall'], { cwd, encoding: 'utf8', windowsHide: true });
    const lines = statRes.status === 0 && statRes.stdout ? statRes.stdout.split(/\r?\n/).filter(x => x.trim()) : [];
    for (const line of lines) {
      let f = line.slice(3).trim();
      if (f.includes(' -> ')) f = f.split(' -> ').pop();
      f = norm(f.replace(/^"|"$/g, ''));
      if (f) filesToStage.push(f);
    }
  } else {
    filesToStage = files.map(norm);
  }

  if (filesToStage.length === 0) {
    return { ok: true, staged: [] };
  }

  for (const f of filesToStage) {
    if (isProtectedPath(f)) {
      throw new GitPublisherError(
        `Cannot stage protected path: "${f}"`,
        PUBLISHER_EXIT_CODES.SCOPE_ESCALATION_DETECTED,
        { reason: 'PROTECTED_PATH_STAGED', file: f }
      );
    }
  }

  if (!scope || scope.length === 0) {
    throw new GitPublisherError(
      `Scope escalation detected in stage: no approved_scope defined for staging files [${filesToStage.join(', ')}].`,
      PUBLISHER_EXIT_CODES.SCOPE_ESCALATION_DETECTED,
      { reason: 'SCOPE_ESCALATION_DETECTED', outside: filesToStage, approved_scope: [] }
    );
  }

  const outside = filesToStage.filter(f => !matchesScope(f, scope));
  if (outside.length > 0) {
    throw new GitPublisherError(
      `Scope escalation detected in stage: [${outside.join(', ')}] outside approved_scope.`,
      PUBLISHER_EXIT_CODES.SCOPE_ESCALATION_DETECTED,
      { reason: 'SCOPE_ESCALATION_DETECTED', outside, approved_scope: scope }
    );
  }

  const addRes = spawnSync('git', ['add', '--', ...filesToStage], { cwd, encoding: 'utf8', windowsHide: true });
  if (addRes.status !== 0) {
    throw new GitPublisherError(
      `git add failed: ${addRes.stderr || addRes.stdout}`,
      PUBLISHER_EXIT_CODES.GIT_EXECUTION_FAILED,
      { stderr: addRes.stderr }
    );
  }

  return {
    ok: true,
    staged: filesToStage
  };
}

export function commit({
  cwd = process.cwd(),
  taskId = null,
  message,
  allowlistBranches = [],
  approvedScope = null,
  certified = true,
  wip = false
} = {}) {
  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new GitPublisherError('Commit message is required', PUBLISHER_EXIT_CODES.GENERAL_ERROR);
  }

  const branch = getCurrentBranch(cwd);
  if (isProtectedBranchTarget(branch)) {
    throw new GitPublisherError(
      `Direct commit to protected branch "${branch}" is forbidden. Work must occur on feature/bugfix branches.`,
      PUBLISHER_EXIT_CODES.PROTECTED_BRANCH,
      { reason: 'PROTECTED_BRANCH_NOT_ALLOWED', branch }
    );
  }

  if (certified && !wip) {
    const stateFile = path.join(cwd, '.aledevos', 'state', 'current.json');
    if (!fs.existsSync(stateFile)) {
      throw new GitPublisherError(
        'Certified commit requires verified task contract with PASS final_state and all canonical gates PASS',
        PUBLISHER_EXIT_CODES.CERTIFICATION_GATE_REQUIRED,
        { reason: 'STATE_FILE_NOT_FOUND' }
      );
    }
    let s;
    try {
      s = JSON.parse(fs.readFileSync(stateFile, 'utf8').replace(/^\uFEFF/, ''));
    } catch {
      throw new GitPublisherError(
        'Certified commit requires verified task contract with PASS final_state and all canonical gates PASS',
        PUBLISHER_EXIT_CODES.CERTIFICATION_GATE_REQUIRED,
        { reason: 'INVALID_STATE_FILE' }
      );
    }
    if (s.final_state !== 'PASS') {
      throw new GitPublisherError(
        'Certified commit requires verified task contract with PASS final_state and all canonical gates PASS',
        PUBLISHER_EXIT_CODES.CERTIFICATION_GATE_REQUIRED,
        { reason: 'FINAL_STATE_NOT_PASS', final_state: s.final_state }
      );
    }
    const requiredGates = ['scope', 'integrity', 'canonical', 'quality_engineering'];
    for (const g of requiredGates) {
      if (!s.gates || s.gates[g]?.status !== 'PASS') {
        throw new GitPublisherError(
          'Certified commit requires verified task contract with PASS final_state and all canonical gates PASS',
          PUBLISHER_EXIT_CODES.CERTIFICATION_GATE_REQUIRED,
          { reason: 'GATE_NOT_PASS', gate: g, status: s.gates?.[g]?.status || 'MISSING' }
        );
      }
    }
    const requiredJudges = ['requirements', 'regression', 'quality'];
    for (const j of requiredJudges) {
      const jData = s.judges?.[j];
      if (!jData || typeof jData.score !== 'number' || jData.score < 90) {
        throw new GitPublisherError(
          'Certified commit requires verified task contract with PASS final_state and all canonical gates PASS',
          PUBLISHER_EXIT_CODES.CERTIFICATION_GATE_REQUIRED,
          { reason: 'JUDGE_SCORE_UNMET', judge: j, score: jData?.score }
        );
      }
    }
  }

  const pf = preflight({ cwd, taskId, allowlistBranches, approvedScope });

  const commitRes = spawnSync('git', ['commit', '-m', message.trim()], { cwd, encoding: 'utf8', windowsHide: true });
  if (commitRes.status !== 0) {
    throw new GitPublisherError(
      `git commit failed: ${commitRes.stderr || commitRes.stdout}`,
      PUBLISHER_EXIT_CODES.GIT_EXECUTION_FAILED,
      { stderr: commitRes.stderr, stdout: commitRes.stdout }
    );
  }

  const shaRes = spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8', windowsHide: true });
  const commitSha = shaRes.status === 0 ? shaRes.stdout.trim() : null;

  const stateFile = path.join(cwd, '.aledevos', 'state', 'current.json');
  if (fs.existsSync(stateFile)) {
    try {
      const cur = JSON.parse(fs.readFileSync(stateFile, 'utf8').replace(/^\uFEFF/, ''));
      cur.publish = {
        last_commit: {
          sha: commitSha,
          message: message.trim(),
          branch: pf.branch,
          at: new Date().toISOString()
        }
      };
      cur.history = cur.history || [];
      cur.history.push({
        at: new Date().toISOString(),
        type: 'PUBLISH_COMMIT',
        sha: commitSha,
        branch: pf.branch,
        message: message.trim()
      });
      fs.writeFileSync(stateFile, JSON.stringify(cur, null, 2) + '\n', 'utf8');

      if (cur.task_id) {
        const safeId = String(cur.task_id).replace(/[^a-zA-Z0-9._-]/g, '_');
        const taskState = path.join(cwd, '.aledevos', 'state', 'tasks', safeId, 'state.json');
        if (fs.existsSync(path.dirname(taskState))) {
          fs.writeFileSync(taskState, JSON.stringify(cur, null, 2) + '\n', 'utf8');
        }
      }
    } catch {}
  }

  return {
    ok: true,
    status: 'COMMITTED',
    branch: pf.branch,
    sha: commitSha,
    message: message.trim()
  };
}

export function push({
  cwd = process.cwd(),
  taskId = null,
  remote = 'origin',
  branch = null,
  allowlistBranches = [],
  extraArgs = [],
  certified = true,
  wip = false
} = {}) {
  assertNonDestructive('', extraArgs);
  if (branch && branch.startsWith('+')) {
    throw new GitPublisherError(
      `Destructive refspec blocked: "${branch}"`,
      PUBLISHER_EXIT_CODES.DESTRUCTIVE_COMMAND_BLOCKED,
      { reason: 'DESTRUCTIVE_COMMAND_BLOCKED', branch }
    );
  }

  let targetBranch = branch;
  if (!targetBranch) {
    targetBranch = getCurrentBranch(cwd);
  }

  const isBranchProtected = isProtectedBranchTarget(branch);
  const isTargetProtected = isProtectedBranchTarget(targetBranch);

  if (isBranchProtected || isTargetProtected) {
    throw new GitPublisherError(
      `Direct push to protected branch "${targetBranch || branch}" is forbidden. Push to feature branches only.`,
      PUBLISHER_EXIT_CODES.PROTECTED_BRANCH,
      { reason: 'PROTECTED_BRANCH_PUSH_BLOCKED', branch: targetBranch || branch }
    );
  }

  if (certified && !wip) {
    const stateFile = path.join(cwd, '.aledevos', 'state', 'current.json');
    if (!fs.existsSync(stateFile)) {
      throw new GitPublisherError(
        'Certified push requires verified task contract with PASS final_state',
        PUBLISHER_EXIT_CODES.CERTIFICATION_GATE_REQUIRED,
        { reason: 'STATE_FILE_NOT_FOUND' }
      );
    }
    let s;
    try {
      s = JSON.parse(fs.readFileSync(stateFile, 'utf8').replace(/^\uFEFF/, ''));
    } catch {
      throw new GitPublisherError(
        'Certified push requires verified task contract with PASS final_state',
        PUBLISHER_EXIT_CODES.CERTIFICATION_GATE_REQUIRED,
        { reason: 'INVALID_STATE_FILE' }
      );
    }
    if (s.final_state !== 'PASS') {
      throw new GitPublisherError(
        'Certified push requires verified task contract with PASS final_state',
        PUBLISHER_EXIT_CODES.CERTIFICATION_GATE_REQUIRED,
        { reason: 'FINAL_STATE_NOT_PASS', final_state: s.final_state }
      );
    }
  }

  const headShaRes = spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8', windowsHide: true });
  const localHeadSha = headShaRes.status === 0 ? headShaRes.stdout.trim() : null;

  const pushArgs = ['push', remote, targetBranch, ...extraArgs];
  const pushRes = spawnSync('git', pushArgs, { cwd, encoding: 'utf8', windowsHide: true });
  if (pushRes.status !== 0) {
    throw new GitPublisherError(
      `git push failed: ${pushRes.stderr || pushRes.stdout}`,
      PUBLISHER_EXIT_CODES.GIT_EXECUTION_FAILED,
      { stderr: pushRes.stderr, stdout: pushRes.stdout }
    );
  }

  const lsRes = spawnSync('git', ['ls-remote', remote, targetBranch], { cwd, encoding: 'utf8', windowsHide: true });
  if (lsRes.status !== 0) {
    throw new GitPublisherError(
      `Failed to query remote commit SHA via git ls-remote: ${lsRes.stderr}`,
      PUBLISHER_EXIT_CODES.REMOTE_VERIFICATION_FAILED,
      { reason: 'REMOTE_VERIFICATION_FAILED', remote, branch: targetBranch }
    );
  }

  const lines = lsRes.stdout.split(/\r?\n/).filter(x => x.trim());
  let remoteSha = null;
  for (const line of lines) {
    const [sha] = line.split(/\s+/);
    if (sha) {
      remoteSha = sha;
      break;
    }
  }

  if (!remoteSha || remoteSha !== localHeadSha) {
    throw new GitPublisherError(
      `Remote SHA verification failed: expected ${localHeadSha}, got ${remoteSha || 'NONE'} on ${remote}/${targetBranch}`,
      PUBLISHER_EXIT_CODES.REMOTE_VERIFICATION_FAILED,
      { reason: 'REMOTE_VERIFICATION_FAILED', expectedSha: localHeadSha, actualSha: remoteSha }
    );
  }

  return {
    ok: true,
    status: 'PUSH_VERIFIED',
    remote,
    branch: targetBranch,
    sha: localHeadSha,
    verified: true
  };
}

export function prComment({ cwd = process.cwd(), prNumber, body } = {}) {
  if (!prNumber) throw new GitPublisherError('PR number is required', PUBLISHER_EXIT_CODES.GENERAL_ERROR);
  if (!body) throw new GitPublisherError('Comment body is required', PUBLISHER_EXIT_CODES.GENERAL_ERROR);
  assertNonDestructive('', [String(prNumber)]);

  const ghRes = spawnSync('gh', ['pr', 'comment', String(prNumber), '--body', String(body)], { cwd, encoding: 'utf8', windowsHide: true });
  if (ghRes.status !== 0) {
    throw new GitPublisherError(`gh pr comment failed: ${ghRes.stderr || ghRes.stdout}`, PUBLISHER_EXIT_CODES.GITHUB_AUTH_BLOCKED, { stderr: ghRes.stderr });
  }
  return { ok: true, prNumber, status: 'PR_COMMENT_POSTED' };
}

export function issueComment({ cwd = process.cwd(), issueNumber, body } = {}) {
  if (!issueNumber) throw new GitPublisherError('Issue number is required', PUBLISHER_EXIT_CODES.GENERAL_ERROR);
  if (!body) throw new GitPublisherError('Comment body is required', PUBLISHER_EXIT_CODES.GENERAL_ERROR);
  assertNonDestructive('', [String(issueNumber)]);

  const ghRes = spawnSync('gh', ['issue', 'comment', String(issueNumber), '--body', String(body)], { cwd, encoding: 'utf8', windowsHide: true });
  if (ghRes.status !== 0) {
    throw new GitPublisherError(`gh issue comment failed: ${ghRes.stderr || ghRes.stdout}`, PUBLISHER_EXIT_CODES.GITHUB_AUTH_BLOCKED, { stderr: ghRes.stderr });
  }
  return { ok: true, issueNumber, status: 'ISSUE_COMMENT_POSTED' };
}

export function prCreateDraft({ cwd = process.cwd(), base, head, title, body } = {}) {
  if (!base || !head || !title || !body) {
    throw new GitPublisherError('base, head, title, and body are required for prCreateDraft', PUBLISHER_EXIT_CODES.GENERAL_ERROR);
  }
  assertNonDestructive('', [String(base), String(head)]);

  const ghRes = spawnSync('gh', ['pr', 'create', '--draft', '--base', String(base), '--head', String(head), '--title', String(title), '--body', String(body)], { cwd, encoding: 'utf8', windowsHide: true });
  if (ghRes.status !== 0) {
    throw new GitPublisherError(`gh pr create failed: ${ghRes.stderr || ghRes.stdout}`, PUBLISHER_EXIT_CODES.GITHUB_AUTH_BLOCKED, { stderr: ghRes.stderr });
  }
  return { ok: true, draft: true, base, head, title, status: 'DRAFT_PR_CREATED', output: ghRes.stdout.trim() };
}

export function handlePublisherCli(cliArgs, cwd = process.cwd()) {
  const cmd = cliArgs[0];
  const take = (f, d = null) => {
    const i = cliArgs.indexOf(f);
    return i >= 0 && i + 1 < cliArgs.length ? cliArgs[i + 1] : d;
  };
  const takes = (f) => {
    const o = [];
    for (let i = 0; i < cliArgs.length; i++) {
      if (cliArgs[i] === f && i + 1 < cliArgs.length) o.push(cliArgs[i + 1]);
    }
    return o;
  };
  const has = (f) => cliArgs.includes(f);

  try {
    const callerRole = String(process.env.ALEDEVOS_ROLE || take('--caller-role') || '').trim().toLowerCase();
    const orchestratorTokenArg = take('--orchestrator-token');

    let authorized = (process.env.ALEDEVOS_ROLE && process.env.ALEDEVOS_ROLE.toLowerCase() === 'orchestrator');

    if (!authorized && orchestratorTokenArg) {
      const tokenHash = crypto.createHash('sha256').update(orchestratorTokenArg).digest('hex');
      const stateArg = take('--state');
      const stateFiles = [
        stateArg ? path.resolve(cwd, stateArg) : null,
        path.join(cwd, '.aledevos', 'state', 'current.json')
      ].filter(Boolean);

      for (const stateFile of stateFiles) {
        if (fs.existsSync(stateFile)) {
          try {
            const cur = JSON.parse(fs.readFileSync(stateFile, 'utf8').replace(/^\uFEFF/, ''));
            if (cur.orchestrator_token_hash && cur.orchestrator_token_hash === tokenHash) {
              authorized = true;
              break;
            } else if (cur.orchestrator_token && cur.orchestrator_token === orchestratorTokenArg) {
              authorized = true;
              break;
            }
          } catch {}
        }
      }

      if (!authorized) {
        const privFiles = [
          stateArg ? path.join(path.dirname(path.resolve(cwd, stateArg)), '.private', 'orchestrator.token') : null,
          path.join(cwd, '.aledevos', 'state', '.private', 'orchestrator.token')
        ].filter(Boolean);
        for (const privFile of privFiles) {
          if (fs.existsSync(privFile)) {
            try {
              const savedToken = fs.readFileSync(privFile, 'utf8').trim();
              if (savedToken && savedToken === orchestratorTokenArg) {
                authorized = true;
                break;
              }
            } catch {}
          }
        }
      }
    }

    if (!authorized) {
      throw new GitPublisherError(
        `Publisher caller unauthorized: role '${callerRole || 'unknown'}' cannot invoke publish without orchestrator authorization.`,
        PUBLISHER_EXIT_CODES.PUBLISHER_CALLER_UNAUTHORIZED,
        { callerRole, reason: 'PUBLISHER_CALLER_UNAUTHORIZED' }
      );
    }

    if (cmd === 'status') {
      const res = status({ cwd, taskId: take('--task-id') });
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    }
    if (cmd === 'preflight') {
      const res = preflight({
        cwd,
        taskId: take('--task-id'),
        allowlistBranches: takes('--allow-branch'),
        requireGitHubAuth: has('--require-gh-auth')
      });
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    }
    if (cmd === 'stage') {
      const files = [...takes('--files'), ...takes('--file')];
      const all = has('--all');
      const res = stage({ cwd, taskId: take('--task-id'), files, all });
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    }
    if (cmd === 'commit') {
      const msg = take('--message') || take('-m');
      const wip = has('--wip');
      const certified = has('--no-certified') ? false : (has('--certified') ? true : !wip);
      const res = commit({
        cwd,
        taskId: take('--task-id'),
        message: msg,
        allowlistBranches: takes('--allow-branch'),
        certified,
        wip
      });
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    }
    if (cmd === 'push') {
      const remote = take('--remote', 'origin');
      const branch = take('--branch', null);
      const wip = has('--wip');
      const certified = has('--no-certified') ? false : (has('--certified') ? true : !wip);
      const res = push({
        cwd,
        taskId: take('--task-id'),
        remote,
        branch,
        allowlistBranches: takes('--allow-branch'),
        certified,
        wip
      });
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    }
    if (cmd === 'pr-comment') {
      const prNumber = take('--pr');
      const body = take('--body');
      const res = prComment({ cwd, prNumber, body });
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    }
    if (cmd === 'issue-comment') {
      const issueNumber = take('--issue');
      const body = take('--body');
      const res = issueComment({ cwd, issueNumber, body });
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    }
    if (cmd === 'pr-create-draft') {
      const base = take('--base');
      const head = take('--head');
      const title = take('--title');
      const body = take('--body');
      const res = prCreateDraft({ cwd, base, head, title, body });
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    }
    console.error(`Unknown publish command: ${cmd}`);
    process.exit(1);
  } catch (err) {
    const exitCode = err.code || 1;
    console.error(JSON.stringify({
      ok: false,
      error: err.message,
      code: exitCode,
      details: err.details || null
    }, null, 2));
    process.exit(exitCode);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  handlePublisherCli(process.argv.slice(2), process.cwd());
}
