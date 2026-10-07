# UX/UI Phase 6 Validation — Accessibility + Responsive + UI States + UI Decision Records

Status: **COMPLETE / FROZEN for Phase 6 scope**

## Scope
Phase 6 closes the non-rendered UX/UI governance layer. It does **not** implement screenshot capture, pixel/layout comparison, rendered contrast measurement, browser/device geometry checks, animation smoothness analysis, or the Visual Judge. Those belong to the next Visual QA block.

## Implemented
- Project-canonical Accessibility Policy (`UNSET` → explicit approved `ACTIVE`).
- Project-canonical Responsive Policy (`UNSET` → explicit approved `ACTIVE`) with explicit viewport profiles; no invented breakpoints.
- UI State Catalog plus task/surface-specific sealed UI State Contracts.
- Deterministic baseline state sets for DATA/ACTION/STATIC surfaces.
- Immutable, integrity-sealed UI Decision Records and an integrity-sealed ADR index.
- Supersede-not-rewrite decision history.
- Active ADR requirement for deterministic exceptions.
- Sealed Phase 6 UI Standards Review with policy/source hashes and drift detection.
- Static blockers for obvious source-level accessibility/responsive defects.
- UI change evidence schema 1.1 integration with Design System Guardian and UX/UI Judge.
- Missing specialist Skills remain governed by Skill System Safe Acquisition; Skill outputs remain evidence only.
- OpenCode Guardian/Judge remain read-only and receive only narrow Phase 6 verification commands.
- Installer deploys `ui-quality.mjs`, initializes truthful UNSET structures, and creates Phase 6 transient state directories.

## Deterministic tests
Phase 6 adds **32/32 PASS** tests covering initialization, approval gates, policy integrity, state contracts, ADR immutability/supersession, static blockers, approved exceptions, evidence tampering, source drift, Guardian/Judge integration, schemas, agent discipline and installer wiring.

Cumulative deterministic suite: **366/366 PASS**.

Static validation: **31/31 MJS syntax PASS** and **93/93 JSON parse PASS**.

## Fail-closed / adversarial coverage
- missing accessibility requirement → BLOCKED
- missing/duplicate responsive viewport → BLOCKED
- missing state evidence → BLOCKED
- inline evidence body/transcript-like fields → BLOCKED
- ADR duplicate/rewrite/tamper → BLOCKED
- missing `alt` → BLOCKED
- non-semantic click target without keyboard affordance → BLOCKED
- focus indicator removed without replacement → BLOCKED
- min-width exceeds approved narrow viewport → BLOCKED unless active ADR exception
- Phase 6 review tamper/task mismatch/source drift → BLOCKED
- schema 1.1 visual task without Phase 6 review → Guardian BLOCKED

## Boundary
A Phase 6 PASS means the task has coherent canonical policies/contracts/evidence and no known deterministic source-level blockers. It does **not** prove the rendered UI is visually correct, attractive, aligned, responsive in a real browser/device, or free of visual regressions. Those claims require Visual QA.
