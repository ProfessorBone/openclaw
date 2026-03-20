/**
 * continuum/governance/tar-write-enforcement.ts
 *
 * Work Order 4B — PACS-IMPL-STAGE3-001 Priority 2
 * TAR-003 enforcement: obsidian-vault edit_file (grant-required, side-effecting)
 *
 * Extends the TAR enforcement layer to cover governed write surfaces.
 * TAR-003 requires:
 *   1. Agent authorization (agent in approved_agent_ids)
 *   2. Valid signed grant (present, unexpired, unrevoked)
 *   3. Action binding (grant.authorized_action matches operation)
 *   4. Target binding (grant.allowed_target matches requested target)
 *   5. Human approval record for protected targets
 *
 * Protected targets (require human_approval_record_id in grant):
 *   - System-Charter.md
 *   - Decision-Log.md
 *   - Any file matching LOCKED_ARTIFACT_PATTERN
 *
 * Governed by: PACS-IMPL-STAGE3-001 Work Order 4, PACS-ARCH-TAR-001,
 *              PACS-ARCH-ACM-001, ARCH-ADR-003
 */

import { createSubsystemLogger } from "../../src/logging/subsystem.js";
import type {
  PluginHookBeforeToolCallEvent,
  PluginHookBeforeToolCallResult,
  PluginHookToolContext,
} from "../../src/plugins/types.js";
import { actionAuthorizationGateway } from "./action-authorization-gateway.js";
import {
  checkAgentAuthorization,
  resolveCapability,
  buildInvocationRecord,
  type InvocationRecord,
} from "./tar-enforcement.js";

const log = createSubsystemLogger("continuum/tar-write");

// ---------------------------------------------------------------------------
// Protected target detection
// ---------------------------------------------------------------------------

/**
 * Files that require human_approval_record_id in the grant.
 * Source: PACS-ARCH-TAR-001 TAR-003 scope_constraints
 */
const PROTECTED_TARGET_NAMES = new Set(["System-Charter.md", "Decision-Log.md"]);

/**
 * Pattern for locked artifacts (files containing LOCKED status marker).
 * In practice, checking by filename suffix/pattern is sufficient for Stage 3.
 * A deeper content-based check is Stage 4 work.
 */
