# Diff-first + Context De-dup Contract — ContextOS Phase 3

ContextOS Phase 3 reduces repeated prompt/context payload without weakening evidence.

## Diff-first

For change review, begin with:
1. Task Contract and approved scope.
2. Git working-set / diff snapshot.
3. Deterministic gate evidence.
4. Structured handoff / relevant decisions.
5. Targeted excerpts only when the diff is insufficient.
6. Full-file reads only as a justified fallback.

For Auditor, Verifier, Judges and Repairer, a full-file fallback requires both a reason and diff evidence. Diff capture must not stage or otherwise mutate the Git index. Untracked files are represented by path, hash, size and a bounded text preview rather than by staging them.

## De-duplication

Context identity is SHA-256 over canonical content.

- Exact duplicate content inside the same packet -> `REFERENCE_ONLY`.
- Content already emitted in the task ledger -> `REFERENCE_ONLY`.
- Same semantic item id with a changed hash -> `INLINE` again; old knowledge is not silently reused.
- Low-priority optional context may become `OMIT_BUDGET` when the packet budget is reached.
- Required context is never silently omitted. If required context cannot fit, planning fails closed.
- Transcript items are forbidden.

A reference is only valid for content that has previously been emitted inline and recorded in the ledger.

## Scope

Phase 3 de-duplicates **task context payloads**. It does not claim to remove provider/runtime system prompts that a runtime may independently re-send on every model call.
