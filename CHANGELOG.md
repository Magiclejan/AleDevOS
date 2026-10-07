# v1.52.0 — Productized Macro-Skill Release

- Added Auto-Telemetry V2 with real per-agent Codex token/runtime evidence.
- Validated token-efficiency benchmarks B1-B4, including a repeated real software-engineering E2E edit benchmark with preserved quality.
- Added `aledevos start` install-on-first-use onboarding and simplified the Windows app around one primary `INICIAR ALEDEVOS` action.
- Added explicit support for new/empty projects, existing projects without Git and existing Git repositories without implicit `git init`.
- Reduced the Windows product surface to one launcher: `START_ALEDEVOS.bat`.
- Reworked README/Quickstart around installation, project support and product boundaries.
- Removed obsolete duplicate launchers and historical hotfix onboarding artifacts.
- Release closure requires a fresh manifest/package-tree, deterministic regression inventory, package recertification, public-release audit and Final Master Gate before tagging.
## v1.51 Hotfix 10 â€” OpenCode runtime discovery hardening
- OpenCode P2 discovery now queries pnpm, Yarn, Bun and Mise for actual global executable locations.
- Added PNPM_HOME, WinGet links, ~/.local/bin, extensionless launchers and already-running process path recovery.
- Preserved stable `opencode`, beta `opencode2` and WSL-only classification.
- Missing-CLI messages no longer claim a PATH-only failure after broader discovery has run.
- Added 4 deterministic P2 regressions; cumulative package floor raised to 1941 tests.


## v1.51 Hotfix 6 â€” Codex permission-profile glob compatibility
- Replaced unsupported Codex writer `AGENTS.* = read` permission rules with exact `AGENTS.md` and `AGENTS.override.md` read-only entries.
- Preserved broader `AGENTS.*` control-plane protection at the AleDevOS project/guard layer.
- Applied the same exact-path rule to P2, P3 and P8 inline Codex target profiles.
- Added deterministic regressions for unsupported read globs and exact instruction-file protection.
- Raised the deterministic package floor to 1926 tests.


## v1.51 Hotfix 4 â€” P2 permission-profile correctness

- P2 Codex probes now exercise the AleDevOS named permission profiles (`aledevos_readonly` / `aledevos_writer`) instead of overriding them with an explicit legacy sandbox mode.
- The shell security probe now verifies that shell execution cannot escape into the protected `.aledevos` control plane; ordinary shell execution inside approved product scope is no longer treated as a security defect.
- P3/P8 Codex read-only invocations use the AleDevOS named read-only permission profile.
- Windows runtime diagnostics now print the exact security-probe boolean matrix before the compact log tail.

# v1.51 Windows Hotfix 3

- Updated real-runtime probes for current Codex and Claude Code CLI behavior without weakening target security requirements.
- Claude Code probes no longer require `--permission-prompts none`, which is unavailable in the installed 2.1.92 CLI; unattended denial remains enforced with `--permission-mode dontAsk`.
- Removed `--no-session-persistence` from target probes to avoid unnecessary version coupling in disposable validation targets.
- Normalized Codex P3/P8 non-interactive invocations so the global approval flag precedes the `exec` subcommand.
- Reworked the P2 Windows runtime checker into compact mode: installer/probe detail is retained in logs while the terminal shows one summary row per runtime plus redacted failure diagnostics.
- Added deterministic regression coverage for Claude probe compatibility, Codex argument ordering, and compact P2 diagnostics.
- Aligned P1/P2/Final package certificate test-count metadata with the actual deterministic suites (45 / 57 / 33).

# v1.51 Windows Hotfix 2

- Added Windows PowerShell 5.1-compatible relative-path handling across P2-P8 target runners and the Final Master Gate.
- Removed reliance on `System.IO.Path.GetRelativePath()` from Windows campaign scripts.
- Relative evidence paths remain root-confined and fail closed on escape attempts.
- Added deterministic regression coverage for all eight target/final PowerShell runners and the easy Windows runtime launcher.
- Preserved Hotfix 1 UX/UI Windows path migration behavior.

# v1.51 Windows Hotfix 1 â€” pre-freeze

- Fixed Windows path normalization bug that could create `.aledevos/design/decisions` as a file instead of a directory.
- Added safe migration of the exact legacy placeholder file; non-placeholder collisions fail closed and preserve user data.
- Added package-wide SHA-256 tree integrity so drift in any distributed runtime invalidates `package_certifications_current`, even when that file is outside a phase certificate input list.
- Added regression coverage for Windows directory semantics, legacy migration, collision preservation, and previously-uncovered runtime drift.

# v1.51.0 â€” Final Master Gate

- Closed the V1 implementation roadmap without adding a 34th requirement: the final authority consumes the existing **33 Master checks** exactly.
- Added a fail-closed Final Master Gate finalizer and a SHA-256 sealed `ALEDEVOS_V1_FROZEN` certificate that can only be issued from a current, reverified `V1_RELEASE_READY` report with **33/33 PASS, 0 BLOCKED, 0 FAILED**.
- Added evidence-root binding across all Master check receipts plus package baseline, Master policy, P8 certificate and final package certificate, so stale/rehashed reports cannot freeze a modified package.
- Added a single Final Campaign runner that coordinates deterministic regression evidence plus P2â†’P8 target runners; operational phase coordination is no longer the user's job.
- Preserved the legacy v1.27 release gate as non-authoritative. No legacy or package-only certificate can issue the V1 freeze.
- Added explicit freeze schemas/campaign contracts, final package certification and 30 adversarial Final Gate tests.
- Master P1â†’P8 + Final Gate regression: **381/381 PASS**. Final package floor: **1912 tests / 119 MJS / 265 JSON / 26 TOML / 0 failures required**.
- Package implementation may be certified while target evidence remains BLOCKED; `ALEDEVOS_V1_FROZEN` is intentionally impossible until the real target campaign reaches 33/33.

