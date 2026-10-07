# Canonical Repository Architecture

```text
Magiclejan/AleDevOS
├── core/                      # runtime-agnostic authority
├── adapters/                  # runtime/provider translations
├── contextos/                 # context and project knowledge
├── skillsystem/               # skill discovery/routing/acquisition
├── uxui/                      # UX/UI governance
├── visualqa/                  # browser/render/visual QA
├── multimodel/                # model registry/router/diversity/fallback
├── advanced-execution/        # worktrees/workers/concurrency/dispatch/transport
├── efficiency/                # efficiency governor and benchmarks
├── security-reliability/      # assurance and reliability registry
├── release/                   # release policies/schemas/certifiers/templates
├── scripts/                   # operator/validation/install scripts
├── tests/                     # deterministic tests
├── docs/                      # architecture and operating docs
├── repo-tools/                # repository bootstrap/migration tooling
└── .github/workflows/         # repository integrity gates
```

Not every path must exist before the initial local baseline import. The importer preserves the real V1.51 tree as source of truth and the repository then evolves from that exact baseline.

## Multi-project model

AleDevOS itself is one codebase. It installs/projects into N independent target projects.

```text
AleDevOS canonical repo
     ├─ installs → Project A
     ├─ installs → Project B
     └─ installs → Project N
```

A launcher may remember a registry of known target paths, but a selected target is session-scoped. No single machine-global target project is authoritative.

## Final Master campaign

Preparation is orchestrated by AleDevOS. Operators should not manually locate campaign JSON files. The application is responsible for:

- target selection;
- real profile discovery/bootstrap;
- schema validation;
- evidence generation;
- final campaign creation;
- final master execution;
- fail-closed diagnostics.

No example/template file is promoted as real evidence merely because it parses.
