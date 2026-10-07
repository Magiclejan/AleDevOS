# Design System Guardian + UX/UI Judge Contract

## Purpose
Every UI-affecting implementation is reviewed against verified canonical design evidence before it can be accepted visually.

## Design System Guardian
The Guardian is read-only. It validates, in order:
1. Design Context integrity.
2. Component Registry integrity and source hashes.
3. Reuse-Before-Create decisions for reusable component changes.
4. No unauthorized page-local forks.
5. No canonical-component drift.
6. Token/color discipline when canonical tokens/color rules are present.
7. Presence of bounded evidence for responsive, accessibility and UI states.

A specialist Skill may provide evidence or recommendations, but cannot override a deterministic Guardian blocker.

## UX/UI Judge
The UX/UI Judge is read-only and independent from implementation. It consumes the sealed Guardian report plus the UI change evidence. The deterministic base score is 100 points:
- Design-system compliance: 30
- Component reuse: 25
- Responsive readiness: 15
- Accessibility readiness: 15
- States and interaction readiness: 15

PASS requires score >= 90, zero Guardian blockers and zero critical UNVERIFIED dimensions. Visual aesthetics that require screenshot/image inspection belong to the later Visual QA block and are not fabricated here.

## Evidence rules
- Evidence is project-local and bounded.
- Reports are SHA-256 sealed.
- Drift of Design Context, Component Registry, Guardian report or Judge report invalidates downstream evidence.
- No full transcripts, Skill bodies, prompts, completions or secrets may be stored in review artifacts.
