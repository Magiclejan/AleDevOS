---
name: frontend-change
description: Implement frontend/UI changes with state, accessibility and regression discipline.
compatibility: OpenCode V2 adapter
metadata:
  system: aledevos-core-v1
---

# Frontend change checklist

Verify component ownership, state source, loading/empty/error states, responsive behavior if relevant, accessibility semantics, and existing design-system usage.
Avoid one-off styling when the project already has reusable primitives.
Add/update component or E2E tests for behavior that can regress.
