# AleDevOS Architecture — v1.32 Portability Phase 5

`core/` defines universal development semantics. `contextos/` owns context/knowledge continuity. `skillsystem/` owns specialist capability governance. `uxui/` owns canonical design/interaction governance. `visualqa/` owns rendered-evidence contracts. `adapters/` translate those contracts into runtime-specific tools.

OpenCode is Adapter #1, not an architecture boundary.

```text
AleDevOS Core
  ↓
ContextOS 1.0
  ↓
Skill System 1.1
  ↓
UX/UI System 1.0
  ↓
Visual QA
  ├─ P1 capture contract + evidence integrity      COMPLETE
  ├─ P2 browser capture execution                  COMPLETE
  ├─ P3 approved baselines + pixel regression      COMPLETE
  ├─ P4 rendered runtime checks                    COMPLETE
  └─ P5 Visual Judge + bounded repair              COMPLETE
  ↓
Runtime Adapters
  ├─ OpenCode
  ├─ Codex
  ├─ Claude Code
  ├─ Google Antigravity (canonical)
  │   └─ Gemini (compatibility alias)
  └─ Generic
```

## Adapter ABI boundary

Portability Phase 1 introduces a deterministic Adapter ABI before runtime-specific implementations expand. Core owns capability IDs/profiles and validates adapter manifests; adapters own runtime mappings. Compatibility BLOCKS when a required capability is only `best_effort`/`unsupported`. No adapter may reinterpret Core workflow semantics.

Adapter implementation readiness and target runtime readiness are intentionally separate. For example, an adapter may implement the P5 native-image pathway while a selected text-only model still causes target preflight to BLOCK.

## Visual QA boundary
Phase 1 remains runtime-agnostic. Core/Visual QA defines the exact matrix, provenance and evidence rules; it does not know how a specific runtime launches Chromium, WebKit, a mobile simulator or another renderer. Phase 2 adapters execute the matrix and return evidence into the universal contract.

Screenshot presence is not visual correctness. Phase 3 adds immutable approved baselines and deterministic pixel regression, Phase 4 proves its supported rendered geometry/accessibility checks, and Phase 5 adds the native-image semantic/aesthetic Visual Judge plus bounded repair acceptance.

## Visual QA Phase 2 boundary
Visual QA Core defines the sealed browser-execution contract and receipt verification. Browser implementation remains adapter-owned. In the OpenCode reference adapter, `adapters/opencode/visualqa/playwright-driver.mjs` provides Chromium/Playwright execution and is installed into `.aledevos/visualqa/providers/`. The dedicated `visual-capture-runner` subagent is the only role allowed to execute browser capture; read-only verification roles may verify receipts but may not run arbitrary browser or shell commands.


## Visual QA Phase 3 boundary
Phase 3 is universal and does not require a model to compare images. The portable regression runtime verifies Phase 2 evidence, verifies an immutable approved baseline, decodes supported deterministic PNGs, applies only the baseline-pinned named tolerance profile, and emits sealed PASS/FAIL/BLOCKED reports plus hashed diff images.

Baseline approval is a governance action, not a repair shortcut. It requires an explicit approval reference, never happens automatically after FAIL, and a new target uses a new immutable baseline ID. Phase 3 still does not claim aesthetics, rendered accessibility, layout correctness, contrast, or motion quality.

## Visual QA Phase 4 boundary
Phase 4 keeps browser/DOM measurement adapter-owned and deterministic policy/classification portable. The runtime engine verifies the Phase 2 receipt, canonical Accessibility/Responsive policies and optional Phase 3 report, while the adapter provider exposes a narrow `audit()` operation for exact route/state/viewport cases.

Phase 4 may prove only its supported rendered checks. It must not claim full WCAG conformance or aesthetic/semantic visual quality. Phase 5 consumes only P3/P4 PASS evidence and adds the semantic/aesthetic static screenshot verdict.


## Visual QA Phase 5 boundary
Phase 5 separates semantic visual judgment from product mutation. `visual-judge` must use native image observation and cannot edit product code; `visual-repair-controller` manages sealed repair/acceptance state and cannot judge or edit; `repairer` may edit product files only inside the already-approved scope and cannot self-approve.

The portable engine binds P2/P3/P4 hashes, computes rubric outcomes, couples repair authorization to protected global repair state, enforces a maximum of two repairs, requires new evidence revisions after edits, and rejects stale post-repair P2/P3/P4 evidence. Baselines are never automatically promoted. Final static acceptance still does not claim dynamic motion smoothness or full WCAG conformance.


## V1 final release boundary

AleDevOS v1.27 adds a release-validation layer **after** the frozen P1-P5 stack. It does not change semantic ownership of Core, ContextOS, Skill System, UX/UI or Visual QA. Instead it proves that the target adapter/runtime can execute the frozen contracts for real.

```text
Frozen AleDevOS stack
  ↓
Target Runtime Preflight
  ↓
Real P2/P4 adapter evidence
  ↓
Native-image P5 evidence
  ↓
Bounded repair success + exhaustion proofs
  ↓
Full controlled real-project PASS
  ↓
Security + deterministic regression
  ↓
V1_RELEASE_READY
  ↓
V1 may be frozen
```

The release layer is read-only with respect to product code. It seals and verifies evidence under `.aledevos/state/release/v1/`; it cannot repair the product, judge screenshots on behalf of P5, promote baselines or relax canonical policies.

Target browser evidence additionally seals provider provenance. `CONTROLLED_TEST_PROVIDER` remains valid for deterministic tests but is categorically rejected for the final target evidence; V1 requires `ADAPTER_PROVIDER`.

Native-image capability is derived from the active adapter model declaration and must then be demonstrated by real P5 evidence. A text-only declaration is `BLOCKED`, never inferred as visual capability.
