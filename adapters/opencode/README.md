# OpenCode V2 adapter

Reference adapter, not AleDevOS Core.

Uses OpenCode V2 ordered `permissions[]`, `shell`, `subagent`, hard-deny `experimental.policies`, `execute` disabled by default, and native preventive compaction at 64K (`keep=8000`, `buffer=20000`).

Network is denied by default. Add a separate opt-in research profile later rather than weakening every agent.

## ContextOS Phase 2

The adapter installs portable checkpoint/resume schemas, templates and runtime under `.aledevos/contextos/`, with ephemeral artifacts under `.aledevos/state/contextos/`.

Core policy requires verified checkpoint + resume before COMPACT/HARD transitions. OpenCode native compaction is the current runtime safety net. Exact automatic feeding of live token usage into the portable transition planner is deferred to the telemetry phase; the adapter must not fabricate token counts.

Residual limitation: vanilla OpenCode cannot dynamically intercept every edit path based on task scope. AleDevOS combines static control-plane denies with deterministic scope checking before PASS. A future plugin adapter may add pre-write scope interception.


### UX/UI Phase 5
The adapter exposes the read-only `motion-director` subagent and the protected `.aledevos/uxui/runtime/motion.mjs` runtime. External motion Skills are routed/acquired on demand; they are not bundled into the Core.

## Portability Phase 1 ABI

OpenCode is Adapter #1 and the reference implementation of Adapter ABI 2.0. `adapter-capabilities.json` is verified by the portable adapter runtime. Compatibility with `portable_core`, `uxui`, `visualqa` and `full_current` is deterministic; target model/browser readiness remains a separate runtime preflight.
