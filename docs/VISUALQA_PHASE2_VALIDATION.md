# Visual QA Phase 2 — Validation

Status: **COMPLETE / FROZEN for the Phase 2 contract**.

## Scope
Phase 2 adds deterministic browser execution on top of a sealed Phase 1 capture plan. The reference provider contract targets Chromium through Playwright, while keeping browser execution adapter-owned.

Implemented guarantees:
- Phase 1 plan is re-verified before any browser execution;
- local development server must be reachable before capture;
- only Chromium is allowlisted in the Phase 2 reference policy;
- one isolated browser context per capture case;
- exact approved viewport width/height from the Phase 1 plan;
- deterministic device scale, locale, timezone, color scheme, reduced-motion, service-worker, font, animation and stabilization settings;
- captures execute sequentially;
- screenshot path is never chosen by the provider: it is the exact Phase 1 path;
- non-default UI states require explicit ready-selector attestation;
- route customization is limited to query/hash suffixes that cannot change origin/path;
- no arbitrary JavaScript/interaction script channel is exposed by the Phase 2 contract;
- successful captures are sealed again through Phase 1 PNG/source evidence and then a Phase 2 receipt;
- receipt/spec/plan/Phase-1-run/screenshot drift is detected;
- receipts remain reference/hash based and do not embed screenshot bytes;
- Phase 2 explicitly keeps `visual_quality_verified=false` and `visual_regression_verified=false`.

## Test strategy
The orchestration contract is tested with a controlled provider fixture under the explicit test-only provider seam. Production arbitrary-provider injection is blocked. The real Playwright provider module is syntax-validated and has a fail-closed `doctor` path when Playwright/Chromium is unavailable.

## Deferred by contract
- browser package provisioning across every runtime/OS;
- baseline promotion and image diff;
- rendered overflow/layout checks;
- rendered accessibility/contrast checks;
- motion smoothness;
- Visual Judge and visual repair loop.

## Validation results
- Phase 2 tests: **34 / 34 PASS**.
- Cumulative AleDevOS suite: **430 / 430 PASS**.
- Node syntax: **38 / 38 `.mjs` PASS**.
- JSON parse: **102 / 102 `.json` PASS**.
- Failures: **0**.

## Real-browser integration note
The packaging environment has a Chromium binary but does not have the Playwright Node package installed. The production Playwright provider therefore returned `PLAYWRIGHT_PROVIDER_MISSING` in its fail-closed doctor check. The browser orchestration path was exercised end-to-end with the controlled provider fixture, including real loopback server probing, PNG production/sealing, state readiness, redirects and tamper checks. A real Playwright/Chromium smoke run remains part of final adapter/master validation on the target runtime; no success claim is made for that unexecuted integration here.
