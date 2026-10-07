# Security & Reliability Assurance P8

P8 is a transversal AleDevOS assurance layer. It does not promise that software is impossible to hack. It requires evidence that security and reliability controls ran, that severe unresolved findings block release, and that repaired bugs leave regression evidence.

## Authority split

1. Deterministic native scan detects explicit source/config/test-integrity hazards.
2. External scanner receipts prove required dependency/tool scans actually ran on the target.
3. `security-reviewer` is read-only and performs threat-path analysis over the exact task + deterministic evidence.
4. Reliability Registry persists bugs, vulnerabilities and incidents. A fixed bug cannot become VERIFIED without a regression test and passing verification reference.
5. The P8 assurance gate recomputes all inputs. LLM opinion never overrides deterministic blockers.

## Fail closed

CRITICAL/HIGH unresolved vulnerabilities, open CRITICAL/HIGH incidents, leaked-secret findings, test-integrity weakening, missing required dependency scans, unverified bug fixes, or stale/tampered evidence prevent P8 PASS.

## Separation of duties

`security-reviewer` may read product/evidence but may not edit product code, policies, tests, security receipts or registries. Repair remains a separate governed role.
