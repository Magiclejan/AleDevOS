# Portability Phase 5 — Google Antigravity Adapter + Gemini Compatibility

Status: **COMPLETE / FROZEN** in v1.32.

## Decision

AleDevOS treats current Google agent tooling as one adapter family. `antigravity` is canonical. `gemini` is a deprecated compatibility/migration alias whose ABI capabilities must remain identical to Antigravity. There is no duplicate Gemini implementation.

## Native projection

- custom agents: `.agents/agents/*.md`
- portable Skills: `.agents/skills/*/SKILL.md`
- workspace hooks: `.agents/hooks.json`
- deterministic tool guard: `.aledevos/adapters/antigravity/hooks/pretool-guard.mjs`
- permissions overlay: `.aledevos/adapters/antigravity/aledevos-permissions.overlay.json`
- browser provider: `.aledevos/visualqa/providers/playwright-driver.mjs`

## Security model

The package combines native role tool allowlists, workspace PreToolUse governance, reviewed permission defaults, protected control-plane paths and deterministic AleDevOS runtime commands. Product writers have no shell/subagent delegation. Only the orchestrator receives `invoke_subagent`. Dynamic `define_subagent`, direct network/browser tools, external workspace access and control-plane writes are denied by the certified projection.

Because Antigravity workspace-hook and permission behavior has varied by OS/auth/version, package certification never substitutes for target runtime validation. The runtime preflight therefore reports CLI presence as present-but-uncertified until active probes establish effective behavior.

## Alias invariants

`gemini` must:
- declare `alias_of: antigravity`;
- remain `deprecated_alias: true`;
- point to an existing non-alias canonical adapter;
- have identical capability semantics and lifecycle/installability;
- be explicitly canonicalized by the installer.

Any capability drift invalidates the alias manifest.

## Certification

Canonical command:

```text
node adapters/antigravity/certification/antigravity-certifier.mjs certify run --root .
```

P5 also validates source→installed parity, certificate freshness, role/Skill/hook tamper detection, permission-overlay tamper, alias drift and truthful runtime preflight.

## Boundary

P5 does not claim real Antigravity CLI authentication, selected model behavior, active hook execution on the target OS/auth combination, native-image observation or Playwright/Chromium target readiness. Those remain Master Validation evidence.

## Next

Portability P6 — Cross-adapter Conformance + Portable Skill Pack.
