# Multi-Model Phase 2 — Deterministic Model Router

Status: **COMPLETE / FROZEN** in AleDevOS Local v1.35.

P2 introduces a model-selection runtime that is independent from runtime adapters. It routes only across the models explicitly bound by Multi-Model P1 and never discovers or invents provider/model identities on its own.

## Hard eligibility filters

A candidate is eligible only when all of the following are true:

1. provider/model identity is explicitly bound and not a placeholder;
2. `runtime_ready === true`;
3. all required modalities are present (`visual` automatically requires `image` in addition to `text`);
4. `estimated_context_tokens + 8192` fits inside the declared context window;
5. the model cost class is known to policy;
6. the optional request cost ceiling is respected.

No adapter identity is accepted as a routing hint. `OpenCode`, `Codex`, `Claude Code` and `Antigravity` remain execution surfaces, not model-selection factors.

## Deterministic selection

P2 supports two explicit priorities:

- `COST_THEN_CONTEXT`: lower cost rank first, then greater remaining context headroom;
- `CONTEXT_THEN_COST`: greater context headroom first, then lower cost rank.

An exact tie uses stable slot order: `primary`, then `secondary`.

## Evidence

Each route decision records and seals:

- task / Judge role;
- normalized routing request;
- SHA-256 of the original request file;
- SHA-256 and snapshot of the target binding;
- SHA-256 of the router policy;
- every candidate and its eligibility reasons;
- selected provider/model provenance;
- context headroom and cost rank;
- explicit `router_used: true`;
- explicit `fallback_used: false`;
- explicit `diversity_policy_used: false`;
- `final_judge_decision: null`.

Verification recomputes candidate eligibility and model selection from the sealed snapshots. Rehashing a manipulated selection does not make it valid.

## Phase boundaries

P2 deliberately does **not**:

- enforce provider-family diversity — P3;
- create or execute a fallback chain — P4;
- set the final Judge outcome — the AleDevOS deterministic gate remains authoritative;
- claim target model/API/login/runtime readiness beyond the explicit P1 binding evidence.

## Canonical files

- `multimodel/router/model-router.mjs`
- `multimodel/policies/model-router-policy.json`
- `multimodel/schemas/model-route-request.schema.json`
- `multimodel/schemas/model-route-decision.schema.json`
- `multimodel/templates/model-route-request.example.json`
- `tests/multimodel-phase2.test.mjs`
- `release/certifications/multimodel-p2.json`
