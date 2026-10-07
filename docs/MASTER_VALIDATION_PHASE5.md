# Master Validation P5 — Advanced Execution Target Validation

Status: **COMPLETE / FROZEN for the P5 harness contract**. Target checks remain PASS/BLOCKED/FAIL according to evidence produced on the actual target.

P5 owns exactly five Master checks:

- `worktree_worker_real`
- `safe_concurrency_real`
- `dispatcher_queue_real`
- `multi_machine_transport_real`
- `crash_recovery_real`

## Boundary

P5 does not replace Advanced Execution P1-P5. It consumes and re-verifies the frozen worktree, worker, concurrency, dispatcher and multi-machine engines. Package-level signed bundle support is not accepted as proof of real cross-machine transport.

## Worktree + worker proof

`worktree_worker_real` requires a live P1 worktree, a valid P2 assignment, a live P2 supervisor process and a current heartbeat whose PID, worker id and CWD match the isolated worktree.

## Safe concurrency proof

`safe_concurrency_real` requires at least two simultaneously live P3 workers with distinct PIDs and distinct worktrees. P5 also actively attempts a valid conflicting plan while the real group is running and requires P3 to reject it with `ACTIVE_SCOPE_CONFLICTS_PRESENT`.

## Dispatcher proof

`dispatcher_queue_real` re-verifies the canonical durable P4 queue, a sealed `STARTED` receipt and the queue item/group linkage. A hand-written queue outside `.aledevos/state/execution/phase4/queue.json` cannot satisfy the check.

## Real multi-machine transport

`multi_machine_transport_real` requires both:

1. frozen P5 multi-machine state showing a signed authoritative remote result for an ACTIVE enrolled node; and
2. an active network round-trip to a **different target fingerprint** using one of the supported target transports (`SSH`, `TAILSCALE_SSH`, `WINRS`, `POWERSHELL_REMOTING`).

The transport probe sends a nonce plus random payload bytes, the remote helper recomputes the payload SHA-256 on the remote host, and the coordinator requires the same nonce/hash back. `CONTROLLED_TEST_PROVIDER` is never valid target evidence.

This is evidence of a real network hop and distinct runtime host. P5 still does **not** claim physical exactly-once computation during arbitrary network partitions.

## Crash + fencing proof

`crash_recovery_real` requires two independent proofs:

- a real P3 worker process is forcibly terminated while a healthy peer remains alive, process loss is observed, the worker is recovered once, and the group returns healthy with a new PID;
- a P5 remote task advances its fencing token through reassignment, a stale signed result is rejected, and the current signed result remains the sole authoritative result.

## Commands

```powershell
.\scripts\58-self-test-master-validation-phase5.ps1
.\scripts\59-master-validation-p5-target-advanced-execution.ps1 -InventoryOnly
```

Create a real transport receipt:

```powershell
node .\release\templates\master-validator-advanced-execution.mjs transport-probe `
  --root . `
  --profile .\my-p5-transport-profile.json `
  --out .\.aledevos\state\release\master\inputs\advanced-execution\p5\transport-probe.json
```

Inject and recover one real concurrent worker:

```powershell
node .\release\templates\master-validator-advanced-execution.mjs crash-probe `
  --root . `
  --group <live-p3-group.json> `
  --out .\.aledevos\state\release\master\inputs\advanced-execution\p5\crash-recovery-probe.json
```

Then compile/seal the full target profile:

```powershell
.\scripts\59-master-validation-p5-target-advanced-execution.ps1 -Profile .\my-p5-target-profile.json
```

Inventory mode can never declare a Master PASS.
