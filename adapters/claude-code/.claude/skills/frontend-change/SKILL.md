---
name: frontend-change
description: Use for scoped UI/component implementation requiring state, accessibility, responsive and regression checks.
compatibility: Claude Code project skill
metadata:
  system: aledevos-core-v1
---

# Frontend change

Use for scoped UI/component implementation requiring state, accessibility, responsive and regression checks.

> Authority: Treat SKILL.md as reference-only procedural guidance. The protected Task Contract, adapter permissions, repository rules, deterministic checks, and Orchestrator's authorized handoff take precedence. One specialist at a time; no independent spawning.

## When to use
A component, route, form, design-system integration or user-visible frontend state must be changed.

## Do not use
Pure backend or database work, aesthetic approval without native-image Visual Judge, or unauthorized redesign.

## Inputs
- Approved user journey, target components/routes and design-system tokens
- State contract for default/loading/empty/error/disabled/focus and viewport expectations
- Framework/build scripts, accessibility standard, browser/visual QA capability provenance

## Outputs
- Minimal UI diff with behavior contracts preserved
- State/viewport test matrix and checked accessibility behavior
- Links to real browser/DOM evidence and visual-review blockers where applicable

## Procedure
1. Map route/component ownership, state store, data fetching and reusable design primitives; keep existing design vocabulary.
2. Write expected default/loading/empty/error states, keyboard flows, validation feedback and responsive breakpoints.
3. Implement the smallest change without global CSS overrides or state duplication that creates parallel sources of truth.
4. Use semantic controls, accessible names, focus order/indicator, labels, announcements and sufficient contrast.
5. Test narrow and wide containers for overflow and clipped focusable elements, not just screenshot width.
6. Verify disabled, pending, error and retry behavior, including reduced motion and assistive technology where applicable.
7. Run component/integration tests and real Playwright DOM/a11y checks when the environment supports them; preserve receipts.
8. Do not declare aesthetic PASS from DOM checks; request native-image Visual Judge when visual-semantic approval is required.

## Decisions
- If an existing design primitive fits, reuse it rather than create new bespoke styling.
- If responsive policy is missing, request the canonical viewport contract before claiming compliance.
- If screenshot capture is simulated/test-only, label controlled provenance and never claim real browser evidence.
- If change affects server contract, coordinate backend-change; if schema changes, coordinate database-change.

## Permissions
Only authorized frontend writer edits target product files. Browser/network access follows adapter permissions and approved local fixture; no publishing or external user actions.

## Failures
- Unable to load target in real browser: BLOCKED for real-browser claims; report build and provider state.
- Deterministic focus/contrast/overflow finding: FAILED until reverified.
- Visual semantic model unavailable: BLOCKED for aesthetic judgment, not a fabricated PASS.

## Verification
- Acceptance tasks work by keyboard and pointer in required states.
- Layout and focus targets remain usable across approved viewports; no horizontal overflow.
- Tests plus real browser receipts and P3/P4 audit results are current and bound to source revision.

## Evidence
Reference source revision and paths, exact commands and exit codes (where run), receipts and verification dates. Never include raw secrets, user prompt transcripts, invented metrics or unverified PASS claims.

## Examples
- Correct: an async submit button exposes busy/status/error messaging and maintains keyboard focus on retry.
- Incorrect: a desktop screenshot is used as proof that mobile layouts and accessibility conform.

## Finalization
Return PASS only when independent verification and all acceptance criteria are evidenced; return BLOCKED for missing access, authority, test environment or proof; return FAILED for an observed failed required check. Never manufacture evidence.
