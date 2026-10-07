# AleDevOS UX/UI System

## Phase 1 — Project Mode + Design Context
- **GREENFIELD** → `DESIGN_GENESIS`
- **BROWNFIELD** → `DESIGN_SYSTEM_DISCOVERY`
- **HYBRID** → `DESIGN_AUDIT_AND_CONSOLIDATE`
- Unknown design evidence remains `UNSET`.

## Phase 2 — Component Registry + Reuse-Before-Create
Phase 2 turns the component section of Design Context into an integrity-sealed canonical registry.

Rules:
- discover candidates, never auto-canonicalize them;
- canonical registration requires evidence + explicit approval when bootstrapping existing components;
- newly created reusable components require a prior sealed `CREATE_NEW_JUSTIFIED` decision for the same canonical path;
- source file SHA-256 is stored and drift is fail-closed;
- every reusable UI creation request produces a sealed decision;
- prefer `REUSE_CANONICAL`, then `EXTEND_CANONICAL`, and only then justified creation;
- page/screen-local forks of a matching canonical component are blocked;
- global reusable components must live under a canonical component root;
- ambiguous/partial matches require review rather than guesswork.

### CLI
```bash
node uxui/engine/component-registry.mjs registry init --project-root <project>
node uxui/engine/component-registry.mjs registry discover --project-root <project>
node uxui/engine/component-registry.mjs registry register --project-root <project> --input component.json --approve-existing
node uxui/engine/component-registry.mjs registry register --project-root <project> --input component.json --decision reuse-decision.json
node uxui/engine/component-registry.mjs registry verify --project-root <project>
node uxui/engine/component-registry.mjs registry sync --project-root <project> --component-id <id> --reason "approved canonical change"
node uxui/engine/component-registry.mjs reuse decide --project-root <project> --request request.json
node uxui/engine/component-registry.mjs reuse verify --project-root <project> --decision decision.json
```

Specialist Skill instructions remain on-demand. Phase 2 governs component reuse; it does not duplicate existing design Skills.

## Phase 3 — Design Genesis + Design System Discovery
- GREENFIELD runs a staged Design Genesis plan and routes only the smallest relevant specialist Skills on demand.
- BROWNFIELD performs bounded deterministic design discovery before specialist interpretation.
- HYBRID preserves verified existing evidence and adds an explicit redesign/consolidation path.
- Missing specialist Skills use Skill System Safe Acquisition; trusted sources can auto-acquire and unknown sources require approval.
- Skill outputs and deterministic discovery are proposals/evidence, never automatic canonical truth.
- Canonicalization is explicit, hash-verified and approval-gated. Component Registry remains governed by Phase 2.

### CLI
```bash
node uxui/engine/design-bootstrap.mjs workflow plan --project-root <project> --task-id <id>
node uxui/engine/design-bootstrap.mjs discovery scan --project-root <project>
node uxui/engine/design-bootstrap.mjs evidence validate --project-root <project> --input evidence.json
node uxui/engine/design-bootstrap.mjs evidence apply --project-root <project> --input evidence.json --approve
```

## Phase 4 — Design System Guardian + UX/UI Judge
- The Design System Guardian is a read-only deterministic governance gate for UI-affecting changes.
- It verifies Design Context integrity, Component Registry integrity, reuse decisions, canonical component drift, local-fork policy and token/color discipline.
- Specialist visual Skills provide evidence/recommendations only; they cannot waive Guardian blockers.
- The UX/UI Judge consumes the sealed Guardian report plus bounded UI change evidence.
- Deterministic score: design-system compliance 30, component reuse 25, responsive 15, accessibility 15, states/interaction 15.
- PASS requires score >=90, zero blockers and zero critical UNVERIFIED dimensions.
- Screenshot aesthetics and visual-diff judgement are intentionally deferred to the Visual QA block.

### CLI
```bash
node uxui/engine/design-review.mjs guardian review --project-root <project> --evidence ui-change.json --out guardian.json
node uxui/engine/design-review.mjs guardian verify --project-root <project> --report guardian.json
node uxui/engine/design-review.mjs judge score --project-root <project> --evidence ui-change.json --guardian guardian.json --out judge.json
node uxui/engine/design-review.mjs judge verify --report judge.json --guardian guardian.json
```


## Phase 5 — Motion Director + Motion Language
- Project Motion Language starts UNSET; values are never invented.
- Activation requires explicit approval of evidence and updates Design Context integrity.
- Motion Director is read-only and routes `ux.motion` Skills on demand through Skill System/Safe Acquisition.
- Motion Contracts use semantic duration/easing tokens and mandatory reduced-motion behavior.
- Raw motion literals and decorative infinite loops fail closed unless an approved exception exists.
- Motion plans, contracts and reviews are integrity-sealed and invalidated by Design Context/Motion Language drift.
- Rendered smoothness and visual aesthetics remain deferred to Visual QA.

### CLI
```bash
node uxui/engine/motion.mjs language init --project-root <project>
node uxui/engine/motion.mjs language apply --project-root <project> --input motion-language-proposal.json --approve
node uxui/engine/motion.mjs language verify --project-root <project>
node uxui/engine/motion.mjs plan create --project-root <project> --task-id <id> --platform web
node uxui/engine/motion.mjs contract seal --project-root <project> --input motion-contract.json --out sealed.json
node uxui/engine/motion.mjs review create --project-root <project> --contract sealed.json --out review.json
```

## Phase 6 — Accessibility + Responsive + UI States + UI Decision Records
- Accessibility and responsive policies are canonical project artifacts and start `UNSET`; AleDevOS never invents standards, breakpoints, viewport sizes, or thresholds.
- Activation requires explicit approval and integrity sealing.
- UI State Contracts derive deterministic baseline states by surface kind and require reference-only evidence for every required state.
- UI Decision Records are immutable. A changed decision creates a new `UI-ADR-*` that supersedes the old record; history is preserved.
- Phase 6 reviews statically block obvious source defects such as missing image `alt`, non-semantic click targets without keyboard affordance, focus outline removal without replacement, and `min-width` values larger than the narrowest approved viewport.
- Static checks never claim rendered contrast, actual overflow/alignment, visual hierarchy, or aesthetic correctness; those belong to Visual QA.
- UI change evidence schema `1.1` must point to a sealed `UI_STANDARDS_PASS` review before Guardian/Judge acceptance.
- Specialist Skills remain on-demand evidence providers and missing Skills use Safe Acquisition.

### CLI
```bash
node uxui/engine/ui-quality.mjs standards init --project-root <project>
node uxui/engine/ui-quality.mjs accessibility approve --project-root <project> --input accessibility.json --approval-ref <ref>
node uxui/engine/ui-quality.mjs responsive approve --project-root <project> --input responsive.json --approval-ref <ref>
node uxui/engine/ui-quality.mjs states seal --project-root <project> --input state-contract.json --out sealed-state-contract.json
node uxui/engine/ui-quality.mjs adr create --project-root <project> --input ui-adr.json
node uxui/engine/ui-quality.mjs review create --project-root <project> --input phase6-review-request.json --out phase6-review.json
```
