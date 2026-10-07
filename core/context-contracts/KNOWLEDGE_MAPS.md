# ContextOS Phase 4/5 — Persistent Knowledge Contract

Persistent knowledge lives under `.aledevos/knowledge/` and is separate from transient `.aledevos/state/`.

## Maps
- `repo-map.json`: project/file inventory.
- `dependency-map.json`: local/external dependency edges.
- `symbol-map.json`: deterministic symbol locations for supported parsers.
- `domains.index.json` + `domains/*.json`: bounded domain ownership and cross-domain edges.
- `inventory.json`: exact per-file SHA-256 source identity.

## Phase 5 use rules
1. Run `knowledge freshness` before relying on maps.
2. `FRESH` maps may be used as discovery aids.
3. `STALE` maps must be incrementally refreshed before reuse.
4. `UNKNOWN` means build or fall back to targeted current-source reads.
5. Research cache may be reused only when `FRESH` and source-bound.
6. TTL expiry, missing/changed source, explicit invalidation or integrity failure makes research non-usable.
7. Maps/cache never override current source evidence.
8. Unsupported parser coverage must stay explicit; never fabricate semantics.
