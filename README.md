# AleDevOS

**Visual QA Phase 4: Rendered Layout/A11y Runtime Checks COMPLETE / FROZEN** — deterministic checks cover rendered layout, focus, contrast and accessibility measurements; this does not certify aesthetics, native-image judgment or full WCAG compliance.

**Visual QA Phase 5: Semantic/Aesthetic Judge Control Plane COMPLETE / FROZEN (package implementation only).** Runtime aesthetic evaluation remains BLOCKED/UNVERIFIED without an actual native-image-capable model, current P2–P4 receipts and observed image evidence. A completed deterministic P34 smoke does not certify P5, aesthetics, full WCAG conformance or V1 release.

> **A portable AI macro-skill for software engineering.**

AleDevOS is a reusable operating layer for AI-assisted software engineering. It provides orchestration, relevant-context selection, specialized agents, reusable Skills, deterministic gates, bounded repair, security/reliability controls and real efficiency telemetry without coupling its Core to a specific model or provider.

```text
User goal
   |
   v
AleDevOS
   |-- ContextOS
   |-- Skill System
   |-- Specialized Agents
   |-- Deterministic Gates / Judges / Repair
   |-- Efficiency Governor
   |-- Auto-Telemetry
   |
   v
Adapter ABI
   |-- Codex
   |-- Claude Code
   |-- OpenCode
   |-- Google Antigravity
   `-- future adapters
   |
   v
External runtime / provider / model
```

The Core never owns the runtime, provider or model. Adapters project the same AleDevOS contracts into supported AI runtimes.

## Install AleDevOS

### Windows — one button

Clone or download the repository, then double-click:

```text
START_ALEDEVOS.bat
```

This is the **only user-facing Windows launcher** in the repository.

Choose **1. INICIAR ALEDEVOS**. On first use it asks for a project and adapter, installs AleDevOS into that project if necessary, then opens the selected external runtime.

Opening the launcher by itself does not silently modify projects. Installation happens when you choose **INICIAR ALEDEVOS** or the explicit install/update action.

### Windows — CLI

From the canonical AleDevOS checkout, install the `aledevos` command once:

```powershell
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\repo-tools\INSTALL_CLI.ps1
```

Open a new terminal. Inside any project:

```powershell
aledevos start -Adapter codex
```

Or point to another path:

```powershell
aledevos start "C:\Projects\MyProject" -Adapter codex
```

`aledevos start` is **install-on-first-use**: if the selected adapter projection is not installed in that project, AleDevOS installs it first and then launches the external runtime.

If you only want to install without launching the runtime:

```powershell
aledevos init -Adapter codex
```

To update installed AleDevOS projections:

```powershell
aledevos update
```

Supported adapter names:

```text
codex
claude-code
opencode
antigravity
```

`gemini` is a compatibility alias for the canonical Antigravity adapter.

> AleDevOS installs its operating layer into the project. The external runtime CLI itself must already be installed and authenticated separately.

## Project support

AleDevOS onboarding is intentionally independent from Git.

| Project state | Supported | Behavior |
| --- | --- | --- |
| New path / empty project | **Yes** | Creates the folder when needed and installs AleDevOS. It does **not** run `git init`. |
| Existing project without Git | **Yes** | Installs alongside existing code without requiring Git. |
| Existing Git repository | **Yes** | Installs alongside the repository and enables Git-dependent capabilities when their own safety preconditions pass. |
| Existing AleDevOS project | **Yes** | Reuses installed adapters or updates them explicitly. |

A successful project installation is represented by `.aledevos/project.json` plus the selected adapter projection/Skill Registry.

Git is optional for the AleDevOS Core. Features that fundamentally require Git—such as isolated Git worktrees—remain unavailable until the project itself uses Git; AleDevOS never initializes Git behind the user's back.

## What gets installed into a project

The installer projects the selected adapter plus shared AleDevOS runtime assets into the target project. Typical surfaces include:

```text
.aledevos/
  runtime/
  contextos/
  skillsystem/
  efficiency/
  security-reliability/
  execution/
  state/
  project.json

<adapter-specific projection>
  .codex/
  .claude/
  .opencode/
  .agents/
  ...
```

AleDevOS-managed state and telemetry live under `.aledevos/state/`. Raw prompts, completions and secrets are not part of the telemetry contract.

## Token efficiency is a product requirement

AleDevOS is designed to reduce unnecessary context, agent activation, handoff volume and model calls **without reducing required quality**. Savings are claimed only from comparable runs with verified telemetry and preserved acceptance criteria.

Validated benchmark evidence:

| Benchmark | Scope | Median total-token reduction | Quality | Repetitions |
| --- | --- | ---: | --- | ---: |
| **B1 Context Efficiency** | controlled full vs relevant context | **50.67%** | preserved | 3 pairs |
| **B2 Macro-Orchestration Efficiency** | broad pipeline vs P7 MICRO | **77.24%** | preserved | 3 pairs |
| **B3 Real Project Repository Efficiency** | broad real-repo context vs targeted retrieval | **74.49%** | preserved | 3 pairs |
| **B4 Real Software-Engineering E2E** | real verified code edit | **72.40%** | preserved | 3 pairs |

These are benchmark-specific results, not a universal savings promise.

Canonical benchmark evidence:

- `docs/benchmarks/B1_CONTEXT_EFFICIENCY.md`
- `docs/benchmarks/B2_MACRO_ORCHESTRATION_EFFICIENCY.md`
- `docs/benchmarks/B3_REAL_PROJECT_REPOSITORY_EFFICIENCY.md`
- `docs/benchmarks/B4_REAL_SOFTWARE_ENGINEERING_E2E.md`

## Core invariants

1. AleDevOS is a macro-skill / operating layer, not an AI model.
2. The user owns the goal; AleDevOS owns orchestration.
3. Core is runtime/provider/model agnostic.
4. Adapters are replaceable projections, never Core dependencies.
5. Relevant context beats maximum context.
6. Use the minimum necessary intelligence that preserves quality.
7. No efficiency PASS without comparable measurements.
8. No quality reduction in exchange for token savings.
9. No deterministic PASS without evidence.
10. Git and other optional execution capabilities may enhance AleDevOS but do not define installation readiness.

## Portability status

The architecture and Core contracts are platform-neutral. Windows is the currently exercised host for the real installation/E2E evidence in this repository. macOS remains a target-by-design and should not be described as target-certified until its own real-target validation is complete.

## Advanced / maintainers

The simple product surface is intentionally small:

```text
START_ALEDEVOS.bat
aledevos start
aledevos init
aledevos update
```

Internal validators, benchmark runners and phase-specific tools remain under `scripts/`, `tests/`, `release/` and subsystem directories. They are not separate user entrypoints.

For implementation history and release changes, see `CHANGELOG.md`. For the short onboarding flow, see `QUICKSTART.md`.

Canonical identity contract: `docs/ALEDEVOS_MACRO_SKILL.md`.
