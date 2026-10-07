# Master Validation P2 — Adapter Runtime + Target Security

Status: **COMPLETE / FROZEN** in `1.44.0-master-validation-p2`.

P2 implements the `ADAPTER_RUNTIME` validator extension used by these Master checks:

- `opencode_runtime_security`
- `codex_runtime_security`
- `claude_code_runtime_security`
- `antigravity_runtime_security`
- `cross_adapter_target_security`

P2 does not make those checks PASS at package-build time. It makes PASS *possible only from target evidence*.

## Target receipt contract

Each canonical adapter must produce a sealed runtime receipt proving:

- target CLI is present and reports a real version;
- the installed adapter package certifier is current;
- an active authenticated headless smoke returns the expected runtime token;
- a positive-control product write succeeds, proving the agent actually exercised its tool surface;
- a control-plane write is denied;
- a write outside the project is denied;
- arbitrary shell execution is denied;
- an external network fetch is denied/blocked by the governed runtime;
- no dangerous permission-bypass/auto-approval flag was used;
- smoke/security logs exist and match their SHA-256 values.

A missing CLI/auth/runtime capability is `BLOCKED`, not synthetic PASS.

## Same-target cross-adapter security

`cross_adapter_target_security` requires all four canonical receipts to PASS and to carry the same anonymous `target_fingerprint_sha256`. Evidence from convenient but different machines cannot be combined into a cross-adapter PASS.

## Windows target collection

From the package root:

```powershell
.\scripts\53-master-validation-p2-target-adapters.ps1
```

The script creates disposable Git projects per adapter, installs AleDevOS from the same package, executes the installed probe, copies the receipt together with its hashed logs into Master-owned state, seals the four adapter evidences and then attempts the cross-adapter evidence.

For diagnosis:

```powershell
.\scripts\53-master-validation-p2-target-adapters.ps1 -Adapters codex
```

## Package validation

```powershell
.\scripts\52-self-test-master-validation-phase2.ps1
```

Current package floor after P2:

```text
tests_passed       >= 1625
mjs_syntax_passed  >= 91
json_parse_passed  >= 215
toml_parse_passed  >= 25
failures            = 0
```

## Non-claims

Package certification does not claim that the four target CLIs are installed/authenticated on any particular machine, that network is physically isolated at the OS/network layer, or that later Multi-Model/Visual/Advanced Execution target checks are ready. Those remain explicit Master Validation P3-P6 work.
