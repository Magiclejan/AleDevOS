# AleDevOS V1 â€” Final Target Validation

## Purpose

This validation is the release boundary between a deterministic release candidate and **AleDevOS V1 stable**. Architecture/unit fixtures are necessary but are not accepted as substitutes for target-machine evidence.

## Release rule

V1 freezes only when the sealed release report verifies as:

```text
V1_RELEASE_READY
```

The gate is fail-closed. Missing, `BLOCKED`, `FAIL`, stale, tampered or test-provider target evidence cannot be waived.

## Required checks

| Check | Required proof |
|---|---|
| `real_playwright_capture` | Verified P2 receipt from Chromium/Playwright with `provider.provenance=ADAPTER_PROVIDER`, real package/browser metadata and intact PNG hashes. |
| `real_runtime_audit` | Verified P4 PASS using the real adapter provider over the same target runtime. |
| `native_image_visual_judge` | Verified P5 judgment whose screenshots were actually observed through `NATIVE_IMAGE`, with model reference and screenshot hashes. |
| `visual_fail_repair_pass` | Initial visual FAIL, authorized repair attempt 1, product-only edit, fresh evidence revision and final visual PASS. |
| `visual_two_repair_exhaustion` | Repair attempts 1 and 2 both fail, cycle ends `EXHAUSTED`, global repair state is exactly 2/2, and a third-repair probe returns `MAX_REPAIRS_REACHED`. |
| `full_stack_real_project` | Controlled real project ends PASS with scope/integrity/canonical gates PASS, all three judges >=90/no blockers, and acceptance criteria VERIFIED. |
| `security_permissions_target` | Target adapter security inspection passes canonical deny policy and role separation. |
| `deterministic_regression` | At least 600 deterministic tests, 53 MJS syntax checks, 124 JSON parse checks and zero failures for the current package. |

## Step A â€” deterministic RC regression

From the v1.27 package:

```powershell
.\scripts\35-self-test-v1-release-candidate.ps1
```

The script writes `V1_RC_REGRESSION_SUMMARY.json` locally. To seal that result into the same controlled target project later:

```powershell
.\scripts\35-self-test-v1-release-candidate.ps1 -ProjectPath "<smoke-workspace>"
```

## Step B â€” real browser/runtime evidence

```powershell
.\scripts\34-v1-target-runtime-smoke.ps1 -BootstrapPlaywright
```

The script:
- creates a disposable Git project;
- installs the OpenCode reference adapter and portable AleDevOS runtime;
- approves explicit fixture responsive/accessibility policies;
- starts a loopback-only HTTP fixture;
- executes real Chromium/Playwright P2 capture through the adapter;
- verifies P2 receipt/hash integrity;
- performs P3 baseline comparison;
- performs and verifies real P4 runtime audit;
- seals P2, P4 and security release evidence;
- runs preflight and the release gate;
- preserves the workspace for later P5/repair/full-stack evidence.

A `--provider-module`/controlled-test provider cannot satisfy this release evidence because provenance is explicitly sealed.

## Step C â€” native-image target readiness

Inside the smoke workspace:

```powershell
node .aledevos/release/runtime/v1-release.mjs system preflight --project-root .
```

AleDevOS does not bundle a model provider. Native-image readiness is determined only from target-runtime evidence.

```text
TARGET_RUNTIME_BLOCKED
native_image_visual_judge = BLOCKED
reason = native_image_input_not_declared
```

Do not edit evidence to bypass this. Configure a legitimate image-capable target runtime/model, rerun preflight, then execute P5 against the actual PNGs.

## Step D â€” prove both bounded-repair paths

### Repair-success path
1. produce a deliberate visual defect in the approved product scope;
2. P2/P3/P4 evidence must be fresh for `initial`;
3. P5 must issue a genuine actionable FAIL;
4. invoke protected global `state repair-start` exactly once;
5. authorize repair attempt 1 via the Visual Repair Controller;
6. Repairer edits product files only within approved scope;
7. generate `repair-1` evidence through fresh P2 â†’ P3 â†’ P4 â†’ P5;
8. final acceptance must PASS;
9. seal `visual_fail_repair_pass` evidence.

### Exhaustion path
1. use a controlled defect that remains failing after two authorized repairs;
2. execute repair attempt 1 and fresh P2 â†’ P5; keep FAIL;
3. execute repair attempt 2 and fresh P2 â†’ P5; keep FAIL;
4. cycle must end `EXHAUSTED` and run state must show `repair_count=max_repairs=2`;
5. explicitly attempt a third `state repair-start`; it must exit with `MAX_REPAIRS_REACHED`;
6. seal `visual_two_repair_exhaustion` including the third-repair probe artifact.

No third product repair is permitted.

## Step E â€” full controlled real-project run

Run AleDevOS end-to-end on one controlled real change. Release evidence requires:
- final state PASS;
- deterministic Scope, Integrity and Canonical gates PASS;
- Requirements, Regression and Quality judges each >=90 with no blocker/unverified critical evidence;
- all acceptance criteria VERIFIED;
- no bypass of protected repair limits or control-plane permissions.

Seal the final result as `full_stack_real_project`.

## Step F â€” release decision

```powershell
node .aledevos/release/runtime/v1-release.mjs gate evaluate --project-root .
```

Then verify the emitted report:

```powershell
node .aledevos/release/runtime/v1-release.mjs gate verify --project-root . --report <report-path>
```

Only `V1_RELEASE_READY` means the roadmap item **Congelar V1 estable** can be marked COMPLETE/FROZEN.

## Non-claims

This release boundary does not convert static screenshots into temporal evidence. V1 still does not claim dynamic animation/frame smoothness or complete WCAG conformance.
