# Design Context

This directory is the project-level visual source of truth managed by AleDevOS.

Phase 1 creates structure only. It deliberately does **not** invent brand, tokens, typography, motion, accessibility rules, or component decisions.

Every section starts as `UNSET` until evidence is discovered or a human/verified Skill output establishes it.

Source precedence:
1. Human-approved design context.
2. Existing canonical design system.
3. Verified runtime discovery.
4. Verified Skill output.
5. Model inference, explicitly labelled as inference.

Mode-specific bootstrap:
- `GREENFIELD` -> `DESIGN_GENESIS`
- `BROWNFIELD` -> `DESIGN_SYSTEM_DISCOVERY`
- `HYBRID` -> `DESIGN_AUDIT_AND_CONSOLIDATE`

Skill instruction bodies are not loaded during Phase 1. Missing required Skills are resolved through Skill System acquisition when a later workflow actually needs them.
