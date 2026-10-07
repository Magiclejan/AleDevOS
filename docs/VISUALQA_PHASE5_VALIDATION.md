# Visual QA Phase 5 — Validation

Status: **COMPLETE / FROZEN for the Phase 5 static Visual Judge + bounded repair contract**.

## Scope
Phase 5 adds the final semantic/aesthetic screenshot judgment and a protected two-attempt visual repair loop on top of verified P2/P3/P4 evidence.

Implemented guarantees:
- Phase 5 packets require one verified Phase 2 receipt, `VISUAL_REGRESSION_PASS` Phase 3 report and `VISUAL_RUNTIME_AUDIT_PASS` Phase 4 report for the same task/receipt;
- packets bind exact screenshot hashes, routes, states, viewports, upstream report hashes, evidence revision and rubric;
- the Visual Judge identity and observation mode are pinned to `visual-judge` + `NATIVE_IMAGE`;
- missing native image observation produces BLOCKED rather than guessed visual approval;
- eight mandatory rubric dimensions are scored per case and Core recomputes case/overall verdicts;
- dimension PASS >=80, case PASS >=80, final holistic PASS >=90;
- failed dimensions require concrete evidence/findings and repair hints; critical findings block;
- judgments/submissions/packets are SHA-256 bound and tamper checked;
- automatic visual repair is allowed only for FAIL, never BLOCKED or PASS;
- repair authorization is coupled to protected global `repair_count`, `scope_version`, approved scope and the existing global max of 2 repairs;
- baseline promotion, canonical policy edits and scope expansion are explicitly forbidden as repair tactics;
- evidence revisions preserve `initial`, `repair-1`, `repair-2` capture generations instead of overwriting prior screenshots;
- every repair must produce fresh P2 → P3 → P4 → P5 evidence; stale evidence is rejected;
- attempt 1 may permit exactly one retry; attempt 2 failure becomes `VISUAL_REPAIR_EXHAUSTED`; the protected Core refuses repair 3;
- final `VISUAL_QA_PASS` after repair requires the latest successful sealed repair cycle;
- Phase 5 final static acceptance does not claim full WCAG conformance or dynamic motion smoothness.

## Agent separation
- `visual-judge`: native-image semantic/aesthetic observation; no product edits, no repairs, no baseline promotion.
- `visual-repair-controller`: control-plane-only repair authorization/cycle/acceptance; no product edits and no visual judging.
- `repairer`: product-only repair inside approved scope; cannot self-judge, recapture, change baselines or change control-plane state.
- P2/P3/P4 runners remain separately scoped and must regenerate evidence after a repair.

## Deterministic validation
- frozen pre-Phase-5 stack: **506/506 PASS**;
- Phase 5 semantic + bounded-repair scenarios: **38/38 PASS**;
- Phase 5 integration/wiring scenarios: **8/8 PASS**;
- cumulative deterministic suite: **552/552 PASS**;
- JavaScript module syntax: **47/47 PASS**;
- JSON parse validation: **112/112 PASS**.

The 38 integration-heavy Phase 5 semantic scenarios are run in bounded test-name groups by `33-self-test-visualqa-phase5.ps1`; each test still builds independent sealed P1-P4 evidence. This avoids conflating an environment process timeout with a product failure.

## Packaging/runtime caveats
The package-level deterministic suite uses controlled browser/runtime providers. The packaging environment still does not have the Node Playwright package installed, so no real Chromium browser smoke is claimed here. Likewise, deterministic tests validate the Visual Judge evidence/governance contract, but they cannot prove that a target runtime/model actually supports native image perception. The `visual-judge` contract therefore fails closed to BLOCKED when native image observation is unavailable.

## Explicit non-claims
- dynamic animation/frame smoothness;
- full WCAG conformance;
- multi-model judge diversity/consensus;
- automatic baseline approval.

Those require separate evidence/capabilities and are not silently inferred by Phase 5.
