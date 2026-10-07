# Visual QA Phase 4 — Validation

Status: **COMPLETE / FROZEN for the Phase 4 contract**.

## Scope
Phase 4 adds deterministic rendered layout and accessibility runtime checks on top of verified Phase 2 browser evidence and optional verified Phase 3 regression evidence.

Implemented guarantees:
- a valid Phase 2 receipt is mandatory and every Phase 4 case reuses its exact route, state, viewport and readiness binding;
- a linked Phase 3 report is optional, but when provided it must verify and reference the same Phase 2 receipt;
- canonical Accessibility and Responsive policies must be valid and ACTIVE;
- the accessibility standard selects one named AleDevOS runtime profile; arbitrary per-run threshold overrides are rejected;
- the initial supported runtime profile is `WCAG_2_2_AA` with 4.5:1 normal-text contrast, 3:1 large-text contrast and 24 CSS px target-size minimum;
- browser evidence measures real horizontal document overflow, focusable viewport escape/clipping, keyboard reachability, focus visibility/obscuration, accessible names, rendered image alt presence, target geometry and rendered text contrast;
- critical DOM/focus scan truncation blocks instead of producing a partial PASS;
- rendered contrast that cannot be deterministically resolved because of gradients/images/compositing blocks the contrast claim instead of guessing;
- provider failure and origin/path redirect drift fail closed;
- per-case runtime evidence is SHA-256 sealed and the final PASS/FAIL/BLOCKED report is separately sealed;
- report verification rechecks Phase 2, optional Phase 3, canonical policy drift, case contracts, evidence bytes and deterministic classification;
- a Phase 4 PASS does not claim full WCAG conformance, aesthetic quality, visual hierarchy, brand fidelity or motion smoothness.

## Runtime / adapter boundary
The portable Phase 4 engine lives in `visualqa/engine/runtime-audit.mjs`. DOM/browser measurement remains adapter-owned. The OpenCode reference provider extends the existing Chromium/Playwright driver with a narrow `audit()` operation.

A dedicated `visual-runtime-audit-runner` may execute only receipt/report verification plus the Phase 4 doctor/run/verify commands. It cannot edit product files, baselines or canonical design policies. Verifier and the read-only visual judges receive verification-only Phase 4 access.

## Validation results
- Visual QA Phase 4 deterministic suite: **38 / 38 PASS**.
- Prior frozen deterministic suite: **468 / 468 PASS**.
- Cumulative deterministic suite: **506 / 506 PASS**.
- Node `.mjs` syntax validation: **44 / 44 PASS**.
- JSON parse validation: **106 / 106 PASS**.
- Failures: **0**.

The packaging environment does **not** have the Node Playwright package installed. The reference provider doctor therefore returns `PLAYWRIGHT_PROVIDER_MISSING` for Chromium and no real browser smoke is claimed here. As in Phase 2, adapter orchestration, evidence handling and failure behavior are exercised with the controlled provider; the real provider remains fail-closed until Playwright + Chromium are available on the target machine.

## Explicitly deferred
- aesthetic hierarchy and composition judgment;
- semantic screenshot reasoning beyond deterministic runtime measurements;
- brand/taste evaluation;
- motion smoothness/frame-quality judgment;
- bounded automatic visual repair loop.

Static semantic/aesthetic judgment belongs to Visual QA Phase 5. Dynamic motion smoothness/frame quality requires separate temporal evidence and is not claimed by the static Visual QA P1–P5 pipeline.
