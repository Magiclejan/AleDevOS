# B2 — Controlled Macro-Orchestration Efficiency

Status: **PRELIMINARY PASS / n=1**

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

## Real result — first pair

| Metric | Broad baseline | P7 MICRO candidate | Reduction |
| --- | ---: | ---: | ---: |
| Input tokens | 320,487 | 72,827 | **77.28%** |
| Output tokens | 334 | 193 | 42.22% |
| Total tokens | 320,821 | 73,020 | **77.24%** |
| Model calls | 9 | 6 | **33.33%** |
| Active agents | 9 | 6 | **33.33%** |
| Handoff tokens | measured | measured | **99.73%** |

Quality was preserved for every role in both legs. Telemetry integrity was verified.

## Interpretation

This first B2 pair supports the narrow claim:

> In the controlled B2 MICRO benchmark, the combined AleDevOS efficiency path reduced total token use by 77.24% versus the broad baseline while preserving the exact required result.

The observed saving is attributable to the combined benchmark treatment:
- minimum-necessary agent activation;
- reduced Skill activation;
- relevant-context selection;
- compact delta handoffs.

B2 does not isolate the contribution of each mechanism individually. B1 separately measured context pruning.

## Claim boundary

This is **n=1** and is therefore preliminary evidence.

It does not support a universal claim that AleDevOS always saves 77.24%.

Before B2 is marked VALIDATED, repeat the full pair at least three times and use the median result with quality preserved and telemetry verified.

The current runtime reports the same Codex default runtime path but does not expose a model identity in telemetry, so the evidence is recorded as:

`SAME_CODEX_RUNTIME_DEFAULT_MODEL_UNREPORTED`.

## Validation gate

B2 becomes VALIDATED when:

1. at least 3 full baseline/candidate pairs complete;
2. all calls preserve the exact quality contract;
3. all telemetry summaries verify;
4. median input-token reduction meets the P7 MICRO target (>=35%);
5. median total-token reduction meets the P7 MICRO target (>=30%);
6. no model-identity mismatch is observed.
