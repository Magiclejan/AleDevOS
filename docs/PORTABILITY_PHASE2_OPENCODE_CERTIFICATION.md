# Portability Phase 2 â€” OpenCode Adapter Certification

Status: FROZEN in AleDevOS `1.29.0-portability-p2` after the deterministic suite passes.

## Scope

Phase 1 proves that an adapter declares a valid Adapter ABI 2.0 manifest. Phase 2 certifies that the OpenCode reference adapter has deterministic evidence for the semantics it claims: OpenCode V2 configuration dialect, ordered permission behavior, role isolation, control-plane write protection, narrow shell bindings, bounded repair, subsystem bindings, and source-to-installed parity.

The canonical adapter-specific certifier is `adapters/opencode/certification/opencode-certifier.mjs`. It is intentionally outside AleDevOS Core because OpenCode configuration semantics belong to the adapter.

## OpenCode V2 dialect

AleDevOS targets OpenCode V2 for this adapter. V2 uses ordered `permissions` rules and the `shell` / `subagent` action names. Phase 2 fails closed if V1 syntax (`permission`, `bash`, `task`) is mixed into the certified configuration. Permission resolution is tested with last-matching-rule semantics, so a later wildcard allow cannot hide behind an earlier deny.

## Certification boundary

Target-runtime model capabilities are external to AleDevOS adapter certification. Native-image readiness remains BLOCKED until compatible runtime evidence proves it.

Likewise, this phase does not claim that Playwright/Chromium is installed on every target PC. It certifies that the OpenCode adapter owns and installs the required provider and that the frozen Visual QA subsystem can consume it. Real target browser/model evidence belongs to target runtime validation.

## Commands

Source package certification:

`node adapters/opencode/certification/opencode-certifier.mjs certify run --root .`

Installed project certification:

`node .aledevos/adapters/opencode/opencode-certifier.mjs certify run --root .`

Source-to-installed parity:

`node adapters/opencode/certification/opencode-certifier.mjs parity verify --source <package> --installed <project> --root <package>`

## Fail-closed examples

Certification fails if the V2 permission array is replaced with a V1 permission object, an agent loses its default shell deny, a writer can mutate `.aledevos/**`, network/external-directory denies are weakened, the canonical verifier binding disappears, the adapter-owned browser provider is missing, or installed files drift from their certified source hashes.
