# B4 — Real Software-Engineering E2E Efficiency

Status: **PRELIMINARY PASS / n=1**

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

## First real pair

| Metric | Result |
| --- | ---: |
| Safe eligible source files | 83 |
| Baseline context files | 11 |
| Candidate context files | 1 |
| Baseline input tokens | 222,548 |
| Candidate input tokens | 59,751 |
| Input-token reduction | **73.15%** |
| Total-token reduction | **73.12%** |
| Baseline edit | **PASS** |
| Candidate edit | **PASS** |
| Identical verified diff | **YES** |
| Quality preserved | **YES** |
| Telemetry integrity | **VERIFIED** |
| Source repository intact | **YES** |
| Model | **gpt-5.6-luna** |
| Reasoning effort | **low** |

## Interpretation

This first pair supports the narrow claim:

> In the controlled B4 real software-engineering edit, AleDevOS targeted context reduced total token use by 73.12% versus broad project context while producing the exact same verified code diff.

B4 is stronger than B3 because the model performs a real file edit and the result is independently verified from Git evidence.

## Claim boundary

This is still **n=1**.

It does not establish that arbitrary feature development, debugging or refactoring will save 73.12%. Validation requires at least three comparable pairs with the same frozen source, task, model, reasoning effort and runtime policy.

No external project name, absolute source path, anchor content or raw prompt/completion is stored in canonical public evidence.
