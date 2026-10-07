# AleDevOS

> **A portable AI macro-skill for software engineering.**  
> One reusable operating layer that can sit above different AI runtimes, models and providers without coupling its Core to any of them.

AleDevOS is not a model, provider, IDE or single-agent prompt. It is a **macro-skill / operating layer** that packages orchestration, context management, specialized agents, reusable Skills, deterministic gates, QA, repair loops, portability, observability and efficiency policy into one system that can be projected into supported AI runtimes.

## What AleDevOS is

```text
USER GOAL
   |
   v
AleDevOS  <- portable macro-skill / operating layer
   |
   +-- ContextOS            -> relevant context, budgets, maps, cache, handoffs
   +-- Skill System         -> reusable capabilities loaded when needed
   +-- Specialized Agents   -> minimum necessary agent set
   +-- Deterministic Gates  -> evidence before PASS
   +-- Judges / Repair      -> bounded quality control
   +-- Efficiency Governor  -> minimum necessary intelligence
   +-- Auto-Telemetry       -> real token/runtime measurements
   |
   v
Adapter ABI
   |
   +-- OpenCode
   +-- Codex
   +-- Claude Code
   +-- Google Antigravity
   +-- future adapters
   |
   v
External runtime / provider / model
```

The **Core never owns a concrete model or provider**. A new AI runtime can participate by implementing the AleDevOS Adapter ABI and preserving the required workflow, security and evidence semantics. Adapters translate AleDevOS into runtime-native configuration; they do not redefine the Core.

## Portable by design

AleDevOS is designed as an OS- and runtime-portable macro-skill rather than a Windows-only application.

- **AI/runtime portability:** OpenCode, Codex, Claude Code and Google Antigravity are the current canonical adapters. Future runtimes can be added through the Adapter ABI.
- **Provider/model neutrality:** provider and model selection remain external to AleDevOS.
- **Host portability:** Core contracts and artifacts are platform-neutral. Windows is the currently exercised target in the real E2E evidence; macOS remains a target platform and must complete its own real-target validation before being described as target-certified.
- **No hidden fallback:** an adapter may not silently impersonate another runtime or inject a project-specific backend.

## Token efficiency is a first-class requirement

AleDevOS is intentionally designed to make large AI-assisted projects **cheaper to operate over time without reducing quality**.

It does this through ContextOS and the Global Efficiency governor:

- context budgets instead of loading everything;
- diff-first context and de-duplication;
- structured compact handoffs;
- checkpoint/resume instead of rediscovery;
- persistent repo/dependency/symbol/domain maps;
- research cache with freshness/invalidation;
- minimum-necessary agent and Skill activation;
- adaptive reasoning profiles;
- model routing and bounded fallback;
- closed decision contracts instead of unnecessary prose;
- real per-agent token/runtime telemetry.

**Token savings are evidence-based, not guessed.** AleDevOS only claims an efficiency improvement from comparable baseline/candidate runs with preserved gates, acceptance criteria and Judge quality. Unknown token counts stay unknown.


### Validated token-efficiency evidence

AleDevOS now has repeated real Codex benchmark evidence for two controlled MICRO scenarios:

| Benchmark | What it isolates | Median total-token reduction | Quality | Repetitions |
| --- | --- | ---: | --- | ---: |
| **B1 Context Efficiency** | full context vs relevant context | **50.67%** | preserved | 3 pairs |
| **B2 Macro-Orchestration Efficiency** | broad pipeline vs P7 MICRO + relevant context + compact handoffs | **77.24%** | preserved | 3 pairs |
| **B3 Real Project Repository Efficiency** | broad real-project context vs deterministic targeted retrieval | **74.49%** | preserved | 3 pairs |
| **B4 Real Software-Engineering E2E** | broad project context vs targeted context on a real verified code edit | **72.40%** | preserved | 3 pairs |

B2 also reduced model calls and active agents by **33.33%**, and handoff tokens by **99.73%** in the controlled benchmark. B3 used a real external repository corpus with 1,061 safe eligible files, reduced supplied file context from 15 files to 1, and reduced context bytes by **99.60%** while preserving the exact required result. B3 pinned the same model (`gpt-5.6-luna`) and reasoning effort (`low`) across compared runs.

B4 extends the evidence to a real software-engineering edit: both paths produced the same independently verified diff while the source project remained unchanged.

