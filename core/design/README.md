# AleDevOS Design Governance

## Active
### UX/UI Phase 1 — Project Mode + Design Context
- Detect GREENFIELD / BROWNFIELD from repository evidence.
- HYBRID requires explicit redesign/consolidation intent or a human override.
- Canonical visual source of truth: `.aledevos/design/`.
- Missing design evidence remains `UNSET`; AleDevOS never invents a brand/design system to fill gaps.
- Source precedence is explicit and integrity-sealed.
- Visual Skills are routed/acquired through Skill System and loaded only on demand in later phases.

## Foundation retained for later phases
- Reuse Before Create.
- Canonical reusable component is the source of truth.
- Page-local forks require explicit justification.
- Changes to reusable components happen at the canonical source.
- Design tokens beat hard-coded values.
- Responsive, accessibility, loading/error/empty states are quality requirements.

Later active roles: Design System Guardian, UX/UI Judge, Motion Director.

## Active
### UX/UI Phase 2 — Component Registry + Reuse-Before-Create
- Canonical reusable components live in an integrity-sealed registry.
- Discovery produces candidates only; no auto-canonicalization.
- Reuse decision is mandatory before reusable-component creation/forking.
- Reuse → Extend canonical → Justified create is the enforced order.
- Page-local forks and duplicate reusable primitives are blocked by default.
- Registered canonical source drift is fail-closed until explicitly synchronized.

## UX/UI Phase 3
Project mode now activates Design Genesis, Design System Discovery, or Design Audit & Consolidate. Specialist design Skills are routed and acquired through Skill System, but their output is not canonical until explicitly approved and hash-verified. Brownfield evidence is collected deterministically before interpretation, and component ownership continues to be governed exclusively by Phase 2.

## UX/UI Phase 4 — Design System Guardian + UX/UI Judge
- Dedicated read-only Guardian validates canonical design evidence before visual acceptance.
- Deterministic blockers include Design Context/Registry integrity failures, canonical component drift, invalid/missing reuse decisions, page-local reusable forks and token/color bypass when canonical color evidence exists.
- Dedicated read-only UX/UI Judge scores design-system compliance, component reuse, responsive readiness, accessibility readiness and UI states/interactions.
- UX/UI PASS requires score >=90, zero blockers and zero critical UNVERIFIED evidence.
- Specialist Skills can contribute evidence but cannot waive deterministic blockers.
- Screenshot aesthetics and pixel/visual-diff quality remain explicitly deferred to Visual QA.

## UX/UI Phase 5 — Motion Director + Motion Language
- Motion Language is canonical, approval-gated and starts UNSET.
- Motion contracts use semantic tokens and require reduced-motion behavior.
- Rendered smoothness remains Visual QA.

## UX/UI Phase 6 — Accessibility + Responsive + UI States + UI Decision Records
- Accessibility and responsive project values start UNSET and must never be invented.
- UI state coverage is task/surface-specific and evidence-backed.
- UI ADRs are immutable and superseded rather than rewritten.
- Schema 1.1 visual evidence requires a sealed Phase 6 review before Guardian/Judge acceptance.
- Static policy checks do not claim rendered visual correctness; screenshots, geometry, contrast verification and visual regression remain Visual QA.
