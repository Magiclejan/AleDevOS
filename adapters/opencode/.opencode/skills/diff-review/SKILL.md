---
name: diff-review
description: Review the actual Git diff for scope, accidental edits, security and maintainability risks.
compatibility: OpenCode V2 adapter
metadata:
  system: aledevos-core-v1
---

# Diff review

Inspect `git diff` and changed-file context.
Check:
- unrelated files/format churn;
- accidental removals;
- contract/schema changes;
- hard-coded secrets or environment assumptions;
- duplicated logic;
- missing error handling;
- test modifications that reduce coverage.

Report only actionable findings with file/symbol evidence.