These are **benchmark-specific measurements**, not a universal savings promise. Broader claims require more task classes, repositories, adapters and host platforms.

Canonical evidence:
- `docs/benchmarks/B1_CONTEXT_EFFICIENCY.md`
- `docs/benchmarks/B2_MACRO_ORCHESTRATION_EFFICIENCY.md`
- `docs/benchmarks/B3_REAL_PROJECT_REPOSITORY_EFFICIENCY.md`
- `docs/benchmarks/B4_REAL_SOFTWARE_ENGINEERING_E2E.md`

## Auto-Telemetry V2 — real runtime proof

The V2 agent-call telemetry path has now been exercised with a real Codex call:

```text
call_status   = COMPLETED
exit_code     = 0
usage_status  = REPORTED
input_tokens  = 11894
output_tokens = 13
duration_ms   = 7454
tool_calls    = 0
files_read    = 0
telemetry     = VERIFIED
```

This proves that AleDevOS can execute a real adapter/model call, capture reported token usage and measured duration, aggregate the agent metrics, finalize the task telemetry and independently verify the event chain and summary integrity.

This result validates **measurement**, not a percentage token-saving claim. Token-saving benchmarks start from this instrumentation.

## Core identity invariants

1. **AleDevOS is a macro-skill, not an AI model.**
2. **The user owns the goal; AleDevOS owns orchestration.**
3. **Core is runtime/provider/model agnostic.**
4. **Adapters are replaceable projections, never Core dependencies.**
5. **Use the minimum necessary intelligence that preserves quality.**
6. **Relevant context beats maximum context.**
7. **No efficiency PASS without real comparable measurements.**
8. **No quality reduction in exchange for token savings.**
9. **No PASS without deterministic evidence.**
10. **Every supported platform/runtime must prove its own target readiness.**

Canonical identity contract: `docs/ALEDEVOS_MACRO_SKILL.md`.

---

# AleDevOS Local v1.51 — Final Master Gate

Current implementation roadmap is complete through P8. v1.51 adds the only V1 freeze authority: a Final Master Gate that consumes the existing 33 checks and issues `ALEDEVOS_V1_FROZEN` only after a current real-target campaign reaches **33/33 PASS**. Package certification alone never freezes V1.

The user is the goal owner, not AleDevOS' project manager. `scripts/67-final-master-gate.ps1` coordinates P2→P8 from one campaign contract and refuses to issue a freeze certificate while any required evidence is missing, blocked, failed, stale or tampered.

# AleDevOS Local v1.50 — Security & Reliability P8

Current release line: Master Validation P1-P6 and P7 Global Efficiency remain implemented. P8 adds transversal Security & Reliability assurance: deterministic security scanning, a dedicated read-only Security Reviewer, external dependency/security scanner contracts, durable bug/vulnerability/incident registries, test-health gating and regression-linked bug closure. Final Master Gate remains intentionally unclaimed.

# AleDevOS Local v1.42 — Advanced Execution Phase 5

AleDevOS is a portable, runtime-agnostic multi-agent development system. Portability P1-P6 and Multi-Model P1-P4 remain COMPLETE/FROZEN. Advanced Execution P1-P4 remain frozen. Advanced Execution P5 adds package-level multi-machine coordination with Ed25519 machine identities, explicit trust/approval, signed anti-replay heartbeats, capability-aware assignment, bounded leases, fencing tokens, signed task/result bundles and stale-owner reassignment. Real network transport and target remote-agent execution remain Master Validation evidence.

