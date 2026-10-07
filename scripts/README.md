# Scripts
- 00-09: Windows/local runtime helpers inherited and updated from v1.3.
- 05: installs only the selected adapter + portable `.aledevos` runtime.
- 10: validates v1.4 Core/adapter invariants.
- 12: ContextOS Phase 1 budgets/handoffs self-test.
- 13: ContextOS Phase 2 checkpoint/resume self-test (also reruns Phase 1).

- `14-self-test-contextos-phase3.ps1` — validates ContextOS Phase 1+2+3 (budgets/handoffs, checkpoint/resume, diff-first/de-dup).

## ContextOS Phase 4
- `15-self-test-contextos-phase4.ps1` — runs AleDevOS Core + ContextOS Phase 1-4 deterministic suite (63 tests).


## ContextOS Phase 5
- `16-self-test-contextos-phase5.ps1`: validates Core + ContextOS phases 1-5 (81/81).
- Installed runtime supports `knowledge freshness`, `knowledge refresh` and `research put/get/verify/invalidate`.
- `17-self-test-contextos-phase6.ps1` — runs the Phase 6 telemetry/observability tests and cumulative ContextOS suite.


## Skill System Phase 1
- `18-self-test-skill-system-phase1.ps1` — validates registry/contracts plus the cumulative 121-test deterministic suite.

- `21-self-test-skill-system-phase4.ps1` — Skill System Phase 4 governance/execution/telemetry self-test.

## UX/UI System Phase 1
- `23-self-test-uxui-phase1.ps1` — validates Project Mode + Design Context and reruns the cumulative deterministic suite (229/229).

## UX/UI System Phase 2
- `24-self-test-uxui-phase2.ps1` — validates Component Registry + Reuse-Before-Create and reruns the cumulative deterministic suite (259/259).

## UX/UI System Phase 3
- `25-self-test-uxui-phase3.ps1` — validates Design Genesis + deterministic Design System Discovery.

## UX/UI System Phase 4
- `26-self-test-uxui-phase4.ps1` — validates Design System Guardian + UX/UI Judge. Cumulative suite: 301/301.

## UX/UI System Phase 5
- `27-self-test-uxui-phase5.ps1` — validates Motion Director + Motion Language.

## UX/UI System Phase 6
- `28-self-test-uxui-phase6.ps1` — validates Accessibility + Responsive + UI States + UI Decision Records.
- Phase 6 closes UX/UI System 1.0; rendered Visual QA remains the next independent block.

### `29-self-test-visualqa-phase1.ps1`
Runs the deterministic Visual QA Phase 1 contract/evidence tests. Browser execution is intentionally not part of this phase.
## Visual QA Phase 3
- `31-self-test-visualqa-phase3.ps1` — validates immutable baseline approval, named tolerance profiles, PNG pixel comparison, diff artifacts, contract drift blocking and sealed regression reports.


## Visual QA Phase 5
- `33-self-test-visualqa-phase5.ps1` — validates native-image Visual Judge contracts, deterministic score recomputation, fail-closed UNVERIFIED behavior, evidence revisions, sealed bounded repair authorization/cycles, fresh P2→P5 evidence after repair, the global two-repair cap, final acceptance and adapter/release wiring.

## V1 final release validation
- `34-v1-target-runtime-smoke.ps1` — creates a disposable controlled Git project, installs the current adapter/runtime, optionally bootstraps Playwright+Chromium **inside that workspace**, executes real adapter-provider P2 capture, P3 baseline comparison, P4 audit, seals browser/runtime/security evidence, and shows current target preflight/release-gate state. The workspace is intentionally preserved for later P5/repair/full-stack evidence.
- `35-self-test-v1-release-candidate.ps1` — reruns the complete deterministic RC suite in bounded groups, validates every MJS and JSON file, writes `V1_RC_REGRESSION_SUMMARY.json`, and can seal `deterministic_regression` evidence into the controlled target workspace with `-ProjectPath`.

Current v1.27 floor: **570/570 deterministic PASS, 51/51 MJS syntax, 117/117 JSON parse, 0 failures**. This is package validation, not a substitute for real target evidence.


