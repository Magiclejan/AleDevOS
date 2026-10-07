# B2 — Controlled Macro-Orchestration Efficiency

Status: **VALIDATED / PASS / n=3**

Date: 2026-10-07

## Scope

B2 measures combined AleDevOS efficiency on a controlled MICRO task.

It compares:

### Broad baseline
- full supplied context;
- 9 active agents;
- 9 active Skill IDs;
- broad repeated-state handoffs.

### AleDevOS P7 MICRO candidate
- real P7 Efficiency Plan;
- relevant-only context;
- 6 active agents;
- 7 active Skill IDs;
- compact delta handoffs.

Both legs use the same Codex runtime, the same benchmark key and the same exact quality contract.

## Validated real result

Three full baseline/candidate pairs completed successfully.

| Metric | Validated result |
| --- | ---: |
| Median input-token reduction | **77.28%** |
| Median total-token reduction | **77.24%** |
| Median model-call reduction | **33.33%** |
| Median active-agent reduction | **33.33%** |
| Median handoff-token reduction | **99.73%** |
| Baseline agents | 9 |
| Candidate agents | 6 |
| Baseline Skill IDs | 9 |
| Candidate Skill IDs | 7 |
| Quality preserved | **YES** |
| Telemetry integrity | **VERIFIED** |
| Runs | **n=3 pairs** |

Observed total-token reductions across the three pairs were approximately **77.24%, 77.23% and 77.24%**.

The first pair contained:

| Metric | Broad baseline | P7 MICRO candidate | Reduction |
| --- | ---: | ---: | ---: |
| Input tokens | 320,487 | 72,827 | **77.28%** |
| Output tokens | 334 | 193 | 42.22% |
| Total tokens | 320,821 | 73,020 | **77.24%** |
| Model calls | 9 | 6 | **33.33%** |
| Active agents | 9 | 6 | **33.33%** |

All agent calls in all three pairs preserved the exact quality contract and all benchmark telemetry summaries verified.

The third pair intentionally ran the candidate before the baseline to reduce simple execution-order bias; the result remained effectively unchanged.

## Interpretation

B2 supports the narrow claim:

> In the controlled B2 MICRO benchmark, the combined AleDevOS efficiency path reduced median total token use by 77.24% versus the broad baseline while preserving the exact required result across three repeated pairs.

The observed saving is attributable to the **combined benchmark treatment**:

- minimum-necessary agent activation;
- reduced Skill activation;
- relevant-context selection;
- compact delta handoffs.

B2 does not isolate the contribution of each mechanism individually. B1 separately measured context pruning and found a 50.67% median total-token reduction.

## Claim boundary

B2 is now validated for this controlled MICRO benchmark, but it does **not** support the universal statement that every AleDevOS task saves 77.24%.

Broader claims require additional task classes, real project work, adapters and host platforms.

The current runtime used the same Codex default runtime path for every leg but did not expose a model identity in telemetry. Evidence therefore remains:

`SAME_CODEX_RUNTIME_DEFAULT_MODEL_UNREPORTED`.

Future benchmark families should explicitly pin or record the model identity when the target runtime permits it.

## Validation gate result

1. >=3 full baseline/candidate pairs — **PASS**
2. Exact quality preserved — **PASS**
3. Telemetry summaries verified — **PASS**
4. Median input-token reduction >=35% — **PASS (77.28%)**
5. Median total-token reduction >=30% — **PASS (77.24%)**
6. No observed model-identity mismatch — **PASS**

**B2_MACRO_ORCHESTRATION_VALIDATED**
