# Knowledge Maps bootstrap

From a project root after AleDevOS installation:

```text
node .aledevos/contextos/runtime/contextos.mjs knowledge build
node .aledevos/contextos/runtime/contextos.mjs knowledge verify
node .aledevos/contextos/runtime/contextos.mjs knowledge summary
```

Generated files are stored in `.aledevos/knowledge/`.

Phase 4 introduced deterministic snapshot maps. Phase 5 adds exact freshness checks, incremental refresh and source-bound research cache; current source remains authoritative.


## Phase 5 freshness
Before using these maps, run `knowledge freshness`. If the result is `STALE`, run `knowledge refresh`; if freshness cannot be established, use targeted current-source reads. Cached research is usable only when `FRESH` and source-bound.
