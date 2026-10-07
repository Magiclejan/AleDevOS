# ContextOS Telemetry Contract v1.0

Telemetry is runtime/model agnostic. Adapters MAY emit exact measurements, reported provider metrics, or deterministic derived metrics. Unknown values MUST remain `null`/absent; agents MUST NOT guess token counts, tok/s, timings, cache hits, or context usage.

## Privacy / security
Telemetry MUST NOT contain prompts, completions, transcripts, file contents, credentials, API keys, passwords, authorization headers, cookies, access tokens, or refresh tokens. Store counts, bounded labels, hashes and references instead.

## Integrity
Each run owns an append-only SHA-256 event chain. Summaries bind to the chain tail and are independently SHA-256 sealed. Tampering invalidates the run.

## Benchmarking
Before/after comparisons are authoritative only when both runs share the same explicit `benchmark_key`. Mismatched or missing keys produce a non-comparable result rather than a fabricated improvement claim.

## Minimum useful event families
- agent call / token / timing metrics;
- context pressure samples;
- handoff/checkpoint/compaction/resume;
- research cache and knowledge refresh;
- file/byte reads;
- deterministic gates;
- judges and blockers;
- repair count;
- final state.
