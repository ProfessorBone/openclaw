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
import { tarRepoWriteBeforeToolCallHandler } from "./tar-repo-enforcement.js";
import { tarWriteBeforeToolCallHandler } from "./tar-write-enforcement.js";

const log = createSubsystemLogger("continuum/governance");

const continuumGovernancePlugin: OpenClawPluginDefinition = {
  id: "continuum-governance",
  name: "Continuum Governance",
  description:
    "Enforces Continuum architectural governance: TAR capability authorization, " +
    "agent authorization checks, and invocation record emission for all MCP tool calls.",
  version: "1.0.0",

  activate(api: OpenClawPluginApi): void {
    // Register TAR read-surface enforcement (TAR-001, TAR-002).
    // Priority 100 ensures this runs before other before_tool_call hooks.
    registerTarHook(api);

    // Register TAR write-surface enforcement (TAR-003: obsidian-vault edit_file).
    // Priority 99 — runs after read-surface check, before other hooks.
    api.on("before_tool_call", tarWriteBeforeToolCallHandler, { priority: 99 });

    // Register TAR repo write-surface enforcement (TAR-006: filesystem edit_file, three-tier).
    // Priority 98 — runs after vault write check.
    api.on("before_tool_call", tarRepoWriteBeforeToolCallHandler, { priority: 98 });

    log.info(
      "Continuum Governance Plugin activated: " +
        "TAR-001/002 read + TAR-003 vault write + TAR-006 repo write (three-tier) wired to before_tool_call pipeline",
    );
  },
};

export default continuumGovernancePlugin;
