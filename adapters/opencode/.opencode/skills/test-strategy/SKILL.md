---
name: test-strategy
description: Use to design behavior-first regression and integration verification with honest real/mock provenance and failure controls.
compatibility: OpenCode V2 adapter
metadata:
  system: aledevos-core-v1
---

# Test strategy

Use to design behavior-first regression and integration verification with honest real/mock provenance and failure controls.

> Authority: Treat SKILL.md as reference-only procedural guidance. The protected Task Contract, adapter permissions, repository rules, deterministic checks, and Orchestrator's authorized handoff take precedence. One specialist at a time; no independent spawning.

## When to use
Task Contract or proposed diff needs an executable test matrix with meaningful risk coverage.

## Do not use
Faking green output, lowering coverage to pass CI or promising real-provider behavior with only mocks.

## Inputs
- Approved acceptance criteria, public contract and changed behavior or failure reproduction
- Existing test layers/fixtures, deterministic gates, provider availability and authorization constraints
- Risk classification, external dependencies and regression-sensitive consumer paths

## Outputs
- Test matrix from criterion → layer → setup/input → expected proof → provenance
- Required negative, edge, permission and failure-recovery scenarios
- Exact commands, environment dependencies and realistic gate/blocker states

## Procedure
1. Identify observable behavior and a failure that would distinguish a correct change from an incorrect one.
2. Choose the lowest stable test layer proving each criterion, then add integration/E2E only for cross-boundary risk.
3. For bugs, capture a failing-before reproduction; prevent regression with a test that detects original fault.
4. For features, cover happy path plus permission-denied, malformed, absent and material edge/error paths.
5. Use deterministic fixtures and isolate external services; label mock or controlled provider provenance.
6. Add concurrency, persistence, migrations, network faults and retry tests where the contract crosses those boundaries.
7. Define exact test commands, stable assertions, expected exit codes and freshness/correlation to source revision.
8. Run authorized checks or hand off execution; interpret failures without weakening tests or suppressing warnings.

## Decisions
- If unit coverage cannot prove integration, add a higher-level contract or E2E test.
- If real-browser or native-image output is required, isolate that gate and mark it BLOCKED until provider evidence exists.
- If a flaky test times out, investigate environment and nondeterminism rather than merely doubling budget without evidence.
- If a regression test passes on the broken baseline, strengthen it so it distinguishes the fault.

## Permissions
Planner/test author may edit test files only when explicitly authorized as writer. Verifiers/Judges remain read-only. Never disable CI, tests, coverage, security gates or provider provenance checks.

## Failures
- Missing dependency/environment: BLOCKED with reproduction instructions, not silently SKIPPED.
- Product assertion failure: FAILED with actual/expected values and source revision.
- Non-deterministic outcome: isolate cause, collect repeat measurements and leave gate UNVERIFIED until resolved.

## Verification
- Every acceptance criterion has at least one behavior-based proof and applicable negative scenario.
- Assertions would detect a meaningful wrong implementation, not merely check that a function ran.
- Test results include commands, runtime/provider identity and source revision; no skips or fabricated receipts.

## Evidence
Reference source revision and paths, exact commands and exit codes (where run), receipts and verification dates. Never include raw secrets, user prompt transcripts, invented metrics or unverified PASS claims.

## Examples
- Correct: a change to a payment idempotency key gets replay, concurrency and failed-charge tests with stable fake gateway semantics.
- Incorrect: replace detailed assertions with `expect(true).toBe(true)` to make a flaky run green.

## Finalization
Return PASS only when independent verification and all acceptance criteria are evidenced; return BLOCKED for missing access, authority, test environment or proof; return FAILED for an observed failed required check. Never manufacture evidence.
