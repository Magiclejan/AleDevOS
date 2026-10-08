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


### P37.1A — Codex diagnostic hardening

A Codex CLI exit code 1 by itself cannot distinguish invalid model, missing login, unsupported config, argument incompatibility or actual failed execution. The P37.1 runner now adds a bounded error category, CLI version/login status exit codes (not raw output), and a focused node test read-back for the safe-edit executed_real_task pilot. Output/hints contain only enum codes and numeric exit statuses, never raw provider prompts, stderr, stdout, credentials or transcripts. A reported login status is a local CLI observation, not authorization to expand permissions.

Preflight rejects example placeholders such as TU_MODELO_REAL and TU_PROVEEDOR_REAL before the external provider is invoked. Operators must supply the actual model identifier configured in their own authenticated CLI. For Codex, inspect the local codex version, codex login status, and codex exec help before the pilot. Do not paste auth files, tokens, raw prompts or entire provider logs into tickets.

Examples of safe result codes: CLI_NOT_FOUND, AUTHENTICATION_REQUIRED, MODEL_REJECTED, CONFIGURATION_REJECTED, CLI_ARGUMENT_REJECTED, RUNTIME_PERMISSION_DENIED, NETWORK_OR_CONNECTIVITY, RATE_LIMITED, RUNTIME_TIMEOUT, or UNCLASSIFIED_RUNTIME_FAILURE. The last state requires local diagnosis without inventing a root cause. Login-status failure is noted separately because a CLI may have alternative credential modes.

For previously collected P37.1 receipts, extract only runtime.provider_declared, runtime.model_declared, runtime.exit_code, runtime.error_code, runtime.stdout_bytes, and runtime.stderr_bytes. The original raw stderr was intentionally not stored, so a specific failed attempt cannot be retrospectively classified unless the operator supplies additional safe observations or performs a new authorized run.

MODEL_ID_NOT_OBSERVED_IN_STRUCTURED_RUNTIME remains a provenance gate: Codex JSON events do not necessarily report the model even when exit code is zero; never substitute a declared model for observed provider provenance or call a launch successful merely because JSON was emitted. Successful focused test plus no protected file mutations is still only execution evidence awaiting independent verification and the P37.3 signoff.


### P37.1B — Codex result-zero / no-execution gate (2026-10-08)

A real Windows Codex pilot produced CLI exit 0 but zero modified source paths, zero Orchestrator task directories, zero Skill routes and a failing focused addition test. All 13 native Skill files were present. This proves **installation only**, not runtime routing or Skill execution. Do not call this PASS.

