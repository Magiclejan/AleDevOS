---
name: safe-edit
description: Use for authorized minimal code changes with strict scope, data preservation, non-destructive Git and verification.
compatibility: OpenCode V2 adapter
metadata:
  system: aledevos-core-v1
---

# Safe edit

Use for authorized minimal code changes with strict scope, data preservation, non-destructive Git and verification.

> Authority: Treat SKILL.md as reference-only procedural guidance. The protected Task Contract, adapter permissions, repository rules, deterministic checks, and Orchestrator's authorized handoff take precedence. One specialist at a time; no independent spawning.

## When to use
A scoped Builder or Editor has an approved change plan and must modify source with bounded risk.

## Do not use
Read-only judges, unauthorized refactors, migrations/deployments or scripts that require unapproved destructive operations.

## Inputs
- Approved change plan, current revision/branch, allowed paths and user-owned file boundaries
- Current target files and adjacent callers, protected control-plane rules and failure reproduction
- Focused build/test commands and rollback strategy

## Outputs
- Narrow, reviewable diff mapped to approved findings or behaviors
- Focused check receipts and before/after contract notes
- No unrelated filesystem, Git-history, policy or user-data mutations

## Procedure
1. Confirm clean/dirty Git context and preserve existing user changes; never overwrite unrelated work.
2. Read the exact implementation seam, adjacent callers and repository/agent instructions before editing.
3. Identify smallest coherent edit and its test; explain which existing contract it preserves.
4. Stage reasoning as an edit plan, not as unauthorized Git staging or commit; respect writer role permissions.
5. Apply one bounded source edit, avoiding unrelated reformatting and generated/vendor files.
6. Run the focused deterministic test, lint or compile check and inspect stderr and exit status.
7. Inspect diff for scope, secret leakage, test weakening, permission changes and accidental removals.
8. Handoff changed paths, actual test commands, failures and residual risks; final PASS belongs to Verifier/Judges.

## Decisions
- If working tree contains overlapping user changes, pause and request reconciliation instead of resetting.
- If a repair needs new scope, reauthorize before touching another path.
- If tests are unavailable, mark BLOCKED for verification claims and document the missing runtime.
- If a migration or external side effect is required, stop and route specialized planning.

## Permissions
Authorized writer can edit approved product files only; no force push, hard reset, clean, publish, deploy, delete user data, control-plane mutation or forged evidence.

## Failures
- Patch does not apply cleanly: BLOCKED until source is re-read and conflicts reconciled.
- Focused check fails: preserve diagnostics, report FAILED or route bounded Repairer authorization.
- Protected path detected: abort before write and report attempted boundary crossing.

## Verification
- Diff contains only authorized paths and explains each changed hunk.
- No secrets, markers, test skips, policy bypasses or generated-file divergence introduced.
- Required focused tests execute with exact exit codes and evidence or remain explicitly BLOCKED.

## Evidence
Reference source revision and paths, exact commands and exit codes (where run), receipts and verification dates. Never include raw secrets, user prompt transcripts, invented metrics or unverified PASS claims.

## Examples
- Correct: change one parser branch and add a failing-before regression test without disturbing unrelated workspace files.
- Incorrect: run `git reset --hard` to remove messy local edits before patching.

## Finalization
Return PASS only when independent verification and all acceptance criteria are evidenced; return BLOCKED for missing access, authority, test environment or proof; return FAILED for an observed failed required check. Never manufacture evidence.