## Portability Phase 1
- `36-self-test-portability-phase1.ps1` — validates Adapter ABI 2.0, all six manifests, compatibility/installability fail-closed behavior and cumulative deterministic regression.

Current Portability P1 package floor: **600/600 deterministic PASS, 53/53 MJS syntax, 124/124 JSON parse, 0 failures**.

## Portability Phase 2
- `37-self-test-portability-phase2.ps1` — reruns the frozen P1 regression, executes the OpenCode V2 certification sabotage suite, emits a sealed `OPENCODE_ADAPTER_CERTIFICATE.json`, and checks package MJS/JSON integrity.
- Current Portability P2 package floor: **641/641 deterministic PASS, 55/55 MJS syntax, 125/125 JSON parse, 0 failures**.

## Portability Phase 3
- `38-self-test-portability-phase3.ps1` — reruns frozen P1/P2 checks, executes the Codex certification sabotage suite, verifies ABI compatibility, seals Codex certification, validates TOML/JSON/MJS structure and source-to-installed adapter behavior.
- P3 target cumulative deterministic floor after final regression: **695/695 PASS**.

## Portability P5
- `40-self-test-portability-phase5.ps1` re-runs the frozen P1-P4 chain, Antigravity/Gemini family conformance, canonical certification, all five implemented/compatible identities, and structural checks.


## Multi-Model Phase 1
- `42-self-test-multimodel-phase1.ps1` — validates second-Judge bindings, provenance and pair comparison.

## Multi-Model Phase 2
- `43-self-test-multimodel-phase2.ps1` — validates deterministic Model Router policy/request/eligibility/selection, sealed route verification, P1 freeze and installed-layout projection.
- `44-self-test-multimodel-phase3.ps1` — validates declared-provenance Judge diversity tiers, P1 comparison qualification, fail-closed CROSS_FAMILY policy, tamper resistance, extension projection and P1/P2 phase isolation.

## Advanced Execution Phase 1
- `46-self-test-advanced-execution-phase1.ps1` — validates real Git primary-checkout preflight, pinned worktree requests, deterministic branch/path derivation, task isolation, sealed receipts, non-destructive cleanup, installed-layout execution and P1 package certification.

- `48-self-test-advanced-execution-phase3.ps1` — validates Safe Concurrency P3 and P1/P2/P3 certificates.

- `49-self-test-advanced-execution-phase4.ps1` — validates durable Dispatcher/Queue P4, deterministic priority/FIFO aging, work-conserving P3 delegation, pause/resume/cancel/drain, stale-lock recovery and P1-P4 certification.

- `50-self-test-advanced-execution-phase5.ps1` — validates Multi-machine P5 identity/trust, signed anti-replay heartbeat, capability admission, signed bundle transfer, ACK/result flow, lease fencing, stale-owner reassignment, duplicate-authority prevention, state tamper resistance, installed-layout policy and P1-P5 certification.

- `51-self-test-master-validation-phase1.ps1` — verifies the recovered current-stack Master Validation P1 harness plus legacy gate compatibility.


- `58-self-test-master-validation-phase5.ps1` — validates the P5 Advanced Execution target harness and package certificate.
- `59-master-validation-p5-target-advanced-execution.ps1` — inventory/target orchestration for live P1→P5 evidence, real network transport, crash recovery and fencing proof. Inventory mode never declares PASS.

- `62-self-test-global-efficiency-phase7.ps1` — validates the transversal Efficiency Governor, adaptive agent/skill/reasoning plans, ACTL/closed decisions, anti-tamper benchmark semantics, quality preservation and P7 package certification.
- `63-master-validation-p7-target-efficiency.ps1` — target inventory/plan/benchmark runner for the four P7 Master checks; inventory mode never declares PASS.

## Final Master Gate — v1.51
- `66-self-test-final-master-gate.ps1` — validates the final freeze authority, 33/33 preconditions, anti-tamper behavior and final package certificate.
- `67-final-master-gate.ps1` — single target campaign runner. It seals measured deterministic-regression evidence, coordinates P2→P8, evaluates the 33-check Master Gate and issues/verifies the V1 freeze certificate only on 33/33 PASS. `-InventoryOnly` never freezes.

