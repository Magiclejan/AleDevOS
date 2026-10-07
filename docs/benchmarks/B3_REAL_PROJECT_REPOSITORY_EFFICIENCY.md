# B3 — Real Project Repository Efficiency

Status: **PRELIMINARY PASS / n=1**

Date: 2026-10-07

## Scope

B3 moves beyond synthetic fixtures and measures context efficiency against a real repository corpus.

Runtime / telemetry project:
- AleDevOS consumer project with the Codex adapter installed.

Corpus:
- the canonical AleDevOS repository, used read-only;
- control-plane, dependency/build directories and credential-like surfaces are excluded;
- secret-like content is excluded before corpus construction;
- raw prompts, completions and the target source line are not persisted.

The benchmark compares:
- baseline: broad real-project context from up to 20 safe repository files;
- candidate: one deterministic targeted retrieval result with the relevant file excerpt.

## First real pair

| Metric | Result |
| --- | ---: |
| Eligible safe files | 637 |
| Baseline files supplied | 20 |
| Candidate files supplied | 1 |
| Baseline context bytes | 112,814 |
| Candidate context bytes | 899 |
| Input-token reduction | **69.86%** |
| Total-token reduction | **69.78%** |
| File-context reduction | **95.00%** |
| Context-byte reduction | **99.20%** |
| Quality preserved | **YES** |
| Telemetry integrity | **VERIFIED** |
| Repetitions | **n=1 pair** |

The selected target was a real repository file:

`adapters/antigravity/visualqa/playwright-driver.mjs`

The target source line itself was not stored in benchmark evidence.

## Interpretation

This first pair supports the narrow claim:

> On the frozen real-project B3 corpus, deterministic targeted retrieval reduced total token use by 69.78% versus broad repository context while preserving the exact required result.

B3 does not yet measure code-edit quality or a complete software-engineering workflow. It measures real-repository retrieval/context efficiency.

## Claim boundary

This result is preliminary until at least three full baseline/candidate pairs complete on the same corpus digest and target identity with quality preserved and telemetry verified.

The current runtime uses the same Codex default runtime path but does not expose model identity in telemetry, so evidence remains:

`SAME_CODEX_RUNTIME_DEFAULT_MODEL_UNREPORTED`.

## Validation gate

B3 becomes VALIDATED when:

1. >=3 full baseline/candidate pairs complete;
2. the corpus digest and target identity remain unchanged across reused evidence;
3. exact quality is preserved;
4. telemetry summaries verify;
5. median input-token reduction meets the P7 MICRO target (>=35%);
6. median total-token reduction meets the P7 MICRO target (>=30%);
7. no observed model-identity mismatch occurs.
