# Security model

Layers:
1. Core policy.
2. Adapter permissions.
3. Adapter hard-deny policies where available.
4. Protected `.aledevos` runtime.
5. Deterministic scope + gate + integrity checks before PASS.
6. Judges cannot override deterministic failures.

OpenCode v1.4 disables Code Mode (`execute`), network and external directories by default. Write agents have no arbitrary shell. Verifier can execute only the protected AleDevOS control CLI plus read-only Git evidence.

Residual risk: task scope is enforced before PASS, not as a true pre-write dynamic capability. A future OpenCode plugin/interceptor should close that gap.
