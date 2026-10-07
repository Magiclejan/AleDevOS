# Skill Composition + On-demand Loading Contract

1. Routing produces logical skill IDs only. It never implies that all skill instructions should be loaded.
2. Composition expands only declared dependencies of routed skills.
3. Every dependency must be registered, runtime-usable, and hash-valid.
4. Any declared conflict between composed skills blocks composition.
5. Dependency cycles block composition; order is deterministic and dependencies precede dependents.
6. Instruction bodies are loaded only after a successful composition.
7. A load packet must verify source SHA-256 again at load time. Discovery or registry trust is not enough after source drift.
8. Skill instruction loading consumes the ContextOS budget of the target agent. Required instructions are never silently truncated or partially loaded to make a budget fit.
9. If the composed instruction set does not fit, loading blocks and the caller must reduce task scope, change composition, checkpoint/compact, or select an appropriate runtime profile.
10. The persisted load packet may contain the selected skill instruction bodies; route and composition artifacts remain metadata-only.
11. Execution inputs are reference-only. Full transcripts are forbidden.
12. The execution handoff specifies required outputs and references the sealed load packet; it does not execute a runtime-specific skill.
13. Runtime execution remains an adapter concern and is disabled in Skill System Phase 3.
