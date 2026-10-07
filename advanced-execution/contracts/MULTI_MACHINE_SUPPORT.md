# Advanced Execution P5 — Multi-machine Support

P5 adds a transport-neutral distributed coordination protocol above the frozen P1–P4 local execution stack.

Core invariants:

- Every machine has an Ed25519 identity and private key kept outside the source package.
- Enrollment is not trust: new nodes enter `PENDING` and require explicit coordinator approval.
- Heartbeats are signed and sequence-numbered; replayed heartbeats are rejected.
- Tasks are snapshotted and assigned by signed bundles.
- Every assignment has a bounded lease and monotonically increasing fencing token.
- Reassignment is allowed only after the old lease expires and the previous owner is stale/revoked.
- Late results from old fencing tokens are never authoritative.
- Exactly one authoritative result can be accepted for a task.
- Local P1–P4 remain the authority for worktree, worker, concurrency and local queue behavior on each machine.
- P5 does not claim to prevent a partitioned stale machine from continuing physical computation before its lease deadline. It prevents that machine from producing an authoritative accepted result after ownership changes.
- Package validation uses signed bundle transport only. Actual network transport and real agent-runtime binding are deferred to Master Validation.
