# UX/UI Phase 3 Validation — Design Genesis + Design System Discovery

## Scope
Phase 3 adds project-mode-specific design foundation workflows without duplicating specialist Skill bodies:
- GREENFIELD → `DESIGN_GENESIS`
- BROWNFIELD → `DESIGN_SYSTEM_DISCOVERY`
- HYBRID → `DESIGN_AUDIT_AND_CONSOLIDATE`

## Implemented guarantees
- Design workflow plans are integrity-sealed and tied to the current Design Context + project-mode decision.
- GREENFIELD routes only the minimum specialist capabilities needed for each design stage.
- BROWNFIELD/HYBRID perform bounded deterministic repository discovery before model/Skill interpretation.
- Discovery records CSS variables, colors, spacing-like values, radii, shadows, typography evidence, responsive breakpoints, motion declarations, design-system markers and component candidates.
- Observed hardcoded values never become approved tokens automatically.
- Missing Skills use Skill System Safe Acquisition (`trusted/allowlisted → auto`, unknown/untrusted → approval).
- Specialist Skill instruction bodies remain on-demand and are absent from Phase 3 planning artifacts.
- Skill output and deterministic discovery are proposals/evidence, never automatic canonical Design Context.
- Canonicalization requires project-local artifacts, SHA-256 verification and explicit approval.
- Phase 3 cannot write the Component Registry directly; Phase 2 remains the exclusive component canonicalization path.
- Discovery/workflow artifacts detect source/context drift and fail closed.

## Deterministic validation
- UX/UI Phase 3 tests: **19/19 PASS**
- Full accumulated suite: **278/278 PASS**
- JSON parse: **71/71 PASS**
- MJS syntax: **25/25 PASS**
- Failures: **0**

## Adversarial checks
PASS:
- workflow-plan tampering/context drift detected;
- brownfield source drift detected;
- greenfield deterministic discovery rejected as not applicable;
- canonicalization without approval blocked;
- artifact SHA mismatch blocked;
- external evidence paths blocked;
- Component Registry bypass blocked;
- Skill instruction leakage absent from planning artifacts.

## Phase status
**UX/UI Phase 3 = COMPLETE / FROZEN**

Next: **UX/UI Phase 4 — Design System Guardian + UX/UI Judge**.
