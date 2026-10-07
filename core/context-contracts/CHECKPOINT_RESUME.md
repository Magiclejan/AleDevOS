# ContextOS Checkpoint + Resume Contract — Phase 2

ContextOS must never rely on transcript history as the only carrier of active task state.

## Trigger bands

Budget pressure is evaluated against the runtime profile's **usable input capacity**:

- `NORMAL`: continue normally.
- `WATCH`: reduce context growth and avoid broad reads.
- `CHECKPOINT_REQUIRED`: capture and seal a checkpoint before more exploration.
- `COMPACT_REQUIRED`: a verified checkpoint + verified resume packet must exist before compaction or a new session.
- `HARD_GUARD`: stop new reads and continue only through `NEW_SESSION_AND_RESUME`.

## Checkpoint invariants

A checkpoint must:

1. carry the exact protected AleDevOS `run_state` object;
2. capture current Git working-set metadata without dumping full file contents;
3. include objective, summary, decisions, evidence references, risks, open questions and next action;
4. state the source runtime profile / context pressure;
5. explicitly declare `transcript_included=false`;
6. be sealed with SHA-256 over canonical JSON excluding the integrity block;
7. stay below the configured checkpoint token ceiling.

A modified checkpoint whose hash no longer matches is invalid and must not be resumed.

## Resume invariants

A resume packet is derived deterministically from a verified checkpoint. It must preserve the checkpoint's **critical state exactly**:

- task objective/constraints;
- AleDevOS run state, including scope version, criteria, gates, judges, blockers and repair count;
- working set;
- decisions/evidence/tests;
- risks/questions;
- next agent/action/required reads/forbidden actions.

The packet stores both the source checkpoint hash and a `critical_state_sha256`. Resume validation fails if any of these fields diverge.

## Runtime independence

Core expresses `CHECKPOINT -> RESUME -> TRANSITION` as capabilities. Adapters choose how to compact:

- native compaction, then inject/restore the verified resume packet; or
- a fresh session started from the verified resume packet.

At `HARD_GUARD`, Core prefers a fresh session even when native compaction exists.

## No false precision

If exact token usage is unavailable, do not invent it. Native runtime compaction remains a safety net; exact automatic triggering is completed by the telemetry phase.
