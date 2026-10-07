---
name: requirements-check
description: Use to independently verify every acceptance criterion against source and observed test evidence without self-approval.
compatibility: Claude Code project skill
metadata:
  system: aledevos-core-v1
---

# Requirements check

Use to independently verify every acceptance criterion against source and observed test evidence without self-approval.

> Authority: Treat SKILL.md as reference-only procedural guidance. The protected Task Contract, adapter permissions, repository rules, deterministic checks, and Orchestrator's authorized handoff take precedence. One specialist at a time; no independent spawning.

## When to use
Verifier or Requirements Judge needs evidence-based criterion-by-criterion final coverage.

## Do not use
Writing acceptance criteria from scratch, changing tests to meet a score, or implementing product fixes as a judge.

## Inputs
- Approved immutable Task Contract and acceptance criteria IDs
- Source revision, code diff, focused test results, functional artifacts and required role receipts
- Security/quality gates, any explicitly permitted waivers with policy references

## Outputs
- One status per criterion: VERIFIED, FAILED or UNVERIFIED, with traceable evidence references
- Blocking findings and missing proof, separate from overall acceptance decision
- Unambiguous final handoff to Orchestrator without mutating protected state

## Procedure
1. Load the canonical current Task Contract and ensure criteria and scope have not drifted.
2. Map each criterion to observable behavior, affected code and at least one admissible proof type.
3. Verify cited artifacts exist and match source revision and policy provenance, not only a reported PASS string.
4. Execute permitted independent checks or inspect sealed receipts; distinguish real provider runs from controlled mocks.
5. Test negative/permission/edge cases when the criterion demands them; check that assertions prove behavior.
6. Mark VERIFIED only when requirements and evidence align; FAILED on contradictory observation, UNVERIFIED on missing or stale proof.
7. Aggregate blockers and score without deleting weak or ambiguous criteria from the denominator.
8. Report criterion table with immutable IDs and link to Regression and Quality Judges, never approving itself.

## Decisions
- If an acceptance criterion is ambiguous, request clarification and mark UNVERIFIED.
- If evidence comes from a stale build, reject it until reproduced under current revision.
- If policy permits a waiver, record its authorized ID and scope; don't silently exempt.
- If any critical criterion is UNVERIFIED, block completion even when other tests pass.

## Permissions
Strictly read-only judge/verification role; cannot edit code, tests, Task Contract, scores, gate policies or sealed evidence.

## Failures
- Missing Task Contract: BLOCKED with no invented acceptance matrix.
- Observed criterion failure: FAILED with exact counterexample and evidence.
- Corrupt receipt/hash: BLOCKED evidence and escalate integrity concerns.

## Verification
- Every original acceptance criterion appears exactly once in the matrix.
- VERIFIED rows link to actual reproducible proof from the pinned revision.
- Critical UNVERIFIED rows prevent global PASS under existing gate policy.

## Evidence
Reference source revision and paths, exact commands and exit codes (where run), receipts and verification dates. Never include raw secrets, user prompt transcripts, invented metrics or unverified PASS claims.

## Examples
- Correct: the criterion 'denies non-owner updates' is VERIFIED using an actual 403 test receipt tied to current commit.
- Incorrect: mark a criterion VERIFIED because the developer wrote 'implemented' in a handoff.

## Finalization
Return PASS only when independent verification and all acceptance criteria are evidenced; return BLOCKED for missing access, authority, test environment or proof; return FAILED for an observed failed required check. Never manufacture evidence.
