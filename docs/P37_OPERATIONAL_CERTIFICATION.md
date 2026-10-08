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
