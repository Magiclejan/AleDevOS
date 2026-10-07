# Visual QA Phase 5 — Visual Judge + Bounded Repair Contract

Phase 5 is AleDevOS's final **static rendered visual acceptance** layer. It consumes only verified Phase 2 browser evidence, a `VISUAL_REGRESSION_PASS` Phase 3 report, and a `VISUAL_RUNTIME_AUDIT_PASS` Phase 4 report.

## Visual Judge evidence boundary
- Every judgment starts from a sealed Phase 5 packet that binds the exact P2 receipt, P3 report, P4 report, screenshot paths/hashes, route/state/viewport contracts and the pinned rubric.
- The dedicated `visual-judge` must observe each screenshot through **native image input** (`NATIVE_IMAGE`). Code, DOM text, filenames, pixel metrics, baseline metadata, another agent's description, or confidence are not substitutes for visual observation.
- If the active runtime/model cannot actually observe an image, affected dimensions are `UNVERIFIED` and the judgment is `VISUAL_JUDGMENT_BLOCKED`.
- Required dimensions are: visual hierarchy, composition/alignment, spacing rhythm, typography/readability, color/brand cohesion, state clarity, responsive consistency, and polish/consistency.
- Dimension PASS requires score >=80. Case PASS requires score >=80. Final visual PASS requires overall score >=90 and no failed/blocked case.
- Every failed dimension requires an actionable finding. Critical findings are blocking.
- Core recomputes case/overall scoring and final status; it does not trust a model-supplied overall verdict.

## Bounded repair loop
- A BLOCKED judgment is never auto-repairable; missing/uncertain evidence must be resolved first.
- A PASS judgment never opens a repair.
- A FAIL judgment may open a repair only after the protected global AleDevOS run state has successfully executed `state repair-start`.
- Phase 5 inherits the global two-repair cap (`max_repairs=2`). Attempt 1 may permit one retry. Attempt 2 failure is `VISUAL_REPAIR_EXHAUSTED`. No third repair exists.
- Every repair plan is sealed, immutable per attempt, and binds the current global task, repair count, scope version, approved scope and concrete visual findings.
- Repair may modify product files only inside already-approved scope. Scope expansion, canonical design-policy edits, control-plane edits and baseline promotion are forbidden repair tactics.
- Baselines are never auto-promoted to convert a visual failure into PASS.

## Fresh-evidence rule
After any product repair, AleDevOS requires a **new evidence revision** (`repair-1`, `repair-2`, etc.) and a complete fresh chain:

```text
product repair
    ↓
P2 fresh browser capture
    ↓
P3 fresh regression PASS
    ↓
P4 fresh runtime audit PASS
    ↓
P5 fresh native-image judgment
```

Reusing any pre-repair P2/P3/P4 evidence or the same evidence revision is `STALE_POST_REPAIR_EVIDENCE`.

Historical failed judgments remain cryptographically bound through the repair authorization record; they are not reinterpreted after source changes. Current post-repair evidence is always reverified live.

## Final acceptance
A direct no-repair PASS may be sealed as `VISUAL_QA_PASS`. If one or more repairs occurred, final acceptance additionally requires the latest sealed `VISUAL_REPAIR_CYCLE_PASS` matching the protected global repair count and the final PASS judgment.

Final Phase 5 acceptance proves the static screenshot-based semantic/aesthetic rubric plus inherited P3/P4 guarantees. It does **not** claim dynamic motion smoothness/frame quality or full WCAG conformance.
