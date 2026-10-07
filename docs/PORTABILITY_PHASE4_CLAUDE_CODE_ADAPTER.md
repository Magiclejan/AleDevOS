# Portability Phase 4 — Claude Code Adapter

Status: **COMPLETE / FROZEN** in v1.31.

## Objective

Implement Claude Code as the third first-class AleDevOS Adapter ABI 2.0 runtime projection without moving Claude-specific workflow semantics into Core.

## Native projection

Claude Code is projected through its own repository-native surfaces:

- `.claude/settings.json` — project permissions, sandbox defense-in-depth and `PreToolUse` hook wiring.
- `.claude/agents/*.md` — 24 canonical AleDevOS subagents using Claude Code frontmatter.
- `.claude/skills/*/SKILL.md` — 13 repository-native portable Skills.
- `.aledevos/adapters/claude-code/hooks/pretool-guard.mjs` — installed deterministic shell guard.
- adapter-owned Playwright provider for Visual QA.

No OpenCode or Codex configuration is used as a hidden fallback.

## Permission model

The adapter is fail-closed around four independent boundaries:

1. `permissions.defaultMode = dontAsk` prevents unapproved tool calls from turning into interactive permission expansion.
2. bypass/auto permission modes are disabled at project level.
3. every subagent has an explicit tool allowlist; writer roles do not receive shell tools, and only the orchestrator receives the `Agent` tool.
4. `PreToolUse` deterministically rejects Bash/PowerShell unless the command matches an enumerated AleDevOS runtime entrypoint.

Global project denies cover:

- `WebFetch`
- `WebSearch`
- generic MCP access
- built-in `Explore` / `Plan` agents
- writes to `.aledevos/**`, `.claude/**`, `CLAUDE.md`, `CLAUDE.*` and `.git/**`

Claude Code OS sandboxing is enabled as defense in depth where the platform supports it. Package certification does not pretend that native Windows provides the same OS sandbox as macOS/Linux/WSL2; runtime preflight reports that distinction explicitly.

## Role classes

### Product writers

`builder`, `editor-*` and `repairer` use `acceptEdits` and receive only repository read/write tools plus Skills. They do not receive Bash/PowerShell or subagent delegation.

### State / verification roles

The orchestrator, verifier, judges and Visual QA state runners use `dontAsk`. Narrow Bash/PowerShell access is still subject to the deterministic PreToolUse allowlist and is intended only for canonical AleDevOS runtime commands.

### Read-only roles

Architectural/research/audit roles receive repository read/search tools plus Skills and no write or shell tools.

## Portable Skills

Thirteen portable Skills are projected under `.claude/skills/`:

- backend-change
- database-change
- diff-review
- frontend-change
- implementation-plan
- regression-analysis
- repair-loop
- repo-map
- requirements-check
- safe-edit
- security-check
- task-contract
- test-strategy

Skill binding, discovery and acquisition remain governed by the frozen Skill System contracts.

## Certification

The adapter-owned certifier supports:

```text
certify run
certify verify
parity verify
runtime preflight
```

The frozen source adapter result is:

```text
CLAUDE_CODE_ADAPTER_CERTIFIED
250 / 250 checks PASS
```

The P4 sabotage/conformance suite is:

```text
59 / 59 PASS
```

The certificate is SHA-256-bound to settings, hook, manifest, provider, project template, Skill System projections, Core runtimes, all 24 role definitions and all 13 Skill definitions. Post-certification drift produces a stale/tampered result.

## Source → installed parity

`-Adapter claude-code` projects only Claude-native files and the portable AleDevOS runtime. The P4 suite proves source/installed parity and detects drift in settings, roles, Skills and hook code.

## Adapter vs target runtime

P4 certifies the package projection. It does **not** claim target-machine readiness for:

- Claude Code CLI installation;
- authentication;
- chosen model behavior;
- native-image Visual Judge observation;
- real Playwright/Chromium execution;
- native Windows OS sandboxing.

Those are later Master Validation evidence. The runtime preflight must fail/block/report limitations truthfully rather than upgrading package certification into runtime certification.

## Frozen boundary

Portability P4 may be considered complete only while all of the following remain true:

- Adapter ABI `full_current` = `26/26 PASS`.
- adapter is `implemented` and installable.
- P4 deterministic suite = `59/59 PASS`.
- adapter certificate = `250/250 PASS` and fresh.
- source→installed parity passes.
- no silent fallback to OpenCode or Codex exists.
