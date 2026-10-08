# P37 — PRO Operational Certification

## Scope and current state

P36 gave us structurally reviewed documentation and four adapter distributions. **P37 must prove real runtime behavior** before any AleDevOS component receives the internal, non-vendor label `PRO_CERTIFIED`.

P37.0 is **the evidence policy, target matrix, intake validator and a local preflight**. It is **not operational certification**. There are 156 required adapter-scoped targets: 13 Skills × 4 adapters (52), 25 agent roles × 4 adapters (100), and one end-to-end Orchestrator workflow × 4 adapters (4).

Each target has six required scenarios, including authorization/negative cases and independent verification. For example, a Skill must be correctly activated, rejected outside scope, execute a real task, respect permissions, handle an error and be independently verified. Captures must bind exact Git SHA, source SHA-256, adapter, real provider/model/runtime, individual case IDs, exit codes and evidence artifact hashes.

**Evidence provenance is a claim until independently reviewed.** JSON integrity/hashes alone cannot prove that an AI provider actually ran or that a model observed an image. Accordingly the intake validator can emit `BLOCKED`, `FAILED` or `EVIDENCE_REVIEW_REQUIRED` — **never `PRO_CERTIFIED`**. Unmeasured facts stay unknown, text-only Visual Judge claims are blocked, and P5 remains blocked without native-image inspection.

## Windows preflight — first local handoff

From the **AleDevOS repository folder**, on the feature branch or after the approved change is merged into `main`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\37-0-pro-operational-preflight.ps1
```

The command verifies exactly 156 source-pinned targets and saves a **structural-only** receipt at `.aledevos/state/certification/p37/preflight.json`, excluded from Git. It executes no model or agent and deliberately records `operational_executions_observed: 0` and `pro_certified: 0`. A preflight PASS is not a release PASS.

To inspect the target matrix without modifying anything:

```powershell
node .\certification\pro\engine\p37-operational.mjs plan --root .
```

The evidence intake command `assess` is reserved for a later P37.1 harness that produces actual run artifacts in `.aledevos/state/certification/p37/`. It fails closed even for complete-looking evidence, pending independent P37.3 evaluation.

## Planned phases

- **P37.0 — Operational evidence foundation:** source-bound matrix, scenarios, immutable references and fail-closed validator; no runtime certification.
- **P37.1 — Real Skill executions:** exercise all 13 Skills against authorized local test projects on each available adapter, checking routing, success, denial, failure, integrity and verification. An adapter without a runnable provider remains BLOCKED.
- **P37.2 — Agent and workflow executions:** exercise 25 roles, read-only judges, Orchestrator handoffs, repair limit, security vetoes, Visual P2–P5 capability-specific gates and fresh receipts. One subagent at a time.
- **P37.3 — Independent signoff:** review real artifact bytes and provider provenance, reconcile all scenario receipts, issue component-scoped PRO_CERTIFIED only where every required gate passes, keeping the rest BLOCKED/FAILED.

Do not redefine these phase labels as V1 release freeze. The separate V1 Master Gate requires its own 33/33 target evidence; P37 cannot waive it.


## P37.1 — Real Skills Execution (local operator workflow)

**Status: IN PROGRESS / local runtime evidence required.** The P37.1 harness is a capture tool, not a simulator, certification engine or background job. It uses exactly the P37.0-pinned 13 Skill files per adapter, actual installed adapter projections, a disposable Windows test project and each adapter's runtime profile. Source, runtime profile, model/provider claim, native process exit, output hashes and project-file diffs are captured without raw prompts, model responses or secrets. No live provider execution can be inferred from CI or from the existence of the harness.

Prerequisites: Windows PowerShell, Git, Node.js, the target runtime CLI installed and authenticated, an explicitly selected provider/model, no production data, and a clean/known AleDevOS checkout. Repeat P37.0 on the current Git SHA; the originally uploaded preflight is bound to an earlier commit and is not transferable.

Use the controlled single-case pilot first:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\37-0-pro-operational-preflight.ps1
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\37-1-real-skills-execution.ps1 -Adapter codex -Provider REAL_PROVIDER -Model REAL_MODEL -Skill safe-edit -Case executed_real_task -ConfirmReal

Replace the provider/model placeholders with exact identifiers for the actually configured CLI. The script never launches a model without -ConfirmReal. It installs into a new temporary fixture, verifies all 13 installed Skill hashes, clones that fixture to a fresh temporary directory for each run, executes the external provider command using the shared ABI profile, and emits one JSON receipt per attempt under .aledevos/state/certification/p37/skills/. The output lists the disposable project path so a human can inspect actual changed bytes. No user project is edited. Do not commit these local receipts or any credentials.

Once the single-case pilot has been independently inspected, run all 13 × 6 cases (78 adapter-scoped attempts) on one available adapter:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\37-1-real-skills-execution.ps1 -Adapter codex -Provider REAL_PROVIDER -Model REAL_MODEL -FullCampaign -ReviewerId INDEPENDENT_REVIEWER_ID -ConfirmReal

Repeat explicitly for each actually runnable adapter, not for imagined providers. The reviewer identifier is a declared identity, not proof of independence. Missing reviewer, missing runnable CLI, unsupported role binding, unknown model provenance, output unavailable, protected file mutation, bad exit and unobservable routing all remain BLOCKED or require review. The PowerShell wrapper does not transform provider exit zero into a Skill PASS.

For a CLI-only inventory and post-run totals:

    node .\certification\pro\engine\p37-skills.mjs cases
    node .\certification\pro\engine\p37-skills.mjs summary
    node --test .\tests\pro-operational-phase37-1.test.mjs

A generated EVIDENCE_REVIEW_REQUIRED means only that the invocation and basic artifacts have no detected blocker: it does not prove automatic Skill activation, correct denial, scope compliance beyond filesystem differences, or independent validation. These are separate human/provider and deterministic review gates. The P37.0 assess contract still requires reviewed, scenario-complete receipts; the P37.1 raw observational files are not automatically promoted to P37.0 receipts.

**Acceptance to close P37.1:** For each available adapter, preserve six scenario-level observations for each of 13 Skill targets; confirm installation hash and provider identity out of band; inspect activation/routing, refusal, task outcome, protected-path effects, failure/recovery and verifier independence using actual workspace bytes. Explicitly record unavailable/unsupported adapters as BLOCKED. A P37.1 closure may report only observed/blocked/failed/review-needed targets; PRO_CERTIFIED remains zero until P37.3, and no V1 Master Gate is waived.
