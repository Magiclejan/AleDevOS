# UX/UI Phase 1 Contract — Project Mode + Design Context

AleDevOS MUST determine visual project mode before major UI work.

Modes:
- GREENFIELD: little/no existing UI evidence; bootstrap with DESIGN_GENESIS.
- BROWNFIELD: meaningful existing UI; bootstrap with DESIGN_SYSTEM_DISCOVERY.
- HYBRID: existing UI plus explicit redesign/consolidation intent; bootstrap with DESIGN_AUDIT_AND_CONSOLIDATE.

Rules:
1. HYBRID is never guessed from repository size alone; it requires explicit intent or a human override.
2. Existing UI evidence prevents an automatic GREENFIELD classification unless a human explicitly overrides it.
3. Design Context is canonical project knowledge under `.aledevos/design`.
4. Missing evidence stays UNSET. Never fabricate brand/tokens/design rules to make the context look complete.
5. Human-approved design context outranks existing canonical system, verified discovery, verified Skill output, and labelled model inference.
6. Skill routing is metadata-only in Phase 1. Skill instruction bodies are loaded only when a later workflow needs them.
7. If a required Skill is absent, Skill System acquisition policy applies: trusted/allowlisted sources may auto-acquire; untrusted sources require approval; re-discovery and verification are mandatory before use.
8. Mode decision and Design Context are integrity-sealed and fail closed on tampering.
