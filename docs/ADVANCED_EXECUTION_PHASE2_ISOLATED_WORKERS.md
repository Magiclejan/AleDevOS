# Advanced Execution P2 — Isolated Workers

Status: **COMPLETE / FROZEN in v1.39**.

P2 binds exactly one AleDevOS worker identity to one P1-certified Git worktree and one task contract. It deliberately remains sequential: Safe Concurrency is P3.

## Deterministic lifecycle

`PROVISIONED -> RUNNING -> STOPPED -> COMPLETED|BLOCKED|FAILED`

A real supervisor process runs with its CWD fixed to the assigned worktree, emits PID/heartbeat evidence and receives only an allowlisted environment. The package does **not** claim that a target LLM/adapter CLI has been executed; that binding remains `DEFERRED_MASTER_VALIDATION`.

## Isolation and ownership

- worker identity is derived from sealed task/worktree/scope inputs;
- one worktree receipt can have only one worker owner;
- P2 allows at most one `RUNNING` worker; P3 owns concurrency;
- writes require explicit task-contract scope; read-only roles receive no write scope;
- `.git/**`, `.aledevos/**` and adapter/project `protected_paths` are denied even if a task scope would otherwise match;
- external/cross-worktree paths and symlink escapes fail closed;
- shell and network remain disabled by the P2 supervisor contract.

Control-plane mutations are serialized through an atomic state lock so two lifecycle commands cannot race the single-worker invariant.

## Recovery

P2 detects PID/heartbeat loss, including Linux zombie processes. One recovery is allowed. Recovery preserves the same worker identity/worktree and returns the session to `STOPPED`; a second process loss exhausts recovery and marks the worker `FAILED`.

## Handoff and durable evidence

The worker does not declare its changed paths. AleDevOS derives them from Git (`base_commit..HEAD`) and refuses handoff if any committed path falls outside the worker write scope. READY handoff requires evidence files.

Before sealing, each evidence file is copied to worker-owned primary state under `.aledevos/state/execution/phase2/evidence/<worker>/` and SHA-256 verified. This means P1 can later remove the clean temporary worktree while the handoff remains independently verifiable from:

- the preserved task branch / Git commit graph;
- the sealed handoff;
- the primary-state evidence snapshot.

Tampering with source evidence while the worktree is live, the durable snapshot, Git head, changed paths, session/assignment identity, project protection policy or receipt binding invalidates the handoff.

## Explicit P2 boundaries

P2 does not enable:
- multiple RUNNING workers;
- parallel execution;
- dispatcher/queue;
- multi-machine execution;
- target agent/model runtime proof.

Those remain Advanced Execution P3-P5 and final Master Validation.

Canonical files:
- `advanced-execution/workers/worker-manager.mjs`
- `advanced-execution/workers/worker-runtime.mjs`
- `advanced-execution/policies/worker-policy.json`
- `advanced-execution/schemas/worker-*.schema.json`
- `advanced-execution/contracts/ISOLATED_WORKER.md`
- `release/certifications/advanced-execution-p2.json`
