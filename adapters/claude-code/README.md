# Claude Code adapter

Status: **implemented / installable / Portability P4 certified**.

Native projection:
- `.claude/settings.json` for project permissions, sandbox and deterministic PreToolUse shell guard.
- `.claude/agents/*.md` for the 24 canonical AleDevOS subagents.
- `.claude/skills/*/SKILL.md` for repository-native portable Skills.
- `.aledevos/adapters/claude-code/hooks/pretool-guard.mjs` as installed immutable shell guard.

Package certification does **not** certify the target Claude CLI/login/model/browser. Native Windows lacks Claude Code OS sandboxing; target validation must report that platform fact rather than pretending WSL2/macOS/Linux isolation exists. The adapter remains fail-closed for arbitrary shell through `dontAsk` + the PreToolUse guard.
