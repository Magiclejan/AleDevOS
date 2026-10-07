# Portability / Adapter ABI

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
