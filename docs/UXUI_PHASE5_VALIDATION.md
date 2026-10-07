# UX/UI Phase 5 Validation — Motion Director + Motion Language

Status: **COMPLETE / FROZEN for Phase 5 scope**

## Scope
This phase implements motion governance only. It does **not** implement rendered visual regression, screenshot analysis, pixel comparison, or a Visual Judge; those belong to the later Visual QA block.

## Implemented
- Read-only `motion-director` role in Core and OpenCode adapter.
- Project-canonical Motion Language under `.aledevos/design/motion-language.json` plus a human-readable mirror.
- `UNSET` initialization with **no invented duration/easing values**.
- Explicit approval required before Motion Language becomes ACTIVE.
- Required semantic duration tokens: `micro`, `standard`, `large`.
- Required easing tokens: `enter`, `exit`, `emphasis`.
- Mandatory reduced-motion policy.
- Motion plans with platform-aware preferred Skills and `ux.motion` capability routing.
- Missing motion Skills use existing Skill System Safe Acquisition (`ACQUIRE_IF_TRUSTED_ELSE_APPROVAL`).
- Sealed Motion Contracts and Motion Reviews.
- Token reference validation, reduced-motion validation, raw-literal guards, decorative infinite-loop blocking, source/path checks and reference-only Skill evidence.
- Drift detection across Design Context, Motion Language, Motion Contracts and Motion Reviews.
- Bounded deterministic detection of motion-related source signals.
- Installer wiring for runtime, state directories and Motion Language initialization.

## Skill leverage
Preferred Skills remain external/on-demand and are never embedded into the Core:
- `animation-vocabulary`
- `find-animation-opportunities`
- `animate`
- `animate-expo`
- `improve-animations`
- `emil-design-eng`
- `apple-design`

If a routed Skill is not installed, Skill System Phase 5 acquisition resolves/downloads it through the active adapter when the source is trusted/allowlisted; unknown sources require explicit approval. Post-install discovery and hash verification are mandatory before use.

## Deterministic test result
- UX/UI Phase 5: **33/33 PASS**
- Cumulative suite: **334/334 PASS**
- JSON parse: **80/80 PASS**
- MJS syntax: **29/29 PASS**
- Skill-body leakage marker check: **PASS**

## Adversarial coverage
PASS coverage includes:
- Motion Language tampering.
- Human-readable canonical artifact drift.
- Design Context drift.
- Plan drift.
- Contract tampering.
- Review tampering.
- invalid duration/easing token references.
- missing reduced-motion behavior.
- raw duration/easing literals without approval.
- decorative infinite loops without approval.
- inline Skill prompt/body/transcript evidence.
- unsupported platform routing.
- motion-required work with Motion Language still UNSET.

## Boundary
Phase 5 proves policy/contract consistency, **not that rendered animation looks smooth or aesthetically correct**. Runtime visual quality, frame/render behavior, screenshot/video evidence and visual regression stay explicitly deferred to Visual QA.
