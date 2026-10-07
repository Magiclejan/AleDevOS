# Portability / Adapter ABI

## Macro-skill portability invariant

AleDevOS is a portable AI macro-skill. The Core is not owned by any runtime, provider, model or host OS. An AI runtime participates only through a truthful Adapter ABI implementation. "Any AI" therefore means any runtime that can satisfy the ABI and required AleDevOS semantics; unsupported capabilities must remain explicit rather than being faked.

Host portability follows the same rule: platform-specific launch/install mechanics live at the host/adapter boundary. Windows has current real-target evidence; macOS is a target platform by design and requires its own real-target campaign before target certification.

Canonical identity contract: `docs/ALEDEVOS_MACRO_SKILL.md`.

Every supported runtime is represented by a truthful Adapter ABI 2.0 manifest. Core evaluates capabilities without runtime-specific workflow branches.

## Phase map

1. Adapter ABI + Capability Negotiation — COMPLETE / FROZEN in v1.28.
2. OpenCode Adapter Certification — COMPLETE / FROZEN in v1.29.
3. Codex Adapter — COMPLETE / FROZEN in v1.30.
4. Claude Code Adapter — COMPLETE / FROZEN in v1.31.
5. Google Antigravity Adapter + Gemini compatibility alias — COMPLETE / FROZEN in v1.32.
6. Cross-adapter Conformance + Portable Skill Pack — **COMPLETE / FROZEN in v1.33.**

## Canonical adapters

- **OpenCode** — certified reference adapter.
- **Codex** — native `.codex/` projection and repository Skills.
- **Claude Code** — native `.claude/` projection with deterministic PreToolUse governance.
- **Google Antigravity** — native `.agents/` projection and workspace hooks.

`gemini` is an explicit compatibility/migration alias to canonical `antigravity`, not a fifth independent runtime.

## P6 conformance rule

The four canonical adapters must preserve the same portable security and workflow outcomes while remaining truthful about runtime-specific enforcement differences. The Portable Skill Pack proves semantic equivalence of all 13 built-in Skills, while raw adapter projections remain independently sealed.

Adapters map capabilities; they do not redefine Core workflows. Missing enforcement remains `best_effort`/`unsupported`. **No adapter may silently weaken Core or silently fall back to another runtime identity.**

Target runtime readiness remains separate from package certification for every adapter.

## Next roadmap family

Portability is closed. Multi-Model P1 is now frozen in v1.34. Next: **Multi-Model P2 — Model Router**, followed by Judge diversity and Model fallback.
