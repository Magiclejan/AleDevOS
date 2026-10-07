# Visual QA Phase 3 — Approved Baselines + Pixel Regression

Phase 3 compares verified Phase 2 screenshots against immutable, explicitly approved visual baselines.

## Baseline rules
- Baseline promotion requires explicit approval; AleDevOS never promotes a changed screenshot automatically.
- A baseline is copied into the persistent `.aledevos/visualqa/baselines/<baseline-id>/` store and sealed with SHA-256 metadata.
- Baseline IDs are immutable. Revisions use a new ID and may explicitly supersede a prior baseline.
- Superseding a baseline cannot silently reduce the case set.
- The tolerance profile is pinned when the baseline is approved. Only named policy profiles are allowed; arbitrary per-run numeric tolerance overrides are forbidden.

## Comparison rules
- The current screenshot set must come from a valid Phase 2 receipt.
- The baseline manifest and every baseline PNG must verify before comparison.
- Case IDs, routes, UI states and viewports must match the approved baseline contract; contract drift is BLOCKED, not misreported as a pixel regression.
- PNGs are decoded deterministically and compared by pixels. Dimension changes always fail regression.
- Reports include diff ratio, changed pixel count, channel deltas, changed bounds and optional PNG diff artifacts.
- PASS means the rendered pixels are within the baseline's approved tolerance profile. FAIL means a verified visual difference exceeded that profile.

## Claims boundary
A Phase 3 PASS proves only baseline regression compliance for the captured cases. It does not prove aesthetic quality. Rendered layout and accessibility remain deferred to Visual QA Phase 4, and holistic visual judgment remains deferred to the Visual Judge phase.
