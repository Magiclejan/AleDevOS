# Skill Discovery + Capability Routing Contract

## Discovery
- Discovery is adapter-specific; the registry and routing contract are runtime-agnostic.
- Only real instruction files are discoverable. A declared name without a source remains unresolved and unusable.
- Discovery never embeds instruction bodies. It stores path, SHA-256, metadata provenance and bounded metadata only.
- Project-local discovery roots are allowed by default. External roots fail closed unless an adapter explicitly enables them.
- Unknown runtime skills require an `aledevos-skill.json` sidecar before they can enter the universal registry.
- A changed instruction or sidecar hash is drift and must be rediscovered before routing.

## Routing
- Routing consumes metadata only; it does not load or execute skill bodies.
- Required capabilities are hard constraints. If the usable registry cannot cover them, routing is BLOCKED.
- Unresolved skills may be suggested, never selected.
- The router chooses a deterministic minimal set: cover the largest number of still-missing required capabilities first, then preferred capability, intent and domain relevance, then stable logical ID.
- `max_skills` is a hard upper bound.
- Dependencies/conflicts are reported but composition is deferred to Skill System Phase 3.

## Context discipline
Discovery and routing results are compact structured artifacts suitable for ContextOS handoffs. Full skill instructions remain on-demand and are not loaded in Phase 2.
