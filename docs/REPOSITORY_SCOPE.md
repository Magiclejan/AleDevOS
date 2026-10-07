# Repository Scope

This repository is the canonical source of truth for AleDevOS.

## Current scope

- AleDevOS Core
- ContextOS
- Skill System
- UX/UI + Visual QA
- Runtime adapters
- Multi-Model
- Advanced Execution
- Efficiency
- Security / Reliability
- Validation
- Tests
- Launchers
- Scripts
- Documentation

Future integrations are intentionally outside the current repository scope until they are explicitly designed and adopted.

## Target projects

AleDevOS supports multiple target projects. Target-project runtime state is separate from the AleDevOS source repository.

## Generated / local-only

The following remain local or generated and should not be committed as source:

- `.aledevos/state/`
- logs
- temporary targets
- campaign run outputs
- runtime receipts containing secrets
- local auth/config credentials
- build caches
