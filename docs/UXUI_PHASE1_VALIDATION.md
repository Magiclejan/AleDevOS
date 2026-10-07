# UX/UI System Phase 1 — Validation

## Scope
Phase 1 implements **Project Mode + Design Context** only.

Included:
- deterministic GREENFIELD / BROWNFIELD detection from repository evidence;
- HYBRID only with explicit redesign/consolidation intent or human override;
- mode-specific bootstrap workflow routing;
- canonical `.aledevos/design/` source-of-truth skeleton;
- explicit UNSET state instead of invented design decisions;
- source-precedence contract;
- integrity-sealed project-mode decision and design-context manifest;
- Skill System linkage without loading Skill instruction bodies;
- missing-skill acquisition contract carried forward from Skill System 1.1;
- installer deployment/initialization.

Not included yet:
- Component Registry enforcement / Reuse-Before-Create gate;
- Design Genesis or Design System Discovery execution;
- Design System Guardian or UX/UI Judge;
- Motion Director;
- accessibility/responsive/state governance beyond context placeholders;
- Visual QA.

## Deterministic validation
- UX/UI Phase 1 tests: **21/21 PASS**
- Full cumulative suite: **229/229 PASS**
- MJS syntax: **21/21 PASS**
- JSON parse: **64/64 PASS**

## Adversarial checks
- Repository size alone cannot produce HYBRID.
- Existing UI blocks a conflicting GREENFIELD override unless explicitly forced by a human/operator.
- `node_modules` and `.aledevos` are excluded from classification evidence.
- Mode-decision tampering is detected.
- Design-context tampering is detected.
- Individual Design Context section artifact tampering is detected.
- Existing Design Context is preserved by default.
- Phase 1 cannot load external Skill instruction bodies.
- Brand/tokens/components begin UNSET/empty rather than fabricated.

## Mode contract
- `GREENFIELD` -> `DESIGN_GENESIS`
- `BROWNFIELD` -> `DESIGN_SYSTEM_DISCOVERY`
- `HYBRID` -> `DESIGN_AUDIT_AND_CONSOLIDATE`

## Skill acquisition
Phase 1 does not execute visual specialist Skills. When later phases route to one and it is missing, Skill System 1.1 acquisition applies: trusted/allowlisted sources may auto-acquire; untrusted/community sources require explicit approval; re-discovery + registry verification are mandatory before use.

## Result
`UXUI_PHASE1_PASS`
