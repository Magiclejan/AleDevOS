# Multi-Model Phase 4 — Model Fallback

## Scope

P4 adds deterministic, bounded model replacement when an already-routed Judge model cannot be used for an explicitly allowed operational reason, or when a P3 pair is blocked by declared-provenance diversity.

Fallback is not model shopping. AleDevOS does not search providers/models automatically and does not retry because a Judge result was unfavorable.

## Allowed triggers

- `RUNTIME_UNAVAILABLE`
- `INVOCATION_ERROR`
- `RATE_LIMITED`
- `TRANSIENT_PROVIDER_ERROR`
- `MODALITY_UNAVAILABLE_AT_RUNTIME`
- `CONTEXT_REJECTED_AT_RUNTIME`
- `DIVERSITY_BLOCKED`

Explicitly non-fallbackable examples include `JUDGE_RESULT_FAIL`, `JUDGE_DISAGREEMENT`, `JUDGE_LOW_SCORE`, content-policy rejection and user rejection of a result.

## Bounded explicit plan

Fallback candidates must already exist in an explicit plan. P4 never discovers a provider/model on its own.

The package maximum is two fallback hops. Previously attempted model identities and the failed model cannot be selected again.

Candidate eligibility preserves the P2 hard constraints:
- runtime readiness;
- required modalities;
- context-window fit plus P2 reserve;
- cost ceiling.

It also preserves the P3 minimum diversity tier against the non-replaced Judge slot. Current roles therefore still require `CROSS_FAMILY` by default.

## Evidence chain

For an operational runtime failure, P4 requires a valid P2 route proving that the failed model was actually selected for that request/binding.

For `DIVERSITY_BLOCKED`, P4 requires a sealed P3 blocked decision.

The fallback decision seals the request, binding, trigger, plan, optional P2/P3 evidence, every candidate evaluation and the deterministic replacement selected.

## Replacement

`replacement apply` produces a derived binding with fallback provenance. A selected replacement explicitly invalidates prior P2/P3 evidence:

```text
replacement
   ↓
fresh P2 route required
   ↓
fresh P3 diversity required
```

Old evidence is not promoted across a model replacement.

## Boundaries

P4 never sets the final Judge result. `final_judge_decision` remains `null`; final authority remains `ALEDEVOS_DETERMINISTIC_GATE`.

P4 does not claim target provider/login/API availability. Target execution remains Master Validation work.

## Commands

```powershell
node multimodel\extensions\fallback\model-fallback.mjs policy verify
node multimodel\extensions\fallback\model-fallback.mjs plan verify --plan <fallback-plan.json>
node multimodel\extensions\fallback\model-fallback.mjs trigger verify --trigger <trigger.json>
node multimodel\extensions\fallback\model-fallback.mjs fallback resolve --binding <binding.json> --request <request.json> --plan <fallback-plan.json> --trigger <trigger.json> --route <p2-route.json> --out <fallback.json>
node multimodel\extensions\fallback\model-fallback.mjs fallback verify --decision <fallback.json> --binding <binding.json> --request <request.json> --plan <fallback-plan.json> --trigger <trigger.json> --route <p2-route.json>
node multimodel\extensions\fallback\model-fallback.mjs replacement apply --binding <binding.json> --decision <fallback.json> --out <replacement-binding.json>
```