P37.1 now records privacy-safe metadata from structured Codex JSONL: event counts, tool event count, final-message count and presence of the exact BLOCKED marker (never the model's message), plus actual counts of per-task contracts/states and Skill route receipts. For actionable cases, missing task contracts, states or routing artifacts block independently of the CLI exit code; safe-edit must change only src/utils.mjs and pass its focused test. P37.3 independent signoff and model provenance remain mandatory.

The Windows installer deliberately supports no-Git targets. Codex documentation specifies that project-local .codex/config.toml settings only load for *trusted projects*. The P37.1 disposable fixture is normally a no-Git temporary project; the existence of local config, agent definitions or Skills alone therefore does not verify Codex actually loaded them. Record project_config_effectiveness as UNVERIFIED rather than inferring trust.

For explicitly authorized positive Codex pilot cases only, use -CodexWorkspaceWrite with -ConfirmReal to request Codex's native workspace-write sandbox **within the already-validated disposable fixture**. This does not bypass the operating-system boundary, grant full filesystem/network access, establish project trust or prove control-plane protections. Read-only, negative permission and independent-verification cases do not receive this switch. P37.1 remains a diagnostic harness and does not authorize changing global Codex trust settings.

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\37-1-real-skills-execution.ps1 -Adapter codex -Provider openai -Model gpt-5.6-luna -Skill safe-edit -Case executed_real_task -CodexWorkspaceWrite -ConfirmReal

Interpret together: native_events, execution_evidence, workspace_runtime, focused_check, workspace.changed_paths and issues. No raw model answer or secrets should be copied into certification evidence. If task/routing evidence remains missing after Codex receives workspace-write, investigate project trust and actual agent delegation before attempting a full campaign.


### P37.1C — real bootstrap reached; bounded timeout and route adjudication

On 2026-10-08 the third real Codex safe-edit pilot emitted 7 JSONL events, 4 tool events, 1 task state, 1 task contract and 1 route receipt, but produced no completed turn and timed out at the prior fixed 120-second limit. The focused addition test continued failing; the target file was unchanged. This proves that a task and a route artifact were created, **not** that the safe-edit Skill was activated or completed.

For diagnosis, the Windows pilot wrapper now supports `-TimeoutSeconds 30..600` (default 120), passed unchanged to the engine, which rejects values outside the same bounds. Do not run the whole 78-case campaign with the extended timeout. Try one case only after checking the previous route and task progress. For example:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\37-1-real-skills-execution.ps1 -Adapter codex -Provider openai -Model gpt-5.6-luna -Skill safe-edit -Case executed_real_task -CodexWorkspaceWrite -TimeoutSeconds 300 -ConfirmReal

New `route_progress` records only allowlisted task state, roles, route status, selected requested Skill and **independent canonical route-verification exit code**; it never stores task objectives, route request data, task content or assistant replies. Receipt presence alone is not authorization or integrity evidence. `workspace_runtime.timeout_ms` and `workspace_runtime.elapsed_ms` preserve the bound and elapsed duration. If PowerShell/CLI timeout prevents proving termination of its child process tree, `provider_process_termination_after_timeout` remains UNVERIFIED. Do not reuse or certify that temporary workspace without checking for still-running processes.

If the new execution finishes yet routing is not ROUTE_READY, the target Skill was not selected or canonical route verification fails, the target remains BLOCKED. Model identification is still independent: Codex's structured JSONL may omit model even for successful turns. All P37.3 certification remains blocked until separately verified.


### P37.1D — successful scoped edit, distinct blockers (2026-10-08)

The fourth real Windows pilot of codex:safe-edit:executed_real_task completed in about 181 seconds with one completed Codex turn, seven tool events, canonical ROUTE_READY verified, safe-edit selected and four named agent roles. Its independent focused regression returned exit 0 and the authorized source file was changed. This proves an observed **successful scoped edit and focused test**, not full P37 operational certification.

The observation remains BLOCKED for separate reasons:
- Codex exec --json currently does not guarantee a model field in its publicly documented thread.started / turn.completed event types. An explicit --model flag and successful login do **not** independently attest which model ran. Record declared model and model_observed separately, with model_identity_independently_verified=false.
- The original agent_message_blocked_marker was an imprecise lexical detector: any occurrence of BLOCKED in *any* assistant message, including a description of a previous gate or a denial test, raised a critical blocker. Presence of the word is useful as a diagnostic, not as proof of an explicit final refusal.
- The real task state reported final_state UNFINISHED. Completion of a CLI turn or a focused unit test is not a substitute for Orchestrator finalization and independent verification.

The runner now records final_message_verdict and final_message_blocked based on a strict explicit verdict **in the last completed assistant message**, without saving raw text. A narrative mention of BLOCKED remains visible through the legacy agent_message_blocked_marker but no longer alone triggers CODEX_AGENT_REPORTED_BLOCKED. An explicit terminal refusal triggers CODEX_EXPLICIT_FINAL_BLOCKED. Separately, task_finalizationIssue fails closed with ORCHESTRATOR_TASK_NOT_FINALIZED / ORCHESTRATOR_TASK_RECORDED_BLOCKED / ORCHESTRATOR_TASK_RECORDED_FAILED based on task state. State evidence supersedes language heuristics; no old receipt is mutated or retroactively promoted.

Before another paid inference, inspect the original temporary task's safe metadata and core gate/role completion. A focused edit/test PASS and genuine route proof can be reported as a **partial operational result** while the overall Skill case stays BLOCKED for missing model provenance and unfinished lifecycle. Do not remove those gates or claim PRO_CERTIFIED. P37.2 and P37.3 have their own acceptance requirements.


### P37.1E — Quality Engineering gate diagnosis and Git-backed synthetic fixture (2026-10-08)

The fourth local Windows run successfully changed src/utils.mjs and its post-run focused test passed. Subsequent read-only inspection of that same original fixture showed: Researcher COMPLETED, Builder COMPLETED, Verifier STARTED, no Judges, no scope/integrity/canonical gate result, Quality Engineering BLOCKED. The verified Core Quality Engineering missing requirements were precisely: tests, canonical-gate-pass, regression-test, regression-analysis and diff-review. The installed project had configured=true with required canonical gate id tests.

This is a **real QA evidence deficit**, not a reason to weaken the quality policy. The P37 external post-run focused test is not a Core canonical gate receipt and must never be passed off as one. Core scope/integrity invoke git status, but the prior synthetic P37 fixture was not a Git repository. The absence of Git makes the protected scope and integrity steps unavailable under their real command contracts; it does not prove why the earlier Verifier stopped before attempting them.

For new P37.1 fixtures, the harness initializes Git **only inside its validated newly created temporary synthetic directory**, before installation. After installing all adapter files and verifying the native Skill projection, it commits a synthetic baseline using local, non-global Git author settings. An explicit synthetic .gitignore excludes only .aledevos/state/, to prevent Orchestrator state receipts appearing as product edits while leaving all other control-plane files tracked and protected. The runner refuses missing, dirty, unowned or non-Git baselines before any model invocation. Read-only Git may refresh stat data in .git/index; that one file is excluded from byte-level snapshot comparison, while its staged entries are fingerprinted independently before and after inference. All other .git metadata remain protected by the original snapshot comparison.

New quality_progress exposes only approved gate statuses, a small allowlist of missing requirement IDs, quality plan classification and evidence counts, Verifier completed flag, and judge counts. It stores neither plans, raw QA evidence, prompts, nor completions. New safe-edit prompt explicitly requests ordered real scope/integrity/canonical/quality steps and real regression-analysis/diff-review artifacts rather than synthetic passes; no command is invoked on behalf of the Verifier or Judges after Codex returns.

This is a correction to the P37 **disposable certification harness**, not a change to the installer contract for arbitrary user projects, the frozen Core quality policy or the actual operating-system sandbox. Existing P37 receipts and their non-Git workspaces are historical observations and shall not be retroactively reclassified.

Acceptance for the next real safe-edit case still requires the selected Skill/route to verify, authorized diff only, real canonical gates and Quality Engineering evidence, completed Verifier and required Judges, finalized task, and independent model provenance, followed by P37.3 review. PRO_CERTIFIED remains zero until all separate gates pass.
