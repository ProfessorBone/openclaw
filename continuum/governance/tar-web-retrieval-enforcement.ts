/**
 * continuum/governance/tar-web-retrieval-enforcement.ts
 *
 * TAR-009: Signal web retrieval enforcement (envelope-allowed).
 *
 * TAR-009: web web_search / web_fetch
 *   - No grant required
 *   - Invocation mode: envelope-allowed only
 *   - Authorized agents: signal only
 *   - No unrestricted web access
 *   - Scope constrained to Signal's Bridge-defined retrieval scope
 *   - Activates only for Signal's retrieval cycle
 *
 * Signal is the only agent authorized to cross the external retrieval
 * boundary at the tool layer. Unauthorized agent invocations are
 * INTEGRITY events.
 *
 * Governed by: PACS-IMPL-STAGE3-001, PACS-ARCH-TAR-001, PACS-ARCH-ACM-001
 */

import { createSubsystemLogger } from "../../src/logging/subsystem.js";
import type {
  PluginHookBeforeToolCallEvent,
  PluginHookBeforeToolCallResult,
  PluginHookToolContext,
} from "../../src/plugins/types.js";
import { enforceBeforeToolCall } from "./tar-enforcement.js";

const log = createSubsystemLogger("continuum/tar-web");

// ---------------------------------------------------------------------------
// TAR-009 operation set
// ---------------------------------------------------------------------------

const TAR009_OPERATIONS = new Set(["web_search", "web_fetch"]);

// ---------------------------------------------------------------------------
// Hook handler
// ---------------------------------------------------------------------------

/**
 * before_tool_call handler for TAR-009 (Signal web retrieval).
 *
 * Intercepts web_search and web_fetch native tool calls.
 * Signal is the only authorized agent. All other agents are denied
 * and an INTEGRITY event is emitted.
 *
 * Non-web tools pass through without evaluation.
 */
export async function tarSignalWebRetrievalBeforeToolCallHandler(
  event: PluginHookBeforeToolCallEvent,
  ctx: PluginHookToolContext,
): Promise<PluginHookBeforeToolCallResult | void> {
  if (!TAR009_OPERATIONS.has(event.toolName)) {
    return;
  }

  const agentId = ctx.agentId ?? "unknown";
  const taskId = ctx.runId ?? "no-task-id";
  const traceId = ctx.sessionId ?? ctx.sessionKey ?? "no-trace-id";

  const result = enforceBeforeToolCall({
    serverName: "web",
    operationName: event.toolName,
    agentId,
    taskId,
    traceId,
  });

  log.info(
    `TAR-009 web retrieval: capability=${result.record.capability_id} ` +
      `agent=${agentId} task_id=${taskId} trace_id=${traceId} ` +
      `op=${event.toolName} outcome=${result.record.outcome}` +
      (result.record.denial_reason ? ` denied=${result.record.denial_reason}` : ""),
  );

  if (result.integrityEvent) {
    log.error(`INTEGRITY_EVENT: ${result.integrityEvent}`);
  }

  if (!result.allowed) {
    return {
      block: true,
      blockReason:
        `TAR-009 web retrieval denied: ${result.record.denial_reason ?? "unauthorized"} ` +
        `[capability=${result.record.capability_id} agent=${agentId} op=${event.toolName}]`,
    };
  }

  return;
}