function isProtectedTarget(targetPath: string): boolean {
  const filename = targetPath.split("/").pop() ?? targetPath;
  if (PROTECTED_TARGET_NAMES.has(filename)) {
    return true;
  }
  // Any file matching known locked artifact naming conventions
  if (filename.endsWith("-LOCKED.md") || filename.includes("PACS-ARCH-")) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Write enforcement result types
// ---------------------------------------------------------------------------

export type WriteEnforcementDenialReason =
  | "unauthorized_agent"
  | "capability_resolution_failed"
  | "grant_not_found"
  | "grant_expired"
  | "grant_revoked"
  | "action_mismatch"
  | "target_mismatch"
  | "human_approval_required"
  | "denied_categorically_prohibited";

export type WriteEnforcementResult = {
  allowed: boolean;
  record: InvocationRecord;
  integrityEvent?: string;
  denialReason?: WriteEnforcementDenialReason;
};

// ---------------------------------------------------------------------------
// Core enforcement logic
// ---------------------------------------------------------------------------

/**
 * Enforces TAR-003 (obsidian-vault edit_file) access:
 *   1. Resolve capability
 *   2. Check agent authorization
 *   3. Verify grant (present, unexpired, unrevoked, action+target binding)
 *   4. Check human approval for protected targets
 *
 * @param params.grantId - The grant_id submitted with the request
 * @param params.requestedTarget - The file path being edited
 */
export function enforceWriteBeforeToolCall(params: {
  serverName: string;
  operationName: string;
  agentId: string;
  taskId: string;
  traceId: string;
  grantId: string | undefined;
  requestedTarget: string;
  /** Optional gateway override for testing. Defaults to singleton. */
  gateway?: ActionAuthorizationGateway;
}): WriteEnforcementResult {
  const { serverName, operationName, agentId, taskId, traceId, grantId, requestedTarget } = params;

  // Step 1: Capability resolution
  const entry = resolveCapability(serverName, operationName);
  if (!entry) {
    const record = buildInvocationRecord({
      capabilityId: "UNRESOLVED",
      capabilityResolutionResult: "unresolved",
      agentId,
      taskId,
      traceId,
      operationName,
      outcome: "denied",
      denialReason: "capability_resolution_failed",
    });
    return { allowed: false, record, denialReason: "capability_resolution_failed" };
  }

  // Step 2: Agent authorization
  const authResult = checkAgentAuthorization(entry.capability_id, agentId);
  if (!authResult.authorized) {
    const record = buildInvocationRecord({
      capabilityId: entry.capability_id,
      capabilityResolutionResult: "resolved",
      agentId,
      taskId,
      traceId,
      operationName,
      outcome: "denied",
      denialReason: "unauthorized_agent",
      scopeBasis: grantId ?? "envelope",
    });
    return {
      allowed: false,
      record,
      denialReason: "unauthorized_agent",
      integrityEvent: `INTEGRITY_EVENT: unauthorized_agent — agent=${agentId} attempted ${entry.capability_id} (${operationName})`,
    };
  }

  // Step 3: Grant required check — entry.grant_required must be true for write ops
  if (!grantId) {
    const record = buildInvocationRecord({
      capabilityId: entry.capability_id,
      capabilityResolutionResult: "resolved",
      agentId,
      taskId,
      traceId,
      operationName,
      outcome: "denied",
      denialReason: "grant_not_found",
      scopeBasis: "envelope",
    });
    return { allowed: false, record, denialReason: "grant_not_found" };
  }

  // Step 4: Verify grant via ActionAuthorizationGateway
  const gw = params.gateway ?? actionAuthorizationGateway;
  const verifyResult = gw.verifyGrant(grantId, operationName, requestedTarget);

  if (!verifyResult.valid) {
    const denialReason = verifyResult.reason as WriteEnforcementDenialReason;
    const record = buildInvocationRecord({
      capabilityId: entry.capability_id,
      capabilityResolutionResult: "resolved",
      agentId,
      taskId,
      traceId,
      operationName,
      outcome: "denied",
      denialReason,
      scopeBasis: grantId,
    });
    // Revoked grant use is an INTEGRITY event per ARCH-ADR-003
    const integrityEvent =
      verifyResult.reason === "grant_revoked"
        ? `INTEGRITY_EVENT: revoked_grant_used — agent=${agentId} grant_id=${grantId}`
        : undefined;
    return { allowed: false, record, denialReason, integrityEvent };
  }

  const grant = verifyResult.grant;

  // Step 5: Human approval check for protected targets
  if (isProtectedTarget(requestedTarget) && !grant.human_approval_record_id) {
    const record = buildInvocationRecord({
      capabilityId: entry.capability_id,
      capabilityResolutionResult: "resolved",
      agentId,
      taskId,
      traceId,
      operationName,
      outcome: "denied",
      denialReason: "human_approval_required",
      scopeBasis: grantId,
    });
    return { allowed: false, record, denialReason: "human_approval_required" };
  }

  // All checks passed
  const record = buildInvocationRecord({
    capabilityId: entry.capability_id,
    capabilityResolutionResult: "resolved",
    agentId,
    taskId,
    traceId,
    operationName,
    outcome: "executed",
    scopeBasis: grantId,
  });
  return { allowed: true, record };
}

// ---------------------------------------------------------------------------
// Hook handler for write surfaces
// ---------------------------------------------------------------------------

/**
 * before_tool_call handler for TAR-003 and other grant-required write surfaces.
 *
 * Extracts grant_id and target from tool params, then runs write enforcement.
 * Expects params to contain:
 *   - grant_id: string (the signed grant ID)
 *   - target: string (the file path being written/edited)
 *   - path: string (alternative field name for target, used by some MCP servers)
 */
export async function tarWriteBeforeToolCallHandler(
  event: PluginHookBeforeToolCallEvent,
  ctx: PluginHookToolContext,
): Promise<PluginHookBeforeToolCallResult | void> {
  // Only handle obsidian-vault edit_file
  if (event.toolName !== "mcp__obsidian-vault__edit_file") {
    return;
  }

  const agentId = ctx.agentId ?? "unknown";
  const taskId = ctx.runId ?? "no-task-id";
  const traceId = ctx.sessionId ?? ctx.sessionKey ?? "no-trace-id";

  const params = event.params;
  const grantId = typeof params["grant_id"] === "string" ? params["grant_id"] : undefined;
  const requestedTarget =
    typeof params["target"] === "string"
      ? params["target"]
      : typeof params["path"] === "string"
        ? params["path"]
        : "";

  const result = enforceWriteBeforeToolCall({
    serverName: "obsidian-vault",
    operationName: "edit_file",
    agentId,
    taskId,
    traceId,
    grantId,
    requestedTarget,
  });

  log.info(
    `TAR-003 write enforcement: capability=${result.record.capability_id} ` +
      `agent=${agentId} outcome=${result.record.outcome} target=${requestedTarget}` +
      (result.denialReason ? ` denied=${result.denialReason}` : ""),
  );

  if (result.integrityEvent) {
    log.error(`INTEGRITY_EVENT: ${result.integrityEvent}`);
  }

  if (!result.allowed) {
    return {
      block: true,
      blockReason:
        `TAR-003 write enforcement denied: ${result.denialReason ?? "unauthorized"} ` +
        `[capability=${result.record.capability_id} agent=${agentId} target=${requestedTarget}]`,
    };
  }

  return;
}
