# B4 — Real Software-Engineering E2E Efficiency

Status: **VALIDATED / PASS / n=3**

Date: 2026-10-07

## Scope

B4 measures a real code-edit workflow on real project code.

The source project is treated read-only. When the source folder is not a Git repository, AleDevOS creates an ephemeral Git snapshot and runs both benchmark legs in isolated disposable worktrees from the same frozen snapshot.

Task contract:
- one real source file;
- one deterministic non-functional marker insertion;
- exactly one added line;
- zero deleted lines;
- exactly one changed file;
- `git diff --check` must pass;
- baseline and candidate must produce the identical verified diff;
- source project must remain unchanged.

## Validated real result

Three full baseline/candidate pairs completed successfully with the same frozen source, task, model, reasoning effort and runtime policy.

| Metric | Validated result |
| --- | ---: |
| Safe eligible source files | 83 |
| Baseline context files | 11 |
| Candidate context files | 1 |
| Median input-token reduction | **72.41%** |
| Median total-token reduction | **72.40%** |
| Baseline edit | **PASS** |
| Candidate edit | **PASS** |
| Identical verified diff | **YES** |
| Quality preserved | **YES** |
| Telemetry integrity | **VERIFIED** |
| Source project intact | **YES** |
| Repetitions | **n=3 pairs** |
| Model | **gpt-5.6-luna** |
| Reasoning effort | **low** |
| Sandbox | **workspace-write** |
| Approval policy | **never** |

Observed total-token reductions across the three pairs were approximately:
- 73.12%
- 70.73%
- 72.40%

Execution order was balanced across repeated runs.

## Interpretation

B4 supports the narrow claim:

> In the controlled B4 real software-engineering benchmark, AleDevOS targeted context reduced median total token use by 72.40% versus broad project context while producing the same independently verified code diff across three repeated pairs.

B4 is stronger than B3 because the model performs a real file edit and the result is independently verified from Git evidence.

## Claim boundary

B4 validates this real, deterministic software-engineering edit workflow. It does **not** establish that arbitrary feature development, debugging or refactoring will always save 72.40%.

Broader claims require additional task classes and repositories.

No external project name, absolute source path, anchor content, raw prompt or raw completion is stored in canonical public evidence.

## Validation gate result

1. >=3 full baseline/candidate pairs — **PASS**
2. Same frozen source and target identity — **PASS**
3. Explicit same model — **PASS**
4. Explicit same reasoning effort — **PASS**
5. Same sandbox / approval policy — **PASS**
6. Exact edit contract satisfied — **PASS**
7. Identical verified diff — **PASS**
8. Quality preserved — **PASS**
9. Telemetry verified — **PASS**
10. Source project unchanged — **PASS**

**B4_REAL_SOFTWARE_ENGINEERING_E2E_VALIDATED**
