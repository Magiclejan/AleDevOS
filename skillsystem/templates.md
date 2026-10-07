# Skill System 1.0 artifact flow

```text
route
  → composition
  → on-demand load packet
  → execution handoff
  → governance decision
  → adapter/runtime execution
  → execution receipt
  → output-contract validation
  → skill telemetry
```

Metadata-only until the load packet. The load packet is the only Skill System artifact that contains selected instruction bodies and it lives under ignored runtime state. Governance, receipts and telemetry never contain instruction bodies, prompts or transcripts.

The universal engine authorizes and validates execution but does not directly invoke runtime-specific skills.
