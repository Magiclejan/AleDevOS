---
name: backend-change
description: Implement backend/service/API changes with contract and failure-mode discipline.
compatibility: AleDevOS Core
metadata:
  system: aledevos-core-v1
---

# Backend change checklist

Trace request -> validation -> service/domain -> persistence/external -> response.
Preserve status/error contracts unless explicitly changed.
Check authorization, idempotency/concurrency where relevant, and transactional boundaries.
Tests should cover the public behavior rather than only private helpers.
