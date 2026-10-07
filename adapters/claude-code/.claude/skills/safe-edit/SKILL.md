---
name: safe-edit
description: Apply minimal code edits while protecting user data, Git history and existing behavior.
compatibility: Claude Code project skill
metadata:
  system: aledevos-core-v1
---

# Safe edit rules

- Read the target and adjacent callers before editing.
- Keep the diff narrow.
- Never `git reset --hard`, `git clean`, force-push, publish or deploy.
- Never delete/migrate user data unless explicitly required and planned.
- No silent fallbacks that hide errors.
- No placeholders or fake green paths.
- Do not reformat unrelated files.
- After each coherent slice, run a focused non-destructive check.
