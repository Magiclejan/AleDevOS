# Master Validation P1 — Current-Stack Harness + Release Evidence Matrix

Status: **COMPLETE / FROZEN** in `1.43.0-master-validation-p1`.

P1 recovers the original v1.27 release-gate work without treating that early eight-check gate as final V1 authority. The legacy commands remain supported for backward compatibility, but `legacy_gate.authorizes_v1_freeze=false`. Final freeze authority belongs only to the Master Validation gate.

## Current Master Validation roadmap

1. **P1 — Current-Stack Harness + Evidence Matrix** — COMPLETE / FROZEN
2. **P2 — Adapter Runtime + Target Security** — COMPLETE / FROZEN (`v1.44`)
3. **P3 — Multi-Model Target Binding** — COMPLETE / FROZEN (`v1.45`)
4. **P4 — Visual Runtime + Bounded Repair** — COMPLETE / FROZEN (`v1.46`)
5. **P5 — Advanced Execution Target Validation** — NEXT
6. **P6 — End-to-End Real Project** — pending
7. **P7 — Global Efficiency Governor** — planned before final Master Gate
8. **P8 — Security + Reliability Assurance** — planned before final Master Gate

## Master matrix

The gate contains 22 required checks in these domains:

- PACKAGE
- ADAPTER_RUNTIME
- MULTIMODEL
- VISUAL_RUNTIME
- ADVANCED_EXECUTION
- RESILIENCE
- SECURITY
- END_TO_END

At its freeze point, P1 implemented two built-in validators:

- `PACKAGE_CERTIFICATES`
- `DETERMINISTIC_REGRESSION`

Later validators are extension points. P2 now legitimately implements `ADAPTER_RUNTIME`; validators for P3-P6 remain absent. Any check whose validator is not yet implemented still rejects PASS with `MASTER_CHECK_VALIDATOR_NOT_IMPLEMENTED`.

Extension modules are discovered through `release/templates/master-validator-<validator>.mjs`, which is already projected by the existing installer template copy. P2-P6 can therefore add validators without changing the P1 engine or shared installer.

## Package baseline

`release/templates/master-validation-package-baseline.json` records the frozen package prerequisites and the 14 pre-Master package certificates. In source-package mode the master runtime verifies certificate status, certificate evidence SHA, and each certificate input SHA. Installed targets retain the baseline as package provenance; target-runtime proof remains separate.

Current deterministic floor:

```text
tests_passed       >= 1571
mjs_syntax_passed  >= 88
json_parse_passed  >= 212
toml_parse_passed  >= 25
failures            = 0
```

## Commands

```powershell
node release/engine/v1-release.mjs master policy --project-root .
node release/engine/v1-release.mjs master package --project-root .
node release/engine/v1-release.mjs master matrix --project-root .
node release/engine/v1-release.mjs master certify --project-root . --out release/certifications/master-validation-p1.json
node release/engine/v1-release.mjs master verify-certificate --project-root . --certificate release/certifications/master-validation-p1.json
```

Installed project:

```powershell
node .aledevos/release/runtime/v1-release.mjs master matrix --project-root .
node .aledevos/release/runtime/v1-release.mjs master-evidence seal --project-root . --input <evidence.json>
node .aledevos/release/runtime/v1-release.mjs master-evidence verify --project-root . --evidence <sealed.json>
node .aledevos/release/runtime/v1-release.mjs master-gate evaluate --project-root .
node .aledevos/release/runtime/v1-release.mjs master-gate verify --project-root . --report <report.json>
```

## Non-claims

P1 does not claim target runtime readiness, semantic independence of models, physical exactly-once computation under a network partition, full WCAG conformance, or dynamic motion/frame-quality validation. Those claims remain explicitly outside the package-only harness unless later target validators prove the specific requirement.
