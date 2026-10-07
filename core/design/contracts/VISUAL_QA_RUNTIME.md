# Visual QA Phase 4 — Rendered Runtime Contract

Phase 4 consumes a verified Phase 2 browser receipt and the project-canonical responsive/accessibility policies, then performs deterministic rendered DOM/runtime measurements through an adapter-owned browser provider.

## Guarantees
- Every audited case must correspond exactly to a verified Phase 2 case: route, state, viewport and readiness binding are reused, not reinvented.
- The canonical Responsive Policy and Accessibility Policy must be valid and ACTIVE.
- Runtime thresholds are selected only from the named accessibility standard supported by AleDevOS policy. Per-run numeric overrides are forbidden.
- Runtime evidence is sealed per case and the final report is sealed separately.
- Verification rechecks the Phase 2 receipt, optional Phase 3 report, canonical policy hashes, case contracts, evidence hashes and deterministic classification.
- Redirect origin/path drift, provider failure, incomplete critical scans, unsupported accessibility standards and unmeasurable required contrast fail closed as BLOCKED.

## Deterministic checks in Phase 4
- document horizontal overflow;
- focusable viewport escape and clipping;
- keyboard reachability;
- focus indicator presence and focus obscuration;
- accessible names for interactive controls;
- missing `alt` on rendered non-decorative images;
- WCAG 2.2 AA target-size minimum with deterministic inline/spacing/user-agent exceptions;
- rendered text contrast where the browser can deterministically resolve foreground/background colors.

## Non-claims
A `VISUAL_RUNTIME_AUDIT_PASS` proves only the supported rendered layout/accessibility checks for the captured cases under the pinned runtime profile. It does **not** prove full WCAG conformance, aesthetic quality, visual hierarchy, spacing taste, brand fidelity, motion smoothness, or final Visual QA acceptance. Static semantic/aesthetic decisions remain for Visual QA Phase 5. Dynamic motion smoothness/frame quality requires temporal evidence and is not certified by the static screenshot pipeline.
