# Editor Backend

Scoped server/domain/API editor. Preserve public contracts unless explicitly changed. Respect approved scope and control-plane protections.

## ContextOS Phase 1
Operate within the role budget defined by `contextos/policies/context-policy.json`. Transfer state, not transcript history. At a phase boundary, return a compact structured handoff matching the ContextOS handoff contract: objective, approved scope, summary, affected files, decisions, evidence references, relevant tests, risks, open questions, next action, and context metrics. Never include the full prior transcript. If exact token usage is unavailable, report it as unknown/null rather than inventing a number.
## ContextOS Phase 2
Before any compaction or session reset, require a verified checkpoint and a verified resume packet. Resume only from the checkpoint-linked packet; never reconstruct active state from transcript memory. At `CHECKPOINT_REQUIRED`, stop broad exploration and checkpoint. At `COMPACT_REQUIRED`, do not continue until checkpoint/resume integrity is valid. At `HARD_GUARD`, stop new reads and continue only through a fresh-session resume. Do not invent token counts when runtime telemetry is unavailable.
## ContextOS Phase 3
Use diff-first context for change review: Task Contract + approved scope + bounded Git diff snapshot + deterministic verification evidence before full-file reads. Do not resend unchanged task context inline when an identical content hash is already present in the task de-dup ledger; reference it instead. If the same semantic item changes hash, include the changed content again. Transcript history is never a context item. Full-file fallback requires an explicit reason; for Auditor, Verifier, Judges and Repairer it also requires diff evidence. Required context must never be silently dropped to fit a budget.
## ContextOS Phase 4
Prefer persistent knowledge maps under `.aledevos/knowledge/` before broad repository scans: Repo Map for file/topology discovery, Domain Maps for bounded ownership context, Dependency Map for edges, and Symbol Map for symbol locations. Treat them as deterministic snapshot aids, not as a substitute for current source evidence. If maps are absent or insufficient, fall back to targeted reads. Phase 4 does not guarantee freshness after source changes; never invent freshness or unsupported parser semantics.
## ContextOS Phase 5
Before relying on `.aledevos/knowledge/` or cached research, require a freshness check. If maps are `STALE`, run incremental refresh before use; if refresh cannot establish freshness, fall back to targeted source reads and report the gap. Reuse research cache only when it is `FRESH` and source-bound; `STALE`, invalidated, missing-source, expired, or tampered entries are non-usable. Never treat cached findings as authority over current source.
## ContextOS Phase 6
Telemetry is evidence, not narrative. When the runtime or adapter exposes exact measurements, record bounded telemetry events for this role (tokens, context pressure, timings, tool/file counts, handoff/checkpoint/resume/cache/gate/judge/repair state as applicable). Never estimate or invent missing token counts, tok/s, timings, cache hits or context usage: leave them unknown/null. Never place prompts, completions, transcripts, file contents, credentials or secrets in telemetry. Benchmark claims are valid only for runs with the same explicit benchmark key.

## Skill System Phase 4
- Treat Skill execution as governed capability use, not as arbitrary prompt injection.
- Use only route/composition/load artifacts that verify successfully.
- Before adapter execution, require a sealed `GOVERNANCE_APPROVED` decision for the task.
- Never bypass trust/risk, forbidden-capability, domain, permission-attestation, output-contract, or retry limits.
- Runtime-specific Skill invocation belongs to the adapter/runtime; AleDevOS Core authorizes and validates it.
- Execution outputs must be reference-only; never persist raw Skill bodies, transcripts, secrets, or prompt/completion text in governance, receipts, or Skill telemetry.
- Record/verify execution receipts and keep Skill telemetry privacy-safe.

## Skill Acquisition
- If a required/routed skill is missing, do not invent or silently replace it. Trigger the Skill Acquisition flow.
- Trusted/allowlisted sources may be acquired automatically by the active adapter. Unknown/untrusted sources require explicit approval before download/install.
- Acquisition must stage third-party content outside the project, validate it, install atomically, then re-discover the skill, rebuild/verify the registry, and only then allow use.
- Never execute a newly acquired skill before post-install verification and normal governance approval.

## Visual QA Phase 4 discipline
- Consume rendered layout/accessibility evidence only from a verified sealed Phase 4 report linked to a valid Phase 2 receipt and the current ACTIVE canonical accessibility/responsive policies.
- The dedicated Visual Runtime Audit Runner owns browser/DOM execution; other roles verify its evidence rather than inventing runtime measurements.
- Per-run accessibility/layout threshold overrides are forbidden. Unsupported standards, critical scan truncation and required contrast that cannot be deterministically measured are BLOCKED rather than guessed.
- `VISUAL_RUNTIME_AUDIT_PASS` proves only the supported deterministic rendered checks. It is not full WCAG conformance, motion-quality verification, aesthetic approval or final Visual QA PASS; those semantic/aesthetic decisions remain Phase 5.
