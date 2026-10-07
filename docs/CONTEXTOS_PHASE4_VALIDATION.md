# ContextOS Phase 4 — Validation

Status: **PASS / FROZEN FOR PHASE 4 SCOPE**

Phase 4 scope is intentionally limited to persistent snapshot knowledge maps:
- Repo Map
- Dependency Map
- Symbol Map
- Domain Maps
- integrity/provenance manifest

It does **not** implement Phase 5 freshness/invalidation, incremental refresh or research cache.

## Deterministic guarantees validated

1. Relevant repository files are inventoried while `.git`, `node_modules`, `.aledevos`, build output and other configured noise are excluded.
2. Every map records exact `source_fingerprint_sha256`; Git HEAD/branch are recorded when Git exists.
3. JS/TS lexical imports resolve local file edges and external package usage.
4. JS/TS symbols and Python top-level symbols include deterministic line metadata.
5. Unsupported source languages remain inventoried but report `UNSUPPORTED`; ContextOS does not invent symbols/dependencies.
6. Configured feature/module/domain roots produce persistent Domain Maps and cross-domain edges.
7. Manifest + map payloads are SHA-256 sealed; tampering is rejected.
8. Non-Git repositories are supported with explicit null Git provenance.
9. Rebuilding unchanged source keeps source fingerprint and semantic map hashes stable.
10. Source edits change provenance and affected semantic map hashes.
11. File-count overflow fails closed instead of silently truncating repository knowledge.
12. Compact `knowledge summary` does not embed source bodies.
13. `.aledevos/knowledge/` remains persistent and is not treated as transient `.aledevos/state/`.
14. Core and OpenCode agents carry a concise map-first discovery discipline.
15. Unsupported source languages are inventoried with `UNSUPPORTED` parser status and no fabricated symbols/dependencies.
16. Rebuild uses an atomic snapshot swap, so removed domains do not leave stale domain-map files.
17. Phase 4 self-test preserves earlier Phase 3 compatibility markers.

## Test result

```text
AleDevOS Core             8/8 PASS
ContextOS Phase 1        10/10 PASS
ContextOS Phase 2        12/12 PASS
ContextOS Phase 3        16/16 PASS
ContextOS Phase 4        17/17 PASS
────────────────────────────────
TOTAL                    63/63 PASS
```

## Parser boundary

Phase 4 deliberately uses dependency-free deterministic lexical extractors for JS/TS and Python so the Core remains portable. This is not claimed to be a semantic AST for every language. Future adapters/extractors may enrich maps without changing the Core map contracts.

## Next phase

**ContextOS Phase 5 — Incremental Knowledge + Research Cache + Freshness/Invalidation.**
