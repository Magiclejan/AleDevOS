---
name: database-change
description: Use when changing schema, migrations, persistence queries or database constraints; plan compatibility and data integrity.
compatibility: OpenCode V2 adapter
metadata:
  system: aledevos-core-v1
---

# Database change

Use when changing schema, migrations, persistence queries or database constraints; plan compatibility and data integrity.

> Authority: Treat SKILL.md as reference-only procedural guidance. The protected Task Contract, adapter permissions, repository rules, deterministic checks, and Orchestrator's authorized handoff take precedence. One specialist at a time; no independent spawning.

## When to use
A scoped task changes tables, indexes, RLS policies, migration ordering, persisted representations or query behavior.

## Do not use
No persistence surface changed, ad-hoc production data cleanup or destructive operations without explicit ownership and authorization.

## Inputs
- Database dialect/driver, migration tool, current schema and deployed version assumptions
- Migration scope and rollback/forward-recovery policy from approved Task Contract
- Affected writers/readers, backfill or retention constraints, test database fixture

## Outputs
- Migration plan with expand/migrate/contract stages and affected consumers
- Scoped migration/query edit, compatibility notes and independent test evidence
- Explicit rollback limitations and owner approval needed for irreversible steps

## Procedure
1. Locate schema source of truth, migration numbering convention and current database constraints before drafting SQL.
2. Enumerate callers, job consumers, validation layers, generated types and RLS/authorization rules touching the fields.
3. Classify the change as additive, backfill, constraint tightening, index operation or destructive contraction.
4. Prefer an additive compatible stage; for breaking changes document dual-read/write or staggered deploy ordering.
5. Define null/default behavior, uniqueness, foreign keys, isolation and transaction semantics, including failure halfway through.
6. For a backfill, specify batching, idempotent restart checkpoints and how to detect partial progress without exposing data.
7. Implement only authorized migration and query changes; do not edit production data or launch irreversible SQL from a test flow.
8. Test forward migration against a disposable database and verify old and new caller behavior, restart behavior and data integrity.

## Decisions
- If any irreversible drop/rename/data deletion is needed, BLOCKED until explicit approval and verified restoration procedure.
- If old clients remain deployed, stage compatibility before enforcing strict constraints.
- If production locking impact is not measurable, label it UNVERIFIED and require an operational review.
- If RLS or identity authorization changes, route security-check and obtain separate gate evidence.

## Permissions
Use disposable test databases only unless the Orchestrator explicitly authorizes another target. Never auto-drop live tables, bypass RLS, or disclose stored records.

## Failures
- Missing schema snapshot or migration ownership: BLOCKED and identify the source of truth needed.
- Migration fails mid-run: stop, record applied steps and test reversible continuation; never blindly retry destructive operations.
- Post-migration reader or invariant failure: FAILED with a reproducible fixture and rollback/forward-fix options.

## Verification
- Schema shape, null/defaults, constraints and index behavior match the approved target.
- Existing readers/writers remain compatible for the documented deployment window.
- Migration runs on disposable fixtures, catches duplicate/restart behavior and preserves row-level authorization.

## Evidence
Reference source revision and paths, exact commands and exit codes (where run), receipts and verification dates. Never include raw secrets, user prompt transcripts, invented metrics or unverified PASS claims.

## Examples
- Correct: introduce a nullable column, backfill in idempotent batches, switch readers, then separately propose tightening its constraint.
- Incorrect: delete an obsolete production column in the same rollout as the first consumer update.

## Finalization
Return PASS only when independent verification and all acceptance criteria are evidenced; return BLOCKED for missing access, authority, test environment or proof; return FAILED for an observed failed required check. Never manufacture evidence.
