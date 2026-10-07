# Advanced Execution P1 — Worktree Isolation Contract

P1 provisions Git worktrees only. It does not start workers, schedule tasks, dispatch a queue, run tasks concurrently, or use multiple machines.

Hard invariants:

1. Provisioning originates from the primary Git checkout only.
2. The primary checkout must be attached to a branch and clean.
3. Every request is pinned to an exact base commit before creation.
4. Task IDs are narrow identifiers; branch names and worktree paths are derived by AleDevOS, never supplied by a worker/model.
5. Task branches use `aledevos/task/<task_id>` and may not be reused by P1.
6. Task worktrees live outside the repository under a deterministic sibling `.aledevos-worktrees` container.
7. The primary HEAD and cleanliness are rechecked before and after provisioning.
8. Existing target paths, registered target worktrees, existing task branches, detached task worktrees, and path escapes fail closed.
9. Cleanup is non-destructive by default: dirty worktrees are blocked, force removal is disabled, and the task branch is preserved.
10. Receipts are SHA-256 sealed and can be revalidated against live Git state.
11. P1 never performs network operations and never starts a worker.
12. Concurrency, dispatcher/queue, workers, and multi-machine execution remain later Advanced Execution phases.
