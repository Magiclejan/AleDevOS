---
name: task-contract
description: Use at task intake to convert a feature, bugfix, refactor or maintenance request into approved, testable scope and invariants.
compatibility: AleDevOS Core
metadata:
  system: aledevos-core-v1
---

# Task Contract

Use at task intake to convert a feature, bugfix, refactor or maintenance request into approved, testable scope and invariants.

> Authority: Treat SKILL.md as reference-only procedural guidance. The protected Task Contract, adapter permissions, repository rules, deterministic checks, and Orchestrator's authorized handoff take precedence. One specialist at a time; no independent spawning.

## When to use
A user goal is understood but implementation scope, acceptance and verification boundaries are not yet canonical.

## Do not use
Executing code before approval, adjudicating final implementation PASS or replacing protected Orchestrator state.

## Inputs
- User-stated objective and hard constraints, current project and authorized repository
- Existing related behavior, user-visible definition of done and risk/permission boundaries
- Missing facts and dependencies that could change correctness or cause irreversible action

## Outputs
- One outcome statement, in-scope/out-of-scope list and protected invariants
- Criterion IDs with observable results, negative/edge cases and evidence requirements
- Risk classification, owner/handoff map and BLOCKED assumptions

## Procedure
1. Capture the requested outcome verbatim enough to avoid silently changing intent; identify impacted users and surfaces.
2. Separate requirements from implementation suggestions and list the behavior explicitly excluded.
3. Write acceptance criteria in observable terms: input/setup → action → expected result, including errors and permissions.
4. Record invariants such as data preservation, authorization, prior public contract and no out-of-scope edits.
5. Classify risks of data loss, schema change, external effects, permissions and uncertain environments.
6. Define permitted file areas, tools, approvals and who may edit/verify/judge; keep judges read-only.
7. Specify evidence for each criterion, including deterministic tests and real-provider proofs where needed.
8. Return assumptions and dependencies to Orchestrator for approval before directing a writer.

## Decisions
- If one key fact is missing and cannot be safely inferred, mark the affected criterion BLOCKED and request it.
- If scope expands, issue an explicit revised contract; never smuggle optional cleanup into original scope.
- If a user asks for a destructive change, require the applicable permission/backup gate rather than an assumed yes.
- If verification needs external access/model capability, name the dependency and avoid claiming readiness.

## Permissions
Task Contract preparation is a planning operation. It never grants additional shell, write, network or subagent permissions; protected state updates require authorized Orchestrator commands.

## Failures
- Contradictory requirements: BLOCKED with the competing statements and minimal resolution question.
- Untestable acceptance text: revise to a measurable observation or mark UNVERIFIED.
- Unknown consent for irreversible action: block that action, preserve unaffected work.

## Verification
- Each criterion can be independently observed without trusting a writer's statement.
- All invariants, exclusions and permission boundaries are explicit and non-contradictory.
- Handoff has a criterion-to-evidence map and no claim of completed implementation.

## Evidence
Reference source revision and paths, exact commands and exit codes (where run), receipts and verification dates. Never include raw secrets, user prompt transcripts, invented metrics or unverified PASS claims.

## Examples
- Correct: 'Given a non-owner token, PATCH /record/7 must return 403 and leave row unchanged', with corresponding test evidence required.
- Incorrect: acceptance criterion 'make the API better' or plan to rewrite the service because the task sounds broad.

## Finalization
Return PASS only when independent verification and all acceptance criteria are evidenced; return BLOCKED for missing access, authority, test environment or proof; return FAILED for an observed failed required check. Never manufacture evidence.
