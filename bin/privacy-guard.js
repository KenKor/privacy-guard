#!/usr/bin/env node
// Runs the TypeScript CLI directly; Node 22.18+ strips the types, so there is no build step.
import { main } from "../src/cli.ts";

process.exitCode = await main(process.argv.slice(2));
