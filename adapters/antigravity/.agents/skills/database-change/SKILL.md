---
name: database-change
description: Plan and implement database changes with migration, compatibility and data-integrity safeguards.
compatibility: AleDevOS Core
metadata:
  system: aledevos-core-v1
---

# Database change checklist

Before editing, identify source-of-truth schema/migration system and existing policies.
Check nullability, defaults, constraints, indexes, RLS/authorization and backwards compatibility.
Prefer additive/reversible migration steps.
Never destroy production/user data as part of an automated repair.
Validate generated types if the project uses them.
