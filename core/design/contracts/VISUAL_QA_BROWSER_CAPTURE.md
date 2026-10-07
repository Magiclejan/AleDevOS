# Visual QA — Browser Capture Contract

Visual QA Phase 2 converts a **valid sealed Phase 1 capture plan** into browser-produced screenshot evidence. It is an execution layer, not an aesthetic judge.

## Required order
1. Verify the Phase 1 plan before launching a browser.
2. Probe only the already-approved loopback development origin.
3. Execute cases sequentially with the exact approved viewport dimensions.
4. Use a new isolated browser context per case; no cross-case cookies/storage/state leakage.
5. Wait for DOM readiness, declared state readiness, fonts and the bounded stabilization delay.
6. Freeze animations and hide the caret for static screenshot evidence; motion quality is evaluated separately.
7. Write screenshots only to the exact paths declared by the Phase 1 plan.
8. Seal the screenshots through Phase 1 evidence integrity, then seal a Phase 2 execution receipt.
9. Re-verify plan, source, spec, Phase 1 run and screenshot hashes before consuming the receipt.

## State truthfulness
`DEFAULT` may be captured from its declared route without extra state activation. Any non-default state requires an explicit `ready_selector` and may use only a query/hash `route_suffix`. Phase 2 does not execute arbitrary JavaScript or arbitrary interaction scripts to manufacture state.

## Deterministic defaults
The reference browser driver is Chromium via Playwright, headless, 1x device scale, fixed locale/timezone/color scheme per execution spec/policy, reduced motion, service workers blocked, fonts awaited, animations frozen, caret hidden, cases sequential.

## Non-claims
A successful Phase 2 receipt proves that the browser ran and the declared screenshots were captured under the sealed configuration. It does **not** prove visual correctness, visual regression equivalence, rendered accessibility, layout quality, contrast or motion smoothness. Those remain later Visual QA phases.
