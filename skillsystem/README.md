# AleDevOS Skill System 1.1

The Skill System lets AleDevOS reuse specialist skills without turning every skill body into permanent prompt baggage.

## Phase 1 — Registry & Contracts ✅
Stable logical IDs, metadata-only descriptors, adapter bindings, hashes and on-demand policy.

## Phase 2 — Discovery + Capability Routing ✅
Runtime discovery verifies real `SKILL.md` sources before a skill becomes usable. Routing is metadata-only, deterministic and fail-closed.

## Phase 3 — Composition + On-demand Loading ✅
Dependencies are expanded, conflicts/cycles block, only selected instructions are loaded, source hashes are rechecked, ContextOS budgets are enforced, and execution handoffs remain reference-only.

## Phase 4 — Governance + Skill Telemetry ✅
Trust/risk governance, adapter execution authorization, sealed execution receipts, output-contract validation, retry limits and privacy-safe skill telemetry.

## Phase 5 — Safe Acquisition ✅
When a required skill is absent, AleDevOS can acquire it instead of silently substituting another capability.

- Core emits/validates universal acquisition plans and receipts.
- Adapters own real network/download/install mechanics.
- Trusted/allowlisted sources may auto-install.
- Unknown/community sources require explicit approval.
- Third-party downloads are staged outside the target project.
- Post-install discovery + registry build + registry verify are mandatory before use.
- Newly acquired skills still pass normal governance before execution.

## Runtime state
Transient artifacts:
- `.aledevos/state/skills/compositions/`
- `.aledevos/state/skills/loads/`
- `.aledevos/state/skills/execution-handoffs/`
- `.aledevos/state/skills/governance/`
- `.aledevos/state/skills/executions/`
- `.aledevos/state/skills/acquisition/`

Persistent verification evidence:
- `.aledevos/skills/acquisitions/`
- `.aledevos/telemetry/skills/events.jsonl`
- `.aledevos/telemetry/skills/summary.json`

**Skill System 1.1 is complete/frozen for registry, discovery, routing, composition, governance, telemetry and safe acquisition.** Runtime-specific invocation and acquisition mechanics remain adapter responsibilities.
