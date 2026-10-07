# V1 validation evidence captured before v1.4

Observed in the sandbox:
- simple FEATURE → PASS;
- deterministic gate failure → Repairer → re-verification → PASS;
- Git diff-first scoped feature → PASS;
- contradictory task → BLOCKED without edits;
- green tests + Requirements Judge veto → Repairer → PASS;
- Scope Escalation → Architect revised scope → Auditor approval → PASS;
- exactly 2 repair loops exhausted → FAILED; no third repair.

Security audit then exposed broad write/shell capabilities and vacuous gate risk. v1.4 moves those guarantees from prompt-only behavior toward adapter/runtime controls.
