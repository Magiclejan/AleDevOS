# Multi-Model Phase 1 — Second Judge Model

Status: COMPLETE / FROZEN at package level in v1.34.

P1 separates **runtime adapters** from **model identity**. A runtime adapter controls tools, filesystem/network policy, roles and installation. The Multi-Model layer records which provider/model produced a Judge result and proves that two Judge runs consumed the same immutable input and rubric.

## Contract

- two explicit logical slots: `primary` and `secondary`;
- target runtime must bind both slots to concrete provider/model identities;
- the same provider+model identity cannot occupy both slots;
- every sealed Judge evidence records provider, model, modalities, context-window metadata, cost class and runtime readiness;
- `visual` Judge evidence requires the selected model to declare image capability;
- pair comparison requires identical task, role, input SHA-256 and rubric SHA-256;
- an unavailable/unbound model produces `INCOMPLETE` / readiness BLOCKED, never fabricated agreement;
- pair comparison never sets AleDevOS final state;
- the deterministic AleDevOS gate remains the final decision authority.

## Deliberately deferred

P1 does **not** implement routing, provider-diversity policy or fallback. Those remain Multi-Model P2, P3 and P4 respectively.

No concrete secondary model is hard-coded by the package. That is a target binding decision and must be explicit evidence, not an AleDevOS guess.
