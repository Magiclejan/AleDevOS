# B3 — Real Project Repository Efficiency

Status: **VALIDATED / PASS / n=3**

Date: 2026-10-07

## Scope

B3 measures context efficiency against a real external software repository corpus rather than a synthetic fixture.

The runtime/telemetry project remains an AleDevOS consumer environment with the Codex adapter installed. The repository corpus is used read-only.

Safety boundaries:
- control-plane, dependency/build directories and credential-like surfaces are excluded;
- secret-like content is excluded before corpus construction;
- raw prompts, raw completions and the target source line are not persisted;
- absolute runtime/corpus paths are not stored in the receipt;
- the corpus is frozen by SHA-256 digest for evidence reuse.

The benchmark compares:
- baseline: broad real-project context;
- candidate: deterministic targeted retrieval of the relevant file/excerpt.

## Validated real result

Three full baseline/candidate pairs completed successfully on the same frozen corpus digest and target identity.

| Metric | Validated result |
| --- | ---: |
| Eligible safe files in corpus | 1,061 |
| Baseline files supplied | 15 |
| Candidate files supplied | 1 |
| Baseline context bytes | 164,606 |
| Candidate context bytes | 665 |
| Median input-token reduction | **74.58%** |
| Median total-token reduction | **74.49%** |
| File-context reduction | **93.33%** |
| Context-byte reduction | **99.60%** |
| Quality preserved | **YES** |
| Telemetry integrity | **VERIFIED** |
| Repetitions | **n=3 pairs** |
| Model | **gpt-5.6-luna** |
| Reasoning effort | **low** |
| Model comparability | **EXPLICIT_SAME_MODEL** |
| Reasoning comparability | **EXPLICIT_SAME_REASONING_EFFORT** |

Observed total-token reductions across the three pairs were approximately:

- 74.49%
- 74.52%
- 74.28%

The second executed pair intentionally ran the candidate before the baseline to reduce simple order bias. The result remained effectively unchanged.

## Interpretation

B3 supports the narrow claim:

> On the frozen real-project B3 corpus, deterministic targeted retrieval reduced median total token use by 74.49% versus broad repository context while preserving the exact required result across three repeated pairs.

This extends B1's controlled context-pruning result to a real repository corpus.

## Claim boundary

B3 is validated for real-project retrieval/context efficiency, but it does **not** measure complete code-editing quality or establish that every AleDevOS task saves 74.49%.

Broader system-level claims require end-to-end software-engineering tasks where the model reads, reasons, edits and verifies real code.

No external project name or absolute path is stored in the canonical public evidence.

## Validation gate result

1. >=3 full baseline/candidate pairs — **PASS**
2. Same corpus digest and target identity — **PASS**
3. Explicit same model — **PASS**
4. Explicit same reasoning effort — **PASS**
5. Exact quality preserved — **PASS**
6. Telemetry summaries verified — **PASS**
7. Median input-token reduction >=35% — **PASS (74.58%)**
8. Median total-token reduction >=30% — **PASS (74.49%)**

**B3_REAL_PROJECT_REPOSITORY_EFFICIENCY_VALIDATED**
