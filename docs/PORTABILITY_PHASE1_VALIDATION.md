# Portability Phase 1 Validation — Adapter ABI + Capability Negotiation

Status: **COMPLETE / FROZEN** in `1.28.0-portability-p1`.

## Guarantees

- Adapter manifests use ABI contract version 2.0.
- Capability IDs come only from the canonical catalog.
- Missing/unknown capabilities invalidate an adapter manifest.
- Security requirements can demand `enforced`; `best_effort` cannot satisfy them.
- Scaffold adapters are non-installable by construction.
- Installer performs deterministic installability preflight before runtime-specific file access.
- Core adapter verifier contains no OpenCode-specific branch.
- OpenCode satisfies all current implementation profiles.
- Codex/Claude/Gemini/Antigravity/Generic remain truthfully blocked until implemented.
- Adapter implementation readiness never substitutes for target runtime/model readiness.

## Tests

`tests/portability-phase1.test.mjs` contains 30 deterministic contract, compatibility, downgrade, tamper and installer-wiring tests.

Next: **Portability Phase 2 — OpenCode Adapter Certification**.

## Cumulative regression

- Deterministic: **600/600 PASS**
- MJS syntax: **53/53 PASS**
- JSON parse: **124/124 PASS**
- Failures: **0**

Visual QA P5 semantic tests were executed in exact non-overlapping batches because the packaging environment times out on the monolithic run.
