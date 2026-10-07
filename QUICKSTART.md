# Quickstart — AleDevOS v1.50 Security & Reliability P8

P8 adds the transversal AppSec + QA + SRE assurance layer. Package certification does not substitute real target security evidence. Run the P8 self-test, then collect target evidence with the P8 target script.

```powershell
.\scripts\64-self-test-security-reliability-phase8.ps1
.\scripts\65-master-validation-p8-target-security-reliability.ps1 -InventoryOnly
```

The final Master Gate remains the next phase.

---

# Quickstart — AleDevOS v1.42 Advanced Execution Phase 5

Portability P1-P6, Multi-Model P1-P4 and Advanced Execution P1-P5 are COMPLETE/FROZEN at package level. P5 adds signed/fenced multi-machine coordination while real network transport and target remote-agent execution remain Master Validation evidence.

## 1. Re-run the frozen Portability stack

```powershell
.\scripts\41-self-test-portability-phase6.ps1
```

## 2. Re-run Multi-Model P1

```powershell
.\scripts\42-self-test-multimodel-phase1.ps1
```

## 3. Run Multi-Model P2

```powershell
.\scripts\43-self-test-multimodel-phase2.ps1
```

## 4. Run Multi-Model P3

```powershell
.\scripts\44-self-test-multimodel-phase3.ps1
```

## 5. Run Multi-Model P4

```powershell
.\scripts\45-self-test-multimodel-phase4.ps1
```

## 6. Verify the model registry

```powershell
node multimodel\engine\multimodel.mjs registry verify
```

Expected: `MODEL_REGISTRY_VALID`.

## 7. Bind real target Judge models

Copy `multimodel/templates/target-model-bindings.example.json` into target evidence/config and replace both logical slots with the real provider/model identities available on that machine. AleDevOS does not invent the secondary model.

```powershell
node multimodel\engine\multimodel.mjs binding verify --binding <binding.json>
node multimodel\engine\multimodel.mjs readiness check --binding <binding.json>
```

Until both models are real and ready, readiness remains fail-closed.

## 8. Route a Judge task deterministically

Create a request from `multimodel/templates/model-route-request.example.json`, then run:

```powershell
node multimodel\router\model-router.mjs request verify --request <route-request.json>
node multimodel\router\model-router.mjs route decide --binding <binding.json> --request <route-request.json> --out <route.json>
node multimodel\router\model-router.mjs route verify --route <route.json>
```

A blocked route is fail-closed: no unready, modality-incompatible, context-insufficient or over-budget model is selected.

## 9. Seal two Judge observations over the same evidence

```powershell
node multimodel\engine\multimodel.mjs evidence seal --binding <binding.json> --slot primary --input <input> --rubric <rubric> --submission <primary.json> --out <primary-evidence.json>
node multimodel\engine\multimodel.mjs evidence seal --binding <binding.json> --slot secondary --input <input> --rubric <rubric> --submission <secondary.json> --out <secondary-evidence.json>
node multimodel\engine\multimodel.mjs pair compare --primary <primary-evidence.json> --secondary <secondary-evidence.json> --out <comparison.json>
```

The comparison may be `AGREE`, `DISAGREE` or `INCOMPLETE`; it never replaces the deterministic AleDevOS gate.


## 10. Qualify Judge diversity

```powershell
node multimodel\extensions\diversity\judge-diversity.mjs pair assess --binding <binding.json> --judge-role quality --comparison <comparison.json> --out <diversity.json>
node multimodel\extensions\diversity\judge-diversity.mjs pair verify --decision <diversity.json> --binding <binding.json> --comparison <comparison.json>
```

Default P3 policy requires `CROSS_FAMILY`. Same-provider or same-family pairs are fail-closed as `JUDGE_DIVERSITY_BLOCKED`.


## 11. Resolve an explicit model fallback

Create a plan and trigger from the P4 templates. For an operational failure, include the valid P2 route that selected the failed model. For a `DIVERSITY_BLOCKED` trigger, include the sealed P3 blocked decision.

