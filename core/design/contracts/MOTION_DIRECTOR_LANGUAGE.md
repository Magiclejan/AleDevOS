# UX/UI Phase 5 — Motion Director + Motion Language

## Purpose
Make motion a project-level governed language instead of page-local improvisation. Motion-specific specialist Skills are routed on demand through Skill System; their output is evidence/proposal, never automatic canonical truth.

## Canonical Motion Language
Project values live in `.aledevos/design/motion-language.json` with a human-readable mirror in `motion-language.md`. Initialization is `UNSET`; AleDevOS must not invent durations or easing values. Activation requires explicit approval of verified evidence. Reduced-motion support is mandatory.

## Motion Director
Read-only planning role. It creates the motion plan, requests the minimum `ux.motion` Skills, requires Safe Acquisition when missing, and produces a Motion Contract. It does not edit product code.

## Motion Contract
Every motion-relevant change references semantic duration/easing tokens, declares reduced-motion behavior, and uses reference-only Skill evidence. Raw duration/easing literals or decorative infinite loops are blocked unless an explicit approved exception exists.

## Review
A sealed Motion Review fails closed on Design Context drift, Motion Language drift, invalid token references, missing reduced-motion behavior, contract tampering, decorative infinite loops, or inline Skill bodies/transcripts. Visual smoothness and rendered aesthetics remain a later Visual QA responsibility.