# v1.50.0 â€” Security & Reliability Assurance P8

- Added a transversal AppSec + QA + SRE assurance layer without claiming perfect security or complete penetration testing.
- Added dedicated read-only `security-reviewer` roles across Core, OpenCode, Codex, Claude Code and Antigravity.
- Added deterministic native security scanning for secrets, dangerous execution patterns, shell/config risks and test-integrity regressions.
- Added external scanner contracts for dependency/security tooling with real-process execution, exact profiles and sealed receipts.
- Added durable Bug, Vulnerability and Incident registries with deterministic fingerprints, deduplication, integrity seals and explicit lifecycle rules.
- Bugs cannot become VERIFIED without a linked regression test and verified regression evidence; accepted vulnerability risk requires explicit approval.
- Added test-health assurance for failures, skips, focused tests and critical flaky tests.
- Added a final Security & Reliability assurance gate that requires severe native findings to be resolved, mitigated or explicitly accepted with evidence.
- Integrated P8 with P7 so security-sensitive work cannot optimize away the Security Reviewer.
- Added seven Master checks: native scan, Security Reviewer, dependency scan, bug regression registry, incident/vulnerability registry, test health and final assurance.
- P8 adversarial suite: **45/45 PASS**. Current release floor: **1878 tests / 115 MJS / 260 JSON / 26 TOML / 0 failures required**.
- Next: Final Master Gate.

# v1.49.0 â€” Global Efficiency P7

- Added a transversal Efficiency Governor across Orchestrator, ContextOS, Skills, model routing, workers, QA and Judges.
- Added deterministic `MICRO` / `STANDARD` / `DEEP` / `CRITICAL` task profiles with risk/scope/signal-based agent, skill and reasoning activation.
- Made `USER_IS_GOAL_OWNER_NOT_PROJECT_MANAGER` a hard contract: operational coordination requests to the user are forbidden; only product authority, credentials, irreversible-action and policy-exception decisions may require intervention.
- Added ACTL 1.0 compact technical language and closed decision contracts without claiming ASD-STE100 compliance.
- Added sealed baseline-vs-optimized efficiency benchmarking across input/output/total tokens, context peak, tool calls, files read, handoff tokens, model calls and active agents.
- Added quality-preservation gates: no final-state/gate/Judge/acceptance regression and no increase in repairs. Token savings can never compensate for worse engineering.
- Added semantic recomputation of plans and benchmark receipts so rehashing manipulated artifacts cannot manufacture PASS.
- Integrated P7 into all canonical Orchestrators and the installer while preserving required deterministic gates and specialist security/Visual QA activation.
- Added four Master checks for adaptive execution, context/token efficiency, quality preservation and user project-manager independence.
- Added an explicit fail-closed P8 Security & Reliability successor so P7 cannot authorize final V1 freeze.
- Global Efficiency P7 suite: **79/79 PASS**. Current release floor: **1833 tests / 108 MJS / 248 JSON / 25 TOML / 0 failures required**.

# v1.48.0 â€” Master Validation P6 / Full-Stack Real Project

- Added the fail-closed `END_TO_END` Master validator for `full_stack_real_project`.
- Added a strict sixteen-stage SHA-256 sealed orchestration trace from Orchestrator through the final deterministic gate.
- P6 is an evidence binder/verifier rather than a parallel runtime: it re-validates frozen ContextOS, Skill System, Multi-Model, Advanced Execution and Visual QA artifacts.
- Requires model identity/runtime invocation evidence for every model-driven pipeline stage.
- Re-validates canonical P4 Dispatcher queue state plus a semantic/integrity-checked historical `STARTED` receipt.
- Requires final deterministic `PASS`, all scope/integrity/canonical gates PASS, all three Judge scores >=90 with zero blockers/unverified criteria and all acceptance criteria VERIFIED.
- Enforces that worker changed paths remain inside the global approved scope and binds target/project/task/run identity.
- Inventory/fixtures cannot manufacture target PASS; incomplete profiles remain fail-closed.
- Explicitly leaves P7 Global Efficiency and P8 Security & Reliability unclaimed before final V1 freeze.
- Added P6 target/trace/receipt contracts, Windows target orchestrator, package certifier and 32 deterministic P6 harness tests.
- Raised the Master Validation floor to 1754 tests, 104 MJS, 237 JSON and 25 TOML with zero failures required.
- Next: P7 â€” Global Efficiency across all AleDevOS.

# v1.47.0 â€” Master Validation P5 / Advanced Execution Target

