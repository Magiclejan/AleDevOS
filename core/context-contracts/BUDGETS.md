# Context Budget Contract — ContextOS Phase 1+2

ContextOS budgets are portable policy. Runtime/model adapters provide the actual context window and reserve behavior.

For a runtime profile:

`usable_input = context_window - max(max_output_tokens, native_compaction_buffer_tokens)`

Pressure bands are calculated from usable input, not from the advertised context window.

Actions:
- NORMAL → continue;
- target exceeded → reduce context / stop broad exploration;
- WATCH → reduce context aggressively;
- CHECKPOINT_REQUIRED → capture + verify checkpoint and prepare resume;
- COMPACT_REQUIRED → do not compact/swap sessions until checkpoint + resume validate;
- HARD_GUARD → stop new reads and use `NEW_SESSION_AND_RESUME`.

Agent targets are soft operating targets. Pressure thresholds are safety controls.

The Core never hardcodes OpenCode, Claude, Codex, Gemini or a specific model. Adapter/runtime profiles supply those numbers and implement the actual compact/session transition.
