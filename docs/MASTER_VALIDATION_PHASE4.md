# Master Validation P4 — Visual Runtime + Bounded Repair

Status: **COMPLETE / FROZEN for the P4 harness contract**. Target checks remain PASS/BLOCKED/FAIL according to evidence produced on the actual target.

P4 owns exactly five Master checks:

- `playwright_chromium_real`
- `runtime_layout_a11y_real`
- `native_image_visual_judge_real`
- `visual_repair_success_real`
- `visual_repair_exhaustion_real`

## Boundary

P4 does not replace Visual QA P1-P5. It re-verifies the frozen Visual QA artifacts. A controlled test provider can exercise the contract in package tests but can never satisfy target PASS evidence. Real PASS requires `ADAPTER_PROVIDER`, Playwright + Chromium, a native-image model invocation bound to the exact screenshot SHA-256, and frozen P5 judgment/cycle verification.

## Native-image proof

Use `MASTER_VISUAL_NATIVE_PROBE.example.json` as a template. The probe command requires both `{model}` and `{image}` placeholders, executes without a shell, injects a nonce into the prompt, and seals stdout/stderr plus the exact image SHA-256. Merely declaring `input:[image]` is insufficient.

## Repair proof

Successful repair must verify a real `VISUAL_REPAIR_CYCLE_PASS` at attempt 1 with fresh P2/P3/P4/P5 evidence. Exhaustion must verify attempt 1 `VISUAL_REPAIR_RETRY_ALLOWED`, attempt 2 `VISUAL_REPAIR_EXHAUSTED`, and a recorded rejected third `repair-start` (`MAX_REPAIRS_REACHED`). There is no third automatic repair.

## Commands

```powershell
.\scripts\56-self-test-master-validation-phase4.ps1
.\scripts\57-master-validation-p4-target-visual.ps1 -InventoryOnly
.\scripts\57-master-validation-p4-target-visual.ps1 -Profile .\my-p4-target-profile.json
```

P4 explicitly does not claim full WCAG conformance or dynamic motion/frame-quality validation.
