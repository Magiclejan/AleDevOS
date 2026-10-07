# Advanced Execution Phase 4 — Dispatcher / Queue

P4 is AleDevOS' durable local scheduling control plane. It queues already-valid P3 concurrency plans, orders them deterministically, and asks P3 to start groups only when P3 admits them.

## What P4 owns

- durable repo-local queue state;
- stable priority + FIFO ordering;
- deterministic epoch aging to prevent indefinite starvation;
- pause/resume at queue and item level;
- explicit cancel and completion;
- drain mode;
- bounded dispatch attempts;
- work-conserving handling of temporarily blocked higher-priority items;
- stale dispatcher-lock recovery;
- crash-resumable state across separate CLI invocations.

## What P4 does not own

P4 never provisions worktrees (P1), never defines isolated worker semantics (P2), and never decides concurrency safety (P3). It does not spawn worker processes directly. Every real start is delegated through P3 `group start`.

P4 is local-only. Network scheduling, multi-machine leases, remote workers and target model/adapter execution remain deferred.

## Durable plan snapshots

A submitted P3 plan is verified and then snapshotted into `.aledevos/state/execution/phase4/items/<dispatch-id>/plan.json`. The external submit file may later move or change without silently changing the accepted queue item. Tampering with the repo-owned snapshot invalidates the queue.

## Fairness

Ordering is `effective_priority DESC`, then `enqueue_sequence ASC`, then dispatch id. Effective priority is base priority plus a bounded boost derived from queue dispatch epochs, not wall-clock milliseconds. This makes aging deterministic and testable.

A safety-blocked item does not freeze the queue. P4 is work-conserving: it records the P3 blocker and may start a lower-priority non-conflicting item in the same tick.

## P3 stale-lock hardening discovered by P4

P4 exposed that a P3 subprocess exiting from inside a rejected group-start could leave a dead global lock. P3 now recovers a lock only when the recorded owner PID is dead. Its admission semantics, parallelism cap and worker behavior are otherwise unchanged; the P3 certificate is refreshed in v1.41 to bind this maintenance fix.

## Boundaries

P4 scheduling state is operational evidence, not a final product/Judge verdict. `COMPLETED` means the dispatch item was explicitly completed and its P3 group stopped; it does not imply AleDevOS acceptance gates passed.
