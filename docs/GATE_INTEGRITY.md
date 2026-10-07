# Canonical gate integrity

The OpenCode adapter does not let Builder/Repairer/editors run arbitrary test runners. Verifier calls only the protected AleDevOS gate runner.

At install time AleDevOS records:
- expected `package.json` scripts used by canonical gates;
- SHA-256 fingerprints of recognized gate-affecting config (tsconfig/vitest/vite/jest/eslint/pytest files).

If those definitions drift, `gate run` returns `GATE_INTEGRITY_DRIFT` instead of PASS.

A legitimate reviewed config change requires a **human** to run:

```powershell
.\scripts\11-refresh-gate-integrity.ps1 -ProjectPath "D:\repo"
```

This avoids letting the same implementation agent weaken its own verification gate.
