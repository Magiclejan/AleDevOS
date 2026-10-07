# ContextOS Phase 3 — Validation

Status: **FROZEN / PASS** for the master distribution test suite.

Scope of this phase only:

- Diff-first evidence collection.
- Git-index-safe handling of untracked files.
- Context-item content identity.
- Cross-packet de-dup ledger.
- Budgeted context packet planning.
- Full-file fallback discipline.

## Deterministic acceptance criteria

1. Capturing a diff must not mutate the Git index.
2. Tracked changes are represented by a bounded patch.
3. Untracked files are visible without `git add` through path/hash/size/bounded preview.
4. Diff artifacts are SHA-256 sealed and tampering is rejected.
5. Exact duplicate context in one packet is sent once and referenced thereafter.
6. Previously emitted unchanged content is reference-only on later packets.
7. Changed content for the same semantic item id is emitted again.
8. Review-agent full-file reads require an explicit reason and prior diff evidence.
9. Optional context may be dropped only with an explicit `OMIT_BUDGET` decision.
10. Required context that does not fit causes planning failure; it is never silently omitted.
11. Transcript context is not an allowed item type.
12. Diff-first priority is deterministic.
13. Phase 3 runtime state is kept under `.aledevos/state/contextos/{diffs,dedup,packets}`.
14. Core and OpenCode reference-agent contracts carry Phase 3 discipline.

## Results

- Core engine: 8/8 PASS.
- ContextOS Phase 1: 10/10 PASS.
- ContextOS Phase 2: 12/12 PASS.
- ContextOS Phase 3: 16/16 PASS.
- **Total deterministic suite: 46/46 PASS.**

Additional checks:

- `node --check contextos/engine/contextos.mjs`: PASS.
- All JSON policy/schema/template files parse: PASS.
- Diff capture with tracked modification: PASS.
- Untracked-file capture without staging: PASS.
- Diff tamper rejection: PASS.
- De-dup across packets: PASS.
- Changed-hash invalidation: PASS.
- Required-context fail-closed behavior: PASS.

## Non-claims / deferred

This phase does not implement live runtime token telemetry, knowledge maps, cache/freshness, or visual systems. It also does not promise to de-duplicate provider-owned system prompts. Those remain explicit later phases.