- Added the fail-closed `ADVANCED_EXECUTION` Master validator for all five P5 checks.
- Re-validates frozen P1 worktrees and P2 worker assignments/sessions, requiring a live real supervisor heartbeat in the exact isolated worktree.
- Requires at least two simultaneously live P3 workers with distinct PIDs/worktrees and actively proves scope-conflict rejection on the target.
- Re-validates the canonical P4 durable queue plus a sealed `STARTED` receipt proving dispatch delegated through P3.
- Added active real-network transport proof using nonce + random payload round-trip to a distinct host fingerprint; controlled test providers and same-host roundtrips cannot PASS.
- Binds real network transport to frozen P5 signed-node/task/result state and re-verifies the authoritative signed result.
- Added controlled real worker-process crash injection, one-recovery proof, healthy-peer survival and post-recovery health verification.
- Requires multi-machine fence advancement through reassignment plus stale signed-result rejection and current authoritative-result re-verification.
- Preserves Advanced Execution P1-P5 engines/policies byte-for-byte and explicitly does not claim physical exactly-once compute under arbitrary partitions.
- Added P5 target/profile/transport contracts, remote endpoint helper, Windows target orchestrator, package certifier and 33 deterministic P5 harness tests.
- Raised the Master Validation floor to 1722 tests, 101 MJS, 231 JSON and 25 TOML with zero failures.
- Next: Master Validation P6 â€” Full-Stack Real Project.

# v1.46.0 â€” Master Validation P4 / Visual Runtime + Bounded Repair

- Added the fail-closed `VISUAL_RUNTIME` Master validator for all five P4 checks.
- Re-validates frozen Phase 2 Playwright/Chromium receipts and Phase 4 rendered layout/accessibility reports; controlled test providers are forbidden for target PASS.
- Added active native-image invocation receipts: exact image SHA-256, explicit model selector, no-shell execution, nonce observation and sealed stdout/stderr.
- Binds semantic Visual Judge evidence to the exact screenshot observed by the target model.
- Requires a real attempt-1 repair PASS with fresh P2/P3/P4/P5 evidence.
- Requires bounded exhaustion: repair-1 retry, repair-2 exhausted and a rejected third repair (`MAX_REPAIRS_REACHED`).
- Preserves the frozen Visual QA P1-P5 engines and retains explicit non-claims for full WCAG conformance and dynamic motion/frame quality.
- Added P4 target profile/receipt contracts, Windows target orchestrator, package certifier and 24 deterministic P4 harness tests.
- Next: Master Validation P5 â€” Advanced Execution Target Validation.

# 1.45.0-master-validation-p3

- Added Master Validation P3 target-only Multi-Model validator for `primary_secondary_models_real`, `model_router_real`, `judge_diversity_real` and `model_fallback_real`.
- Added inventory-only discovery that cannot produce PASS and active model probes requiring the exact explicit model selector plus a nonce-bearing successful invocation.
- Bound real primary/secondary target identities into the frozen Multi-Model P1 contract, then reused frozen P2 routing and frozen P1 Judge evidence/pair comparison.
- Required frozen P3 `CROSS_FAMILY` Judge diversity; weaker pairs are recorded but remain BLOCKED.
- Added non-destructive real fallback proof via an allowed sealed `DIVERSITY_BLOCKED` weak-pair topology, frozen P4 replacement, and mandatory fresh P2/P3 evidence.
- Kept the hard two-hop fallback cap, no-repeat/model-shopping prohibitions and final deterministic-gate authority unchanged.
- Explicitly records context-window size as target-declared metadata rather than an independently stress-benchmarked provider ceiling, and makes no semantic/training-data independence claim.
- Added P3 target profile/receipt schemas, Windows inventory/full-run orchestration, package certification and 40 deterministic adversarial tests.
- Raised the deterministic Master Validation floor to 1665 tests, 94 MJS, 220 JSON and 25 TOML with zero failures.
- Multi-Model P1-P4 engines/policies remain frozen and are consumed, not modified.

# 1.44.0-master-validation-p2

- Added Master Validation P2 target adapter-runtime/security validator for OpenCode, Codex, Claude Code and Antigravity.
- Added sealed runtime receipts with CLI/version, anonymous target fingerprint, current package-certifier evidence, active authenticated smoke and runtime logs.
- Added active denial probes for control-plane writes, external writes, arbitrary shell and network access; dangerous bypass/auto-approval flags fail closed.
- Added same-target `cross_adapter_target_security` validation across all four canonical adapters.
- Added Windows target orchestration using disposable per-adapter projects; missing CLIs/auth remain BLOCKED.
- Kept P1 built-ins forward-compatible while P3-P6 validators remain unavailable for PASS.
- Raised the deterministic Master Validation floor to 1625 tests, 91 MJS, 215 JSON and 25 TOML with zero failures.
- Added P2 schema/template, validator/probe, certificate, 54 deterministic tests and scripts 52/53.

# 1.43.0-master-validation-p1

- Recovered the v1.27 target-release gate without restoring its obsolete OpenCode-only authority.
- Added the 22-check current-stack Master Validation matrix covering Package, Adapter Runtime, Multi-Model, Visual Runtime, Advanced Execution, Resilience, Security and End-to-End validation.
- Legacy eight-check gate remains executable but explicitly cannot authorize final V1 freeze.
- Added fail-closed validator extension points: future P2-P6 checks cannot seal PASS until their validator module exists.
- Added current package baseline over 14 frozen prerequisite certificates and their input hashes.
- Raised the deterministic Master Validation floor to 1571 tests, 88 MJS, 212 JSON and 25 TOML with zero failures.
- Added Master evidence/report schemas, package certificate, tests and self-test script.
- Refreshed OpenCode, Codex, Claude Code, Antigravity and cross-adapter certificates because their release-runtime/validator-role inputs intentionally changed.

# v1.42.0 â€” Advanced Execution P5 / Multi-machine Support

