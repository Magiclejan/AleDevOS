# Structured Handoff Contract — ContextOS Phase 1

A phase boundary transfers **state, not conversation history**.

Every handoff must contain:
- task and phase identity;
- source and target agent;
- objective and approved scope;
- concise summary;
- affected files and why they matter;
- decisions and rationale;
- evidence references and claims;
- relevant tests;
- risks and open questions;
- exactly one next action;
- context metrics.

Rules:
1. Never paste the full prior transcript into a handoff.
2. Evidence is referenced, not recopied wholesale.
3. A handoff should normally remain well below the 4,000 estimated-token ceiling.
4. If context pressure is WATCH or above, shorten the handoff further and stop exploratory reads.
5. Unknowns stay explicit; do not convert uncertainty into conclusions.
6. Handoffs do not change approved scope. Scope changes still require SCOPE_ESCALATION.
7. Runtime adapters may transport the handoff inline, as an artifact, or through a native session mechanism, but the semantic contract is the same.

Canonical schema: `contextos/schemas/handoff.schema.json`.
