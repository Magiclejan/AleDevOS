---
name: implementation-plan
description: Create the smallest safe implementation plan grounded in repository evidence.
compatibility: AleDevOS Core
metadata:
  system: aledevos-core-v1
---

# Implementation plan

For every planned edit, state:
1. location/module;
2. behavioral change;
3. why this location owns the behavior;
4. contract preserved/changed;
5. test proving it.

Prefer modifying existing seams over adding parallel architecture. Separate required work from optional cleanup.
