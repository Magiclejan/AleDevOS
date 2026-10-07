# Master Validation P6 — Full-Stack Real Project

Status: **IMPLEMENTED / PACKAGE-CERTIFIED; TARGET EVIDENCE PENDING**

P6 owns exactly the Master check `full_stack_real_project`. It does not implement a second runtime. It binds and independently re-verifies evidence produced by the existing AleDevOS stack.

## Required runtime trace

The controlled project must provide a SHA-256 sealed trace with exactly these stages:

1. ORCHESTRATOR
2. CONTEXTOS
3. SKILL_DISCOVERY
4. RESEARCHER
5. ARCHITECT
6. AUDITOR
7. MODEL_ROUTER
8. DISPATCHER
9. BUILDER_OR_EDITOR
10. VERIFIER
11. BROWSER
12. VISUAL_QA
13. JUDGE_REQUIREMENTS
14. JUDGE_REGRESSION
15. JUDGE_QUALITY
16. FINAL_GATE

Every stage must point to real hash-bound evidence. Model-executed stages also carry provider/model identity and `runtime_invoked=true`.

## Re-verification

P6 re-runs the frozen verifiers for ContextOS handoffs/telemetry, Skill discovery/composition/loading/governance/execution, Multi-Model binding/routing/Judge pair/diversity, Worktree/Worker/Dispatcher evidence, Browser capture, rendered layout/accessibility audit and final Visual QA acceptance. The dispatcher STARTED receipt is also semantically checked and SHA-verified.

## Final deterministic conditions

The controlled project must finish with `final_state=PASS`; scope/integrity/canonical gates PASS; Requirements/Regression/Quality Judges >=90 with zero blockers and zero unverified criteria; all acceptance criteria VERIFIED; repair budget <=2; and all implementation changes inside the globally approved scope.

## Non-claims

P6 does not claim P7 global token/context efficiency, P8 security/reliability assurance or final V1 freeze authority. Package fixtures validate the validator contract only and cannot become target PASS.

## Commands

```powershell
.\scripts\60-self-test-master-validation-phase6.ps1
.\scripts\61-master-validation-p6-target-full-stack.ps1 -InventoryOnly -ProjectPath .\<controlled-real-project>
```

Templates:
- `release/templates/MASTER_END_TO_END_TARGET_PROFILE.example.json`
- `release/templates/MASTER_END_TO_END_ORCHESTRATION_TRACE.example.json`

Package certificate SHA256: `8885fc4b341676b459fb9cb7c028fe8e7e8493e6456bb3e6c98e91dd5aa9a37d`.
