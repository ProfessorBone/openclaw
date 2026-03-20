/**
 * continuum/governance/tar-create-enforcement.ts
 *
 * Work Order 4D — PACS-IMPL-STAGE3-001 Priority 4
 * TAR-004 and TAR-008 enforcement: new file creation
 *
 * TAR-004: obsidian-vault write_file (new vault artifact creation)
 *   - grant-required
 *   - new file must not shadow or replace an existing locked artifact
 *   - authorized agents: the-bridge, foundry
 *
 * TAR-008: filesystem write_file (new repo file creation)
 *   - grant-required
 *   - path must be within /Users/faheem/openclaw
 *   - must not create files in .openclaw/, LaunchAgents/, or outside repo
 *   - authorized agents: the-bridge, foundry
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

const log = createSubsystemLogger("continuum/tar-create");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTHORIZED_REPO_ROOT = "/Users/faheem/openclaw";

/**
 * Directories within the repo that are off-limits for new file creation.
 * Source: PACS-ARCH-TAR-001 TAR-008 scope_constraints
 */
const REPO_CREATE_PROHIBITED_PREFIXES = [
  `${AUTHORIZED_REPO_ROOT}/.openclaw/`,
  `/Users/faheem/Library/LaunchAgents/`,
];

/**
 * Known locked artifact filename patterns for TAR-004 shadowing check.
 * A new vault file must not match or overwrite these.
 */
const LOCKED_ARTIFACT_PATTERNS = ["System-Charter.md", "Decision-Log.md", "PACS-Session-State.md"];

// ---------------------------------------------------------------------------
// Path validation helpers
// ---------------------------------------------------------------------------

/**
 * Checks whether a vault file path would shadow or replace a locked artifact.
 * Source: PACS-ARCH-TAR-001 TAR-004 scope_constraints
 */