```powershell
node multimodel\extensions\fallback\model-fallback.mjs fallback resolve --binding <binding.json> --request <route-request.json> --plan <fallback-plan.json> --trigger <trigger.json> --route <route.json> --out <fallback.json>
node multimodel\extensions\fallback\model-fallback.mjs fallback verify --decision <fallback.json> --binding <binding.json> --request <route-request.json> --plan <fallback-plan.json> --trigger <trigger.json> --route <route.json>
node multimodel\extensions\fallback\model-fallback.mjs replacement apply --binding <binding.json> --decision <fallback.json> --out <replacement-binding.json>
```

After replacement, rerun P2 and P3 with the derived binding.

## Important boundary

P4 implements explicit bounded fallback. It does not discover providers/models, does not retry unfavorable Judge outcomes, and does not claim target provider/login/API/local-runtime availability. Final browser/image/security proof still belongs to Master Validation.


## Advanced Execution P1 — Worktrees

Prepare and provision an isolated task checkout from a clean primary repository:

```powershell
node .aledevos\execution\worktrees\worktree-manager.mjs request prepare --repo . --task-id feature-123 --base-ref HEAD --out .aledevos\state\execution\phase1\worktrees\feature-123.request.json
node .aledevos\execution\worktrees\worktree-manager.mjs worktree create --repo . --request .aledevos\state\execution\phase1\worktrees\feature-123.request.json --out .aledevos\state\execution\phase1\worktrees\feature-123.receipt.json
```

Inspect or verify the live isolated worktree before any later worker phase uses it. Dirty worktrees are never force-removed by P1.


## Advanced Execution P2 — Isolated Workers

Re-run the P2 package suite:

```powershell
.\scripts\47-self-test-advanced-execution-phase2.ps1
```

Typical lifecycle after a P1 worktree exists:

```powershell
node .aledevos\execution\workers\worker-manager.mjs assignment prepare ...
node .aledevos\execution\workers\worker-manager.mjs worker provision ...
node .aledevos\execution\workers\worker-manager.mjs worker start ...
node .aledevos\execution\workers\worker-manager.mjs worker status ...
node .aledevos\execution\workers\worker-manager.mjs handoff seal ...
node .aledevos\execution\workers\worker-manager.mjs worker finalize ...
```

P2 allows only one RUNNING worker. Parallel workers begin in P3 Safe Concurrency.


## Advanced Execution P3

Safe local concurrency is frozen in v1.40. Run `scripts/48-self-test-advanced-execution-phase3.ps1`.


## Advanced Execution P4 — Dispatcher / Queue

Run the P4 self-test:

```powershell
.\scripts\49-self-test-advanced-execution-phase4.ps1
```

Typical local queue flow:

```powershell
node .aledevos\execution\dispatcher\dispatcher-manager.mjs queue submit --repo . --plan <p3-plan.json> --priority 5
node .aledevos\execution\dispatcher\dispatcher-manager.mjs dispatch tick --repo .
node .aledevos\execution\dispatcher\dispatcher-manager.mjs queue status --repo .
node .aledevos\execution\dispatcher\dispatcher-manager.mjs queue pause --repo .
node .aledevos\execution\dispatcher\dispatcher-manager.mjs queue resume --repo .
node .aledevos\execution\dispatcher\dispatcher-manager.mjs queue drain --repo .
```

P4 never bypasses P3 admission and never spawns workers directly. P5 is the distributed coordination layer above the frozen local stack.

## Advanced Execution P5 — Multi-machine Support

Run the P5 self-test:

```powershell
.\scripts\50-self-test-advanced-execution-phase5.ps1
```

Package-level coordinator/node flow:

```powershell
node .aledevos\execution\multimachine\multimachine-manager.mjs coordinator init --repo .
node .aledevos\execution\multimachine\multimachine-manager.mjs identity create --node-dir C:\AleDevOSNodeA --machine-id node-a --capabilities machine-capabilities.json
node .aledevos\execution\multimachine\multimachine-manager.mjs node enroll --repo . --identity C:\AleDevOSNodeA\identity\identity.json
node .aledevos\execution\multimachine\multimachine-manager.mjs node approve --repo . --machine-id node-a
```

Assignments, acknowledgements and results are signed and fenced. Package validation intentionally uses file bundles rather than claiming an untested network transport. Real cross-machine transport and remote CLI/agent execution are the next Master Validation task.


## Master Validation P1

Inspect the current final-release matrix:

```powershell
node release/engine/v1-release.mjs master policy --project-root .
node release/engine/v1-release.mjs master package --project-root .
node release/engine/v1-release.mjs master matrix --project-root .
```

