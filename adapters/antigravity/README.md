# Google Antigravity adapter

Status: **implemented / installable / Portability P5**.

This is AleDevOS' canonical Google development-agent adapter. It targets Antigravity CLI / Antigravity 2.0 native surfaces: `.agents/agents`, `.agents/skills`, workspace hooks, fine-grained permissions, native subagents and the shared Antigravity agent harness.

`gemini` is retained only as an explicit deprecated alias for migration/enterprise compatibility. There is no second Gemini implementation.

Package certification does not equal target-runtime certification. Target validation must prove the installed `agy` version, active permissions, workspace hook execution, browser/runtime provider and image-capable judge on the target machine. Known upstream hook/config issues are fail-closed prerequisites, not waived.
