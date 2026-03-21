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
import { auditLog } from "./audit-log.js";
import { mecAvailabilityGuard, type ProtectedDecisionClass } from "./mec-fail-closed.js";
import {
  tarVaultCreateBeforeToolCallHandler,
  tarRepoCreateBeforeToolCallHandler,
} from "./tar-create-enforcement.js";
import { registerTarHook } from "./tar-hook.js";
import {
  tarFilesystemReadBeforeToolCallHandler,
  tarFilesystemListBeforeToolCallHandler,
} from "./tar-read-enforcement.js";
import { tarRepoWriteBeforeToolCallHandler } from "./tar-repo-enforcement.js";
import { tarSignalWebRetrievalBeforeToolCallHandler } from "./tar-web-retrieval-enforcement.js";
import { tarWriteBeforeToolCallHandler } from "./tar-write-enforcement.js";

const log = createSubsystemLogger("continuum/governance");

const continuumGovernancePlugin: OpenClawPluginDefinition = {
  id: "governance",
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

    // Register TAR-004 vault create enforcement (obsidian-vault write_file).
    api.on("before_tool_call", tarVaultCreateBeforeToolCallHandler, { priority: 97 });

    // Register TAR-008 repo create enforcement (filesystem write_file).
    api.on("before_tool_call", tarRepoCreateBeforeToolCallHandler, { priority: 96 });

    // Register TAR-005 filesystem read enforcement (read_file / read_text_file).
    api.on("before_tool_call", tarFilesystemReadBeforeToolCallHandler, { priority: 95 });

    // Register TAR-007 filesystem list enforcement (list_directory / directory_tree).
    api.on("before_tool_call", tarFilesystemListBeforeToolCallHandler, { priority: 94 });

    // Register TAR-009 Signal web retrieval enforcement (web_search / web_fetch).
    api.on("before_tool_call", tarSignalWebRetrievalBeforeToolCallHandler, { priority: 93 });

    log.info(
      "Continuum Governance Plugin activated: " +
        "TAR-001-009 (all active) wired to before_tool_call pipeline",
    );
  },
};

export default continuumGovernancePlugin;

// ---------------------------------------------------------------------------
// Protected decision enforcement (INJ-005 / INJ-021 gate)
// ---------------------------------------------------------------------------

export type ProtectedDecisionResult =
  | { allowed: true; entry_id: string }
  | { allowed: false; reason: string };

/**
 * Gate for all protected Bridge decisions (SUMMARY_EMISSION, MEMORY_COMMIT_AUTH,
 * ESCALATION_DECISION).
 *
 * Enforces in order:
 *   1. MEC availability check (mecAvailabilityGuard) — fires FAIL_CLOSED_TRIGGERED
 *   2. Audit log write (auditLog) — blocked + returns false when log is frozen
 *
 * A protected decision may not proceed unless both checks pass.
 * Per PACS-ARCH-AUDIT-001 Section 5 and PACS-VALIDATION-001 INJ-005/INJ-021.
 */
export function enforceProtectedDecision(params: {
  agentId: string;
  decisionClass: ProtectedDecisionClass;
  decisionId: string;
  payload: Record<string, unknown>;
}): ProtectedDecisionResult {
  // 1. MEC availability gate
  const mecResult = mecAvailabilityGuard.checkDecision(params.decisionClass);
  if (!mecResult.allowed) {
    log.info(
      `Protected decision blocked — MEC unavailable: ` +
        `class=${params.decisionClass} agent=${params.agentId}`,
    );
    return { allowed: false, reason: mecResult.reason };
  }

  // 2. Audit log write gate
  const writeResult = auditLog.write({
    producer_agent: params.agentId,
    decision_id: params.decisionId,
    decision_class: params.decisionClass,
    payload: params.payload,
  });

  if (!writeResult.write_confirmed) {
    log.error(
      `Protected decision blocked — audit log frozen: ` +
        `class=${params.decisionClass} agent=${params.agentId}`,
    );
    return { allowed: false, reason: writeResult.reason };
  }

  return { allowed: true, entry_id: writeResult.entry_id };
}
