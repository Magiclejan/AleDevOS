---
name: regression-analysis
description: Use to trace consumer and behavior blast radius after code changes, pairing each plausible risk with concrete verification.
compatibility: Claude Code project skill
metadata:
  system: aledevos-core-v1
---

# Regression analysis

Use to trace consumer and behavior blast radius after code changes, pairing each plausible risk with concrete verification.

> Authority: Treat SKILL.md as reference-only procedural guidance. The protected Task Contract, adapter permissions, repository rules, deterministic checks, and Orchestrator's authorized handoff take precedence. One specialist at a time; no independent spawning.

## When to use
A change touches shared behavior, a public contract, persistence, auth, UI states or a previous regression-sensitive area.

## Do not use
A request merely to summarize an unchanged file or to assert zero regressions without test evidence.

## Inputs
- Pinned diff or change plan, affected API/type/schema/event contracts
- Call sites and consumers, data/state compatibility and prior regression history
- Current focused tests and release-gate expectations

## Outputs
- Blast-radius map by boundary/consumer and severity
- Risk-to-test matrix with PASSED/FAILED/UNVERIFIED entries
- Regression recommendations grounded in changed behavior

## Procedure
1. Identify changed semantics rather than only filenames; record before/after contract, side effects and error paths.
2. Find direct and transitive callers within bounded scope; distinguish unreferenced code from dynamic entry points.
3. Check persisted data, serialized states, migrations and old/new consumer overlap where relevant.
4. Evaluate permission, concurrency, caching, retries, loading/error and external-service failure paths.
5. Link each plausible failure to a failing-before/failing-after regression test or explicit manual gate.
6. Prioritize by customer impact and probability; remove risks with no plausible path, not missing evidence.
7. Run authorized focused tests or attach their existing run receipts and report version provenance.
8. Deliver unresolved paths to Verifier/Regression Judge without declaring production safety by opinion.

## Decisions
- If a consumer contract remains byte-compatible, lower risk only with evidence from caller tests.
- If persistence migration changes shape, require old-data fixture and backward-read verification.
- If risk relies on an unsupported provider, leave it UNVERIFIED and report the missing capability.
- If a suspected regression is unrelated to this diff, record it separately without enlarging edit scope.

## Permissions
Analysis is read-only; source modifications and test approvals belong to authorized writer/Verifier/Judge roles.

## Failures
- Caller inventory incomplete: BLOCKED for global 'no-regression' claims.
- Focused test fails on a changed behavior: FAILED with reproduction path.
- Environment-specific test fails before product execution: BLOCKED environment, not product PASS/FAIL guessing.

## Verification
- Coverage matrix names every changed public behavior and material consumer path.
- Observed test results include exact command, source revision and exit status.
- No unverified area is silently counted as regression PASS.

## Evidence
Reference source revision and paths, exact commands and exit codes (where run), receipts and verification dates. Never include raw secrets, user prompt transcripts, invented metrics or unverified PASS claims.

## Examples
- Correct: changing null handling in a shared serializer triggers tests for legacy persisted records and all message consumers.
- Incorrect: mark regression PASS because only one file changed.

## Finalization
Return PASS only when independent verification and all acceptance criteria are evidenced; return BLOCKED for missing access, authority, test environment or proof; return FAILED for an observed failed required check. Never manufacture evidence.
