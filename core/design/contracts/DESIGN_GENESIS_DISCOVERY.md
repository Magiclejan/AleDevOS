# Design Genesis + Design System Discovery Contract

UX/UI Phase 3 turns Project Mode into a controlled design-foundation workflow without duplicating specialist Skill bodies.

## GREENFIELD — DESIGN_GENESIS
1. Start from the canonical Design Context; `UNSET` stays truthful until evidence exists.
2. Route the smallest relevant set of verified Skills (`design`, `brand`, `design-system`, `frontend-design`, `ui-ux-pro-max`, `ui-styling` are preferred candidates, not assumed installed).
3. Missing Skills go through Skill System Safe Acquisition. Trusted/allowlisted sources may auto-acquire; unknown sources require approval.
4. Skill output is a proposal. It never becomes canonical Design Context automatically.
5. Canonicalization requires explicit approval and artifact hashes.
6. Genesis covers product personality, brand direction, UX principles, tokens/foundations, responsive/layout foundations, interaction/accessibility foundations, and reference-screen specifications.

## BROWNFIELD — DESIGN_SYSTEM_DISCOVERY
1. Deterministic repository discovery happens before model interpretation.
2. Record existing components, design-system markers, CSS variables, repeated/hardcoded colors, spacing values, radii, shadows, typography evidence, responsive breakpoints and motion declarations.
3. Discovery evidence is observational. A hardcoded value is not automatically a token.
4. Existing components are not automatically canonicalized; Phase 2 Component Registry rules still apply.
5. Specialist Skills interpret verified evidence and propose consolidation; they do not overwrite the existing system silently.

## HYBRID — DESIGN_AUDIT_AND_CONSOLIDATE
Preserve verified existing design evidence first, then propose a new visual direction and an explicit consolidation/migration plan. No destructive visual reset is inferred from repository size.

## Canonicalization gate
Allowed sources are human-approved context, existing canonical design-system evidence, verified runtime discovery, or verified Skill output. Every artifact must be project-local, hash-verified, explicitly approved, and mapped to an allowed Design Context section. Component Registry is excluded from direct Phase 3 canonicalization and remains governed by Phase 2.
