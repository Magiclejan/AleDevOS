# Global Efficiency P7 — Minimum Necessary Intelligence

Status: **IMPLEMENTED / PACKAGE-CERTIFIED / TARGET BENCHMARK PENDING**

P7 is a transversal AleDevOS control layer. It does not replace Orchestrator, ContextOS, Skills, Model Router, workers, QA or Judges. It decides how much of the existing system should be activated for a task and then proves that the optimized execution preserved quality.

## Macro-skill efficiency invariant

AleDevOS is a portable macro-skill whose efficiency objective is to reduce unnecessary context, model calls, agent activation, tool use and output while preserving required quality. Auto-Telemetry provides the real per-agent token/runtime measurements needed to turn that objective into comparable evidence. A completed telemetry run proves measurement capability; only a matched baseline/candidate benchmark may prove actual savings.

Canonical identity contract: `docs/ALEDEVOS_MACRO_SKILL.md`.

## Governing principles

1. The user is the goal owner, not AleDevOS's project manager.
2. Use the minimum necessary intelligence without quality regression.
3. Required evidence, gates and security controls are never removed for token savings.
4. Unknown measurements remain unknown and cannot become an efficiency PASS.
5. Prefer closed decisions to free-form prose where the decision space is finite.
6. Prefer relevant context, delta handoffs and read-on-demand over repeated context.
7. Reasoning effort and specialist activation must match task risk.

## Adaptive profiles

- `MICRO`: small, low-risk, narrow work. Avoids Researcher/Architect/Auditor unless a signal requires them.
- `STANDARD`: normal feature/change work. Adds Researcher + Architect.
- `DEEP`: high-impact/cross-domain work. Adds Auditor and higher reasoning.
- `CRITICAL`: security-sensitive or migration/destructive work. Maximum safeguards; efficiency may never weaken controls.

Every code-changing profile still preserves the canonical Verifier and Requirements/Regression/Quality Judge path when Core requires them.

## Agent and Skill activation

The governor computes a sealed plan from the Task Contract and explicit efficiency signals. It chooses only the required agents, skills and reasoning level. A single-domain change prefers a scoped editor; cross-domain work uses Builder. UI, Visual QA, security and repair specialists activate only when their signals require them.

The user must not be asked to choose agents, skills, workers, test order or the next operational step. User intervention remains valid for product authority, credentials/secrets, irreversible actions and explicit policy exceptions.

## ACTL 1.0

AleDevOS Compact Technical Language (ACTL) applies controlled-technical-language principles without claiming ASD-STE100 compliance. It uses one canonical term per concept, direct instructions, references unchanged evidence by ID/hash and avoids repeating tool output. Required evidence can exceed response budgets.

## Closed decision contracts

Finite decisions use constrained outputs such as `TASK_PROFILE`, `BOOLEAN_NEED`, `ROUTING_ACTION` and `EFFICIENCY_RESULT`. Free-form explanation fields are rejected for these contracts.

## Benchmark and quality preservation

P7 compares a baseline run with an optimized candidate using the same task/benchmark key. PASS requires real measurements for:

- input tokens;
- output tokens;
- total tokens;
- context peak;
- tool calls;
- files read;
- handoff tokens;
- model calls;
- active agents.

Profile-specific targets bound token reduction and growth in context/tool/model/agent/file/handoff work. A token reduction cannot compensate for quality loss.

Quality preservation requires candidate final state `PASS`, canonical deterministic gates PASS, all three core Judges >=90, no new blockers/unverified criteria, all acceptance criteria verified and no increase in repairs. Judge average may not regress beyond the pinned tolerance.

## Tamper resistance

Plans and benchmark receipts are SHA-256 sealed. Verification recomputes plan semantics from Task Contract + signals and benchmark semantics from the source baseline/candidate artifacts. Rehashing a manipulated receipt or plan does not make it valid.

## Master Validation checks

P7 owns exactly:

- `adaptive_execution_governor_real`
- `context_token_efficiency_real`
- `quality_preservation_real`
- `user_project_manager_independence_real`

Target evidence is collected with `scripts/63-master-validation-p7-target-efficiency.ps1`. `-InventoryOnly` never declares PASS.

P8 Security & Reliability is an explicit fail-closed successor. P7 has no authority to freeze V1.