export function wouldShadowLockedArtifact(filePath: string): boolean {
  const filename = filePath.split("/").pop() ?? filePath;
  if (LOCKED_ARTIFACT_PATTERNS.includes(filename)) {
    return true;
  }
  // Any file path that contains known locked artifact names
  for (const pattern of LOCKED_ARTIFACT_PATTERNS) {
    if (filePath.endsWith(`/${pattern}`)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether a repo file path is in a prohibited directory for new creation.
 * Source: PACS-ARCH-TAR-001 TAR-008 scope_constraints
 */
export function isRepoCreateProhibitedPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  // Must be inside the authorized repo root
  if (!normalized.startsWith(AUTHORIZED_REPO_ROOT)) {
    return true; // out of scope counts as prohibited for creation
  }
  // Must not be in a prohibited subdirectory
  for (const prefix of REPO_CREATE_PROHIBITED_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Create enforcement result types
// ---------------------------------------------------------------------------

export type CreateEnforcementDenialReason =
  | "unauthorized_agent"
  | "capability_resolution_failed"
  | "grant_not_found"
  | "grant_expired"
  | "grant_revoked"
  | "action_mismatch"
  | "target_mismatch"
  | "denied_artifact_shadowing"
  | "denied_path_out_of_scope";

export type CreateEnforcementResult = {
  allowed: boolean;
  record: InvocationRecord;
  integrityEvent?: string;
  denialReason?: CreateEnforcementDenialReason;
};

// ---------------------------------------------------------------------------
// Core enforcement logic
// ---------------------------------------------------------------------------

/**
 * Enforces TAR-004/TAR-008 (new file creation).
 * Enforcement order:
 *   1. Capability resolution
 *   2. Agent authorization
 *   3. Grant verification
 *   4. Path-specific constraint check (shadowing for vault, prohibited paths for repo)
 */
export function enforceCreateBeforeToolCall(params: {
  serverName: string;
  operationName: string;
  agentId: string;
  taskId: string;
  traceId: string;
  grantId: string | undefined;
  newFilePath: string;
  gateway?: ActionAuthorizationGateway;
}): CreateEnforcementResult {
  const { serverName, operationName, agentId, taskId, traceId, grantId, newFilePath } = params;

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

  // Step 3: Grant required
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

  const gw = params.gateway ?? actionAuthorizationGateway;
  const verifyResult = gw.verifyGrant(grantId, operationName, newFilePath);

  if (!verifyResult.valid) {
    const denialReason = verifyResult.reason as CreateEnforcementDenialReason;
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
    return { allowed: false, record, denialReason, integrityEvent };
  }

  // Step 4: Path-specific constraint check
  if (serverName === "obsidian-vault") {
    // TAR-004: check for artifact shadowing
    if (wouldShadowLockedArtifact(newFilePath)) {
      const record = buildInvocationRecord({
        capabilityId: entry.capability_id,
        capabilityResolutionResult: "resolved",
        agentId,
        taskId,
        traceId,
        operationName,
        outcome: "denied",
        denialReason: "denied_artifact_shadowing",
        scopeBasis: grantId,
      });
      return {
        allowed: false,
        record,
        denialReason: "denied_artifact_shadowing",
        integrityEvent: `INTEGRITY_EVENT: artifact_shadowing_attempt — agent=${agentId} attempted to shadow ${newFilePath}`,
      };
    }
  } else if (serverName === "filesystem") {
    // TAR-008: check for prohibited paths
    if (isRepoCreateProhibitedPath(newFilePath)) {
      const record = buildInvocationRecord({
        capabilityId: entry.capability_id,
        capabilityResolutionResult: "resolved",
        agentId,
        taskId,
        traceId,
        operationName,
        outcome: "denied",
        denialReason: "denied_path_out_of_scope",
        scopeBasis: grantId,
      });
      return { allowed: false, record, denialReason: "denied_path_out_of_scope" };
    }
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
// Hook handlers
// ---------------------------------------------------------------------------

function extractCreateParams(
  event: PluginHookBeforeToolCallEvent,
  ctx: PluginHookToolContext,
  serverName: string,
  operationName: string,
) {
  const agentId = ctx.agentId ?? "unknown";
  const taskId = ctx.runId ?? "no-task-id";
  const traceId = ctx.sessionId ?? ctx.sessionKey ?? "no-trace-id";
  const params = event.params;
  const grantId = typeof params["grant_id"] === "string" ? params["grant_id"] : undefined;
  const newFilePath =
    typeof params["path"] === "string"
      ? params["path"]
      : typeof params["target"] === "string"
        ? params["target"]
        : "";
  return { agentId, taskId, traceId, grantId, newFilePath, serverName, operationName };
}

/**
 * before_tool_call handler for TAR-004 (obsidian-vault write_file).
 */
export async function tarVaultCreateBeforeToolCallHandler(
  event: PluginHookBeforeToolCallEvent,
  ctx: PluginHookToolContext,
): Promise<PluginHookBeforeToolCallResult | void> {
  if (event.toolName !== "mcp__obsidian-vault__write_file") {
    return;
  }

  const p = extractCreateParams(event, ctx, "obsidian-vault", "write_file");
  const result = enforceCreateBeforeToolCall({ ...p, newFilePath: p.newFilePath });

  log.info(
    `TAR-004 vault create: capability=${result.record.capability_id} ` +
      `agent=${p.agentId} outcome=${result.record.outcome} path=${p.newFilePath}` +
      (result.denialReason ? ` denied=${result.denialReason}` : ""),
  );

  if (result.integrityEvent) {
    log.error(`INTEGRITY_EVENT: ${result.integrityEvent}`);
  }

  if (!result.allowed) {
    return {
      block: true,
      blockReason:
        `TAR-004 vault create denied: ${result.denialReason ?? "unauthorized"} ` +
        `[capability=${result.record.capability_id} agent=${p.agentId} path=${p.newFilePath}]`,
    };
  }
  return;
}

/**
 * before_tool_call handler for TAR-008 (filesystem write_file).
 */
export async function tarRepoCreateBeforeToolCallHandler(
  event: PluginHookBeforeToolCallEvent,
  ctx: PluginHookToolContext,
): Promise<PluginHookBeforeToolCallResult | void> {
  if (event.toolName !== "mcp__filesystem__write_file") {
    return;
  }

  const p = extractCreateParams(event, ctx, "filesystem", "write_file");
  const result = enforceCreateBeforeToolCall({ ...p, newFilePath: p.newFilePath });

  log.info(
    `TAR-008 repo create: capability=${result.record.capability_id} ` +
      `agent=${p.agentId} outcome=${result.record.outcome} path=${p.newFilePath}` +
      (result.denialReason ? ` denied=${result.denialReason}` : ""),
  );

  if (result.integrityEvent) {
    log.error(`INTEGRITY_EVENT: ${result.integrityEvent}`);
  }

  if (!result.allowed) {
    return {
      block: true,
      blockReason:
        `TAR-008 repo create denied: ${result.denialReason ?? "unauthorized"} ` +
        `[capability=${result.record.capability_id} agent=${p.agentId} path=${p.newFilePath}]`,
    };
  }
  return;
}
