# ContextOS 1.0 — Phase 6 complete

ContextOS is the runtime/model-agnostic context, knowledge and observability engine for AleDevOS.

## Frozen phases
- Phase 1: context budgets + structured handoffs.
- Phase 2: checkpoint + preventive compaction planning + resume.
- Phase 3: diff-first + task-context de-duplication.
- Phase 4: persistent Repo / Dependency / Symbol / Domain Maps.
- Phase 5: incremental refresh + freshness/invalidation + source-bound research cache.
- Phase 6: telemetry + observability + comparable benchmark summaries.

## Phase 6 — Telemetry & Observability
- Runtime-neutral append-only telemetry events.
- SHA-256 event-chain integrity per run.
- SHA-256 sealed run summaries bound to the event-chain tail.
- Exact input/output tokens when supplied by the runtime/provider. Unknown values stay unknown; they are never guessed.
- Context peak and pressure-band history.
- Handoff/checkpoint/resume/compaction metrics.
- Research cache hit/miss/stale/invalid rates.
- Incremental knowledge refresh reparse/reuse metrics.
- Files/bytes read, tool calls, gates, judge scores, blockers, repair count and final state.
- Per-agent timing/token summaries and exact/derived decode rates when sufficient measurements exist.
- Before/after comparison only when `benchmark_key` matches.
- Raw prompts, completions, transcripts, file contents and secrets are forbidden in telemetry.

## Commands

```text
contextos.mjs budget resolve/check
contextos.mjs handoff validate/stats
contextos.mjs checkpoint capture/verify
contextos.mjs resume create/validate
contextos.mjs transition plan
contextos.mjs diff capture/verify
contextos.mjs context plan/ledger-show
contextos.mjs knowledge build/refresh/freshness/verify/summary
contextos.mjs research put/get/verify/invalidate
contextos.mjs telemetry start/emit/summarize/verify/compare
contextos.mjs self-test
```

## Trust boundary
ContextOS distinguishes measurement from inference. Telemetry may be `MEASURED`, `REPORTED`, or `DERIVED`; missing metrics are not back-filled with guesses. A comparison without the same benchmark key is explicitly non-comparable.

## ContextOS 1.0 status
All six planned ContextOS phases are now implemented. ContextOS can be frozen at 1.0 after the clean master validation suite passes.
