# AleDevOS Macro-Skill Contract

Status: **CANONICAL IDENTITY / ARCHITECTURAL INVARIANT**

## Definition

AleDevOS is a **portable macro-skill / AI software-engineering operating layer**.

It is a reusable system of contracts, agents, Skills, context management, deterministic verification, quality control, repair, portability and observability that can be projected into different AI runtimes without binding its Core to a specific model, provider or vendor.

AleDevOS is not:

- a model;
- a provider;
- a model server;
- an IDE;
- a single prompt;
- a wrapper around one AI product;
- a project-specific backend.

## Runtime model

```text
User goal
  -> AleDevOS Core
     -> ContextOS / Skills / Agents / Gates / Judges / Efficiency / Telemetry
        -> Adapter ABI
           -> runtime-native adapter
              -> external provider/model
```

The runtime/provider/model is outside the AleDevOS Core trust and ownership boundary.

## "Any AI" rule

"Usable with any AI" means:

> Any AI runtime can integrate with AleDevOS when an adapter truthfully implements the Adapter ABI and preserves required AleDevOS semantics.

Current canonical adapters:

- OpenCode
- Codex
- Claude Code
- Google Antigravity

New adapters may be added without introducing runtime-specific branches into Core.

An adapter may expose unsupported or best-effort capabilities when the target runtime cannot enforce a Core capability. It may never silently claim equivalence that is not proven.

## Operating-system portability

AleDevOS Core artifacts and contracts are designed to be host-portable.

The host OS is an execution concern, not a Core identity.

Current evidence:

- Windows: real target execution exercised.
- macOS: target platform by design; real-target validation is still required before claiming macOS target certification.

Platform-specific launchers or installers belong at the adapter/host boundary. Platform-specific behavior must not leak into universal Core semantics.

## Efficiency invariant

AleDevOS must reduce unnecessary AI work while preserving required quality.

The governing principle is:

> **Minimum Necessary Intelligence.**

Optimization surfaces include:

- context selection and budgets;
- diff-first reads;
- de-duplication;
- compact structured handoffs;
- checkpoints and resume;
- persistent knowledge maps;
- cache reuse;
- selective agent activation;
- selective Skill activation;
- reasoning-profile selection;
- model routing;
- bounded fallback;
- tool/file-read minimization;
- concise closed decisions;
- output discipline.

Security, deterministic gates, required evidence, acceptance criteria and quality requirements may never be removed merely to save tokens.

## Token claims

AleDevOS distinguishes **designed efficiency** from **measured savings**.

A token-saving claim requires comparable baseline and optimized runs under the same benchmark key with:

- real input/output token measurements;
- comparable task scope;
- preserved final PASS;
- required gates PASS;
- preserved acceptance criteria;
- preserved Judge quality;
- no new blockers;
- no increase in repair behavior beyond policy.

Missing measurements remain unknown.

No percentage savings may be invented from prompt size, context estimates or anecdotal runs.

## Auto-Telemetry role

Auto-Telemetry is the measurement substrate for this contract.

It records safe structured metrics such as:

- input tokens;
- output tokens;
- duration;
- tool calls;
- files read;
- adapter;
- agent;
- model identity when reported;
- call status;
- metric provenance.

It must not persist raw prompts, completions, transcripts, source file contents or secrets.

The real Codex V2 E2E demonstrated:

- completed real agent/model call;
- reported input/output tokens;
- measured duration;
- verified telemetry event chain;
- verified summary integrity.

That proof establishes trustworthy measurement. It does not by itself establish a token-reduction percentage.

## Non-negotiable boundaries

1. Core must remain provider-neutral.
2. Core must remain model-neutral.
3. Core must remain runtime-neutral.
4. Foreign/project-specific backends must never become AleDevOS dependencies.
5. Runtime adapters may not redefine Core policy.
6. Host-specific launch mechanics may not redefine Core semantics.
7. Token optimization may not weaken quality or safety.
8. Unknown measurements may not be fabricated.
9. Target readiness must be proven separately for each runtime/platform.
10. The user provides goals and authority; AleDevOS manages operational orchestration.

## North Star

AleDevOS should make a project:

- easier to resume;
- cheaper to understand;
- cheaper to change;
- safer to modify;
- more deterministic to validate;
- more portable across AI runtimes;
- more efficient as project knowledge accumulates.

The system should become **less wasteful as the project grows**, not more.
