# Accessibility + Responsive + UI States + UI Decisions Contract

This contract closes UX/UI System Phase 6 without pretending that static source inspection proves rendered visual quality.

## Accessibility
1. Project accessibility policy starts `UNSET`; project standards and thresholds must never be invented.
2. Activation requires explicit approval and canonical evidence.
3. Required coverage: semantics, keyboard, focus, labels, contrast, reduced motion.
4. Static source checks may block obvious defects (missing image alt, non-semantic click target without keyboard affordance, removed focus indicator without replacement).
5. Full accessibility compliance is never claimed from static analysis alone; rendered/runtime evidence remains required where applicable.

## Responsive
1. Responsive policy starts `UNSET`; project breakpoints and viewport sizes must never be invented.
2. Activation requires at least two explicitly approved viewport profiles and a strategy.
3. Every required viewport must have bounded evidence for a visual task.
4. Obvious source-level constraints that exceed the narrowest approved viewport are blockers unless an active UI ADR explicitly approves the exception.
5. Rendered overflow/alignment quality belongs to Visual QA.

## UI states
1. State coverage is task/surface-specific, not guessed globally.
2. DATA_SURFACE baseline: LOADING, EMPTY, ERROR, CONTENT.
3. ACTION_SURFACE baseline: DEFAULT, DISABLED, ERROR, SUCCESS.
4. STATIC_SURFACE baseline: DEFAULT.
5. A sealed state contract must reference evidence for every required state.

## UI Decision Records
1. Canonical IDs use `UI-ADR-####` (4+ digits).
2. Accepted records are immutable.
3. When a decision changes, supersede rather than rewrite: create a new record that references the old one and preserve history.
4. Exceptions to deterministic UX/UI rules require an active ADR reference.
5. ADR records and the index are SHA-256 sealed.

## Phase 6 review
A visual task using evidence schema `1.1` requires a sealed Phase 6 review. The Design System Guardian must verify that review rather than trusting self-declared `VERIFIED` strings. The UX/UI Judge uses the verified Guardian dimensions.

Specialist Skills remain evidence providers only. Missing routed Skills use Safe Acquisition. Skills cannot waive deterministic blockers.

Rendered aesthetics, layout geometry, screenshots, pixel diffs and visual smoothness remain the responsibility of the later Visual QA block.
