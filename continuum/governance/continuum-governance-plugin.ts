/**
 * continuum/governance/continuum-governance-plugin.ts
 *
 * Work Order 3 — PACS-IMPL-STAGE3-001
 * Continuum Governance Plugin entry point.
 *
 * Registers the TAR before_tool_call enforcement hook with the OpenClaw
 * plugin system so it fires on every MCP tool invocation.
 *
 * This file is loaded by OpenClaw's plugin discovery via the loadPaths
 * entry in openclaw.json: plugins.loadPaths[].
 *
 * Governed by: PACS-IMPL-STAGE3-001 Work Order 3
 * Source: PACS-ARCH-TAR-001, PACS-ARCH-ACM-001, ARCH-ADR-003, ARCH-ADR-004
 */

import { createSubsystemLogger } from "../../src/logging/subsystem.js";
import type { OpenClawPluginApi, OpenClawPluginDefinition } from "../../src/plugins/types.js";
import { registerTarHook } from "./tar-hook.js";

const log = createSubsystemLogger("continuum/governance");

const continuumGovernancePlugin: OpenClawPluginDefinition = {
  id: "continuum-governance",
  name: "Continuum Governance",
  description:
    "Enforces Continuum architectural governance: TAR capability authorization, " +
    "agent authorization checks, and invocation record emission for all MCP tool calls.",
  version: "1.0.0",

  activate(api: OpenClawPluginApi): void {
    // Register TAR before_tool_call enforcement.
    // Priority 100 ensures this runs before other before_tool_call hooks.
    registerTarHook(api);

    log.info(
      "Continuum Governance Plugin activated: " +
        "TAR enforcement wired to before_tool_call hook pipeline",
    );
  },
};

export default continuumGovernancePlugin;
