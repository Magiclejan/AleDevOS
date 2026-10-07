# Advanced Execution P4 — Dispatcher / Queue contract

P4 is the durable local scheduling control plane. It MUST NOT recreate P1 worktree isolation, P2 worker lifecycle, or P3 concurrency admission.

## Authority split

- P1 owns worktrees.
- P2 owns isolated worker assignments/runtime semantics.
- P3 is the only authority that may admit/start concurrent worker groups.
- P4 owns durable queue order, priority, pause/resume/cancel/drain, dispatch retry accounting, and crash-resumable scheduling state.

## Queue invariants

1. Every queue item references a P3 plan that passed `plan verify` at submission.
2. P4 snapshots the verified P3 plan into repo-owned phase4 state. Dispatch never relies on an arbitrary mutable external plan path.
3. Dispatch MUST invoke P3 `group start`; P4 MUST NOT spawn workers directly.
4. P3 safety blockers never become bypasses. A blocked higher-priority item may wait while a lower-priority non-conflicting item runs (work-conserving scheduling).
5. Priority is deterministic: base priority, epoch-based aging, FIFO submission sequence, then dispatch id.
6. Queue state is durable and atomically written. P4 mutations are serialized by a repository-local lock with stale-lock recovery.
7. Pause stops new dispatch only. Existing P3 groups continue.
8. Drain stops new dispatch and reaches DRAINED only when no queue item is RUNNING.
9. Cancel of a RUNNING item first asks P3 to stop the group, then marks it CANCELLED.
10. Completion is explicit. P4 may stop a running P3 group as part of completion, but never invents product/Judge success.
11. Dispatch retries are bounded. Temporary P3 admission blockers do not consume failure attempts; execution/start failures do.
12. Multi-machine/network scheduling remains disabled in P4.

## States

Queue mode: `ACTIVE | PAUSED | DRAINING | DRAINED`.

Item state: `QUEUED | BLOCKED | PAUSED | RUNNING | COMPLETED | CANCELLED | FAILED`.

P4 state is scheduling evidence only; it is not a final AleDevOS acceptance verdict.
