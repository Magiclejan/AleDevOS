# Skill System Phase 5 — Acquisition Validation

Status: **PASS**

## Scope
Phase 5 adds a universal acquisition contract and an OpenCode reference-adapter installer for missing skills. It does not make network/download logic part of AleDevOS Core.

## Guarantees
- Missing required skills can trigger acquisition instead of being permanently unresolved.
- Trusted/allowlisted sources may be auto-approved.
- Unknown/untrusted sources require explicit approval before download/install.
- Third-party installers run in a temporary staging workspace, never directly in the project.
- `DISABLE_TELEMETRY=1` is set for the `skills` CLI path.
- Global skill installation is forbidden by policy.
- Symlink/reparse-point, file-count and byte-size guards are enforced before copy-in.
- Installation into the project is atomic via pending directory + move.
- Post-install flow must re-run discovery, registry build and registry verification.
- A skill cannot become usable until post-install registry verification succeeds.
- Acquisition plans and receipts are SHA-256 sealed; installed-source drift is detected.
- Runtime-specific acquisition remains adapter-owned.

## OpenCode adapter strategy
The reference adapter uses `npx skills add <source> --skill <id> -a opencode -y --copy` **inside a temporary staging directory**. It then copies only the verified skill directory into `.opencode/skills/<id>` and re-runs AleDevOS discovery/registry verification. This avoids allowing third-party installer side effects to land directly in the target project.

Source resolution order:
1. AleDevOS source catalog.
2. skills.sh exact-name resolution.
3. Explicit/manual approved source.

Trusted/allowlisted sources can proceed automatically. Community/unknown sources stop with an approval requirement.

## Validation
- Full deterministic suite: **207/207 PASS**.
- Skill System Phase 5 tests: **14/14 PASS**.
- JavaScript module syntax checks: **19 PASS**.
- JSON parse checks: **61 PASS**.

Adversarial cases include plan tampering, unresolved source, unverified registry state, installed-source drift, direct-project installer protection and approval-gating for untrusted sources.

## Boundary
Phase 5 does not claim that every external skill already has a canonical source pinned in the master catalog. The acquisition layer resolves missing sources when needed and fails closed when a trustworthy source cannot be established.