```text
AleDevOS Core                    COMPLETE / FROZEN
ContextOS 1.0                    COMPLETE / FROZEN
Skill System 1.1                 COMPLETE / FROZEN
UX/UI System 1.0                 COMPLETE / FROZEN
Visual QA
  ├─ Phase 1: Capture Contracts + Evidence Integrity   COMPLETE / FROZEN
  ├─ Phase 2: Browser Capture Runner                   COMPLETE / FROZEN
  ├─ Phase 3: Approved Baselines + Visual Regression  COMPLETE / FROZEN
  ├─ Phase 4: Rendered Layout/A11y Runtime Checks      COMPLETE / FROZEN
  └─ Phase 5: Visual Judge + Bounded Repair Loop       COMPLETE / FROZEN
Portability / Adapters
  ├─ P1 Adapter ABI + Capability Negotiation           COMPLETE / FROZEN
  ├─ P2 OpenCode Adapter Certification                 COMPLETE / FROZEN
  ├─ P3 Codex Adapter                                  COMPLETE / FROZEN
  ├─ P4 Claude Code Adapter                            COMPLETE / FROZEN
  ├─ P5 Google Antigravity + Gemini Compatibility      COMPLETE / FROZEN
  └─ P6 Cross-adapter Conformance + Portable Skill Pack COMPLETE / FROZEN
Multi-Model
  ├─ P1 Second Judge Model                              COMPLETE / FROZEN
  ├─ P2 Model Router                                    COMPLETE / FROZEN
  ├─ P3 Judge Diversity                                 COMPLETE / FROZEN
  └─ P4 Model Fallback                                  COMPLETE / FROZEN
Advanced Execution
  ├─ P1 Worktrees                                       COMPLETE / FROZEN
  ├─ P2 Isolated Workers                                COMPLETE / FROZEN
  ├─ P3 Safe Concurrency                                COMPLETE / FROZEN
  ├─ P4 Dispatcher / Queue                              COMPLETE / FROZEN
  └─ P5 Multi-machine Support                           COMPLETE / FROZEN
```


## Multi-Model Phase 1

P1 introduces an adapter-independent model registry with explicit `primary` and `secondary` Judge slots. Target runtimes bind those slots to concrete provider/model identities. Every Judge result can be sealed with immutable input/rubric SHA-256, provider/model provenance, modalities, context-window metadata, cost class and runtime readiness.

Pair comparison is evidence only: it may report `AGREE`, `DISAGREE` or `INCOMPLETE`, but it never sets AleDevOS final state. Missing/unready secondary evidence never becomes consensus. Routing, provider-diversity enforcement and fallback remain deliberately deferred to P2/P3/P4. No concrete secondary model is hard-coded by the package.

Canonical files:
- `multimodel/engine/multimodel.mjs`
- `multimodel/registry/model-registry.json`
- `multimodel/policies/judge-pair-policy.json`
- `multimodel/schemas/*.json`
- `multimodel/templates/target-model-bindings.example.json`
- `release/certifications/multimodel-p1.json`


## Multi-Model Phase 2

P2 routes only across the explicit models bound by P1. Eligibility is fail-closed on runtime readiness, required modality, context fit with an 8192-token safety reserve, known cost class and an optional cost ceiling. Selection is deterministic (`COST_THEN_CONTEXT` or `CONTEXT_THEN_COST`) with stable slot tie-breaking.

Route artifacts seal the original request SHA-256, binding SHA-256/snapshot, policy SHA-256, every candidate rejection reason and the selected provider/model identity. Verification recomputes the route from the sealed snapshots, so a manipulated selection cannot be made valid simply by recalculating the route hash.

P2 does not enforce provider diversity, does not create fallback chains and does not decide the final Judge outcome; those boundaries remain P3, P4 and the deterministic AleDevOS gate respectively.

Canonical P2 files:
- `multimodel/router/model-router.mjs`
- `multimodel/policies/model-router-policy.json`
- `multimodel/schemas/model-route-request.schema.json`
- `multimodel/schemas/model-route-decision.schema.json`
- `multimodel/templates/model-route-request.example.json`
- `release/certifications/multimodel-p2.json`
- `docs/MULTIMODEL_PHASE2_MODEL_ROUTER.md`


## Multi-Model Phase 3

P3 qualifies the existing P1 Judge pair using declared `model_id`, `provider_id` and `provider_family` provenance. It exposes three ordered tiers: `DISTINCT_MODEL_SAME_PROVIDER`, `CROSS_PROVIDER_SAME_FAMILY`, and `CROSS_FAMILY`. Every current Judge role requires `CROSS_FAMILY` by default; weaker pairs are recorded but blocked.

This is intentionally a provenance claim, not a claim of cognitive/training-data independence. P3 can bind its evidence to a sealed P1 comparison, but it never changes `AGREE/DISAGREE/INCOMPLETE`, never overrides P2 routing, never substitutes a model, and never sets final Judge state. Automatic fallback remains P4.

