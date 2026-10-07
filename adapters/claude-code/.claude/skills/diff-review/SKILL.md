---
name: diff-review
description: Use for evidence-based review of an actual scoped Git diff; find actionable regressions, security and scope risks.
compatibility: Claude Code project skill
metadata:
  system: aledevos-core-v1
---

# Diff review

Use for evidence-based review of an actual scoped Git diff; find actionable regressions, security and scope risks.

> Authority: Treat SKILL.md as reference-only procedural guidance. The protected Task Contract, adapter permissions, repository rules, deterministic checks, and Orchestrator's authorized handoff take precedence. One specialist at a time; no independent spawning.

## When to use
A committed or working-tree diff needs independent review before verifier/judges or merge.

## Do not use
No diff is available, a request to write production changes, or an unrelated whole-repository audit.

## Inputs
- Pinned base and head refs (or named working tree), Task Contract and allowed path scope
- Changed hunks, nearby callers, tests, generated-file ownership and verification logs
- Risk classification and existing required code review or CI policies

## Outputs
- Findings ordered by severity with path:line/symbol, evidence, impact and specific next action
- Clean or unresolved review assessment with cited scope/test gaps
- No code modifications, approvals or guessed PASS labels

## Procedure
1. Confirm which base/head and dirty/untracked files are included; do not assume a plain diff shows new untracked files.
2. Read the full changed hunks and local context before concluding, paying attention to deletions and moved logic.
3. Map changed contracts to callers, schemas, persistence and error handling; identify introduced scope outside approval.
4. Review data access, authorization, user input, logging, secrets and dependency changes for concrete exploit paths.
5. Compare test changes with product changes; look for skipped tests, weakened assertions, fixture-only happy paths and fake receipts.
6. Classify each issue by observed consequence and reproducible evidence; separate risk hypotheses from confirmed faults.
7. Return minimal fix suggestions linked to the changed line and acceptance criterion; avoid broad stylistic noise.
8. Hand findings to Orchestrator/Repairer with no write permissions and no self-approval.

## Decisions
- If only a formatting change exists, focus on accidental semantic churn and avoid inventing functional defects.
- If a security boundary is touched, request security-check and mark the finding pending its evidence.
- If a necessary source or test is missing, mark that dimension UNVERIFIED instead of PASS.
- If change scope exceeds authorization, block finalization until the Task Contract is updated.

## Permissions
Read-only review. May inspect safe Git status/diff/log through adapter policy; never stage, commit, edit or run destructive Git commands.

## Failures
- Unknown base revision or missing complete diff: BLOCKED with exact missing refs/files.
- Observed harmful behavior or prohibited scope: FAILED with repro or deterministic gate.
- Unconfirmed concern: label RISK/UNVERIFIED and identify the precise verification needed.

## Verification
- Every high-severity finding has an artifact, path/symbol and potential failure route.
- All changed files are accounted for, including new/untracked files or explicit exclusions.
- Review does not claim tests executed unless an actual test receipt is available.

## Evidence
Reference source revision and paths, exact commands and exit codes (where run), receipts and verification dates. Never include raw secrets, user prompt transcripts, invented metrics or unverified PASS claims.

## Examples
- Correct: report that modified access control now permits a non-owner and point to the policy branch plus a failing denial test.
- Incorrect: produce 30 generic security concerns without checking any changed code.

## Finalization
Return PASS only when independent verification and all acceptance criteria are evidenced; return BLOCKED for missing access, authority, test environment or proof; return FAILED for an observed failed required check. Never manufacture evidence.
