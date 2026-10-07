---
name: repo-map
description: Use for bounded source investigation to locate implementation owners, entry points, dependencies and test seams.
compatibility: AleDevOS Core
metadata:
  system: aledevos-core-v1
---

# Repository map

Use for bounded source investigation to locate implementation owners, entry points, dependencies and test seams.

> Authority: Treat SKILL.md as reference-only procedural guidance. The protected Task Contract, adapter permissions, repository rules, deterministic checks, and Orchestrator's authorized handoff take precedence. One specialist at a time; no independent spawning.

## When to use
Orchestrator needs to know where a requested behavior lives before planning, reviewing or editing.

## Do not use
Unbounded repo summarization, speculative source rewrites or private files outside the approved project scope.

## Inputs
- User behavior/request, Task Contract or discovery scope and repository root
- Root/closest AGENTS.md instructions, allowed read paths and stale-knowledge policy
- Known entry point or keyword, test commands and tooling available under permission

## Outputs
- Compact request → entry → module owner → dependencies → tests map with real paths
- Open questions and discovered restrictions, generated/vendor file warnings
- Explicit freshness/source provenance and confidence labels, no invented modules

## Procedure
1. Read root and closest scoped repository rules; do not scan secrets or unrelated projects.
2. Locate likely entry using exact symbols, routes, event names and tests before broad keyword search.
3. Trace call chain to the actual source-of-truth implementation, including config, schema, persistence and external boundaries.
4. Inspect closest tests and any recorded regressions, keeping changed-file context and revision fresh.
5. Flag generated, vendored or copied code and identify their canonical source to avoid editing derived artifacts.
6. Build an annotated shortest dependency map showing ownership, interfaces and typical failure path.
7. Identify which modules and acceptance evidence require further targeted reading; stop exploring when sufficient.
8. Report paths and relevant symbols rather than dumping source or making ownership claims from filenames alone.

## Decisions
- If multiple implementations share a name, confirm callers and runtime routing rather than selecting the first search hit.
- If no owner found, return BLOCKED with search evidence and proposed bounded expansion.
- If a cached map has source drift, refresh it and mark old references stale.
- If crossing an unapproved repository boundary, stop and ask Orchestrator to extend scope.

## Permissions
Read-only within the approved repository. No network fetch, secret access, writes or subagent spawning without explicit adapter authorization.

## Failures
- Repository context unavailable: BLOCKED with exact missing root/permissions.
- Ambiguous dynamic dispatch: mark suspected edges as UNVERIFIED rather than authoritative.
- Source docs contradict executable code: report both and cite evidence, favor observed execution for behavior.

## Verification
- Every reported entry/owner/test file exists in pinned revision.
- Each claimed call edge has a symbol, import, route or runtime trace reference.
- Map includes meaningful excluded areas and generated-source warnings.

## Evidence
Reference source revision and paths, exact commands and exit codes (where run), receipts and verification dates. Never include raw secrets, user prompt transcripts, invented metrics or unverified PASS claims.

## Examples
- Correct: map `/users/:id` route → controller → policy → repository method → contract tests with source citations.
- Incorrect: assert a module owns a feature solely because its filename resembles the user request.

## Finalization
Return PASS only when independent verification and all acceptance criteria are evidenced; return BLOCKED for missing access, authority, test environment or proof; return FAILED for an observed failed required check. Never manufacture evidence.