Canonical P3 files:
- `multimodel/extensions/diversity/judge-diversity.mjs`
- `multimodel/policies/judge-diversity-policy.json`
- `multimodel/schemas/judge-diversity-decision.schema.json`
- `release/certifications/multimodel-p3.json`
- `docs/MULTIMODEL_PHASE3_JUDGE_DIVERSITY.md`


## Multi-Model Phase 4

P4 resolves only explicit fallback plans and permits at most two fallback hops. It never discovers providers/models automatically and never retries because a Judge returned an unfavorable verdict. Allowed fallback triggers are operational/eligibility failures or a sealed P3 `DIVERSITY_BLOCKED` decision.

Every candidate must still satisfy P2 runtime/modality/context/cost constraints and the P3 diversity tier against the non-replaced Judge slot. Failed/previously-attempted models cannot repeat. A selected replacement produces a derived binding and mandates fresh P2 routing and fresh P3 diversity evidence. Final Judge authority remains `ALEDEVOS_DETERMINISTIC_GATE`.

Canonical P4 files:
- `multimodel/extensions/fallback/model-fallback.mjs`
- `multimodel/policies/model-fallback-policy.json`
- `multimodel/schemas/model-fallback-*.schema.json`
- `multimodel/templates/model-fallback-*.example.json`
- `release/certifications/multimodel-p4.json`
- `docs/MULTIMODEL_PHASE4_MODEL_FALLBACK.md`


## Advanced Execution Phase 1

P1 establishes a real Git worktree lifecycle without starting workers. Provisioning is allowed only from a clean, attached primary checkout. `request prepare` pins `base_ref` to an exact commit and records repository identity plus primary HEAD/branch; any drift blocks creation.

AleDevOS derives both mutable surfaces instead of trusting model/user paths:

- task branch: `aledevos/task/<task_id>`
- task checkout: sibling `.aledevos-worktrees/<repo-bucket>/<task_id>`

`worktree create` uses real `git worktree add`, rechecks primary postconditions and emits a SHA-256 sealed creation receipt. Live verification recomputes the expected path/branch, checks worktree registration and base ancestry, and rejects semantic tampering even when a receipt is rehashed. Cleanup is intentionally non-destructive: dirty worktrees block, force removal is disabled and task branches are preserved.

P1 explicitly does **not** start workers, enable concurrency, dispatch queues, perform network work or use multiple machines. Those are Advanced Execution P2-P5.

Canonical P1 files:
- `advanced-execution/worktrees/worktree-manager.mjs`
- `advanced-execution/policies/worktree-policy.json`
- `advanced-execution/schemas/worktree-*.schema.json`
- `advanced-execution/contracts/WORKTREE_ISOLATION.md`
- `release/certifications/advanced-execution-p1.json`
- `docs/ADVANCED_EXECUTION_PHASE1_WORKTREES.md`

## Advanced Execution Phase 2

P2 binds one worker identity to one P1 worktree and one task contract. A real supervisor process provides PID/heartbeat/CWD evidence with an allowlisted environment; target LLM/adapter runtime execution remains explicitly deferred to Master Validation. Only one worker may be `RUNNING` in P2.

Writes are limited to task-contract scopes and are additionally constrained by global and project `protected_paths`. Cross-worktree/external paths, symlink escapes, arbitrary shell and network remain blocked. Lifecycle mutations are serialized through an atomic control lock.

Handoff derives changed paths from Git rather than worker claims. Evidence is SHA-256 snapshotted into primary worker-owned state before cleanup, so a finalized handoff remains verifiable after P1 removes the temporary worktree while preserving its task branch. Recovery is bounded to one process-loss recovery.

Canonical P2 files:
- `advanced-execution/workers/worker-manager.mjs`
- `advanced-execution/workers/worker-runtime.mjs`
- `advanced-execution/policies/worker-policy.json`
- `advanced-execution/schemas/worker-*.schema.json`
- `release/certifications/advanced-execution-p2.json`
- `docs/ADVANCED_EXECUTION_PHASE2_ISOLATED_WORKERS.md`


## Advanced Execution Phase 3

P3 is the only layer allowed to run multiple worker supervisors concurrently. It consumes valid live P2 assignments backed by P1 worktrees, computes a deterministic admission plan, blocks write/write and write/read overlap, permits read/read overlap, and enforces distinct workers/worktrees.

