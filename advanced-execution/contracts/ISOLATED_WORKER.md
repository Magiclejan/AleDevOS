# Advanced Execution P2 — Isolated Worker Contract

P2 binds one AleDevOS worker supervisor lifecycle to one valid P1 task worktree. It remains sequential: concurrency, dispatcher/queue and multi-machine execution are not enabled here.

Hard invariants:

1. A worker assignment requires a live, valid Advanced Execution P1 worktree receipt and a task contract with the same `task_id`.
2. Worker identity is AleDevOS-derived from the assignment inputs; a worker/model cannot choose its own identity, state path or evidence path.
3. One worktree may be owned by only one P2 worker identity, and one worker identity may own only one worktree.
4. Worker state, heartbeat and handoff evidence live in the primary repository's ignored `.aledevos/state/execution/phase2/` control state, not inside the task branch.
5. The worker supervisor process is started with the task worktree as `cwd`, a narrow environment allowlist and explicit AleDevOS identity variables.
6. P2 never grants arbitrary shell or network access. Binding to an external model/agent CLI is deferred to target-runtime Master Validation.
7. All file-path requests are checked against the assigned worktree, read/write scope and symlink boundaries. Cross-worktree and external-path access fail closed.
8. `.git/**` and `.aledevos/**` are always protected from worker file operations even if a scope attempts to include them.
9. Read-only roles cannot receive write scope. Product-writer roles require non-empty write scope, and every write scope must be explicitly present in the task contract's `in_scope` list.
10. P2 allows only one RUNNING worker supervisor per repository. Safe concurrency is P3.
11. A final handoff is worker-owned, SHA-256 sealed, bound to assignment/session identity, and derives changed paths from Git rather than trusting worker-provided path claims.
12. A READY_FOR_VERIFICATION handoff can complete a worker only when the task worktree is clean. BLOCKED/FAILED handoffs finalize to their matching terminal state.
13. Unexpected process loss is detected from PID/heartbeat and may be recovered at most once under the same worker identity; recovery does not invent a new worker or worktree.
14. P2 never removes the worktree or task branch. Worktree cleanup remains exclusively owned by P1.
15. Dispatcher, queue, multi-machine execution and multiple simultaneously running workers remain later phases.

## Frozen P2 hardening

- Project protected paths from `.aledevos/project.json` are sealed into the assignment and enforced in addition to global protected paths. Drift invalidates the assignment.
- Mutating P2 control-plane commands are serialized by an atomic lock.
- Handoff evidence is snapshotted into primary worker-owned state before P1 cleanup and remains verifiable after the worktree is removed.
- Git-derived changed paths, not worker claims, determine handoff scope compliance.
