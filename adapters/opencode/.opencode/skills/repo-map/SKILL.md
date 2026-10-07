---
name: repo-map
description: Map the relevant repository area before planning or editing.
compatibility: OpenCode V2 adapter
metadata:
  system: aledevos-core-v1
---

# Repository mapping workflow

1. Read `AGENTS.md` and the closest package/module instructions.
2. Locate entry points, source-of-truth modules, tests, types/schemas and configuration tied to the request.
3. Trace callers and downstream consumers for the behavior being changed.
4. Identify generated files or vendored code that must not be edited.
5. Return a compact map: `request -> entry -> core logic -> persistence/external -> tests`.

Never infer a contract from a filename alone.