A repository-global lease registry and atomic control lock enforce the parallelism cap across all groups, not per group. New groups are compared against every active group before any process is launched. Lost workers degrade only their own group member and may be recovered once without stopping healthy peers.

P3 remains local-only: dispatcher/queue, network execution, multi-machine scheduling and target agent/model runtime proof remain deferred to P4/P5 and Master Validation.

Canonical P3 files:
- `advanced-execution/concurrency/concurrency-manager.mjs`
- `advanced-execution/policies/concurrency-policy.json`
- `advanced-execution/schemas/concurrency-*.schema.json`
- `advanced-execution/contracts/SAFE_CONCURRENCY.md`
- `release/certifications/advanced-execution-p3.json`
- `docs/ADVANCED_EXECUTION_PHASE3_SAFE_CONCURRENCY.md`

Useful package command:

```powershell
.\scripts\46-self-test-advanced-execution-phase1.ps1
```


## Advanced Execution Phase 4

P4 owns durable local scheduling only. Verified P3 plans are snapshotted into repo-owned phase4 state and enter a SHA-256 sealed queue. Selection is deterministic: base priority, epoch-based aging, FIFO sequence and dispatch id. A safety-blocked higher-priority item does not freeze the queue; P4 may dispatch a lower-priority non-conflicting item, but every start still goes through P3.

Queue/item pause, resume, cancellation, explicit completion, drain and bounded retry accounting are supported. Dispatcher state survives separate CLI invocations and stale dispatcher locks are recovered only when their recorded PID is dead. Multi-machine/network scheduling and target adapter/model runtime binding remain deferred to P5/Master Validation.

Canonical P4 files:
- `advanced-execution/dispatcher/dispatcher-manager.mjs`
- `advanced-execution/policies/dispatcher-policy.json`
- `advanced-execution/contracts/DISPATCHER_QUEUE.md`
- `advanced-execution/schemas/dispatcher-*.schema.json`
- `release/certifications/advanced-execution-p4.json`
- `docs/ADVANCED_EXECUTION_PHASE4_DISPATCHER_QUEUE.md`

## Portability Phase 6

P6 closes package-level Portability across the four canonical runtimes. `portability/conformance/conformance.mjs` verifies equivalent security/workflow outcomes, fresh per-adapter certificates, identical role sets, explicit capability variance, byte-identical Visual QA provider projection, Gemini alias integrity, and zero runtime-specific leakage back into Core.

The 13 built-in Skills are now governed by `skillsystem/portable/portable-skill-pack.json`. Adapter-native frontmatter may differ, but normalized Skill semantics must hash identically across Core, OpenCode, Codex, Claude Code and Antigravity.

## Canonical portability files

- `core/adapter-runtime/adapter.mjs`
- `adapters/antigravity/.agents/agents/*.md`
- `adapters/antigravity/.agents/skills/*/SKILL.md`
- `adapters/antigravity/.agents/hooks.json`
- `adapters/antigravity/hooks/pretool-guard.mjs`
- `adapters/antigravity/settings/aledevos-permissions.overlay.json`
- `adapters/antigravity/certification/antigravity-certifier.mjs`
- `adapters/gemini/adapter-capabilities.json`
- `docs/PORTABILITY_PHASE5_GOOGLE_ANTIGRAVITY.md`
- `docs/PORTABILITY_PHASE6_CONFORMANCE.md`
- `portability/conformance/conformance.mjs`
- `skillsystem/portable/portable-skill-pack.json`

## Useful commands

```powershell
node core/adapter-runtime/adapter.mjs compatibility check --root . --adapter antigravity --profile full_current
node core/adapter-runtime/adapter.mjs compatibility check --root . --adapter gemini --profile full_current
node portability/conformance/conformance.mjs matrix run --root .
node portability/conformance/conformance.mjs skills verify --root .
node portability/conformance/conformance.mjs projection verify --root .
.\scripts\41-self-test-portability-phase6.ps1
```

Install canonical Google adapter:

```powershell
.\scripts\05-install-into-project.ps1 -ProjectPath "C:\path\to\project" -Adapter antigravity
```

Compatibility spelling is explicit and canonicalized:

```powershell
.\scripts\05-install-into-project.ps1 -ProjectPath "C:\path\to\project" -Adapter gemini
# gemini -> antigravity; no duplicate Google runtime is installed
```


## Advanced Execution Phase 5

