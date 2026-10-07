# Advanced Execution P3 — Safe Concurrency

P3 admits multiple already-isolated P2 worker assignments into one local execution group.
It does not implement a dispatcher, durable queue, multi-machine execution, or target LLM runtime binding.

## Invariants
- P1 worktree isolation and P2 assignment identity remain authoritative.
- Each admitted worker has a distinct worker id and worktree.
- Write/write and write/read scope overlap fail closed; read/read overlap is allowed.
- Admission is deterministic and stable in request order.
- Active workers are capped by policy and started/stopped under an atomic group lock.
- A lost worker can be recovered independently once; other healthy workers remain running.
- No fallback to sequential P2 `worker start` occurs silently.
- Network, dispatcher, queue and multi-machine behavior remain disabled.
