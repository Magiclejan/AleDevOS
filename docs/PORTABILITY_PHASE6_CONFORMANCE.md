# Portability P6 — Cross-adapter Conformance + Portable Skill Pack

Status: **COMPLETE / FROZEN** in AleDevOS Local v1.33.

## Canonical runtime set

P6 compares four independent canonical Adapter ABI 2.0 implementations:

- `opencode`
- `codex`
- `claude-code`
- `antigravity`

`gemini` remains an explicit compatibility alias to `antigravity`; it is not counted as a fifth runtime.

## Cross-adapter conformance

`portability/conformance/conformance.mjs` normalizes package-level behavior across the four runtimes. It verifies:

1. every canonical adapter remains `implemented + installable`;
2. every adapter passes the same `full_current` compatibility profile;
3. every adapter-owned package certificate is fresh;
4. all adapters expose the exact same 24 AleDevOS roles;
5. capability semantics remain equal except for explicitly authorized runtime variance;
6. the shared Playwright provider is byte-identical;
7. Gemini cannot diverge from canonical Antigravity capabilities;
8. runtime-specific names do not leak into AleDevOS Core implementation/policy files;
9. the portable Skill Pack is semantically equivalent on every adapter;
10. package conformance remains separate from target-runtime readiness.

### Authorized capability variance

P6 does **not** force runtimes to lie about native enforcement. Two differences remain explicit:

- `scope_prewrite`: OpenCode is `unsupported`; Codex/Claude Code/Antigravity are `best_effort`.
- `compaction`: OpenCode reports `enforced`; Codex/Claude Code/Antigravity report `implemented`.

The conformance layer checks the shared semantic outcome instead of rewriting these truthful statuses.

## Normalized scenarios

Twenty-six package scenarios are evaluated with portable outcomes. Examples:

- in-scope repository/product operation → `PASS`;
- control-plane write → `BLOCKED`;
- arbitrary shell → `BLOCKED`;
- external directory/network/unrestricted code mode → `BLOCKED`;
- canonical gate, ContextOS, Skills, UX/UI and Visual QA contracts → `PASS`;
- third repair attempt → `BLOCKED`.

P6 uses only `PASS`, `BLOCKED`, and `FAILED` as portable semantic states. Runtime absence/readiness is not converted into package failure; target runtime validation remains deferred to Master Validation.

## Portable Skill Pack 1.0

`skillsystem/portable/portable-skill-pack.json` defines the 13 canonical AleDevOS Skills and their semantic SHA-256 values.

Adapter projections may change only adapter-native frontmatter such as `compatibility`. After normalizing that field, every Skill body must hash identically to Core. Raw adapter files remain independently sealed by each adapter binding, so adapter metadata drift is still detectable.

The installed project also receives the portable Skill Pack manifest at:

```text
.aledevos/skillsystem/portable/portable-skill-pack.json
```

## Core decontamination

P6 removed the remaining OpenCode-specific control-plane paths from `core/policies/security-policy.json`. Core now protects only generic AleDevOS/Git state and delegates runtime-native protected surfaces to the selected adapter `project-template.json`.

The conformance scan fails if `opencode`, `codex`, `claude`, `antigravity`, or `gemini` reappears in Core `.mjs`/`.json` implementation files.

## Source → installed projection

P6 materializes a generic projection for all four canonical adapters and verifies 156 source→installed SHA-256 comparisons covering:

- 24 roles per runtime;
- 13 Skills per runtime;
- adapter capability manifest;
- shared Visual QA Playwright provider.

The projection verifier can also inspect a pre-existing projection tree and detects post-install tampering.

## Certificate

The P6 certificate is written to:

```text
release/certifications/cross-adapter-portability-p6.json
```

It seals the conformance engine/policy, scenarios, portable Skill Pack, Core security policy, all canonical manifests, Skill bindings, Playwright providers, prior adapter certificates, and Gemini alias manifest with root-relative SHA-256 inputs.

## Runtime boundary

P6 is package conformance, not target-machine conformance. It does **not** claim that OpenCode, Codex, Claude Code or Antigravity CLIs are installed/authenticated or that browser/image/hook permissions are active on a target machine. Those remain Master Validation evidence.