The legacy `gate evaluate` command remains available for v1.27 compatibility but no longer authorizes V1 freeze. Final authority is `master-gate evaluate`. At P1, target-runtime PASS evidence is intentionally blocked until the corresponding P2-P6 validator module exists.

Self-test:

```powershell
.\scripts\51-self-test-master-validation-phase1.ps1
```


## Master Validation P2 — target adapters

Package self-test and certificate verification:

```powershell
.\scripts\52-self-test-master-validation-phase2.ps1
```

Collect real adapter runtime/security evidence on the target machine using disposable projects:

```powershell
.\scripts\53-master-validation-p2-target-adapters.ps1
```

You may scope the run while diagnosing a runtime:

```powershell
.\scripts\53-master-validation-p2-target-adapters.ps1 -Adapters codex
```

The four canonical adapter checks require real CLI/auth/runtime evidence. Missing CLIs or failed authentication remain `BLOCKED`; the script never upgrades them to PASS. `cross_adapter_target_security` can PASS only when all four adapter receipts PASS on the same target fingerprint.

## Master Validation P3 — Multi-Model target binding

Run the P3 package suite first:

```powershell
.\scripts\54-self-test-master-validation-phase3.ps1
```

Discover target CLIs/models without making any PASS claim:

```powershell
.\scripts\55-master-validation-p3-target-multimodel.ps1 -InventoryOnly
```

Copy and fill `release\templates\MASTER_MULTIMODEL_TARGET_PROFILE.example.json` with the exact target identities/selectors, then run:

```powershell
.\scripts\55-master-validation-p3-target-multimodel.ps1 -Profile .\my-p3-target-profile.json
```

Primary and secondary require active explicit model invocations. `judge_diversity_real` requires `CROSS_FAMILY`. A full `model_fallback_real` PASS additionally needs a real three-model topology containing a same-family weak pair and a cross-family replacement; otherwise fallback remains honestly BLOCKED.

P4 and P5 are now implemented; see the current P6 section below.


## Master Validation P5 — Advanced Execution Target

```powershell
.\scripts\58-self-test-master-validation-phase5.ps1
.\scripts\59-master-validation-p5-target-advanced-execution.ps1 -InventoryOnly
```

P5 target PASS is intentionally stricter than package-level Advanced Execution P1-P5 certification. It requires live supervisor/concurrency evidence, canonical dispatcher state, a real network round-trip to a distinct host fingerprint, real process-loss recovery and stale-fence rejection.


## Master Validation P6 — Full-Stack Real Project

Run the package suite and certificate first:

```powershell
.\scripts\60-self-test-master-validation-phase6.ps1
```

Inventory the P6 target surface without claiming PASS:

```powershell
.\scripts\61-master-validation-p6-target-full-stack.ps1 -InventoryOnly -ProjectPath .\<controlled-real-project>
```

Use `release\templates\MASTER_END_TO_END_TARGET_PROFILE.example.json` as the target profile and `release\templates\MASTER_END_TO_END_ORCHESTRATION_TRACE.example.json` for the exact sixteen-stage runtime trace. Seal the real trace, then compile/seal the P6 target receipt:

```powershell
.\scripts\61-master-validation-p6-target-full-stack.ps1 -ProjectPath .\<controlled-real-project> -TraceDraft .\trace-draft.json -TraceOut .\trace.json
.\scripts\61-master-validation-p6-target-full-stack.ps1 -Profile .\p6-target-profile.json
```

`full_stack_real_project` can PASS only when every required artifact is present, hash-stable and re-validates through the existing frozen engines. P6 does not authorize final V1 freeze: P7 Global Efficiency and P8 Security & Reliability still follow before the final Master Gate.

## P7 — Global Efficiency across all AleDevOS

Run the deterministic P7 suite and certificate:

```powershell
.\scripts\62-self-test-global-efficiency-phase7.ps1
```

Inspect the target without claiming PASS:

```powershell
.\scripts\63-master-validation-p7-target-efficiency.ps1 -InventoryOnly
```

P7 creates a sealed adaptive plan from the Task Contract + efficiency signals, then compares a real baseline and optimized candidate. PASS requires measured token/context/tool/file/handoff/model-call/agent usage with no quality regression and zero operational project-management intervention by the user.

Next: **P8 — Security & Reliability Assurance**.
