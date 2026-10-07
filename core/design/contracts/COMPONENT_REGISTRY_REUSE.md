# Component Registry + Reuse-Before-Create Contract

## Universal rule
Before creating or locally forking a reusable UI component, AleDevOS must consult the verified canonical Component Registry and produce a sealed reuse decision.

## Allowed decisions
- `REUSE_CANONICAL` — use the existing canonical source unchanged.
- `EXTEND_CANONICAL` — add missing variants/capabilities at the canonical source; never fork it page-locally.
- `CREATE_NEW_JUSTIFIED` — allowed only when no suitable canonical component exists and the request includes an explicit justification.
- `REVIEW_REQUIRED_*` — ambiguity or partial match must be resolved before implementation.
- `BLOCK_LOCAL_FORK` / `CREATE_BLOCKED_*` — implementation must stop.

## Registry truth
Discovery finds candidates; it **never auto-registers** them. Existing components become canonical only through explicit registration from an approved source. Every registered component stores a SHA-256 of its canonical source. Drift invalidates the registry until the canonical change is explicitly synchronized.

New reusable components may be registered only after a valid `CREATE_NEW_JUSTIFIED` decision for the same canonical path. Existing canonical-system/runtime-discovered components require explicit bootstrap approval.

## Source-of-truth rule
A reusable global component is modified at its `canonical_path`, under a canonical component root. Page/screen-local copies are denied by default. Domain-owned components may be domain-scoped, but ownership must be explicit.

## No invention
The registry stores evidence, not stylistic guesses. Capabilities, variants, aliases, ownership and category must come from human approval, an existing canonical design system, verified runtime discovery, or verified Skill output.

## Design Context integration
`.aledevos/design/component-registry.json` is part of the sealed Design Context. Registry mutations must update the Design Context artifact hash and integrity seal.