P5 adds a transport-neutral multi-machine coordination protocol above the frozen local P1-P4 stack. Machine and coordinator identities use Ed25519. Enrollment is explicitly approved; signed heartbeats are sequence-numbered and replay protected. Remote tasks carry capability requirements, bounded leases and monotonically increasing fencing tokens. Reassignment is allowed only after lease expiry and a stale/revoked owner, with a hard two-reassignment cap.

Assignment/result payloads are transferred as signed SHA-256 checked bundles for package validation. A stale node may not produce an authoritative accepted result after fencing advances. P5 intentionally does **not** claim that package logic can stop a physically partitioned host from continuing computation before its lease expires. Real network transport, host-to-host CLI execution and remote P1-P4 target binding remain Master Validation work.

Canonical P5 files:

```text
advanced-execution/multimachine/multimachine-manager.mjs
advanced-execution/policies/multimachine-policy.json
advanced-execution/contracts/MULTI_MACHINE_SUPPORT.md
advanced-execution/schemas/machine-identity.schema.json
advanced-execution/schemas/machine-registry.schema.json
advanced-execution/schemas/remote-task.schema.json
advanced-execution/schemas/remote-assignment.schema.json
advanced-execution/schemas/remote-result.schema.json
release/certifications/advanced-execution-p5.json
```

The v1.27 release-gate work is retained as a compatibility-only legacy gate. Master Validation P1 owns the current-stack evidence matrix; P2-P5 add target validators for adapters/security, Multi-Model, Visual Runtime and Advanced Execution. P6 now owns the final `END_TO_END` validator for one controlled real project and re-verifies evidence from the existing frozen engines instead of creating a parallel runtime. P7 efficiency and P8 security/reliability remain outside P6 authority.

## Deterministic validation

```text
Frozen v1.42 deterministic baseline 1527 / 1527 PASS
Master Validation P1 tests               44 /   44 PASS
Master Validation P2 tests               54 /   54 PASS
Master Validation P3 tests               40 /   40 PASS
Master Validation P4 tests               24 /   24 PASS
Master Validation P5 tests               33 /   33 PASS
Master Validation P6 tests               32 /   32 PASS
Global Efficiency P7 tests                79 /   79 PASS
Cumulative deterministic inventory     1833 / 1833
MJS syntax                               108 / 108 required
JSON                                     248 / 248 required
Codex TOML                                25 /  25 required
Failures                                           0 required
```

The cumulative inventory is the package release floor; phase-specific suites are independently executable. Target PASS is never inferred from package test success.

Cross-adapter certificate SHA256: `fc6c97923ffd6ac82d05f30213d228f92c06194ce9e5ac247655dc59072ceaff` (refreshed because the release runtime and V1 release-validator roles intentionally changed for Master Validation P1).

Multi-Model P1 certificate remains frozen and valid.

Multi-Model P2/P3/P4 certificates were refreshed only because the shared installer gained the one-time forward Advanced Execution projection hook; their router/diversity/fallback engines and policies are unchanged.

Multi-Model P2 certificate evidence SHA256: `6808c156196ae5634480c026b3a387f0fd5495964b871065a624fe1b0fd4366d`.

Multi-Model P3 certificate evidence SHA256: `32deb070be3fe433cbbdb754a7088e6837089136acbc382e36952c2432c366bb`.

Multi-Model P4 certificate evidence SHA256: `affb88cf90c3cc100e28596de110affaf197ae8862ec6212cd68c49bf7a7e067`.

Advanced Execution P1 certificate evidence SHA256: `2c09afbaf803a8bd8c9cd98576c98bf928e13e71bb79026a16ffbcc26fb8d47e`.

Advanced Execution P2 certificate evidence SHA256: `02cab05002bd2a97b744a3d6060bcfb34f6147fc440b8a21cc11884dbc0ae006`.

Advanced Execution P3 certificate evidence SHA256: `414db65159d33127adab28e80ff75693462b3fbde498b0baca0d20c8aec632c5` (refreshed only for stale-dead-lock recovery discovered during P4).

Advanced Execution P4 certificate evidence SHA256: `be8d7918e2c58818f31d4b4e0605170542830dc3568ed50adc7f4dc6285a4d31`.

Advanced Execution P5 certificate evidence SHA256: `8f8b9a965c598491fa4d93aec2abe029878929413b6ca4a5b30bb71c973be73e`.

