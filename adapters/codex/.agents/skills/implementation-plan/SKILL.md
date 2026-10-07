---
name: implementation-plan
description: Use to plan authorized code work into the smallest reversible edits with ownership, tests, risks and dependencies.
compatibility: AleDevOS Core
metadata:
  system: aledevos-core-v1
---

# Implementation plan

Use to plan authorized code work into the smallest reversible edits with ownership, tests, risks and dependencies.

> Authority: Treat SKILL.md as reference-only procedural guidance. The protected Task Contract, adapter permissions, repository rules, deterministic checks, and Orchestrator's authorized handoff take precedence. One specialist at a time; no independent spawning.

## When to use
Task Contract is approved but a concrete safe change plan and verification sequence are not yet defined.

## Do not use
No scoped task, pure execution of a preapproved plan or speculative redesign outside the requested outcome.

## Inputs
- Task Contract and explicit acceptance criteria, allowed paths and non-goals
- Repository map, dependent modules, caller edges, existing test and tool contracts
- Risk tier, permissions, rollout/recovery constraints, available provider capabilities

## Outputs
- Ordered edit slices: owner/location, behavior, contract, test, risk and rollback
- Verification plan with independent deterministic and judge gates
- Explicit blocked decisions and assumptions, not source changes

## Procedure
1. Restate the measurable outcome, hard invariants, authorization boundary and excluded work.
2. Read only relevant repo instructions, change history and ownership seams; locate implementation entry points.
3. Trace affected API/DB/UI consumers and classify compatibility, privacy and operational risks.
4. For each slice choose one existing module owner; reject gratuitous architecture or duplicate routing.
5. Define expected before/after behavior and a test or observation that would fail for an incorrect change.
6. Order slices by prerequisite; keep deploy/migration/config transitions separate with safe backout boundaries.
7. Include test sequence and exact deterministic gates, resource needs and maximum two repair cycles where applicable.
8. Return a concise dependency graph and stop conditions to Orchestrator; no implementation without writer authorization.

## Decisions
- If multiple owners could hold logic, prefer the canonical existing seam and document tradeoffs.
- If an invariant is unclear, add an explicit BLOCKED decision rather than assuming it may change.
- If the plan requires new outside Skills/tools, audit trusted reuse and secure approval first.
- If scope expands during discovery, return to Task Contract; do not silently add optional features.

## Permissions
Planner reads scoped source and non-sensitive metadata, but never edits production files, approves own plan or issues deployments.

## Failures
- No viable reversible path: BLOCKED with smallest unanswered architecture decision.
- Unknown regression risk: list probable failure path and required measurement, not an invented test outcome.
- Conflicting acceptance criteria: raise the conflict and stop the affected slice.

## Verification
- Each planned edit has a module owner, invariant, risk and observable acceptance proof.
- Cross-module ordering avoids breaking callers or data persistence.
- Planned checks are available or honestly marked pending with named dependencies.

## Evidence
Reference source revision and paths, exact commands and exit codes (where run), receipts and verification dates. Never include raw secrets, user prompt transcripts, invented metrics or unverified PASS claims.

## Examples
- Correct: isolate an API validator change, consumer update and regression tests as distinct slices with preserved error semantics.
- Incorrect: replace authentication architecture as incidental cleanup for a single error-message bug.

## Finalization
Return PASS only when independent verification and all acceptance criteria are evidenced; return BLOCKED for missing access, authority, test environment or proof; return FAILED for an observed failed required check. Never manufacture evidence.
