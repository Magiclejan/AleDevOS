# ContextOS Phase 5 — Validation

Status: **PASS / FROZEN FOR PHASE 5 SCOPE**

Phase 5 scope is intentionally limited to:
- Incremental Knowledge refresh
- Freshness detection
- Source-aware invalidation
- Research Cache

It does **not** implement Phase 6 telemetry/observability.

## Deterministic guarantees validated

1. Every persistent map snapshot includes an exact SHA-256 file inventory.
2. Freshness is computed from current workspace bytes, not timestamps or model judgement.
3. Freshness returns explicit `FRESH`, `STALE` or `UNKNOWN` states.
4. Added, changed and deleted paths are classified deterministically.
5. Incremental refresh reparses only changed/added source/test files.
6. Unchanged parse entries are reused only when exact source SHA-256 matches.
7. An unchanged refresh is a no-op and does not rewrite the manifest.
8. Deleted domains/files cannot survive an atomic refresh as stale map artifacts.
9. Research cache entries are bound to exact source paths and hashes.
10. Source drift makes research stale immediately, even before map refresh.
11. Map refresh proactively invalidates research entries bound to changed/deleted sources.
12. Unrelated source changes do not invalidate unaffected research entries.
13. TTL expiration makes cached research non-usable.
14. Stale cache results are not returned as usable content.
15. Transcript/message/raw-conversation payloads are rejected from research cache.
16. Research cache integrity is SHA-256 sealed; tampering is detected.
17. Manual invalidation is supported for decision/semantic changes not represented by source bytes.
18. Research cache survives knowledge refresh/build snapshot swaps.
19. Core and OpenCode agents require freshness-before-use discipline.
20. Phase 5 preserves all earlier ContextOS and AleDevOS Core tests.

## Test result

```text
AleDevOS Core              8/8   PASS
ContextOS Phase 1         10/10  PASS
ContextOS Phase 2         12/12  PASS
ContextOS Phase 3         16/16  PASS
ContextOS Phase 4         17/17  PASS
ContextOS Phase 5         18/18  PASS
──────────────────────────────────
TOTAL                     81/81  PASS
```

## Important boundary

Incremental means **incremental parsing/semantic extraction**, not zero-cost freshness checks. Phase 5 still hashes relevant candidate files to establish exact byte freshness. A future runtime adapter may accelerate candidate detection using Git or filesystem signals, but exact hash verification remains the correctness boundary.

## Next phase

**ContextOS Phase 6 — Telemetry & Observability.**
