# Visual QA Phase 3 — Validation

Status: **COMPLETE / FROZEN for the Phase 3 contract**.

## Scope
Phase 3 adds approval-gated visual baselines and deterministic pixel regression on top of verified Phase 2 browser evidence.

Implemented guarantees:
- a baseline can be created only from a valid Phase 2 receipt;
- baseline promotion requires an explicit approval reference and never occurs automatically after a failed comparison;
- baseline IDs are immutable; a revision uses a new ID and may explicitly supersede a prior baseline;
- superseding cannot silently reduce the visual case set;
- baselines are self-contained under `.aledevos/visualqa/baselines/<baseline-id>/` and survive removal of the originating transient Phase 2 receipt;
- baseline manifest and every baseline PNG are SHA-256 verified;
- only named policy tolerance profiles are allowed and the selected profile is pinned into the approved baseline;
- arbitrary per-run numeric tolerance overrides are rejected;
- current screenshots are accepted only through a valid Phase 2 receipt;
- case-set, route, state and viewport contract drift is BLOCKED rather than misclassified as a pixel regression;
- PNG decoding validates PNG signature, chunk CRCs, supported 8-bit non-interlaced color formats, filters and dimensions; unsupported image formats fail closed;
- image comparison reports dimension mismatch, changed-pixel count, diff ratio, maximum channel delta, mean absolute channel delta and changed bounds;
- changed cases can emit deterministic hashed diff PNG artifacts;
- PASS / FAIL / BLOCKED reports are SHA-256 sealed and re-verified against current Phase 2 evidence, baseline bytes, policy tolerance and diff artifacts;
- a Phase 3 PASS claims baseline regression compliance only. It does not claim aesthetic quality, rendered layout correctness, rendered accessibility/contrast or motion quality.

## Tolerance governance
The current policy contains two named profiles:
- `strict`: exact pixel match;
- `browser_stable`: bounded low-level channel noise with a small changed-pixel ceiling.

The profile is chosen at baseline approval time. A comparison cannot override individual threshold values.

## Agent/runtime integration
- Added `visual-regression-runner` as a narrow execution role.
- Product edits, arbitrary shell, external-directory access and network tools remain denied for that role.
- Baseline approval, baseline verification, comparison and report verification are the only Phase 3 regression commands exposed to the runner.
- Verifier, Design System Guardian, UX/UI Judge, Quality Judge and Regression Judge receive verification-only access; they cannot approve baselines.
- Core contracts preserve all prior ContextOS, Skill System, UX/UI and Visual QA Phase 1/2 disciplines.

## Validation results
Validated in clean deterministic invocations after the final Phase 3 implementation:
- Existing suite excluding Visual QA Phase 2/3: **396 / 396 PASS**.
- Visual QA Phase 2 regression-preservation suite: **34 / 34 PASS**.
- Visual QA Phase 3 suite: **38 / 38 PASS**.
- Cumulative deterministic total: **468 / 468 PASS**.
- Node syntax: **41 / 41 `.mjs` PASS**.
- JSON parse: **104 / 104 `.json` PASS**.
- Failures: **0**.

A single all-files `node --test tests/*.test.mjs` invocation exceeded the packaging environment command-time limit, so the cumulative result above is the exact sum of three clean non-overlapping test invocations, not an inferred partial run.

## Explicitly deferred
- rendered overflow/geometry checks;
- runtime contrast/accessibility checks;
- focus visibility and clipping from rendered DOM geometry;
- motion smoothness;
- semantic/aesthetic Visual Judge scoring;
- automatic visual repair loop.

Those belong to Visual QA Phase 4 and Phase 5.
