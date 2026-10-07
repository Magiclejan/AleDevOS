# ContextOS Phase 2 — Validation

Scope: **Checkpoint + Preventive Compaction Planning + Resume** only.

## Acceptance criteria
- Checkpoint contains exact AleDevOS run state.
- Checkpoint is integrity-sealed and tamper detection fails closed.
- Resume packet is derived from a verified checkpoint.
- Resume preserves critical state exactly and detects drift.
- No transcript history is embedded.
- COMPACT/HARD transitions cannot proceed without verified checkpoint + resume.
- HARD_GUARD selects fresh-session resume.
- Installer deploys schemas/templates and runtime state directories.
- Core and OpenCode agent contracts include Phase 2 discipline.
- Phase 1 behavior remains green.

## Deliberate non-goals
- Live automatic token telemetry ingestion.
- Diff-first/de-duplication enforcement.
- Repository/domain knowledge maps.
- Research cache/freshness.
- Visual/UX systems.

Those remain separate phases so Phase 2 can be frozen independently.

## Deterministic test evidence

`node --test tests/core-engine.test.mjs tests/contextos-phase1.test.mjs tests/contextos-phase2.test.mjs`

Result: **30/30 PASS**
- Core: 8/8
- ContextOS Phase 1: 10/10
- ContextOS Phase 2: 12/12

Additional checks:
- `node contextos/engine/contextos.mjs self-test` → `CONTEXTOS_PHASE2_SELF_TEST_PASS`
- all JSON files parse → PASS
- sealed checkpoint example verification → PASS
- resume example verification against checkpoint → PASS

Current OpenCode/Qwen64K thresholds remain:
- usable input: 45,536
- WATCH: 26,410
- CHECKPOINT: 30,509
- COMPACT: 32,785
- HARD_GUARD: 36,428

Those are profile outputs, not universal constants.
