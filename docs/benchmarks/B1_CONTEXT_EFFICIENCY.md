# B1 — Controlled Context Efficiency

Status: **PASS**

Date: 2026-10-07

## Scope

B1 isolates the effect of relevant-context selection. It compares the same controlled task on the same Codex runtime:

- baseline: full supplied context;
- candidate: relevant-only supplied context.

Both legs use the same quality contract and Auto-Telemetry V2. Raw prompts and completions are not persisted.

## Repeated real result

Three baseline/candidate pairs were executed (six successful real Codex calls).

| Metric | Result |
| --- | ---: |
| Baseline input tokens | 24,297 / 24,297 / 24,297 |
| Candidate input tokens | 11,989 / 11,989 / 11,989 |
| Median input-token reduction | **50.66%** |
| Median total-token reduction | **50.67%** |
| MICRO input target | >= 35% |
| MICRO total target | >= 30% |
| Quality preserved | **YES (6/6 calls PASS)** |
| Telemetry integrity | **VERIFIED** |
| Runs | **n=3 pairs** |

Observed total-token reductions were 50.67%, 50.64% and 50.69%.

## Claim boundary

This evidence supports the following claim:

> In the controlled B1 context-pruning benchmark, relevant-context selection reduced median total token use by 50.67% while preserving the exact required result.

It does **not** support the claim that every AleDevOS task saves 50.67%. B1 measures context selection only. Broader orchestration, Skills, handoffs, task classes, adapters and host platforms require separate benchmarks.

## Next benchmark

B2 measures controlled macro-orchestration efficiency: minimum-necessary agents plus compact handoffs versus a broad pipeline baseline, while using the same relevant task context.