- Added Ed25519 machine/coordinator identities, explicit PENDINGâ†’APPROVED trust and coordinator trust anchors.
- Added signed anti-replay heartbeats and capability-aware remote task admission.
- Added signed task/result bundles, bounded leases, monotonically increasing fencing tokens and a hard two-reassignment cap.
- Late/stale fence results cannot become authoritative; exactly one authoritative task result is accepted.
- Added durable coordinator registry/tasks state with stale-lock recovery and per-task integrity seals.
- Explicitly does not claim prevention of physical duplicate computation on a partitioned node before lease expiry; authoritative duplicate acceptance is prevented.
- Real network transport and target remote-agent/P1-P4 execution remain deferred to Master Validation.
- Added P5 schemas, contract, templates, certification, self-test script 50 and 61 deterministic adversarial tests.
- Advanced Execution P1-P5 is now COMPLETE/FROZEN.
- Next roadmap item: Master Validation / V1 target-runtime release gate.

# v1.41.0 â€” Advanced Execution P4 / Dispatcher + Queue

- Added durable repository-local Dispatcher/Queue state above frozen P1/P2/P3 execution layers.
- Added deterministic priority + FIFO + epoch-aging selection, work-conserving dispatch, bounded retry accounting, pause/resume/cancel/complete/drain and crash-resumable CLI state.
- Submitted P3 plans are verified and snapshotted into phase4 state; arbitrary external plan drift cannot silently change queued work.
- P4 delegates every start/stop to P3 and does not spawn worker processes directly. Multi-machine/network scheduling remains disabled.
- P4 adversarial suite: 62 deterministic tests.
- P4 exposed and fixed a P3 stale-dead-lock recovery bug; P3 admission semantics are unchanged and its certificate is refreshed to bind the maintenance hardening.
- Added P4 schemas, contract, template, documentation, certification and self-test script 49.
- Next roadmap item: Advanced Execution P5 â€” Multi-machine Support.

# v1.40.0 â€” Advanced Execution P3 / Safe Concurrency

- Added deterministic multi-worker local concurrency as a separate layer above frozen P1 worktrees and P2 isolated workers.
- Added scope admission: write/write and write/read conflicts block; read/read overlap is allowed.
- Added repository-global lease registry and atomic global control lock so limits/conflicts apply across all active groups.
- Added hard local parallelism cap (4 by default), stable FIFO plan ordering and no dispatcher/queue semantics yet.
- Added real simultaneous supervisor processes with distinct worktree CWD/heartbeat evidence.
- Added isolated per-worker failure detection and one-recovery cap without terminating healthy peers.
- Preserved dispatcher, queue, network, multi-machine and target agent-runtime proof as deferred boundaries.
- Advanced Execution P3 suite: 58 deterministic tests.
- Cumulative deterministic validation: 1403/1403 PASS; structural validation: 83/83 MJS, 192/192 JSON, 25/25 TOML.

# v1.39.0 â€” Advanced Execution P2 / Isolated Workers

- Added deterministic one-worker/one-worktree assignment and exclusive ownership.
- Added real supervisor process lifecycle with PID, heartbeat, exact worktree CWD and environment allowlist.
- Added scoped read/write authorization, cross-worktree/external/symlink blocking, project protected-path enforcement and serialized control-plane mutations.
- Added bounded process-loss recovery with Linux zombie detection and one-recovery cap.
- Added Git-derived handoff, durable evidence snapshots and verification after safe P1 worktree cleanup.
- Preserved P3/P4/P5 boundaries: concurrency, dispatcher/queue and multi-machine remain disabled. Target LLM/adapter runtime binding remains deferred to Master Validation.
- Advanced Execution P2 suite: 106 deterministic tests.
- Cumulative deterministic validation: 1345/1345 PASS; structural validation: 81/81 MJS, 186/186 JSON, 25/25 TOML.

# v1.38.0 â€” Advanced Execution Phase 1 / Worktrees

- Added deterministic Git worktree lifecycle as the first Advanced Execution primitive.
- Added strict primary-checkout preflight: non-bare root, attached branch, clean tree and no in-progress merge/rebase/cherry-pick/revert/bisect.
- Added request preparation pinned to exact base commit plus repository identity and primary HEAD/branch.
- Branch names and sibling worktree paths are AleDevOS-derived; user/model supplied branch/path input is forbidden.
- Added real `git worktree add` provisioning with primary HEAD/cleanliness postconditions and sealed SHA-256 creation receipts.
- Added live receipt verification with Git registration, deterministic path/branch recomputation and base-commit ancestry checks.
- Added non-destructive cleanup: dirty trees block, force removal is disabled and task branches are preserved.
- Added forward recursive Advanced Execution installer projection so P2-P5 can add execution components without further installer edits.
- Multi-Model P2/P3/P4 certificates were refreshed only because the shared installer gained that forward projection; their engines/policies remain unchanged.
- Added package certification and 79 deterministic P1 tests using real local Git worktrees, including symlink/path hardening and cross-platform task-name validation.
- Cumulative deterministic validation: 1239/1239 PASS; structural validation: 78/78 MJS, 178/178 JSON, 25/25 TOML.
- Next roadmap item: Advanced Execution P2 â€” Isolated Workers.

# v1.37.0 â€” Multi-Model Phase 4 / Model Fallback

