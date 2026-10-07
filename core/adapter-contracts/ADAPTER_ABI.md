# AleDevOS Adapter ABI — Portability Phase 1

Adapters translate runtime primitives into AleDevOS capabilities. They MUST NOT redefine workflows, PASS/BLOCKED/FAILED semantics, Core policies, ContextOS contracts, Skill System governance, UX/UI governance or Visual QA semantics.

## Truthfulness rules

- `enforced`: the adapter/runtime has an enforcement boundary that prevents violation.
- `implemented`: the operation/transport/runtime capability is implemented, but the word does not imply a security boundary.
- `best_effort`: the adapter can assist but cannot prove/enforce the capability.
- `unsupported`: the adapter cannot currently provide it.
- A scaffold MUST remain non-installable.
- Missing/unknown capabilities invalidate the manifest.
- A compatibility profile FAIL/BLOCKED may never be converted into PASS by fallback prose.
- Runtime/model readiness is separate from adapter implementation readiness. An adapter can implement native-image Visual QA while the selected model remains text-only; target preflight must then BLOCK.

## Contract files

Every adapter directory contains `adapter-capabilities.json`. The canonical capability IDs live in `capability-catalog.json`; compatibility requirements live in `compatibility-profiles.json`. `core/adapter-runtime/adapter.mjs` is the deterministic verifier and compatibility evaluator.
