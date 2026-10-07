---
name: repair-loop
description: Repair failed verifier/judge gates without expanding scope.
compatibility: AleDevOS Core
metadata:
  system: aledevos-core-v1
---

# Repair loop

Input must be concrete failed gates.
For each failure:
1. reproduce/inspect;
2. identify root cause;
3. make minimum fix;
4. run focused check;
5. return to full verifier.

Maximum two automated repair cycles before escalating unresolved evidence.
