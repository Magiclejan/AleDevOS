# Advanced Execution P1 — Worktrees

Advanced Execution P1 establishes deterministic Git worktree lifecycle and task isolation. It provisions isolated task checkouts but intentionally does **not** start workers, run tasks concurrently, schedule a queue, or use multiple machines.

## Lifecycle

```text
primary Git checkout (clean + attached)
        ↓
request prepare
        ↓
base_ref → exact pinned commit
        ↓
derive branch + target path
        ↓
worktree create
        ↓
sealed creation receipt
        ↓
inspect / worker-side edits later
        ↓
clean-only cleanup
        ↓
branch preserved
```

## Deterministic derivation

A caller supplies only a narrow `task_id` and a `base_ref`. AleDevOS derives both mutable Git surfaces:

- branch: `aledevos/task/<task_id>`
- path: sibling `.aledevos-worktrees/<repo-bucket>/<task_id>`

The request cannot supply its own branch/path. Base refs are resolved to an exact commit at request preparation; any primary HEAD, primary branch, repository identity, or base-ref drift blocks creation.

## Primary checkout safety

Provisioning is allowed only from the primary checkout. The primary must be:

- a non-bare Git worktree root;
- attached to a branch;
- clean;
- free of merge/rebase/cherry-pick/revert/bisect operations.

Creation rechecks that the primary HEAD and cleanliness did not change.

## Cleanup safety

P1 never force-removes a worktree. Dirty worktrees block cleanup. A successful cleanup removes only the linked worktree registration/path and preserves its task branch for audit/recovery.

## Evidence

Creation and cleanup receipts are SHA-256 sealed. Live verification recomputes deterministic paths/branches and checks Git registration, primary identity/HEAD, branch attachment, and base-commit ancestry. Rehashing a manipulated receipt does not bypass semantic verification.

## Deliberate P1 boundaries

P1 does not:

- start or supervise workers;
- enable concurrent execution;
- dispatch or queue tasks;
- perform network operations;
- perform multi-machine execution;
- auto-delete task branches.

Those remain Advanced Execution P2-P5.
