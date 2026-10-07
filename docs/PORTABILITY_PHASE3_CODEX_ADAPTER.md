# Portability Phase 3 — Codex Adapter

Status: **COMPLETE / FROZEN** in v1.30.

## Purpose

Portability P3 turns the Codex entry from an ABI scaffold into an implemented, installable AleDevOS adapter without moving Codex-specific behavior into Core.

The Codex projection is native to the runtime surface used by this adapter:

- project configuration: `.codex/config.toml`
- custom roles: `.codex/agents/*.toml`
- repository skills: `.agents/skills/<skill>/SKILL.md`
- adapter-owned Visual QA provider: `adapters/codex/visualqa/`
- portable AleDevOS engines remain under `.aledevos/` after installation

## Permission model

P3 defines three adapter permission profiles:

1. `aledevos_readonly`: repository read access, no filesystem writes, no network.
2. `aledevos_writer`: product writes, while `.aledevos/**`, `.codex/**`, `.agents/**`, `AGENTS.md`, `AGENTS.override.md` and `.git/**` remain read-only. The broader `AGENTS.*` protection remains enforced by the AleDevOS control-plane guard, because Codex permission profiles do not support read access on arbitrary glob file paths.
3. `aledevos_state_runner`: repository read access plus writes only under `.aledevos/state/**`; external network stays disabled while loopback binding is allowed for controlled runtime evidence.

Writer/read-only roles have shell disabled. State/evidence roles may use shell only inside the state-runner sandbox. Code Mode and model-driven permission expansion are disabled for every AleDevOS Codex role.

## Certification

`adapters/codex/certification/codex-certifier.mjs` validates source and installed layouts, role/profile boundaries, skills, portable subsystem bindings, capability proofs, source-to-installed parity and sealed SHA-256 evidence.

A package certificate proves the checked adapter files and portable bindings are internally coherent. **It does not certify target-runtime readiness.** Codex CLI installation, authentication, selected-model behavior, native-image observation, Chromium/Playwright availability and real end-to-end execution remain target-machine evidence for the later Master Validation stage.

This distinction is deliberate: `CODEX_ADAPTER_CERTIFIED` must never be interpreted as `TARGET_RUNTIME_READY`.

## Scope boundary

`scope_prewrite` remains `best_effort`, not `enforced`. P3 provides strong static product/control-plane permission boundaries plus the portable deterministic scope prepass, but does not claim that Codex dynamically narrows writable product paths to an arbitrary task-specific file list before every write.

## Installation

`scripts/05-install-into-project.ps1 -Adapter codex` projects Codex-native files instead of OpenCode files. Unsupported adapter projections fail closed; there is no silent fallback to OpenCode.

## Next

After P3 is frozen, Portability P4 implements and certifies the Claude Code adapter against the same Adapter ABI 2.0 profiles.
