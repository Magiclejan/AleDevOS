---
name: repair-loop
description: Use only after protected verifier or judge FAIL to authorize a bounded repair cycle with fresh re-verification.
compatibility: Claude Code project skill
metadata:
  system: aledevos-core-v1
---

# Repair loop

Use only after protected verifier or judge FAIL to authorize a bounded repair cycle with fresh re-verification.

> Authority: Treat SKILL.md as reference-only procedural guidance. The protected Task Contract, adapter permissions, repository rules, deterministic checks, and Orchestrator's authorized handoff take precedence. One specialist at a time; no independent spawning.

## When to use
An official failed gate is recorded, protected repair-start permits another attempt and Orchestrator assigns a scoped Repairer.

## Do not use
Initial implementation, aesthetic iteration without sanctioned findings, PASS judgment or exhausted retry budget.

## Inputs
- Failed verifier/judge receipt and exact findings with immutable IDs
- Authorized repair plan, permitted files, current state/attempt count and unchanged invariants
- Reproduction command, source revision and tests needed for fresh P2–P5 evidence where applicable

## Outputs
- Minimal findings-linked repair diff; one attempt per authorized cycle
- Reproduction and focused verification results, unresolved findings and fresh receipt references
- Clear FAILED/BLOCKED/exhausted state without unauthorized third attempt

## Procedure
1. Read protected current task and repair authorization; verify remaining attempts, approved findings and file scope.
2. Reproduce the specific failure using the original command and pinned inputs, keeping evidence intact.
3. Find root cause; classify implementation bug, test-environment defect, policy conflict or missing capability.
4. Propose the smallest source fix for an authorized finding; do not alter baseline, tests, scores or security policies to hide it.
5. Apply the edit only through authorized Repairer tools, one subagent at a time and with no scope expansion.
6. Run a focused check and inspect diff to ensure no changes to protected control-plane or judge reports.
7. Return control to Verifier and all required independent judges; after visual repair require fresh P2 → P3 → P4 → P5 evidence.
8. If the retry budget is exhausted, finalize FAILED; never self-start repair 3 or mutate protected state.

## Decisions
- If the finding cannot be reproduced, report BLOCKED with missing environment, not a speculative edit.
- If fixing the issue needs an out-of-scope file, request new authorized plan; do not write outside scope.
- If a new defect arises, hand it to the independent verifier for classification.
- If the last allowed attempt fails, preserve evidence and report exhausted without third repair.

## Permissions
Repairer edits only approved product paths for approved finding IDs. Judges remain read-only; no baseline promotion, score edits, receipt rewriting or destructive Git commands.

## Failures
- Repair-start missing, stale revision or current state PASS: BLOCKED and no mutation.
- Focused test continues to fail: FAILED and attempt consumed per protected runtime.
- Scope/permission conflict: stop before edit and report exact blocked path.

## Verification
- Repair exactly matches authorized finding IDs and attempt number <=2.
- Changed files are within the approved set; no evidence or control-plane file changed.
- Independent fresh required gates pass after fix, never reused stale before-repair receipts.

## Evidence
Reference source revision and paths, exact commands and exit codes (where run), receipts and verification dates. Never include raw secrets, user prompt transcripts, invented metrics or unverified PASS claims.

## Examples
- Correct: repair one null-guard referenced by a failed regression finding, then run the focused test and full independent verification.
- Incorrect: delete the failing test or promote a screenshot baseline to force visual PASS.

## Finalization
Return PASS only when independent verification and all acceptance criteria are evidenced; return BLOCKED for missing access, authority, test environment or proof; return FAILED for an observed failed required check. Never manufacture evidence.
