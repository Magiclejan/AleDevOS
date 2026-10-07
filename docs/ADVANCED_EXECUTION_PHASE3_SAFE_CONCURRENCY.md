# Advanced Execution P3 — Safe Concurrency

Status: **COMPLETE / FROZEN in v1.40**.

P3 is the only layer allowed to run multiple AleDevOS worker supervisors at once. P1 worktrees and P2 worker assignments remain frozen dependencies and are not modified to “become concurrent”.

## Admission

A concurrency plan is deterministic and preserves request order. Every candidate must be a valid live P2 assignment backed by a live P1 worktree.

- write/write overlap: BLOCK;
- write/read overlap: BLOCK;
- read/read overlap: ALLOW;
- global/unknown write scope: BLOCK;
- worker ids and worktrees must be distinct.

The default maximum is four RUNNING workers per repository. This cap is global across groups, not per group.

## Global leases

P3 maintains a repository-wide phase3 lease registry. Start/stop mutations are serialized through an atomic global control lock. A new group is checked against all currently active groups before any process is started; incompatible scopes or exhausted global worker slots fail closed.

## Runtime

Each admitted worker runs the existing P2 supervisor runtime in its own P1 worktree, with its own PID, heartbeat and restricted environment. P3 stores a group receipt and validates each worker independently.

A lost worker degrades the group but does not kill healthy peers. One per-worker recovery is allowed and preserves the same worker identity/worktree. Recovery exhaustion affects only that worker/group state.

## Explicit boundaries

P3 does not implement a dispatcher, durable queue, network execution, multi-machine scheduling, or target adapter/model runtime proof. Those remain P4/P5 and Master Validation.
