# ContextOS Phase 1 Validation — Budgets + Structured Handoffs

Status: **IMPLEMENTED / DETERMINISTIC TESTS PASS**

This phase is intentionally limited to context budgets and structured handoffs. It does not attempt checkpoint/resume, persistent maps, cache, freshness or telemetry.

## Acceptance criteria

- Runtime/model-specific context numbers live in profiles, not Core policy. PASS.
- Usable input capacity reserves output/native-compaction headroom. PASS.
- Per-agent targets exist and remain below checkpoint thresholds for the current 64K profile. PASS.
- Pressure states NORMAL/WATCH/CHECKPOINT/COMPACT/HARD_GUARD are deterministic. PASS.
- HARD_GUARD forbids new large reads at the policy layer. PASS.
- Structured handoff schema exists. PASS.
- Full transcript inclusion is invalid. PASS.
- Handoff estimated-token ceiling is 4,000. PASS.
- Missing required handoff fields fail validation. PASS.
- Installer packages ContextOS runtime, policies, schemas and contracts. PASS.
- Core and OpenCode agent definitions carry the Phase 1 handoff discipline. PASS.

## Test evidence

`node --test tests/core-engine.test.mjs tests/contextos-phase1.test.mjs`

Result: **18/18 PASS** (8 existing Core tests + 10 ContextOS Phase 1 tests).

Additional checks:
- `node contextos/engine/contextos.mjs self-test` → PASS.
- all JSON files parse → PASS.
- sample handoff validates → PASS.

## Current OpenCode/Qwen64K profile

- context window: 65,536
- reserved headroom: 20,000
- usable input: 45,536
- WATCH: 26,410
- CHECKPOINT: 30,509
- COMPACT: 32,785
- HARD_GUARD: 36,428

These numbers are adapter/profile output, not universal constants.

## Explicitly deferred

- automatic exact-token telemetry from the runtime;
- checkpoint artifact generation;
- automatic compaction/resume orchestration;
- diff-first enforcement;
- prompt de-duplication engine;
- Repo/Domain/Dependency/Symbol Maps;
- knowledge cache/freshness;
- token/context telemetry dashboards.

Those belong to later ContextOS phases and must not be smuggled into Phase 1.
