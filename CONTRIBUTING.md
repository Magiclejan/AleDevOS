# Contributing to AleDevOS

## Canonical repository

All canonical AleDevOS development lands in `Magiclejan/AleDevOS`.

After the initial baseline migration, use Git branches/commits instead of disposable ZIP overlays and keep `main` releasable.

## Repository scope

This repository contains the current AleDevOS codebase and its own supporting artifacts. Future integrations are handled only when they become part of the designed AleDevOS architecture.

## Development flow

1. Update local `main` with `git pull --ff-only`.
2. Create a focused branch when work is non-trivial.
3. Make the change.
4. Run deterministic validation relevant to the touched subsystem.
5. Verify generated/local-only files are not being committed.
6. Commit with a focused message.
7. Push and merge only after validation passes.

## Runtime/target evidence

Generated target evidence belongs in target project state and is not source code. Do not commit transient `.aledevos/state` output to this repo.

## Releases

Release claims must be evidence-backed. A V1 freeze or later release marker must never be inferred from package presence alone.