Target CLI/auth/model/browser execution is not claimed by package certification for any adapter.

## Master Validation Phase 1

The original v1.27 release gate has been recovered as a compatibility layer and superseded for final-freeze authority by the current-stack Master Validation harness. The Master matrix contains 27 required checks spanning package integrity, all four canonical adapter runtimes, Multi-Model, Visual Runtime, Advanced Execution, resilience/security and the final real-project run. P1 keeps package-certificate and deterministic-regression validators as built-ins. P2 adds the first target extension, `ADAPTER_RUNTIME`, without giving later P3-P6 validators any authority. PASS remains impossible for a check until its validator exists and verifies target evidence.

Current deterministic floor: **1833 tests / 108 MJS / 248 JSON / 25 TOML / 0 failures**.

See `docs/MASTER_VALIDATION_PHASE1.md`.

Master Validation P1 certificate SHA256: `bb9016b71a01dafeeb80316bb924cb6de8b06df47c41f4c8fa173405c222a93a`.

## Master Validation Phase 2

P2 adds target adapter-runtime receipts for OpenCode, Codex, Claude Code and Antigravity. A PASS receipt requires a real CLI/version, current installed package certification, an authenticated active smoke, a successful allowed product-write positive control, observable denial of control-plane/external-write/arbitrary-shell/network probes, no dangerous bypass flag, and sealed log artifacts. The cross-adapter security check requires all four PASS receipts to come from the same target fingerprint.

Target collection script: `scripts/53-master-validation-p2-target-adapters.ps1`. It creates disposable per-adapter projects, installs from this package, runs the target probes and seals the five P2 Master evidences. Missing CLIs/auth remain BLOCKED rather than becoming synthetic PASS.

Master Validation P2 certificate SHA256: `87777e7c0cc407991c0b48df8f3523996fa82ce19ecae18c284521abfe1c4e8b`.

## Master Validation Phase 3

P3 owns exactly `primary_secondary_models_real`, `model_router_real`, `judge_diversity_real` and `model_fallback_real`. It requires active non-interactive invocations with an explicit model selector, builds the target binding only from those proven identities, reuses frozen P2 routing, seals two real Judge observations over the same input/rubric, and requires frozen P3 `CROSS_FAMILY` diversity.

Fallback proof is deliberately non-destructive: when at least three actively invocable model identities provide a valid same-family weak pair plus a cross-family replacement, P3 uses the already-allowed sealed `DIVERSITY_BLOCKED` trigger, applies frozen P4 fallback, then requires fresh P2 routing and fresh P3 diversity. With insufficient real topology, only `model_fallback_real` stays BLOCKED; P3 never fabricates an outage or shops for a preferred Judge result.

Inventory first: `scripts/55-master-validation-p3-target-multimodel.ps1 -InventoryOnly`. Full target run: fill `release/templates/MASTER_MULTIMODEL_TARGET_PROFILE.example.json`, then call script 55 with `-Profile`. Context-window size is sealed as target-declared metadata rather than claimed as an independently stress-tested provider ceiling.

See `docs/MASTER_VALIDATION_PHASE3.md`.

Master Validation P3 certificate SHA256: `e678e5a9f4eac14a8994b4a1ea3ae753e9c743a77176f5df7e382a208d792962`.

## Master Validation Phase 4

P4 owns the five Visual Runtime target checks. It requires real Playwright/Chromium provider evidence, rendered layout/accessibility audit, a real native-image model invocation bound to the screenshot hash, a successful bounded repair path and a separate two-repair exhaustion/no-third-repair path. Controlled fixtures cannot become target PASS.

Master Validation P4 certificate SHA256: `b12a4621910858841cf7e68cce4ff7180b9fcca118ef5c7baa0f52acc0cef254`.

## Master Validation Phase 5

P5 owns the five Advanced Execution target checks. It requires a live worktree/worker, simultaneous safe concurrency, canonical dispatcher delegation through P3, an actual network round-trip to a different machine fingerprint, real process-loss recovery and stale-fence rejection.

Master Validation P5 certificate SHA256: `e1c63f09ff0638d84815ab82a6bb9a0228a30b3d051efc13b8f2bfedd2fe14a3`.

## Master Validation Phase 6

