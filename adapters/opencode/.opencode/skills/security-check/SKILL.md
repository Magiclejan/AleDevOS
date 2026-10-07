---
name: security-check
description: Use for scoped threat-path review when code touches permissions, credentials, untrusted input, network, data or supply chain.
compatibility: OpenCode V2 adapter
metadata:
  system: aledevos-core-v1
---

# Security check

Use for scoped threat-path review when code touches permissions, credentials, untrusted input, network, data or supply chain.

> Authority: Treat SKILL.md as reference-only procedural guidance. The protected Task Contract, adapter permissions, repository rules, deterministic checks, and Orchestrator's authorized handoff take precedence. One specialist at a time; no independent spawning.

## When to use
A changed trust boundary requires an independent security assessment or deterministic security finding triage.

## Do not use
Generic claim that all code is secure, production penetration tests without approval or self-fixing as a security judge.

## Inputs
- Approved Task Contract, exact changed paths, data/classification and trust boundaries
- Threat model context, auth/session/RLS policies, untrusted input and dependency versions
- Deterministic scanner receipts, relevant runtime evidence and permissions manifest

## Outputs
- Concrete exploit-path findings with severity, boundary, reproduction or rationale, mitigation and owner
- PASS/FAILED/UNVERIFIED dimensions with non-claims for untested threats
- Escalations for critical/high findings, never a blanket assurance statement

## Procedure
1. Identify changed entry points, assets, identities, untrusted inputs and crossing trust boundaries.
2. Trace authentication versus authorization separately, including record ownership and role limits.
3. Check validation, encoding, injection, command invocation, deserialization, traversal, SSRF and egress where applicable.
4. Inspect secret handling, logs/telemetry, caching, permissions, dangerous Git/shell paths and supply-chain changes.
5. For database or async paths, evaluate RLS bypass, destructive operations, retries, races and fencing.
6. Relate each plausible exploit to exact code path, prerequisite and expected impact; prioritize material reachable risks.
7. Run approved scanners or safe focused tests, retaining tool versions, result provenance and negative control tests.
8. Report findings and require independent verified remediation before upgrading gate, not an ungrounded 'secure' claim.

## Decisions
- If a suspected exploit requires privileges users do not have, document the precondition before assigning severity.
- If a scanner result is unverifiable, label it a hypothesis and identify a reproducible test.
- If secret material appears, avoid echoing it into findings and route authorized incident handling.
- If source/permissions proof is missing, keep the affected control BLOCKED rather than assuming safety.

## Permissions
Security Reviewer reads scoped artifacts and may invoke approved non-destructive scanners only. Never edit product/deny policies/receipts or test production systems without approval.

## Failures
- Critical/high reachable path: FAILED and named mitigation requirement.
- Unknown attack surface or outdated dependency evidence: BLOCKED/UNVERIFIED with concrete missing source.
- Scanner false positive: document counterevidence; never simply suppress the rule.

## Verification
- Finding includes file/entry point, trust boundary, exploit path, impact, severity and minimum mitigation.
- Scan and test results are pinned to current revision and tool/provider identity.
- Report distinguishes deterministic checks from hypothesis, residual risk and untested vectors.

## Evidence
Reference source revision and paths, exact commands and exit codes (where run), receipts and verification dates. Never include raw secrets, user prompt transcripts, invented metrics or unverified PASS claims.

## Examples
- Correct: demonstrate an IDOR by checking non-owner 200 vs expected 403 and cite authorization branch.
- Incorrect: call a product 'fully secure' after finding zero secrets in a single regex scan.

## Finalization
Return PASS only when independent verification and all acceptance criteria are evidenced; return BLOCKED for missing access, authority, test environment or proof; return FAILED for an observed failed required check. Never manufacture evidence.
