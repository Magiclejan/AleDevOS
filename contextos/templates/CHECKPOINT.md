# ContextOS checkpoint — human-readable view

Machine checkpoints are JSON artifacts generated/sealed by `contextos.mjs checkpoint capture` under `.aledevos/state/contextos/checkpoints/`.

Do not hand-author the integrity hash. Do not paste transcript history.

A human review should be able to answer:
- Task ID / objective
- Why checkpoint occurred
- Current agent / phase
- Exact protected run state (scope version, criteria, gates, judges, repairs, blockers)
- Git working set
- Decisions / evidence / relevant tests
- Risks / open questions
- Next agent / exact next action
- Runtime profile / pressure band
- SHA-256 integrity status

Resume must be generated from the verified checkpoint, never reconstructed from memory.
