# Advanced Execution Phase 5 — Multi-machine Support

P5 closes the package-level Advanced Execution roadmap by adding signed, fenced task ownership across trusted machines without weakening the frozen P1–P4 local authorities.

## Trust and identity

- Each machine owns an Ed25519 keypair generated locally.
- Enrollment creates a `PENDING` node; explicit coordinator approval is required before the node can become active.
- Nodes trust a coordinator identity explicitly before accepting assignment bundles.
- Heartbeats are signed, sequence-numbered and replay protected.

## Task ownership

A coordinator snapshots each task payload and requirements. Assignment is possible only when an ACTIVE node has a fresh heartbeat and satisfies required adapters/modalities/features/capacity.

Every assignment contains a bounded lease and a monotonically increasing fencing token. Reassignment is permitted only after the old lease expires and the former owner is stale or revoked. Reassignments are capped at two.

A late result from an older lease/fence can never become authoritative. Exactly one authoritative result is accepted for a task.

## Transfer model

Package validation uses a signed, self-contained bundle transport. Assignment payloads and results are SHA-256 checked and signed. The package does **not** claim that a real TCP/HTTP/SSH/VPN transport has been validated.

Network transport, real remote CLI/agent binding, host authentication beyond the package trust protocol, and real cross-machine P1→P4 execution remain Master Validation evidence.

## Split-brain boundary

P5 does not make the impossible package-only claim that a partitioned machine can never continue physical computation before its lease deadline. It guarantees that a machine which has lost authoritative ownership cannot have a stale result accepted after fencing advances.

## Final Advanced Execution status

- P1 Worktrees — FROZEN
- P2 Isolated Workers — FROZEN
- P3 Safe Concurrency — FROZEN
- P4 Dispatcher / Queue — FROZEN
- P5 Multi-machine Support — FROZEN

Advanced Execution is COMPLETE at package level. Next: Master Validation / target-runtime release gate.
