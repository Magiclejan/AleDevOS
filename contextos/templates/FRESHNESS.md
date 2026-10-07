# ContextOS Freshness Contract — Phase 5

Before using persistent knowledge or research cache:

1. Run `knowledge freshness`.
2. `FRESH` -> maps may be used as discovery aids.
3. `STALE` -> run `knowledge refresh` before relying on maps.
4. `UNKNOWN` -> build or fall back to targeted source reads.
5. Research cache is usable only when `FRESH` and source-bound.
6. TTL expiry, source hash drift, missing source, explicit invalidation or integrity failure makes an entry non-usable.
7. Cached findings never override current source evidence.

Incremental refresh reparses only added/changed source or test files; unchanged parse entries are reused by content identity.
