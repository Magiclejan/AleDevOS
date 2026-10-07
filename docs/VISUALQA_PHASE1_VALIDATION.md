# Visual QA Phase 1 — Validation

Status: **COMPLETE / FROZEN for the Phase 1 contract**.

## Scope
Phase 1 establishes deterministic capture planning and screenshot-evidence integrity. It intentionally does **not** launch a browser, compare screenshots or judge aesthetics.

Implemented guarantees:
- capture plans require an ACTIVE canonical responsive policy;
- only approved viewport IDs can enter the matrix;
- surfaces, routes and states are explicit and duplicate/collision checked;
- supplied UI State Contracts constrain allowed capture states;
- loopback dev-server hosts only by default;
- changed source files are SHA-256 snapshotted;
- deterministic screenshot paths live under the Visual QA artifact root;
- sealed runs require one real PNG per planned case;
- plan, source, responsive-policy and PNG drift/tampering are detected;
- JSON evidence stores references/hashes only, never screenshot bytes;
- Phase 1 evidence explicitly carries `visual_quality_verified=false` and `visual_regression_verified=false`.

## Validation results
- Phase 1 tests: **30 / 30 PASS**.
- Cumulative AleDevOS suite: **396 / 396 PASS**.
- Node syntax: **33 / 33 `.mjs` PASS**.
- JSON parse: **99 / 99 `.json` PASS**.
- Failures: **0**.

## Deferred by contract
- browser/device capture execution;
- deterministic readiness/wait conditions;
- font/network stabilization;
- baseline promotion;
- image diff and layout regression;
- rendered accessibility/contrast;
- animation smoothness;
- Visual Judge and visual repair loop.

Those belong to later Visual QA phases.