- Added explicit adapter-independent fallback plans with a hard maximum of two fallback hops.
- Added allowed operational fallback triggers and explicit prohibitions on Judge-result/model-shopping fallback.
- Preserved P2 runtime readiness, modality, context and cost ceilings for every replacement candidate.
- Preserved P3 declared-provenance diversity as a hard replacement constraint.
- Added no-repeat/failed-model exclusion, deterministic candidate ordering and exhaustion semantics.
- Added sealed trigger/plan/request/binding/P2/P3 provenance and source-drift verification.
- Added derived replacement bindings that mandate fresh P2 routing and P3 diversity evidence.
- Added P4 certification, schemas, templates, documentation and 89 deterministic tests.
- Multi-Model P1/P2/P3 certificates remain valid without modification.
- V2.1 Multi-Model is now COMPLETE/FROZEN; next objective is V3 Advanced Execution â€” Worktrees.

# v1.36.0-multimodel-p3 â€” 2026-10-06

- Added Multi-Model P3 Judge Diversity as an isolated forward extension; P1 engine and P2 router/policy remain unchanged.
- Added deterministic tiers: DISTINCT_MODEL_SAME_PROVIDER, CROSS_PROVIDER_SAME_FAMILY, CROSS_FAMILY.
- Default policy requires CROSS_FAMILY for every current Judge role; weaker pairs are recorded but blocked.
- Diversity claims are explicitly limited to declared provider/model provenance; semantic/epistemic independence is not claimed.
- Added optional qualification of sealed P1 comparisons without changing AGREE/DISAGREE/INCOMPLETE or final Judge authority.
- Added tamper/drift verification for tiers, signals, bindings, comparisons and diversity decisions.
- Added forward `multimodel/extensions/` installer projection so P4 can add fallback without another shared-installer edit.
- P2 certificate refreshed because the shared installer changed; P2 router and policy remain byte-unchanged.
- Added 65 deterministic Multi-Model P3 tests.
- Cumulative deterministic validation: 1071/1071 PASS; structural validation: 74/74 MJS, 166/166 JSON, 25/25 TOML.
- Next roadmap item: Multi-Model P4 â€” Model Fallback.

# v1.35.0-multimodel-p2 â€” 2026-10-06

- Added adapter-independent deterministic Model Router as a separate runtime so Multi-Model P1 remains genuinely frozen.
- Added fail-closed eligibility for explicit binding identity, runtime readiness, required modalities, context-window fit with 8192-token reserve, known cost class and optional cost ceiling.
- Added deterministic `COST_THEN_CONTEXT` and `CONTEXT_THEN_COST` selection with stable slot tie-breaking.
- Visual routing automatically requires image capability.
- Added sealed route evidence with request SHA-256, binding SHA-256/snapshot, policy SHA-256, candidate rejection reasons and selected model provenance.
- Route verification recomputes eligibility and selection, preventing a manipulated decision from becoming valid merely by rehashing it.
- Explicitly keeps provider diversity disabled/deferred to P3 and automatic fallback disabled/deferred to P4.
- Router never sets the final Judge outcome; the AleDevOS deterministic gate remains authoritative.
- Installer now projects the P2 router, all Multi-Model policies/templates/schemas and phase2 request/route state directories.
- Added 65 deterministic Multi-Model P2 tests.
- Next roadmap item: Multi-Model P3 â€” Judge Diversity.

# v1.34.0-multimodel-p1 â€” 2026-10-06

- Added adapter-independent Multi-Model registry with explicit `primary` and `secondary` Judge slots.
- Added target binding contract with provider/model identity, modalities, context-window metadata, cost class and separate runtime-readiness evidence.
- Added sealed Judge model evidence with immutable input/rubric SHA-256 and explicit provider/model provenance.
- Added deterministic pair comparison states `AGREE`, `DISAGREE` and `INCOMPLETE`; comparison never sets AleDevOS final state.
- Missing/unbound/unready secondary models fail closed and never fabricate consensus.
- Visual Judge evidence requires image capability for the selected model.
- Added package certificate with root-relative inputs and explicit target-runtime deferral.
- Installer now projects Multi-Model runtime/contracts into `.aledevos/multimodel/` without inventing target bindings.
- Added 54 deterministic Multi-Model P1 tests.
- Preserved router/diversity/fallback as separate later phases.
- Next roadmap item: Multi-Model P2 â€” Model Router.

# v1.33.0-portability-p6 â€” 2026-10-06

- Froze Portability P6: Cross-adapter Conformance + Portable Skill Pack.
- Added a normalized conformance matrix for OpenCode, Codex, Claude Code and Antigravity with 26 portable PASS/BLOCKED scenarios.
- Added Portable Skill Pack 1.0 with semantic SHA-256 equivalence across all 13 built-in Skills and all canonical adapters.
- Added generic sourceâ†’installed projection parity with 156 SHA-256 comparisons and tamper detection.
- Added sealed cross-adapter P6 certificate with root-relative inputs.
- Removed remaining OpenCode-specific control-plane names from Core security policy; adapter-native protected paths now stay in adapter project templates.
- Gemini remains an explicit ABI-locked alias to canonical Antigravity.
- Historical regression: 818/818 PASS; P6: 69/69 PASS; cumulative: 887/887 PASS.
- Next roadmap item: Multi-Model Phase 1 â€” Second Judge Model.

# v1.32.0 â€” Portability Phase 5 / Google Antigravity Adapter + Gemini Compatibility

