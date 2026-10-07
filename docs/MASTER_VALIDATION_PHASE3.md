# Master Validation P3 — Multi-Model Target Binding

Status: **COMPLETE / FROZEN for the P3 harness contract**. Target checks remain PASS/BLOCKED/FAIL according to evidence collected on the actual machine.

## Purpose

P3 converts the package-level Multi-Model implementation into target-runtime evidence. It does **not** modify Multi-Model P1–P4. The frozen registry, router, diversity engine and fallback engine are executed as the source of truth.

P3 owns exactly these Master checks:

- `primary_secondary_models_real`
- `model_router_real`
- `judge_diversity_real`
- `model_fallback_real`

## Evidence model

A model is considered real/ready only after a successful non-interactive invocation that uses an explicit `--model <selector>` argument and returns the P3 nonce marker. Merely finding a CLI, reading a configured default, or writing `runtime_ready=true` is insufficient.

The target profile binds each active model to:

- adapter/runtime;
- provider ID and provider family;
- exact model ID plus exact CLI selector;
- declared modalities;
- declared context window;
- cost class.

Text capability is exercised by the active invocation. Context-window size is sealed as **target-declared metadata** and is used by the frozen router; P3 deliberately does not claim that it independently stress-benchmarked the provider's maximum context window.

## Real target chain

```text
Primary model explicit invocation
Secondary model explicit invocation
        ↓
real target binding + readiness
        ↓
frozen P2 Model Router decide + verify
        ↓
Primary Judge + Secondary Judge on same input/rubric
        ↓
frozen P1 evidence + pair comparison
        ↓
frozen P3 CROSS_FAMILY diversity
        ↓
controlled DIVERSITY_BLOCKED topology using a third real model
        ↓
frozen P4 bounded fallback
        ↓
derived replacement binding
        ↓
fresh frozen P2 route + fresh frozen P3 diversity
        ↓
Master evidence seal
```

## Fallback proof

P3 does not manufacture a provider outage and does not retry an unfavorable Judge answer. The preferred deterministic target proof uses the already-allowed `DIVERSITY_BLOCKED` trigger:

1. three actively invocable real model identities are available;
2. two distinct identities share a provider family and therefore form a valid weak pair that P3 blocks;
3. the third real identity is cross-family relative to the partner;
4. P4 selects that third identity from an explicit fallback plan;
5. the replacement binding is re-routed through P2 and re-qualified through P3.

If the target has only two usable models, or no valid same-family weak pair plus cross-family replacement, `model_fallback_real` remains **BLOCKED**. The other three P3 checks can still PASS independently.

## Inventory first

Inventory mode never makes a PASS claim:

```powershell
.\scripts\55-master-validation-p3-target-multimodel.ps1 -InventoryOnly
```

It records CLI/version information for all canonical adapters. OpenCode and Antigravity model-list commands are captured when available. No model identity, context limit, or readiness is invented from missing data.

## Full target run

Copy and fill:

```text
release/templates/MASTER_MULTIMODEL_TARGET_PROFILE.example.json
```

Then run:

```powershell
.\scripts\55-master-validation-p3-target-multimodel.ps1 -Profile .\my-p3-target-profile.json
```

The script collects the target receipt and all frozen Multi-Model artifacts, seals the four Master evidence records, and evaluates the Master Gate.

## Fail-closed properties

PASS is rejected when any of the following occurs:

- model selector is absent or does not match the declared invocation identity;
- model invocation/authentication fails;
- a model identity is duplicated or left as a placeholder;
- target receipt or any referenced artifact drifts;
- binding does not match the actively invoked identities;
- frozen P2 cannot recompute the selected route;
- Judge evidence is incomplete or not based on the same input/rubric;
- diversity is weaker than `CROSS_FAMILY`;
- fallback exceeds two hops or its exact inputs drift;
- replacement lacks an active real-model proof;
- fresh P2 or fresh P3 evidence is missing after replacement.

## Explicit non-claims

P3 does not claim semantic/training-data independence merely because providers/families differ. It does not independently benchmark the provider's absolute context-window ceiling. It does not grant LLM output final release authority. Final authority remains `ALEDEVOS_DETERMINISTIC_GATE` and the Master Gate.

## Package validation

- P3 deterministic tests: **40 / 40 PASS**.
- P3 package certificate: `release/certifications/master-validation-p3.json`.
- Target evidence is intentionally not fabricated by package certification.
