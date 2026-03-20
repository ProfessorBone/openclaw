/**
 * continuum/governance/tar-repo-enforcement.ts
 *
 * Work Order 4C — PACS-IMPL-STAGE3-001 Priority 3
 * TAR-006 enforcement: filesystem edit_file (three-tier path classification)
 *
 * Three-tier classification for /Users/faheem/openclaw scope:
 *   Tier A — categorically prohibited: openclaw.json, .env
 *             Block regardless of grant. No exceptions.
 *   Tier B — human-approval-gated: .claude/hooks/** governance hook files
 *             Grant required + human_approval_record_id in grant.
 *   Tier C — grant-required: all other source files in authorized scope
 *             Grant required, no human approval by default.
 *
 * Paths outside the authorized filesystem scope fail before classification.
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
import {
  actionAuthorizationGateway,
  type ActionAuthorizationGateway,
} from "./action-authorization-gateway.js";
import {
  checkAgentAuthorization,
  resolveCapability,
  buildInvocationRecord,
  type InvocationRecord,
} from "./tar-enforcement.js";

const log = createSubsystemLogger("continuum/tar-repo");

// ---------------------------------------------------------------------------
// Authorized filesystem scope
// ---------------------------------------------------------------------------

const AUTHORIZED_REPO_ROOT = "/Users/faheem/openclaw";

// ---------------------------------------------------------------------------
// Three-tier path classification
// ---------------------------------------------------------------------------

export type PathTier =
  | "tier-a-prohibited"
  | "tier-b-human-gated"
  | "tier-c-grant-required"
  | "out-of-scope";

/**
 * Classifies a filesystem path into one of three enforcement tiers.
 *
 * Tier A (categorically prohibited): openclaw.json, .env
 * Tier B (human-approval-gated): governance hook files (.claude/hooks/)
 * Tier C (grant-required): all other files within authorized scope
 * out-of-scope: path is outside /Users/faheem/openclaw
 *
 * Source: PACS-ARCH-TAR-001 TAR-006 scope_constraints
 */
export function classifyRepoPath(filePath: string): PathTier {
  // Normalize to forward slashes for consistent matching
  const normalized = filePath.replace(/\\/g, "/");

  // Out-of-scope check first
  if (!normalized.startsWith(AUTHORIZED_REPO_ROOT)) {
    return "out-of-scope";
  }

  const relative = normalized.slice(AUTHORIZED_REPO_ROOT.length);

  // Tier A: categorically prohibited files
  // Match by filename anywhere in the repo path
  const filename = relative.split("/").pop() ?? "";
  if (filename === "openclaw.json" || filename === ".env") {
    return "tier-a-prohibited";
  }

  // Tier B: governance hook files
  // Pattern: .claude/hooks/ directory
  if (relative.includes("/.claude/hooks/") || relative.startsWith("/.claude/hooks/")) {
    return "tier-b-human-gated";
  }

  // Tier C: all other files within authorized scope
  return "tier-c-grant-required";
}

// ---------------------------------------------------------------------------
// Repo write enforcement result types
// ---------------------------------------------------------------------------

export type RepoEnforcementDenialReason =
  | "unauthorized_agent"
  | "capability_resolution_failed"
  | "out_of_scope"
  | "denied_categorically_prohibited"
  | "grant_not_found"
  | "grant_expired"
  | "grant_revoked"
  | "action_mismatch"
  | "target_mismatch"
  | "human_approval_required";

export type RepoEnforcementResult = {
  allowed: boolean;
  record: InvocationRecord;
  pathTier: PathTier;
  integrityEvent?: string;
  denialReason?: RepoEnforcementDenialReason;
};

// ---------------------------------------------------------------------------
// Core enforcement logic
// ---------------------------------------------------------------------------

/**
 * Enforces TAR-006 (filesystem edit_file) access with three-tier path classification.
 *
 * Enforcement order:
 *   1. Capability resolution
 *   2. Agent authorization
 *   3. Path classification — tier-a is a hard deny before any grant check
 *   4. Grant verification (for tier-b and tier-c)
 *   5. Human approval check (tier-b only)
 */
