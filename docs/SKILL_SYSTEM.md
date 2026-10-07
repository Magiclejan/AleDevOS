# Skill System

## Purpose
Provide a runtime-agnostic way to discover, describe, select, compose and govern specialist skills without stuffing every skill body into every prompt.

## Phase 1 — Registry & Contracts ✅
- stable IDs and metadata-only descriptors;
- adapter bindings and source fingerprints;
- declared external skill catalog;
- on-demand loading policy.

## Phase 2 — Discovery + Capability Routing ✅
### Discovery
Each adapter defines project-local discovery roots. Discovery inventories real instruction files, hashes them, and creates a sealed snapshot. Existing declared skills become usable only when their real source is present and unchanged. Unknown skills require an `aledevos-skill.json` sidecar with explicit machine-readable metadata.

Discovery does **not** copy instruction bodies into the registry and does **not** infer capabilities from prose.

### Routing
A route request supplies required/preferred capabilities plus optional intents/domains. The router:
1. verifies the registry;
2. filters to usable skills only;
3. covers hard required capabilities with the minimum deterministic set it can find;
4. returns `ROUTE_BLOCKED` if any required capability remains uncovered;
5. may report unresolved candidates as suggestions, never as selected skills;
6. persists a SHA-256 sealed metadata-only route artifact.

Dependencies/conflicts are exposed but not yet composed. Instruction bodies remain unloaded and execution remains disabled.

## Phase 3 — Composition + On-demand Loading ✅
Dependencies/conflicts, ContextOS budgets, whole-skill loading and reference-only execution handoffs.

## Phase 4 — Governance + Skill Telemetry ✅
Trust/risk governance, adapter execution authorization, receipts, output validation and privacy-safe telemetry.

## Phase 5 — Safe Acquisition ✅
Missing required skills trigger acquisition. Trusted/allowlisted sources may auto-install; unknown/community sources require approval. Adapters stage downloads outside the project, then re-discover/rebuild/verify before a skill becomes usable. Core only owns the universal plan/receipt contract.

The later UX/UI block consumes this system; it does not implement a second skill loader or downloader.
