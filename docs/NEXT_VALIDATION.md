# Next Validation

Current package: **AleDevOS v1.52.0 — Release Closure**.

The implementation roadmap is complete. The remaining work is release validation only; no new product phase is planned for V1.52.0.

## Remaining release validation

Before AleDevOS v1.52.0 can be tagged and declared RELEASED / V1 FROZEN, the current package must complete the final release-closure sequence:

1. Fresh deterministic regression and package recertification.
2. Real Windows installation acceptance for a new/empty project, an existing non-Git project and an existing Git project.
3. Real target-runtime validation required by the Final Master campaign.
4. Public-release audit over the sanitized public history/snapshot.
5. Final Master Gate with **33/33 PASS, 0 BLOCKED, 0 FAILED**.
6. Only then create the public `v1.52.0` tag/release.

## Visual/runtime evidence boundary

Package-level Visual QA remains frozen and deterministic, but target-runtime claims still require real environment evidence where applicable.

- Real browser evidence must use **Playwright + Chromium** rather than controlled test providers.
- Semantic Visual Judge evidence that depends on seeing screenshots requires a runtime/model with real **native-image** observation.
- If native-image observation is unavailable, Visual QA must remain BLOCKED rather than infer or guess visual quality.
- Static Visual QA does not claim full WCAG conformance or dynamic motion/frame smoothness.

## Current boundary

Windows is the exercised release host. macOS remains target-by-design and is not target-certified by the current release evidence.

This document tracks validation still required for release. Historical implementation phases and frozen subsystem history belong in `CHANGELOG.md`.