P6 owns exactly `full_stack_real_project`. It is an evidence binder/verifier, not a second Orchestrator: a controlled real project must expose a sealed sixteen-stage orchestration trace from `ORCHESTRATOR` through `FINAL_GATE` plus the canonical ContextOS, Skill System, Multi-Model, Advanced Execution, Visual QA, Judge and final-state artifacts. P6 re-runs the existing frozen verifiers, requires final `PASS`, all three deterministic gates PASS, all three Judge scores >=90 with zero blockers/unverified criteria, and verifies implementation changes stayed inside approved scope.

P6 explicitly does **not** claim P7 token/context efficiency or P8 security/reliability completion.

See `docs/MASTER_VALIDATION_PHASE6.md`.

Master Validation P6 certificate SHA256: `58955e37ddb4fe3755310433af331759dd7b1b210dddb6523d750f18d25b57fe`.

## Global Efficiency Phase 7

P7 is transversal across AleDevOS. The sealed Efficiency Plan classifies work as `MICRO`, `STANDARD`, `DEEP` or `CRITICAL`, activates only required agents/skills, applies role-aware reasoning budgets and enforces the rule that the user owns goals and product decisions but is not asked to coordinate agents, workers, skills, tests or next steps.

The Efficiency Benchmark compares a baseline with the optimized candidate and requires measured input/output/total tokens, context peak, tool calls, files read, handoff tokens, model calls and active agents. Savings are rejected if final state, deterministic gates, Judge quality, acceptance criteria or repair count regress. Plans and receipts are recomputed during verification, so rehash fraud cannot manufacture PASS.

P7 owns four Master checks: `adaptive_execution_governor_real`, `context_token_efficiency_real`, `quality_preservation_real`, and `user_project_manager_independence_real`. P8 remains a mandatory fail-closed successor.

See `docs/GLOBAL_EFFICIENCY_PHASE7.md`.

Global Efficiency P7 certificate SHA256: `a8ce91db439791d23c120e4850b180c0d6f23ac15454fbb11b973b701b5729f7`.

## Status

- Portability P1-P6: COMPLETE / FROZEN.
- Multi-Model P1-P4: COMPLETE / FROZEN.
- Advanced Execution P1-P5: COMPLETE / FROZEN.
- Master Validation P1-P6: IMPLEMENTED / package-certified; target evidence remains fail-closed.
- Global Efficiency P7: IMPLEMENTED / package-certified; real baseline-vs-optimized target benchmark pending.
- Next objective: **P8 Security & Reliability Assurance**.
- Master Validation P1-P6: harness contracts IMPLEMENTED / package-certified; target PASS remains evidence-driven.
- Next objective: **P7 — Global Efficiency across all AleDevOS**.
- After P7: P8 Security & Reliability, then the final Master Gate.

## Security & Reliability P8

P8 is a transversal AppSec + QA + SRE assurance layer. It does not claim that AleDevOS or generated software is unhackable. Native deterministic scanning and external scanners remain separate evidence channels from the read-only Security Reviewer. Severe findings fail closed unless they are verified fixed, mitigated or explicitly accepted with approval evidence.

A bug cannot become `VERIFIED` without a linked regression test and `regression_verified=true`. Vulnerabilities and incidents are durable records rather than ephemeral chat findings. The final P8 assurance gate also requires test health to be green.

Canonical P8 files:
- `security-reliability/engine/security-assurance.mjs`
- `security-reliability/engine/reliability-registry.mjs`
- `security-reliability/policies/security-reliability-policy.json`
- `core/agents/security-reviewer.md`
- `release/templates/master-validator-security-reliability.mjs`
- `release/templates/master-validation-p8-certifier.mjs`
- `scripts/64-self-test-security-reliability-phase8.ps1`
- `scripts/65-master-validation-p8-target-security-reliability.ps1`


### P8 source self-scan note

The v1.50 source self-scan intentionally does not suppress a HIGH `node_shell_true` finding in `core/engine/aledevos.mjs` for the canonical gate runner. That runner executes integrity-pinned project gate commands and is protected by AleDevOS control-plane policy, but it still uses a shell and therefore remains visible to the security scanner. P8 does not silently whitelist it: a target/source assurance campaign must either remove the shell requirement, provide verified mitigation, or attach an explicit approved-risk record. This is a bounded known risk, not a claim of zero vulnerability.
