/**
 * AleDevOS Autonomous & Governed Git & GitHub Publisher Test Suite
 * ContextOS Task ID: task-independent-review-git-publisher
 *
 * Verifies the 12 core pillars of autonomous, fail-closed Git & GitHub publishing:
 * 1. Publisher blocks force-push (--force, -f, +ref) with fail-closed error (code 64).
 * 2. Publisher blocks direct commit or push to main or develop (code 60).
 * 3. Publisher preflight detects credential/secret leaks in staged diff (code 61).
 * 4. Publisher blocks staging/committing files outside active task contract approved_scope (code 62).
 * 5. Publisher blocks destructive operations (reset --hard, clean -fdx, branch -D).
 * 6. Publisher reports GITHUB_AUTH_BLOCKED without requesting or printing cleartext credentials.
 * 7. Publisher end-to-end stage, preflight, commit, push, and remote SHA verification in isolated local test repositories.
 * 8. Pretool guard blocks unauthorized subagents (builder/judges) from arbitrary git execution.
 * 9. Pretool guard blocks subagents attempting node .aledevos/runtime/aledevos.mjs publish ...
 * 10. Preflight rejects main and develop even if --allow-branch main is supplied (unconditional exit code 60).
 * 11. Certified commit and push fail closed with exit code 68 when task is not certified (final_state !== 'PASS').
 * 12. Diff inspection failure throws exit code 65 instead of silent empty diff.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  status,
  preflight,
  stage,
  commit,
  push,
  checkGitHubAuth,
  assertNonDestructive,
  scanDiffForSecrets,
  PUBLISHER_EXIT_CODES,
  GitPublisherError
} from '../core/engine/git-publisher.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const guardPath = path.resolve(repoRoot, 'adapters/antigravity/hooks/pretool-guard.mjs');
const publisherRuntime = path.resolve(repoRoot, 'core/engine/git-publisher.mjs');
const aledevosRuntime = path.resolve(repoRoot, 'core/engine/aledevos.mjs');

function createIsolatedRepo(branch = 'feat/test-branch') {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pub-test-repo-'));
  
  // Initialize git repo
  let initRes = spawnSync('git', ['init', '-b', branch], { cwd: tempDir, encoding: 'utf8', windowsHide: true });
  if (initRes.status !== 0) {
    // Fallback for older git versions lacking -b
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', windowsHide: true });
    spawnSync('git', ['checkout', '-b', branch], { cwd: tempDir, encoding: 'utf8', windowsHide: true });
  }

  // Set user identity locally in isolated repo
  spawnSync('git', ['config', 'user.name', 'AleDevOS Test'], { cwd: tempDir, encoding: 'utf8', windowsHide: true });
  spawnSync('git', ['config', 'user.email', 'publisher-test@aledevos.local'], { cwd: tempDir, encoding: 'utf8', windowsHide: true });
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tempDir, encoding: 'utf8', windowsHide: true });

  spawnSync('git', ['commit', '--allow-empty', '-m', 'Initial baseline commit'], { cwd: tempDir, encoding: 'utf8', windowsHide: true });

  return {
    dir: tempDir,
    cleanup: () => {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  };
}

function createIsolatedPairRepos(branch = 'feat/task-e2e') {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pub-e2e-pair-'));
  const bareDir = path.join(baseDir, 'remote.git');
  const workDir = path.join(baseDir, 'work');

  fs.mkdirSync(bareDir, { recursive: true });
  fs.mkdirSync(workDir, { recursive: true });

  // Init bare remote
  spawnSync('git', ['init', '--bare', bareDir], { encoding: 'utf8', windowsHide: true });

  // Init work repo
  let initRes = spawnSync('git', ['init', '-b', branch], { cwd: workDir, encoding: 'utf8', windowsHide: true });
  if (initRes.status !== 0) {
    spawnSync('git', ['init'], { cwd: workDir, encoding: 'utf8', windowsHide: true });
    spawnSync('git', ['checkout', '-b', branch], { cwd: workDir, encoding: 'utf8', windowsHide: true });
  }

  spawnSync('git', ['config', 'user.name', 'AleDevOS Test'], { cwd: workDir, encoding: 'utf8', windowsHide: true });
  spawnSync('git', ['config', 'user.email', 'publisher-test@aledevos.local'], { cwd: workDir, encoding: 'utf8', windowsHide: true });
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: workDir, encoding: 'utf8', windowsHide: true });

  // Add remote origin pointing to bareDir
  spawnSync('git', ['remote', 'add', 'origin', bareDir], { cwd: workDir, encoding: 'utf8', windowsHide: true });

  // Create initial commit in workDir and push to bareDir so origin is set up cleanly
  spawnSync('git', ['commit', '--allow-empty', '-m', 'Initial baseline commit'], { cwd: workDir, encoding: 'utf8', windowsHide: true });
  spawnSync('git', ['push', '-u', 'origin', branch], { cwd: workDir, encoding: 'utf8', windowsHide: true });

  return {
    baseDir,
    bareDir,
    workDir,
    cleanup: () => {
      try {
        fs.rmSync(baseDir, { recursive: true, force: true });
      } catch {}
    }
  };
}

test('Test 1: Publisher blocks force-push (--force, -f, +ref) with fail-closed error', () => {
  const repo = createIsolatedRepo('feat/force-defense');
  try {
    // 1. Block +ref refspec in branch parameter
    assert.throws(
      () => push({ cwd: repo.dir, branch: '+feat/force-defense', remote: 'origin' }),
      (err) => {
        assert.ok(err instanceof GitPublisherError);
        assert.equal(err.code, PUBLISHER_EXIT_CODES.DESTRUCTIVE_COMMAND_BLOCKED);
        assert.equal(err.details.reason, 'DESTRUCTIVE_COMMAND_BLOCKED');
        return true;
      }
    );

    // 2. Block --force in extraArgs
    assert.throws(
      () => push({ cwd: repo.dir, branch: 'feat/force-defense', remote: 'origin', extraArgs: ['--force'] }),
      (err) => {
        assert.ok(err instanceof GitPublisherError);
        assert.equal(err.code, PUBLISHER_EXIT_CODES.DESTRUCTIVE_COMMAND_BLOCKED);
        return true;
      }
    );

    // 3. Block -f in extraArgs
    assert.throws(
      () => push({ cwd: repo.dir, branch: 'feat/force-defense', remote: 'origin', extraArgs: ['-f'] }),
      (err) => {
        assert.ok(err instanceof GitPublisherError);
        assert.equal(err.code, PUBLISHER_EXIT_CODES.DESTRUCTIVE_COMMAND_BLOCKED);
        return true;
      }
    );

    // 4. Block --force-with-lease in extraArgs
    assert.throws(
      () => push({ cwd: repo.dir, branch: 'feat/force-defense', remote: 'origin', extraArgs: ['--force-with-lease'] }),
      (err) => {
        assert.ok(err instanceof GitPublisherError);
        assert.equal(err.code, PUBLISHER_EXIT_CODES.DESTRUCTIVE_COMMAND_BLOCKED);
        return true;
      }
    );

    // 5. CLI entrypoint fails with code 64
    const cliRes = spawnSync(process.execPath, [publisherRuntime, 'push', '--branch', '+feat/force-defense'], {
      cwd: repo.dir,
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, ALEDEVOS_ROLE: 'orchestrator' }
    });
    assert.equal(cliRes.status, PUBLISHER_EXIT_CODES.DESTRUCTIVE_COMMAND_BLOCKED);
  } finally {
    repo.cleanup();
  }
});

test('Test 2: Publisher blocks direct commit or push to main or develop', () => {
  // 1. Direct branch: main
  const mainRepo = createIsolatedRepo('main');
  try {
    // Preflight on main blocks
    assert.throws(
      () => preflight({ cwd: mainRepo.dir }),
      (err) => {
        assert.ok(err instanceof GitPublisherError);
        assert.equal(err.code, PUBLISHER_EXIT_CODES.PROTECTED_BRANCH);
        assert.equal(err.details.reason, 'PROTECTED_BRANCH_NOT_ALLOWED');
        return true;
      }
    );

    // Commit on main blocks
    assert.throws(
      () => commit({ cwd: mainRepo.dir, message: 'Unsafe commit on main' }),
      (err) => {
        assert.ok(err instanceof GitPublisherError);
        assert.equal(err.code, PUBLISHER_EXIT_CODES.PROTECTED_BRANCH);
        return true;
      }
    );

    // Push on main blocks
    assert.throws(
      () => push({ cwd: mainRepo.dir, branch: 'main', remote: 'origin' }),
      (err) => {
        assert.ok(err instanceof GitPublisherError);
        assert.equal(err.code, PUBLISHER_EXIT_CODES.PROTECTED_BRANCH);
        return true;
      }
    );

    // CLI blocks with code 60
    const cliRes = spawnSync(process.execPath, [publisherRuntime, 'preflight'], {
      cwd: mainRepo.dir,
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, ALEDEVOS_ROLE: 'orchestrator' }
    });
    assert.equal(cliRes.status, PUBLISHER_EXIT_CODES.PROTECTED_BRANCH);
  } finally {
    mainRepo.cleanup();
  }

  // 2. Direct branch: develop
  const devRepo = createIsolatedRepo('develop');
  try {
    assert.throws(
      () => preflight({ cwd: devRepo.dir }),
      (err) => {
        assert.ok(err instanceof GitPublisherError);
        assert.equal(err.code, PUBLISHER_EXIT_CODES.PROTECTED_BRANCH);
        assert.equal(err.details.reason, 'PROTECTED_BRANCH_NOT_ALLOWED');
        return true;
      }
    );
  } finally {
    devRepo.cleanup();
  }
});

test('Test 3: Publisher preflight detects credential and secret leaks in staged diff', () => {
  const repo = createIsolatedRepo('feat/secret-scan');
  try {
    // 1. JWT secret pattern
    const fakeJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const jwtDiff = `+ const token = "${fakeJwt}";\n`;
    const jwtScan = scanDiffForSecrets(jwtDiff);
    assert.equal(jwtScan.hasSecrets, true);
    assert.equal(jwtScan.leaks[0].rule, 'JWT / Token');

    // 2. Private Key Header pattern
    const keyDiff = `+ -----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----\n`;
    const keyScan = scanDiffForSecrets(keyDiff);
    assert.equal(keyScan.hasSecrets, true);
    assert.equal(keyScan.leaks[0].rule, 'Private Key Header');

    // 3. Staging a file with a secret in isolated repo triggers preflight leak failure (code 61)
    const secretFileRel = 'config/secret.js';
    const secretFileFull = path.join(repo.dir, secretFileRel);
    fs.mkdirSync(path.dirname(secretFileFull), { recursive: true });
    fs.writeFileSync(secretFileFull, `export const secret = "${fakeJwt}";\n`, 'utf8');

    stage({ cwd: repo.dir, files: [secretFileRel], approvedScope: [secretFileRel] });

    assert.throws(
      () => preflight({ cwd: repo.dir, approvedScope: [secretFileRel] }),
      (err) => {
        assert.ok(err instanceof GitPublisherError);
        assert.equal(err.code, PUBLISHER_EXIT_CODES.SECRET_LEAK_DETECTED);
        assert.equal(err.details.reason, 'SECRET_LEAKS_DETECTED');
        assert.ok(Array.isArray(err.details.leaks));
        return true;
      }
    );

    // CLI preflight exits with 61
    const cliRes = spawnSync(process.execPath, [publisherRuntime, 'preflight', '--scope', secretFileRel], {
      cwd: repo.dir,
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, ALEDEVOS_ROLE: 'orchestrator' }
    });
    assert.equal(cliRes.status, PUBLISHER_EXIT_CODES.SECRET_LEAK_DETECTED);
  } finally {
    repo.cleanup();
  }
});

test('Test 4: Publisher blocks staging/committing files outside active task contract approved_scope', () => {
  const repo = createIsolatedRepo('feat/scope-confinement');
  try {
    const inScopeRel = 'src/feature.js';
    const outOfScopeRel = 'infra/db/migration.sql';

    fs.mkdirSync(path.join(repo.dir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(repo.dir, 'infra/db'), { recursive: true });

    fs.writeFileSync(path.join(repo.dir, inScopeRel), 'console.log("in scope");\n', 'utf8');
    fs.writeFileSync(path.join(repo.dir, outOfScopeRel), 'ALTER TABLE users ADD COLUMN hacked boolean;\n', 'utf8');

    const approvedScope = ['src/**'];

    // 1. Stage in-scope succeeds
    const stageInScope = stage({ cwd: repo.dir, files: [inScopeRel], approvedScope });
    assert.equal(stageInScope.ok, true);

    // 2. Stage out-of-scope fails with code 62
    assert.throws(
      () => stage({ cwd: repo.dir, files: [outOfScopeRel], approvedScope }),
      (err) => {
        assert.ok(err instanceof GitPublisherError);
        assert.equal(err.code, PUBLISHER_EXIT_CODES.OUT_OF_SCOPE_MODIFICATION);
        assert.equal(err.details.reason, 'OUT_OF_SCOPE_STAGING_DENIED');
        assert.deepEqual(err.details.outOfScopeFiles, [outOfScopeRel]);
        return true;
      }
    );

    // 3. Staging mixed files fails closed
    assert.throws(
      () => stage({ cwd: repo.dir, files: [inScopeRel, outOfScopeRel], approvedScope }),
      (err) => {
        assert.ok(err instanceof GitPublisherError);
        assert.equal(err.code, PUBLISHER_EXIT_CODES.OUT_OF_SCOPE_MODIFICATION);
        return true;
      }
    );

    // 4. Direct git add bypassing stage() caught during preflight
    spawnSync('git', ['add', outOfScopeRel], { cwd: repo.dir, encoding: 'utf8', windowsHide: true });
    assert.throws(
      () => preflight({ cwd: repo.dir, approvedScope }),
      (err) => {
        assert.ok(err instanceof GitPublisherError);
        assert.equal(err.code, PUBLISHER_EXIT_CODES.OUT_OF_SCOPE_MODIFICATION);
        assert.equal(err.details.reason, 'STAGED_FILES_OUTSIDE_APPROVED_SCOPE');
        assert.deepEqual(err.details.unapprovedFiles, [outOfScopeRel]);
        return true;
      }
    );
  } finally {
    repo.cleanup();
  }
});

test('Test 5: Publisher blocks destructive operations (reset --hard, clean -fdx, branch -D)', () => {
  // 1. assertNonDestructive unit validation
  assert.throws(
    () => assertNonDestructive('reset', ['--hard', 'HEAD~1']),
    (err) => {
      assert.ok(err instanceof GitPublisherError);
      assert.equal(err.code, PUBLISHER_EXIT_CODES.DESTRUCTIVE_COMMAND_BLOCKED);
      return true;
    }
  );

  assert.throws(
    () => assertNonDestructive('clean', ['-fdx']),
    (err) => {
      assert.ok(err instanceof GitPublisherError);
      assert.equal(err.code, PUBLISHER_EXIT_CODES.DESTRUCTIVE_COMMAND_BLOCKED);
      return true;
    }
  );

  assert.throws(
    () => assertNonDestructive('branch', ['-D', 'feat/legacy']),
    (err) => {
      assert.ok(err instanceof GitPublisherError);
      assert.equal(err.code, PUBLISHER_EXIT_CODES.DESTRUCTIVE_COMMAND_BLOCKED);
      return true;
    }
  );

  // 2. Safe commands pass assertNonDestructive
  assert.doesNotThrow(() => assertNonDestructive('status', ['--porcelain=v1']));
  assert.doesNotThrow(() => assertNonDestructive('diff', ['--name-only']));
  assert.doesNotThrow(() => assertNonDestructive('commit', ['-m', 'Safe commit']));
});

test('Test 6: Publisher reports GITHUB_AUTH_BLOCKED without requesting or printing cleartext credentials', () => {
  const repo = createIsolatedRepo('feat/auth-check');
  try {
    // When gh is simulated as unauthenticated or in an isolated env without tokens
    const authState = checkGitHubAuth({
      cwd: repo.dir,
      env: { ...process.env, GH_TOKEN: '', GITHUB_TOKEN: '', PATH: '' }
    });

    if (!authState.authenticated) {
      assert.equal(authState.status, 'GITHUB_AUTH_BLOCKED');
      assert.ok(!authState.user);
      // Ensure error output does not leak any secret tokens
      assert.throws(
        () => preflight({ cwd: repo.dir, requireGitHubAuth: true }),
        (err) => {
          assert.ok(err instanceof GitPublisherError);
          assert.equal(err.code, PUBLISHER_EXIT_CODES.GITHUB_AUTH_BLOCKED);
          assert.equal(err.details.reason, 'GITHUB_AUTH_BLOCKED');
          return true;
        }
      );
    }
  } finally {
    repo.cleanup();
  }
});

test('Test 7: Publisher end-to-end stage, preflight, commit, push, and remote SHA verification in isolated local test repositories', () => {
  const pair = createIsolatedPairRepos('feat/e2e-publisher-pass');
  try {
    const featureRel = 'core/engine/feature.js';
    const featureFull = path.join(pair.workDir, featureRel);
    fs.mkdirSync(path.dirname(featureFull), { recursive: true });
    fs.writeFileSync(featureFull, 'export const featureName = "AleDevOS Autonomous Publisher";\n', 'utf8');

    const approvedScope = [featureRel];

    // Seed passing task state for certified publication
    fs.mkdirSync(path.join(pair.workDir, '.aledevos/state'), { recursive: true });
    fs.writeFileSync(path.join(pair.workDir, '.aledevos/state/current.json'), JSON.stringify({
      task_id: 'task-e2e',
      final_state: 'PASS',
      gates: {
        scope: { status: 'PASS' },
        integrity: { status: 'PASS' },
        canonical: { status: 'PASS' },
        quality_engineering: { status: 'PASS' }
      },
      judges: {
        requirements: { score: 95 },
        regression: { score: 92 },
        quality: { score: 90 }
      }
    }, null, 2), 'utf8');

    // 1. Stage in-scope file
    const stageRes = stage({ cwd: pair.workDir, files: [featureRel], approvedScope });
    assert.equal(stageRes.ok, true);
    assert.deepEqual(stageRes.staged, [featureRel]);

    // 2. Preflight verification
    const pfRes = preflight({ cwd: pair.workDir, approvedScope });
    assert.equal(pfRes.ok, true);
    assert.equal(pfRes.status, 'PREFLIGHT_PASS');
    assert.equal(pfRes.branch, 'feat/e2e-publisher-pass');
    assert.deepEqual(pfRes.stagedFiles, [featureRel]);

    // 3. Commit
    const commitRes = commit({ cwd: pair.workDir, message: 'feat: implement autonomous publisher e2e', approvedScope });
    assert.equal(commitRes.ok, true);
    assert.equal(commitRes.status, 'COMMITTED');
    assert.ok(commitRes.sha && commitRes.sha.length >= 7);

    // 4. Push to remote with remote commit SHA verification
    const pushRes = push({ cwd: pair.workDir, remote: 'origin', branch: 'feat/e2e-publisher-pass' });
    assert.equal(pushRes.ok, true);
    assert.equal(pushRes.status, 'PUSH_VERIFIED');
    assert.equal(pushRes.verified, true);
    assert.equal(pushRes.sha, commitRes.sha);

    // 5. Independently verify with git ls-remote directly on bareDir
    const verifyLs = spawnSync('git', ['ls-remote', pair.bareDir, 'refs/heads/feat/e2e-publisher-pass'], {
      encoding: 'utf8',
      windowsHide: true
    });
    assert.equal(verifyLs.status, 0);
    const [remoteSha] = (verifyLs.stdout || '').trim().split(/\s+/);
    assert.equal(remoteSha, commitRes.sha, 'Commit SHA on remote bare repo must strictly match committed SHA');
  } finally {
    pair.cleanup();
  }
});

test('Test 8: Pretool guard blocks unauthorized subagents (builder/judges) from arbitrary git execution', () => {
  assert.ok(fs.existsSync(guardPath), `pretool-guard hook must exist at ${guardPath}`);

  function runGuard(toolName, cmdLine, role) {
    const payload = {
      toolCall: {
        name: toolName,
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
    assert.equal(res.status, 0, `Guard process crashed: ${res.stderr}`);
    return JSON.parse(res.stdout);
  }

  // 1. builder role attempting arbitrary git command
  const builderGit = runGuard('run_command', 'git push origin main', 'builder');
  assert.equal(builderGit.decision, 'deny');
  assert.ok(builderGit.reason.includes("AleDevOS denies shell git/gh and publish execution to subagent role 'builder'"));

  // 2. judge-requirements role attempting arbitrary git command
  const judgeReqGit = runGuard('run_command', 'git push origin feat/bypass', 'judge-requirements');
  assert.equal(judgeReqGit.decision, 'deny');
  assert.ok(judgeReqGit.reason.includes("AleDevOS denies shell git/gh and publish execution to subagent role 'judge-requirements'"));

  // 3. judge-regression role attempting git status
  const judgeRegGit = runGuard('run_command', 'git status', 'judge-regression');
  assert.equal(judgeRegGit.decision, 'deny');
  assert.ok(judgeRegGit.reason.includes("AleDevOS denies shell git/gh and publish execution to subagent role 'judge-regression'"));

  // 4. judge-quality role attempting gh pr create
  const judgeQualGh = runGuard('run_command', 'gh pr create --title "Bypass PR"', 'judge-quality');
  assert.equal(judgeQualGh.decision, 'deny');
  assert.ok(judgeQualGh.reason.includes("AleDevOS denies shell git/gh and publish execution to subagent role 'judge-quality'"));

  // 5. Unlisted roles (architect, researcher, security-reviewer) are denied raw git execution
  for (const role of ['architect', 'researcher', 'security-reviewer']) {
    const unlistedGit = runGuard('run_command', 'git status', role);
    assert.equal(unlistedGit.decision, 'deny');
    assert.ok(unlistedGit.reason.includes(`AleDevOS denies shell git/gh and publish execution to subagent role '${role}'`));
  }

  // 6. Command chaining with git is denied
  const chainedGit = runGuard('run_command', 'publish status && git push --force origin main', 'orchestrator');
  assert.equal(chainedGit.decision, 'deny');
  assert.equal(chainedGit.reason, 'AleDevOS denies chained git/gh shell commands.');

  // 7. orchestrator role invoking governed publisher runtime is permitted
  const orchGoverned = runGuard('run_command', 'node core/engine/aledevos.mjs publish status', 'orchestrator');
  assert.equal(orchGoverned.decision, 'allow');
  assert.equal(orchGoverned.reason, 'AleDevOS governed runtime command');

  // 8. orchestrator role executing git command is permitted
  const orchestratorGit = runGuard('run_command', 'git status', 'orchestrator');
  assert.equal(orchestratorGit.decision, 'allow');
  assert.equal(orchestratorGit.reason, 'AleDevOS governed runtime command');
});

test('Test 9: Pretool guard blocks subagents attempting node core/engine/aledevos.mjs publish ...', () => {
  function runGuard(toolName, cmdLine, role) {
    const payload = {
      toolCall: {
        name: toolName,
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
    assert.equal(res.status, 0, `Guard process crashed: ${res.stderr}`);
    return JSON.parse(res.stdout);
  }

  const subagentRoles = [
    'builder',
    'verifier',
    'judge-requirements',
    'judge-regression',
    'judge-quality',
    'architect',
    'editor-backend',
    'editor-frontend'
  ];

  for (const role of subagentRoles) {
    const pubStatus = runGuard('run_command', 'node core/engine/aledevos.mjs publish status', role);
    assert.equal(pubStatus.decision, 'deny', `Role ${role} must be denied publish status`);
    assert.ok(
      pubStatus.reason.includes(`AleDevOS denies shell git/gh and publish execution to subagent role '${role}'`),
      `Reason for ${role} must indicate publisher confinement`
    );

    const pubCommit = runGuard('run_command', 'node core/engine/aledevos.mjs publish commit -m "bypass"', role);
    assert.equal(pubCommit.decision, 'deny', `Role ${role} must be denied publish commit`);

    const pubDirect = runGuard('run_command', 'node core/engine/git-publisher.mjs status', role);
    assert.equal(pubDirect.decision, 'deny', `Role ${role} must be denied direct git-publisher invocation`);
  }

  // Chained publisher commands are denied
  const chainedPub = runGuard('run_command', 'node core/engine/aledevos.mjs publish status ; whoami', 'orchestrator');
  assert.equal(chainedPub.decision, 'deny');
  assert.equal(chainedPub.reason, 'AleDevOS denies chained git/gh shell commands.');
});

test('Test 10: Preflight rejects main and develop even if --allow-branch main is supplied (unconditional exit code 60)', () => {
  // 1. main branch cannot be bypassed with allowlist
  const mainRepo = createIsolatedRepo('main');
  try {
    assert.throws(
      () => preflight({ cwd: mainRepo.dir, allowlistBranches: ['main'] }),
      (err) => {
        assert.ok(err instanceof GitPublisherError);
        assert.equal(err.code, PUBLISHER_EXIT_CODES.PROTECTED_BRANCH);
        assert.equal(err.details.reason, 'PROTECTED_BRANCH_NOT_ALLOWED');
        return true;
      }
    );

    // Commit also blocks unconditionally
    assert.throws(
      () => commit({ cwd: mainRepo.dir, message: 'Unconditional defense commit', allowlistBranches: ['main'] }),
      (err) => {
        assert.ok(err instanceof GitPublisherError);
        assert.equal(err.code, PUBLISHER_EXIT_CODES.PROTECTED_BRANCH);
        return true;
      }
    );

    // Push also blocks unconditionally
    assert.throws(
      () => push({ cwd: mainRepo.dir, branch: 'main', remote: 'origin', allowlistBranches: ['main'] }),
      (err) => {
        assert.ok(err instanceof GitPublisherError);
        assert.equal(err.code, PUBLISHER_EXIT_CODES.PROTECTED_BRANCH);
        return true;
      }
    );

    // CLI preflight exits with 60
    const cliRes = spawnSync(process.execPath, [publisherRuntime, 'preflight', '--allow-branch', 'main'], {
      cwd: mainRepo.dir,
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, ALEDEVOS_ROLE: 'orchestrator' }
    });
    assert.equal(cliRes.status, PUBLISHER_EXIT_CODES.PROTECTED_BRANCH);
  } finally {
    mainRepo.cleanup();
  }

  // 2. develop branch cannot be bypassed with allowlist
  const devRepo = createIsolatedRepo('develop');
  try {
    assert.throws(
      () => preflight({ cwd: devRepo.dir, allowlistBranches: ['develop'] }),
      (err) => {
        assert.ok(err instanceof GitPublisherError);
        assert.equal(err.code, PUBLISHER_EXIT_CODES.PROTECTED_BRANCH);
        assert.equal(err.details.reason, 'PROTECTED_BRANCH_NOT_ALLOWED');
        return true;
      }
    );
  } finally {
    devRepo.cleanup();
  }
});

test('Test 11: Certified commit and push fail closed with exit code 68 when task is not certified', () => {
  const repo = createIsolatedRepo('feat/uncertified-task');
  try {
    const fileRel = 'core/engine/feature.js';
    fs.mkdirSync(path.join(repo.dir, 'core/engine'), { recursive: true });
    fs.writeFileSync(path.join(repo.dir, fileRel), 'export const a = 1;\n', 'utf8');

    stage({ cwd: repo.dir, files: [fileRel], approvedScope: [fileRel] });

    // Scenario A: No .aledevos/state/current.json present
    assert.throws(
      () => commit({ cwd: repo.dir, message: 'Uncertified commit A', approvedScope: [fileRel], requireCertification: true }),
      (err) => {
        assert.ok(err instanceof GitPublisherError);
        assert.equal(err.code, PUBLISHER_EXIT_CODES.TASK_NOT_CERTIFIED);
        assert.equal(err.details.reason, 'TASK_NOT_CERTIFIED');
        return true;
      }
    );

    // Scenario B: State exists, but final_state is not PASS (e.g. IN_PROGRESS)
    fs.mkdirSync(path.join(repo.dir, '.aledevos/state'), { recursive: true });
    fs.writeFileSync(path.join(repo.dir, '.aledevos/state/current.json'), JSON.stringify({
      task_id: 'task-in-prog',
      final_state: 'IN_PROGRESS'
    }, null, 2), 'utf8');

    assert.throws(
      () => commit({ cwd: repo.dir, message: 'Uncertified commit B', approvedScope: [fileRel], requireCertification: true }),
      (err) => {
        assert.ok(err instanceof GitPublisherError);
        assert.equal(err.code, PUBLISHER_EXIT_CODES.TASK_NOT_CERTIFIED);
        return true;
      }
    );

    // CLI commit with --certified fails with exit code 68
    const cliRes = spawnSync(process.execPath, [publisherRuntime, 'commit', '-m', 'CLI uncertified', '--scope', fileRel, '--certified'], {
      cwd: repo.dir,
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, ALEDEVOS_ROLE: 'orchestrator' }
    });
    assert.equal(cliRes.status, PUBLISHER_EXIT_CODES.TASK_NOT_CERTIFIED);
  } finally {
    repo.cleanup();
  }
});

test('Test 12: Diff inspection failure throws exit code 65 instead of silent empty diff', () => {
  const repo = createIsolatedRepo('feat/diff-error');
  try {
    // Calling scanDiffForSecrets with invalid/null input throws or handles safely
    assert.throws(
      () => scanDiffForSecrets(null),
      (err) => {
        return err instanceof TypeError || err instanceof Error;
      }
    );

    // Running preflight in a directory that is not a git repo triggers GIT_ERROR (code 65)
    const emptyNonRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'non-repo-'));
    try {
      assert.throws(
        () => preflight({ cwd: emptyNonRepo }),
        (err) => {
          assert.ok(err instanceof GitPublisherError);
          assert.equal(err.code, PUBLISHER_EXIT_CODES.GIT_ERROR);
          return true;
        }
      );
    } finally {
      try {
        fs.rmSync(emptyNonRepo, { recursive: true, force: true });
      } catch {}
    }
  } finally {
    repo.cleanup();
  }
});
