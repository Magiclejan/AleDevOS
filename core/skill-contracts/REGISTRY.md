# Skill Registry Contract — Phase 1

AleDevOS treats skills as portable capabilities, not as runtime-specific prompt folders.

## Phase 1 invariants

1. The registry stores **metadata only**. Instruction bodies are never embedded in the registry.
2. Skills are identified by stable logical IDs.
3. Runtime adapters bind logical skill IDs to physical runtime paths.
4. A bundled skill is usable only when its runtime binding exists and its SHA-256 matches the binding contract.
5. An external skill may be declared before discovery, but `DECLARED_UNRESOLVED` skills are **not usable**.
6. Duplicate skill IDs fail closed.
7. Registry integrity is sealed with SHA-256.
8. Skills default to `on-demand`; loading every skill into every prompt is forbidden.
9. Phase 1 does not select, compose or execute skills. Those belong to later Skill System phases.

## Universal vs adapter-specific

Universal:
- skill ID;
- domain/role;
- capabilities/intents;
- dependencies/conflicts;
- trust/provenance;
- load policy.

Adapter-specific:
- physical path;
- runtime binding hash;
- runtime availability.
