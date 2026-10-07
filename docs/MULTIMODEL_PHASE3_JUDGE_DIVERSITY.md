# Multi-Model Phase 3 — Judge Diversity

## Scope

P3 qualifies the existing P1 `primary` + `secondary` Judge pair using declared model provenance. It does not claim semantic/epistemic independence, replace models, activate fallback, override P2 routing, or decide AleDevOS final state.

## Diversity tiers

1. `DISTINCT_MODEL_SAME_PROVIDER`
2. `CROSS_PROVIDER_SAME_FAMILY`
3. `CROSS_FAMILY`

All current Judge roles require `CROSS_FAMILY` by default. Lower tiers are observable evidence, but the pair is `JUDGE_DIVERSITY_BLOCKED`.

The classification uses the P1 binding fields:
- `model_id`
- `provider_id`
- `provider_family`

The package certifies only **declared provenance diversity**. It explicitly does not claim that two providers/models are cognitively or training-data independent.

## Commands

```powershell
node multimodel\extensions\diversity\judge-diversity.mjs policy verify
node multimodel\extensions\diversity\judge-diversity.mjs pair assess --binding <binding.json> --judge-role quality --out <diversity.json>
node multimodel\extensions\diversity\judge-diversity.mjs pair assess --binding <binding.json> --judge-role quality --comparison <p1-comparison.json> --out <diversity.json>
node multimodel\extensions\diversity\judge-diversity.mjs pair verify --decision <diversity.json> --binding <binding.json> --comparison <p1-comparison.json>
```

## Fail-closed behavior

- Same exact model identity: blocked.
- Two models at the same provider: blocked.
- Two providers inside the same provider family: blocked.
- Cross-family pair: allowed by the default P3 policy.
- Missing/unbound provenance: invalid.
- Tampered/rehashed tier, signals, binding or comparison provenance: invalid.

## Boundaries

P3 keeps:

```text
router_override = false
fallback_used = false
replacement_model = null
final_judge_decision = null
```

Automatic model replacement/fallback remains Multi-Model P4. Final Judge state remains owned by `ALEDEVOS_DETERMINISTIC_GATE`.