- Unified the Google portability roadmap: Antigravity is the canonical Adapter ABI runtime; Gemini is an explicit deprecated compatibility/migration alias rather than a duplicate adapter implementation.
- Added native Antigravity `.agents/agents/`, `.agents/skills/` and `.agents/hooks.json` projection with deterministic `PreToolUse` governance.
- Added Antigravity permission overlay, protected control-plane boundaries, governed shell commands, network/external-path denial and dynamic-subagent denial.
- Added `antigravity-certifier.mjs` with sealed package certification, sourceâ†’installed parity, tamper detection and truthful target-runtime preflight.
- Extended Adapter ABI 2.0 with explicit alias metadata and fail-closed canonical-existence/capability-parity checks.
- Fixed Gemini installation canonicalization so Skill System and project metadata use `antigravity` end-to-end while preserving the alias manifest for auditability.
- Added 64 deterministic Portability P5 sabotage/conformance tests and 242/242 canonical Antigravity certification checks.
- Retained real CLI/auth/hooks/permissions/browser/native-image proof for later Master Validation; package certification does not fake target-runtime readiness.

# v1.31.0 â€” Portability Phase 4 / Claude Code Adapter

- Implemented Claude Code as Adapter ABI 2.0 runtime #3 without moving Claude-specific workflow logic into Core.
- Added project-native `.claude/settings.json`, 24 `.claude/agents/*.md` roles and 13 repository Skills under `.claude/skills`.
- Added fail-closed `dontAsk`, disabled bypass/auto modes, explicit role tool allowlists and protected control-plane write paths.
- Added deterministic `PreToolUse` Bash/PowerShell guard that permits only enumerated AleDevOS runtime commands and blocks arbitrary/read-only shell escapes.
- Denied WebFetch, WebSearch, generic MCP and built-in Explore/Plan agent expansion in the certified project policy.
- Added Claude sandbox defense-in-depth while explicitly preserving the native-Windows OS-sandbox limitation for target-runtime validation.
- Added Claude Skill discovery/binding/acquisition projection and adapter-owned Playwright provider.
- Added sealed Claude Code source/installed certifier, capability proof coverage, tamper detection and parity verification.
- Installer now projects Claude-native files for `-Adapter claude-code`; unsupported projections fail closed instead of falling back to OpenCode/Codex.
- Added 59 deterministic Portability P4 sabotage/conformance tests and 250/250 adapter certification checks.
- Target Claude CLI/auth/model/Chromium/native-image execution remains explicitly deferred target-machine evidence.

# v1.30.0 â€” Portability Phase 3 / Codex Adapter

- Implemented Codex as Adapter ABI 2.0 runtime #2; no Codex-specific workflow logic moved into Core.
- Added project-native `.codex/config.toml`, 24 `.codex/agents/*.toml` roles and 13 repository Skills under `.agents/skills`.
- Added read-only, product-writer and state-runner permission profiles with external filesystem/network fail-closed boundaries.
- Migrated to current `:workspace_roots` semantics and inline-table form; legacy `:project_roots` is rejected by certification.
- Disabled Code Mode, permission-request expansion and shell for non-state roles; state/evidence shell is confined to `.aledevos/state` writes and loopback-only binding.
- Added Codex Skill discovery/binding/acquisition projection and adapter-owned Playwright provider.
- Added sealed Codex source/installed certifier, capability proof coverage, tamper detection and parity verification.
- Installer now projects Codex-native files for `-Adapter codex`; unsupported projections fail closed instead of falling back to OpenCode.
- Added 54 deterministic Portability P3 sabotage/conformance tests plus TOML structural validation.
- Target Codex CLI/login/model/Chromium execution remains explicitly deferred target-machine evidence.

# v1.29.0 â€” Portability Phase 2 / OpenCode Adapter Certification

- Added adapter-owned OpenCode V2 certifier with 193 deterministic source checks.
- Explicitly pinned the reference adapter to the OpenCode V2 configuration dialect; V1/V2 permission syntax mixing fails closed.
- Added last-matching-rule permission evaluation for certification, including shell, network, external-directory and subagent defaults.
- Certified product-writer vs control-plane boundaries across all OpenCode agent roles.
- Certified narrow canonical gate/scope bindings, bounded two-repair behavior, ContextOS/Skill System/Visual QA/release bindings and adapter-owned Playwright provider presence.
- Added SHA-256 input-bound certification evidence and stale/tamper verification.
- Added source-layout â†” installed-layout parity verification for config, manifest, provider and every OpenCode agent definition.
- Installer now deploys the P2 certifier into `.aledevos/adapters/opencode/`.
- Added 41 deterministic Portability P2 tests with dialect, permission, security, tamper and parity sabotage cases.
- Cumulative validation: 641/641 deterministic PASS, 55/55 MJS syntax, 125/125 JSON parse, 0 failures.

# v1.28.0 â€” Portability Phase 1 / Adapter ABI + Capability Negotiation

- Added Adapter ABI 2.0 with deterministic manifest validation and SHA-256 identity.
- Added canonical 28-capability catalog and inherited compatibility profiles: `portable_core`, `uxui`, `visualqa`, `full_current`.
- Added portable adapter runtime with catalog, manifest, compatibility and installability commands.
- Upgraded OpenCode to a verified ABI manifest while preserving its existing capability truth.
- Added truthful ABI manifests for Codex, Claude Code, Gemini, Antigravity and Generic as non-installable scaffolds.
- Added fail-closed installability preflight so unsupported adapters cannot silently fall back to OpenCode.
- Added project-level adapter identity/contract version and installation of the selected ABI manifest/catalog/runtime.
- Added explicit separation between adapter implementation compatibility and target model/browser readiness.
- Added 30 deterministic Portability P1 tests, including tamper/downgrade/unknown-capability/scaffold-install rejection.
- Preserved the frozen Core, ContextOS, Skill System, UX/UI and Visual QA P1-P5 semantics.
- Portability P1 cumulative validation: 600/600 deterministic PASS, 54/54 MJS syntax, 124/124 JSON parse, 0 failures.

