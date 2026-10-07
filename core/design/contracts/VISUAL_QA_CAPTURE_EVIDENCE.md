# Visual QA Phase 1 — Capture Contract + Evidence Integrity

Visual QA starts from rendered evidence, but AleDevOS must not confuse the presence of a screenshot with proof that the UI is correct.

## Required order
1. Verify the canonical responsive policy is ACTIVE.
2. Receive explicit task surfaces, routes and states. Never invent them.
3. Expand only approved viewport IDs into a deterministic capture matrix.
4. Snapshot UI-relevant source files before capture.
5. Let an adapter-owned runner capture the exact matrix in a later execution phase.
6. Seal screenshot references and SHA-256 hashes; never embed screenshot bytes in JSON evidence.
7. Re-verify plan, responsive policy, source snapshot and screenshot hashes before any later visual judge consumes the evidence.

## Fail closed
Unknown viewports, duplicate surfaces/cases, unsafe routes/paths, state-contract mismatch, missing screenshots, non-PNG evidence, source drift, responsive-policy drift, plan/run tampering or screenshot drift invalidate the evidence.

## Non-claims
Phase 1 does not assert successful browser execution, visual aesthetics, responsive correctness, rendered accessibility, animation smoothness or visual regression. Those require later Visual QA phases.
