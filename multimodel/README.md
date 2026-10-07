# AleDevOS Multi-Model

Multi-Model is intentionally independent from runtime adapters. Runtime adapters answer **how AleDevOS executes**. The model registry answers **which model produced a Judge observation**.

## Phase 1 — Second Judge Model

P1 introduces two explicit Judge slots (`primary`, `secondary`), target bindings, sealed model provenance, immutable input/rubric hashes, and deterministic pair comparison. It does not route models, require provider diversity, or implement fallback; those are later phases.

A missing/unready secondary model never becomes agreement. It remains `INCOMPLETE` / `SECONDARY_JUDGE_MODEL_UNBOUND` or `SECONDARY_JUDGE_MODEL_NOT_READY`.


## Phase 2 — Model Router

P2 lives in `router/model-router.mjs` so the P1 runtime and certificate remain frozen. It routes only over explicit P1 target bindings, applies hard readiness/modality/context/cost filters, and emits a sealed deterministic route decision. Adapter identity is not a routing input. Provider diversity remains P3; automatic fallback remains P4.

## Phase 3 — Judge Diversity

P3 lives in `extensions/diversity/judge-diversity.mjs`. It classifies the P1 Judge pair as `DISTINCT_MODEL_SAME_PROVIDER`, `CROSS_PROVIDER_SAME_FAMILY`, or `CROSS_FAMILY`. All current Judge roles require `CROSS_FAMILY` by default. Lower tiers are evidence but are blocked for dual-Judge execution.

P3 certifies declared provenance only; it does not claim semantic/epistemic independence. It can qualify a sealed P1 `AGREE` / `DISAGREE` / `INCOMPLETE` comparison without deciding the final Judge state. Automatic replacement/fallback remains P4.


## Phase 4 — Model Fallback

P4 adds an adapter-independent explicit fallback extension at `extensions/fallback/model-fallback.mjs`. Fallback is limited to predeclared candidates and a maximum of two hops. It preserves P2 hard constraints and P3 `CROSS_FAMILY` defaults, forbids repeat/failed model reuse and automatic provider/model discovery, and cannot be triggered by an unfavorable Judge outcome. Replacement bindings require fresh P2 and P3 evidence.
