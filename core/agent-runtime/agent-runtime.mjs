#!/usr/bin/env node
// Universal Core entrypoint. Provider parsing and runtime profiles are adapter
// bridge responsibilities, isolated outside Core for portable conformance.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export * from '../../runtime-bridges/agent-runtime.mjs';
import {runAgentRuntimeCli} from '../../runtime-bridges/agent-runtime.mjs';
const self=fileURLToPath(import.meta.url);
if(process.argv[1] && path.resolve(process.argv[1])===self) await runAgentRuntimeCli();
