---
name: regression-analysis
description: Trace blast radius and likely regressions for a proposed or completed change.
compatibility: AleDevOS Core
metadata:
  system: aledevos-core-v1
---

# Regression analysis

1. Identify changed public/internal contracts.
2. Locate all known consumers/callers.
3. Check persistence/state compatibility.
4. Check error/empty/loading/permission states where applicable.
5. Map each material risk to a test or verification step.

Risk without a plausible path is noise; plausible paths without verification stay open.