# v1.27.0 â€” V1 Release Candidate / Final Validation Harness

- Added a fail-closed eight-check AleDevOS V1 release gate; only a verified `V1_RELEASE_READY` authorizes the V1 freeze.
- Added target-runtime preflight for real Playwright/Chromium availability, Phase 4 runtime readiness, native-image Visual Judge model declaration and target security policy.
- Added SHA-256 sealed target-runtime evidence and sealed V1 release reports with artifact drift/tamper detection.
- Added strict browser-provider provenance (`ADAPTER_PROVIDER` vs `CONTROLLED_TEST_PROVIDER`) so controlled fixtures cannot impersonate real target evidence.
- Added dedicated read-only `v1-release-validator` role and Orchestrator delegation.
- Added disposable target-runtime fixture and Windows smoke harness for real P2 Chromium capture, P3 comparison, P4 runtime audit and security evidence.
- Added complete RC regression harness with deterministic floor 570 tests, 51 MJS syntax checks, 117 JSON parse checks and zero failures.
- Added final validation contracts for native-image P5 observation, repair-1 recovery, two-repair exhaustion/no-third-repair proof, and a full controlled real-project PASS.
- Preserved Visual QA P1-P5 frozen behavior and explicit non-claims for dynamic motion/frame quality and full WCAG conformance.

# v1.26.0 â€” Visual QA Phase 5

- Added sealed native-image Visual Judge packets and judgments over verified Phase 2/3/4 evidence.
- Added pinned holistic rubric dimensions for hierarchy, composition/alignment, spacing rhythm, typography/readability, color/brand cohesion, state clarity, responsive consistency and final polish.
- Added Core-side score/status recomputation: the judge cannot self-declare PASS; UNVERIFIED evidence fails closed to BLOCKED.
- Added actionable finding requirements for failed dimensions and blocking semantics for CRITICAL findings.
- Added revisioned visual evidence (`initial`, `repair-1`, `repair-2`) so repair cycles never overwrite prior screenshots/receipts.
- Added sealed bounded Visual Repair authorization/cycles integrated with the global two-repair cap.
- Added mandatory fresh P2 â†’ P3 â†’ P4 â†’ P5 evidence after every repair and stale-evidence rejection.
- Added historical pre-repair evidence integrity verification while retaining live verification for post-repair evidence.
- Added dedicated read-only `visual-judge` and `visual-repair-controller` agents plus narrowed Repairer/Verifier/Judge permissions.
- Added final sealed Visual QA acceptance with direct-pass and repaired-pass paths.
- Preserved strict prohibitions on automatic baseline promotion, scope expansion, canonical design-policy edits and self-approval.
- Preserved explicit non-claims for dynamic motion/frame quality and full WCAG conformance; target-runtime native-image/real-Chromium smoke remains a final environment validation.

# v1.25.0 â€” Visual QA Phase 4

- Added sealed rendered DOM/layout/accessibility runtime auditing from verified Phase 2 cases.
- Added ACTIVE canonical Accessibility/Responsive policy enforcement and named `WCAG_2_2_AA` runtime thresholds.
- Added deterministic horizontal overflow, focusable containment/clipping, keyboard reachability, focus visibility/obscuration, accessible-name, image-alt, target-size and measurable text-contrast checks.
- Added fail-closed handling for unsupported standards, critical scan truncation, unmeasurable required contrast, provider failure and redirect drift.
- Extended the adapter-owned Playwright provider with a narrow `audit()` operation.
- Added per-case SHA-256 evidence plus sealed PASS/FAIL/BLOCKED reports with drift/reclassification verification.
- Added dedicated `visual-runtime-audit-runner` and read-only verification permissions for Verifier/visual judges.
- Preserved explicit non-claims for full WCAG conformance, aesthetics, motion quality and final visual acceptance.

# v1.24.0 â€” Visual QA Phase 3

- Added immutable approval-gated visual baselines under `.aledevos/visualqa/baselines/`.
- Added portable deterministic PNG decoder/encoder and pixel regression engine.
- Added strict case-set and route/state/viewport contract matching before image comparison.
- Added named baseline-pinned tolerance profiles; arbitrary per-run numeric tolerance overrides are forbidden.
- Added pixel metrics, changed bounds, dimension mismatch handling and hashed diff PNG artifacts.
- Added sealed PASS / FAIL / BLOCKED visual-regression reports with drift/tamper verification.
- Added explicit supersede flow without silent coverage reduction.
- Added dedicated narrow Visual Regression Runner plus read-only verification permissions for judges/verifier.
- Preserved explicit non-claims for aesthetics, rendered layout and rendered accessibility.

# v1.23.0 â€” Visual QA Phase 2

- Added adapter-owned deterministic Browser Capture Runner.
- Added Chromium/Playwright reference provider for OpenCode with fail-closed provider doctor.
- Added exact viewport execution, isolated browser context per case, font readiness, reduced motion, animation freezing and bounded stabilization.
- Added non-default state readiness attestation and safe query/hash route suffixes without arbitrary JavaScript/interaction scripts.
- Added local dev-server readiness probing and redirect origin/path enforcement.
- Added automatic Phase 1 evidence sealing after browser capture and a separate SHA-256 sealed Phase 2 execution receipt.
- Added receipt verification against plan, execution spec, Phase 1 run and screenshot hashes.
- Added dedicated `visual-capture-runner` agent with narrow OpenCode permissions.
- Added Phase 2 schemas, template, Core contract, installer integration and deterministic tests.
- Preserved explicit non-claims: no visual-regression or aesthetic PASS in Phase 2.

