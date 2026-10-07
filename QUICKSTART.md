# AleDevOS Quickstart

## One-button Windows flow

1. Open the AleDevOS checkout.
2. Double-click `START_ALEDEVOS.bat`.
3. Choose **1. INICIAR ALEDEVOS**.
4. Select or enter the project path.
5. Choose the adapter.
6. AleDevOS installs itself on first use and then opens the selected external runtime.

The project may be:
- a new/empty folder;
- an existing folder without Git;
- an existing Git repository.

AleDevOS never runs `git init` automatically.

## CLI flow

Install the CLI once from the AleDevOS checkout:

```powershell
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\repo-tools\INSTALL_CLI.ps1
```

Then, from a project:

```powershell
aledevos start -Adapter codex
```

Or:

```powershell
aledevos start "C:\Projects\MyProject" -Adapter codex
```

To install without launching:

```powershell
aledevos init -Adapter codex
```

To update:

```powershell
aledevos update
```

## What “installed” means

The project is considered AleDevOS-enabled when `.aledevos/project.json` exists and the selected adapter's Skill Registry/projection is healthy.

Installing AleDevOS does **not** install or authenticate Codex, Claude Code, OpenCode or Antigravity themselves. Those external runtimes remain user/environment dependencies.

For architecture, support boundaries and validated efficiency evidence, see `README.md`.
