---
name: security-check
description: Perform a scoped security review for code touching auth, permissions, secrets, user input or sensitive data.
compatibility: OpenCode V2 adapter
metadata:
  system: aledevos-core-v1
---

# Security check

Review only relevant threat paths:
- authentication vs authorization;
- input validation/injection;
- secret exposure/logging;
- SSRF/path traversal/file access;
- XSS/HTML injection;
- privilege/RLS bypass;
- unsafe deserialization or command execution.

Report exploit path + affected boundary + minimum mitigation. Avoid generic checklist noise.
