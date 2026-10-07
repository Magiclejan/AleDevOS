# Telemetry event guidance

Emit only exact metrics supplied by a runtime/provider or deterministically derived from exact inputs. Never estimate missing values.

Recommended sequence:
1. `telemetry start`
2. emit bounded events during the run
3. `telemetry summarize`
4. `telemetry verify`
5. compare runs only when `benchmark_key` matches

Raw prompts, completions, transcripts and secrets are forbidden.
