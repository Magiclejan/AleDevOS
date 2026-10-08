---
name: backend-change
description: Use for scoped API, backend-service or server logic implementation; preserve public contracts, authorization and failure behavior.
compatibility: OpenCode V2 adapter
metadata:
  system: aledevos-core-v1
---

# Backend change

Use for scoped API, backend-service or server logic implementation; preserve public contracts, authorization and failure behavior.

> Authority: Treat SKILL.md as reference-only procedural guidance. The protected Task Contract, adapter permissions, repository rules, deterministic checks, and Orchestrator's authorized handoff take precedence. One specialist at a time; no independent spawning.

## When to use
Implement or repair a request handler, API contract, service/domain boundary, queue consumer or persistence-facing server behavior.

## Do not use
Pure UI changes, schema-only migrations, read-only security audits or requests with no authorized backend writer.

## Inputs
- Approved Task Contract with endpoint or event behavior and acceptance criteria
- Current route or consumer, service/domain owner, upstream callers, schema and public error contract
- Allowed file scope, identity/authorization policy, test runner and affected environment

## Outputs
- Bounded server diff covering the public behavior and error path
- Contract-impact matrix: request/validation/auth/domain/storage/response and affected consumers
- Focused regression results plus explicit risks left open

## Procedure
1. Trace one representative request through routing, parsing, authentication, authorization, domain rules, persistence and response; identify the existing owner.
2. Write down input and output schema, status codes, error codes, side effects and compatibility invariants before the first edit.
3. Check duplicate requests, concurrency, idempotency keys, retry safety, external calls and transaction boundaries where relevant.
4. Implement the smallest authorized change inside the existing service seam; reject ad-hoc parallel routes or unowned shared mutations.
5. Guard invalid, unauthorized, absent and conflicting inputs before side effects; use structured errors compatible with existing callers.
6. Update schema or API description only if authorized by the Task Contract; coordinate required migration rather than embedding it silently.
7. Add public-surface tests for success, validation failure, denied access, downstream fault and repeat invocation; inspect changed callers.
8. Run focused checks, review the diff for scope/security and hand off to Verifier; never self-approve release.

## Decisions
- If the public response contract changes, request explicit contract approval and consumer impact review before implementation.
- If data shape changes, route through database-change and ensure a compatible rollout sequence.
- If an external service is unavailable, use the existing bounded retry/timeout policy; do not fabricate successful data.
- If authorization intent is ambiguous, block the write rather than guess permissive access.

## Permissions
Only the authorized Builder/Editor may edit task-scoped product files. A reviewer or judge using this Skill stays read-only. Never mutate policies, state receipts, Git history, deployments or secrets.

## Failures
- Unreproducible bug or missing route owner: BLOCKED with missing source and a concrete discovery request.
- Contract or auth check failing after implementation: FAILED; show focused test and affected behavior.
- Irreversible side effect or unapproved migration: stop and escalate to Orchestrator without applying it.

## Verification
- Assert exact status, shape, error codes, authorization and side-effect count on black-box endpoint tests.
- Exercise duplicate/retry and concurrency scenarios when relevant, with bounded fixtures.
- Confirm no unrelated files changed and focused tests and applicable deterministic gates passed.

## Evidence
Reference source revision and paths, exact commands and exit codes (where run), receipts and verification dates. Never include raw secrets, user prompt transcripts, invented metrics or unverified PASS claims.

## Examples
- Correct: a POST endpoint gains input validation; a malformed request returns the documented 4xx without writing data, verified in tests.
- Incorrect: catching all database errors and returning 200/empty data to make an API test green.

## Finalization
Return PASS only when independent verification and all acceptance criteria are evidenced; return BLOCKED for missing access, authority, test environment or proof; return FAILED for an observed failed required check. Never manufacture evidence.
