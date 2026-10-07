# Visual QA

Visual QA is AleDevOS's rendered-evidence layer. It separates provenance, browser execution, deterministic regression, rendered runtime checks, semantic visual judgment, and bounded product repair.

## Phase 1 — Capture Contracts + Evidence Integrity
Creates a sealed matrix from explicit routes/states and ACTIVE responsive-policy viewports. It snapshots source, constrains screenshot paths, and seals PNG evidence without claiming visual quality. Optional `evidence_id` revisions preserve repair generations.

## Phase 2 — Browser Capture Runner
Executes a valid Phase 1 plan through an adapter-owned browser provider. The OpenCode reference provider targets Chromium via Playwright. It attests deterministic browser execution and screenshot provenance only.

## Phase 3 — Approved Baselines + Pixel Visual Regression
Promotes verified Phase 2 screenshots into immutable explicitly approved baselines and compares current PNGs deterministically. Contract drift is BLOCKED; failed comparisons never auto-promote.

## Phase 4 — Rendered Layout + Accessibility Runtime Checks
Reopens the exact verified Phase 2 cases through the adapter browser and records sealed DOM/runtime evidence. The canonical Accessibility and Responsive policies must be ACTIVE. Supported checks include overflow, focus containment/reachability/visibility, accessible names, rendered image alt, target geometry and measurable rendered text contrast.

## Phase 5 — Visual Judge + Bounded Repair Loop
Requires P3 PASS + P4 PASS for the same verified P2 evidence, then creates a sealed packet for native-image semantic/aesthetic review. The dedicated Visual Judge scores eight pinned dimensions and Core computes the result. Missing image observation or required evidence blocks rather than guesses.

A semantic FAIL may enter at most two protected repair attempts. Repair plans inherit current global scope; they forbid scope expansion, canonical policy edits and baseline promotion. Every repair requires a new evidence revision and fresh P2 → P3 → P4 → P5 evidence. Attempt 2 failure is exhausted. Final PASS after repair requires the latest successful repair cycle.

Commands after installation:

```powershell
node .aledevos/visualqa/runtime/visual-judge.mjs packet prepare --project-root . --receipt <p2> --phase3-report <p3> --phase4-report <p4>
node .aledevos/visualqa/runtime/visual-judge.mjs packet verify --project-root . --packet <packet>
node .aledevos/visualqa/runtime/visual-judge.mjs judgment verify --project-root . --judgment <judgment>
node .aledevos/visualqa/runtime/visual-judge.mjs repair verify --project-root . --plan <repair-plan>
node .aledevos/visualqa/runtime/visual-judge.mjs cycle verify --project-root . --cycle <cycle>
node .aledevos/visualqa/runtime/visual-judge.mjs acceptance verify --project-root . --acceptance <acceptance>
```

`VISUAL_QA_PASS` is static screenshot-based final visual acceptance. It is **not** full WCAG conformance and does not prove dynamic motion/frame smoothness.