# v1.22.0 â€” Visual QA Phase 1

- Added runtime-agnostic Visual QA capture contracts.
- Capture matrices use only ACTIVE canonical responsive viewports and explicit surface/state requests.
- Added loopback-only default capture target policy, deterministic artifact paths and state-contract checks.
- Added SHA-256 source, responsive-policy, plan, screenshot and run integrity verification.
- Added PNG signature validation and fail-closed drift/tamper detection.
- Added explicit non-claims: Phase 1 does not render, compare or judge UI quality.
- Added Visual QA Phase 1 agent discipline, installer wiring, schemas, templates and self-tests.

# Changelog

## v1.21.0-uxui-p6
### UX/UI System Phase 6 â€” Accessibility + Responsive + UI States + UI Decision Records
- Added project-canonical Accessibility Policy and Responsive Policy, both initialized truthfully as `UNSET` and approval-gated.
- Added task/surface-specific UI State Contracts with deterministic baseline states and reference-only evidence.
- Added immutable, integrity-sealed UI Decision Records (`UI-ADR-*`) with supersede-not-rewrite history.
- Added static fail-closed checks for obvious accessibility and responsive defects while preserving the boundary with rendered Visual QA.
- Added sealed Phase 6 UI Standards Reviews and source/policy drift detection.
- Upgraded UI change evidence schema to 1.1: visual tasks require a verified Phase 6 review; Guardian/Judge no longer need to trust self-declared readiness strings.
- Integrated Phase 6 runtime and narrow read-only OpenCode permissions for Design System Guardian / UXUI Judge.
- Added 32 deterministic Phase 6 tests. Cumulative suite target: 366/366 PASS.

## v1.20.0-uxui-p5
### UX/UI System Phase 5 â€” Motion Director + Motion Language
- Added read-only Motion Director in Core and OpenCode adapter.
- Added project-canonical, integrity-sealed Motion Language with explicit approval and no invented defaults.
- Added platform-aware on-demand motion Skill routing with Safe Acquisition for missing Skills.
- Added sealed Motion Plans, Motion Contracts and Motion Reviews.
- Added semantic duration/easing token enforcement, mandatory reduced-motion behavior, raw-literal guards and decorative infinite-loop blocking.
- Added Design Context/Motion Language drift detection and reference-only Skill evidence.
- Kept rendered smoothness/aesthetic judgment reserved for Visual QA.

## v1.19.0-uxui-p4
### UX/UI System Phase 4 â€” Design System Guardian + UX/UI Judge
- Added dedicated read-only Design System Guardian and UX/UI Judge roles.
- Added sealed UI change evidence, Guardian report and Judge report artifacts.
- Added deterministic Design Context and Component Registry integrity review.
- Added Reuse-Before-Create enforcement during visual review.
- Added canonical source drift and page-local fork blockers.
- Added canonical color/token bypass detection with explicit approved exceptions.
- Added deterministic 100-point UX/UI score with >=90 threshold, zero blockers and zero critical UNVERIFIED evidence.
- Kept rendered screenshot aesthetics explicitly out of Phase 4 and reserved for Visual QA.
- Added OpenCode adapter wiring, installer integration and 23 deterministic Phase 4 tests.
- Cumulative deterministic suite: 301/301 PASS.

## v1.18.0-uxui-p3
### UX/UI System Phase 3 â€” Design Genesis + Design System Discovery
- Added sealed project-mode-specific design workflow plans.
- Added GREENFIELD Design Genesis stages with on-demand specialist Skill routing.
- Added BROWNFIELD deterministic discovery before model/Skill interpretation.
- Added HYBRID preserve-audit-new-direction-consolidate workflow.
- Added bounded evidence scanning for components, CSS variables, colors, spacing, radii, shadows, typography, responsive breakpoints and motion declarations.
- Added Safe Acquisition policy for missing design Skills.
- Added approval-gated, hash-verified canonicalization of design evidence.
- Preserved Phase 2 Component Registry as the exclusive component canonicalization path.
- Added Phase 3 schemas, templates, Core contract, agent discipline, installer integration and deterministic tests.

## v1.17.0-uxui-p2
### UX/UI System Phase 2 â€” Component Registry + Reuse-Before-Create
- Added integrity-sealed canonical Component Registry runtime.
- Added deterministic candidate discovery with no auto-canonicalization.
- Added explicit bootstrap approval for existing discovered/design-system components.
- Added source SHA-256 drift detection and approved canonical sync.
- Added sealed reuse decisions: REUSE, EXTEND, justified CREATE, REVIEW and BLOCK outcomes.
- Added page-local fork prevention and canonical root enforcement for global reusable components.
- Added explicit domain-owned component support.
- Added prior creation-decision enforcement for newly registered reusable components.
- Linked registry mutations back into Design Context integrity.
- Added Phase 2 schemas, Core contract, agent discipline, installer integration and 30 deterministic tests.
- Cumulative deterministic suite: 259/259 PASS.

Earlier ContextOS, Skill System and UX/UI Phase 1 history remains preserved in prior release artifacts.
