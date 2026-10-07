# Generic adapter

Status: **scaffold / non-installable** in Portability Phase 1.

This directory now participates in the universal Adapter ABI through `adapter-capabilities.json`. All runtime-owned capabilities remain truthfully `unsupported` until this adapter is implemented and certified. AleDevOS must return `ADAPTER_NOT_INSTALLABLE` instead of silently falling back to OpenCode or weakening Core semantics.

Contract/reference adapter with no runtime implementation.
