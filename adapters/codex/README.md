# Codex adapter — Portability Phase 3

Status: **implemented / installable**.

This adapter maps AleDevOS Adapter ABI 2.0 onto current Codex project primitives:

- project config: `.codex/config.toml`
- custom agent roles: `.codex/agents/*.toml`
- repository skills: `.agents/skills/*/SKILL.md`
- native multi-agent role declarations through `[agents.<role>]`
- filesystem/network permission profiles through `default_permissions` / `[permissions.*]`
- `approval_policy = "never"` so an AleDevOS role cannot approve its own sandbox escape
- Code Mode and permission-request tools disabled for AleDevOS roles
- adapter-owned Playwright provider for Visual QA P2/P4

## Security model

Three native Codex permission profiles are used:

1. `aledevos_readonly` — workspace readable, external filesystem denied, no writes, no network.
2. `aledevos_writer` — workspace product writes, but `.aledevos`, `.codex`, `.agents`, `AGENTS*` and `.git` remain read-only; external filesystem is denied.
3. `aledevos_state_runner` — workspace readable; only `.aledevos/state` is writable. External filesystem/network remain denied; loopback binding is allowed for local browser/server evidence.

The adapter uses the current `:workspace_roots` permission token with inline-table syntax. Writers have `shell_tool = false`. State/evidence roles may use shell, but only inside the state-runner filesystem/network sandbox. This is the Codex projection of AleDevOS `arbitrary_shell_deny`: shell is never unrestricted.

## Runtime truthfulness

Portability P3 certifies the adapter files and mappings. It does **not** claim that the target machine already has Codex CLI, authentication, Playwright/Chromium, or a native-image-capable selected model. Those remain target-runtime preflight evidence.

Codex upstream changes quickly; P3 pins the expected configuration surface in the adapter certificate. Drift requires recertification.