export function enforceRepoWriteBeforeToolCall(params: {
  serverName: string;
  operationName: string;
  agentId: string;
  taskId: string;
  traceId: string;
  grantId: string | undefined;
  requestedTarget: string;
  gateway?: ActionAuthorizationGateway;
}): RepoEnforcementResult {
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
    return {
      allowed: false,
      record,
      pathTier: "out-of-scope",
      denialReason: "capability_resolution_failed",
    };
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
      pathTier: "out-of-scope",
      denialReason: "unauthorized_agent",
      integrityEvent: `INTEGRITY_EVENT: unauthorized_agent — agent=${agentId} attempted ${entry.capability_id} (${operationName})`,
    };
  }

  // Step 3: Path classification
  const pathTier = classifyRepoPath(requestedTarget);

  if (pathTier === "out-of-scope") {
    const record = buildInvocationRecord({
      capabilityId: entry.capability_id,
      capabilityResolutionResult: "resolved",
      agentId,
      taskId,
      traceId,
      operationName,
      outcome: "denied",
      denialReason: "out_of_scope",
      scopeBasis: grantId ?? "envelope",
    });
    return { allowed: false, record, pathTier, denialReason: "out_of_scope" };
  }

  if (pathTier === "tier-a-prohibited") {
    // Hard deny — no grant can override this
    const record = buildInvocationRecord({
      capabilityId: entry.capability_id,
      capabilityResolutionResult: "resolved",
      agentId,
      taskId,
      traceId,
      operationName,
      outcome: "denied",
      denialReason: "denied_categorically_prohibited",
      scopeBasis: grantId ?? "envelope",
    });
    return {
      allowed: false,
      record,
      pathTier,
      denialReason: "denied_categorically_prohibited",
      integrityEvent: `INTEGRITY_EVENT: prohibited_path_access — agent=${agentId} attempted write to ${requestedTarget}`,
    };
  }

  // Step 4: Grant required for tier-b and tier-c
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
    return { allowed: false, record, pathTier, denialReason: "grant_not_found" };
  }

  const gw = params.gateway ?? actionAuthorizationGateway;
  const verifyResult = gw.verifyGrant(grantId, operationName, requestedTarget);

  if (!verifyResult.valid) {
    const denialReason = verifyResult.reason as RepoEnforcementDenialReason;
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
    const integrityEvent =
      verifyResult.reason === "grant_revoked"
        ? `INTEGRITY_EVENT: revoked_grant_used — agent=${agentId} grant_id=${grantId}`
        : undefined;
    return { allowed: false, record, pathTier, denialReason, integrityEvent };
  }

  const grant = verifyResult.grant;

  // Step 5: Human approval required for tier-b
  if (pathTier === "tier-b-human-gated" && !grant.human_approval_record_id) {
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
    return { allowed: false, record, pathTier, denialReason: "human_approval_required" };
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
  return { allowed: true, record, pathTier };
}

// ---------------------------------------------------------------------------
// Hook handler
// ---------------------------------------------------------------------------

/**
 * before_tool_call handler for TAR-006 (filesystem edit_file).
 * Extracts grant_id and target from tool params, runs three-tier enforcement.
 */
export async function tarRepoWriteBeforeToolCallHandler(
  event: PluginHookBeforeToolCallEvent,
  ctx: PluginHookToolContext,
): Promise<PluginHookBeforeToolCallResult | void> {
  if (event.toolName !== "mcp__filesystem__edit_file") {
    return;
  }

  const agentId = ctx.agentId ?? "unknown";
  const taskId = ctx.runId ?? "no-task-id";
  const traceId = ctx.sessionId ?? ctx.sessionKey ?? "no-trace-id";

  const params = event.params;
  const grantId = typeof params["grant_id"] === "string" ? params["grant_id"] : undefined;
  const requestedTarget =
    typeof params["path"] === "string"
      ? params["path"]
      : typeof params["target"] === "string"
        ? params["target"]
        : "";

  const result = enforceRepoWriteBeforeToolCall({
    serverName: "filesystem",
    operationName: "edit_file",
    agentId,
    taskId,
    traceId,
    grantId,
    requestedTarget,
  });

  log.info(
    `TAR-006 repo enforcement: capability=${result.record.capability_id} ` +
      `agent=${agentId} tier=${result.pathTier} outcome=${result.record.outcome} target=${requestedTarget}` +
      (result.denialReason ? ` denied=${result.denialReason}` : ""),
  );

  if (result.integrityEvent) {
    log.error(`INTEGRITY_EVENT: ${result.integrityEvent}`);
  }

  if (!result.allowed) {
    return {
      block: true,
      blockReason:
        `TAR-006 repo enforcement denied: ${result.denialReason ?? "unauthorized"} ` +
        `[tier=${result.pathTier} capability=${result.record.capability_id} agent=${agentId} target=${requestedTarget}]`,
    };
  }

  return;
}
