---
name: test-strategy
description: Design tests that prove the requested behavior and catch regressions without weakening existing coverage.
compatibility: OpenCode V2 adapter
metadata:
  system: aledevos-core-v1
---

# Test strategy

Choose the lowest test layer that proves the behavior, then add higher-level coverage only where integration matters.

For bugs, prefer a regression test that fails on the old behavior.
For features, cover happy path + material edge/error path.
Never use skip/todo or weakened assertions as completion.
Distinguish source defects from environment/setup failures with evidence.
