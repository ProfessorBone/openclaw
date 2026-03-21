/**
 * continuum/governance/tar-hook.ts
 *
 * Work Order 2 — PACS-IMPL-STAGE3-001
 * Wires tar-enforcement.ts into the OpenClaw before_tool_call hook pipeline.
 *
 * This module exports a handler that can be registered via OpenClawPluginApi.on()
 * and a standalone registration helper for the Continuum governance plugin.
 *
 * Architecture:
 *   before_tool_call event → parseMcpToolName() → enforceBeforeToolCall()
 *   → if blocked: return { block: true, blockReason }
 *   → if allowed: return undefined (pass through)
 *
 * MCP tool name format in OpenClaw: mcp__<serverName>__<operationName>
 * Example: mcp__obsidian-vault__read_file
 *
 * Governed by: PACS-IMPL-STAGE3-001, PACS-ARCH-TAR-001, PACS-ARCH-ACM-001
 */

import { createSubsystemLogger } from "../../src/logging/subsystem.js";
import type {
  OpenClawPluginApi,
  PluginHookBeforeToolCallEvent,
  PluginHookBeforeToolCallResult,
  PluginHookToolContext,
} from "../../src/plugins/types.js";
import { auditLog } from "./audit-log.js";
import { enforceBeforeToolCall, type InvocationRecord } from "./tar-enforcement.js";

const log = createSubsystemLogger("continuum/tar");

// ---------------------------------------------------------------------------
// MCP tool name parsing
// ---------------------------------------------------------------------------

export type ParsedMcpToolName =
  | {
      isMcp: true;
      serverName: string;
      operationName: string;
    }
  | {
      isMcp: false;
    };

/**
 * Parses an OpenClaw tool name into MCP server + operation components.
 * OpenClaw MCP tools follow the pattern: mcp__<serverName>__<operationName>
 * Returns { isMcp: false } for native (non-MCP) tools.
 */
export function parseMcpToolName(toolName: string): ParsedMcpToolName {
  if (!toolName.startsWith("mcp__")) {
    return { isMcp: false };
  }
  const withoutPrefix = toolName.slice("mcp__".length);
  const separatorIndex = withoutPrefix.indexOf("__");
  if (separatorIndex === -1) {
    return { isMcp: false };
  }
  const serverName = withoutPrefix.slice(0, separatorIndex);
  const operationName = withoutPrefix.slice(separatorIndex + 2);
  if (!serverName || !operationName) {
    return { isMcp: false };
  }
  return { isMcp: true, serverName, operationName };
}

// ---------------------------------------------------------------------------
// Invocation record emission
// ---------------------------------------------------------------------------

/**
 * Emits an invocation record to the telemetry log.
 * In Stage 3 this writes to the subsystem logger.
 * Stage 4 will wire this to the full telemetry pipeline (PACS-OBS-005).
 */
function emitInvocationRecord(record: InvocationRecord): void {
  log.info(
    `TAR invocation: capability=${record.capability_id} agent=${record.agent_id} ` +
      `outcome=${record.outcome} op=${record.operation_name}` +
      (record.denial_reason ? ` denied=${record.denial_reason}` : ""),
  );

  // Wire routing decisions to the audit chain.
  auditLog.write({
    producer_agent: record.agent_id,
    decision_id: record.task_id,
    decision_class: "routing",
    payload: {
      capability_id: record.capability_id,
      operation_name: record.operation_name,
      outcome: record.outcome,
      ...(record.denial_reason ? { denial_reason: record.denial_reason } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Hook handler
// ---------------------------------------------------------------------------

/**
 * before_tool_call handler that enforces TAR capability authorization.
 *
 * For non-MCP tools: passes through (not TAR-governed).
 * For MCP tools: runs resolveCapability + checkAgentAuthorization.
 *   - If denied: returns { block: true, blockReason } and emits invocation record.
 *   - If allowed: emits invocation record and returns undefined (pass through).
 *   - If INTEGRITY event: logs at error level in addition to normal record.
 */
export async function tarBeforeToolCallHandler(
  event: PluginHookBeforeToolCallEvent,
  ctx: PluginHookToolContext,
): Promise<PluginHookBeforeToolCallResult | void> {
  const parsed = parseMcpToolName(event.toolName);

  // Non-MCP tools are not TAR-governed. Pass through.
  if (!parsed.isMcp) {
    return;
  }

  const agentId = ctx.agentId ?? "unknown";
  const taskId = ctx.runId ?? "no-task-id";
  const traceId = ctx.sessionId ?? ctx.sessionKey ?? "no-trace-id";

  const result = enforceBeforeToolCall({
    serverName: parsed.serverName,
    operationName: parsed.operationName,
    agentId,
    taskId,
    traceId,
  });

  emitInvocationRecord(result.record);

  if (result.integrityEvent) {
    log.error(`INTEGRITY_EVENT: ${result.integrityEvent}`);
  }

  if (!result.allowed) {
    return {
      block: true,
      blockReason:
        `TAR enforcement denied: ${result.record.denial_reason ?? "unauthorized"} ` +
        `[capability=${result.record.capability_id} agent=${agentId} op=${parsed.operationName}]`,
    };
  }

  // Allowed — return undefined to let the call proceed
  return;
}

// ---------------------------------------------------------------------------
// Plugin registration helper
// ---------------------------------------------------------------------------

/**
 * Registers the TAR before_tool_call enforcement hook with an OpenClaw plugin API.
 * Call this from the Continuum governance plugin's activate() function.
 *
 * Priority 100 ensures TAR enforcement runs before other before_tool_call hooks.
 */
export function registerTarHook(api: OpenClawPluginApi): void {
  api.on("before_tool_call", tarBeforeToolCallHandler, { priority: 100 });
  log.info("TAR before_tool_call enforcement hook registered");
}
