---
name: requirements-check
description: Verify every acceptance criterion against code and test evidence.
compatibility: AleDevOS Core
metadata:
  system: aledevos-core-v1
---

# Requirements check

Create one row per acceptance criterion:
`criterion | evidence | status (VERIFIED/FAILED/UNVERIFIED)`.

Do not use implementation intent as evidence. Critical UNVERIFIED criteria block completion.
