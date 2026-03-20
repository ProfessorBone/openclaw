/**
 * continuum/governance/tar-read-enforcement.ts
 *
 * Work Order 4E — PACS-IMPL-STAGE3-001 Priority 5
 * TAR-005 and TAR-007 enforcement: filesystem read surfaces
 *
 * TAR-005: filesystem read_file / read_text_file (envelope-allowed)
 *   - No grant required
 *   - Must be within authorized scope envelope
 *   - Vault reads prohibited through filesystem server when obsidian-vault is available
 *   - Authorized agents: the-bridge, foundry
 *
 * TAR-007: filesystem list_directory / directory_tree (envelope-allowed)
 *   - No grant required
 *   - Must be within authorized paths
 *   - Authorized agents: the-bridge, mec, foundry, gauge, locus
 *
 * Both surfaces: unauthorized agent invocations are INTEGRITY events.
 * Both surfaces: denied/failed calls must emit invocation records.
 *
 * Governed by: PACS-IMPL-STAGE3-001 Work Order 4, PACS-ARCH-TAR-001,
 *              PACS-ARCH-ACM-001
 */

import { createSubsystemLogger } from "../../src/logging/subsystem.js";
import type {
  PluginHookBeforeToolCallEvent,
  PluginHookBeforeToolCallResult,
  PluginHookToolContext,
} from "../../src/plugins/types.js";
import {
  checkAgentAuthorization,
  resolveCapability,
  buildInvocationRecord,
  type InvocationRecord,
} from "./tar-enforcement.js";

const log = createSubsystemLogger("continuum/tar-read");

// ---------------------------------------------------------------------------
// Authorized filesystem scope
// ---------------------------------------------------------------------------

const AUTHORIZED_FILESYSTEM_PATHS = [
  "/Users/faheem/openclaw",
  "/Users/faheem/Projects",
  "/Users/faheem/Library/Mobile Documents/iCloud~md~obsidian/Documents/MyBrain",
];

/**
 * Vault path prefix — filesystem reads to this path are prohibited
 * when obsidian-vault server is available.
 * Source: PACS-ARCH-TAR-001 TAR-005 scope_constraints
 */
const VAULT_PATH_PREFIX =
  "/Users/faheem/Library/Mobile Documents/iCloud~md~obsidian/Documents/MyBrain";

// ---------------------------------------------------------------------------
// Scope validation helpers
// ---------------------------------------------------------------------------

/**
 * Checks whether a path falls within the authorized filesystem scope.
 */
export function isWithinAuthorizedScope(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return AUTHORIZED_FILESYSTEM_PATHS.some((root) => normalized.startsWith(root));
}

/**
 * Checks whether a path is a vault path that should route through
 * the obsidian-vault server rather than the filesystem server.
 * Source: PACS-ARCH-TAR-001 TAR-005 scope_constraints:
 * "vault reads are prohibited through the filesystem server when an
 * equivalent obsidian-vault capability exists"
 */
export function isVaultFallbackPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.startsWith(VAULT_PATH_PREFIX);
}

// ---------------------------------------------------------------------------
// Read enforcement result types
// ---------------------------------------------------------------------------

export type ReadEnforcementDenialReason =
  | "unauthorized_agent"
  | "capability_resolution_failed"
  | "scope_violation"
  | "vault_fallback_prohibited";

export type ReadEnforcementResult = {
  allowed: boolean;
  record: InvocationRecord;
  integrityEvent?: string;
  denialReason?: ReadEnforcementDenialReason;
};

// ---------------------------------------------------------------------------
// Core enforcement logic
// ---------------------------------------------------------------------------

/**
 * Enforces TAR-005 and TAR-007 (filesystem read surfaces, envelope-allowed).
 *
 * Enforcement order:
 *   1. Capability resolution
 *   2. Agent authorization
 *   3. Scope check (path within authorized filesystem paths)
 *   4. Vault-fallback prohibition (TAR-005 only)
 */
export function enforceReadBeforeToolCall(params: {
  serverName: string;
  operationName: string;
  agentId: string;
  taskId: string;
  traceId: string;
  requestedPath: string;
}): ReadEnforcementResult {
  const { serverName, operationName, agentId, taskId, traceId, requestedPath } = params;

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
      scopeBasis: "envelope",
    });
    return {
      allowed: false,
      record,
      denialReason: "unauthorized_agent",
      integrityEvent: `INTEGRITY_EVENT: unauthorized_agent — agent=${agentId} attempted ${entry.capability_id} (${operationName})`,
    };
  }

  // Step 3: Scope check
  if (!isWithinAuthorizedScope(requestedPath)) {
    const record = buildInvocationRecord({
      capabilityId: entry.capability_id,
      capabilityResolutionResult: "resolved",
      agentId,
      taskId,
      traceId,
      operationName,
      outcome: "denied",
      denialReason: "scope_violation",
      scopeBasis: "envelope",
    });
    return { allowed: false, record, denialReason: "scope_violation" };
  }

  // Step 4: Vault-fallback prohibition (TAR-005 reads only — not directory listings)
  if (entry.capability_id === "TAR-005" && isVaultFallbackPath(requestedPath)) {
    const record = buildInvocationRecord({
      capabilityId: entry.capability_id,
      capabilityResolutionResult: "resolved",
      agentId,
      taskId,
      traceId,
      operationName,
      outcome: "denied",
      denialReason: "vault_fallback_prohibited",
      scopeBasis: "envelope",
    });
    return { allowed: false, record, denialReason: "vault_fallback_prohibited" };
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
    scopeBasis: "envelope",
  });
  return { allowed: true, record };
}

// ---------------------------------------------------------------------------
// Hook handlers
// ---------------------------------------------------------------------------

const TAR005_OPERATIONS = new Set([
  "mcp__filesystem__read_file",
  "mcp__filesystem__read_text_file",
]);

const TAR007_OPERATIONS = new Set([
  "mcp__filesystem__list_directory",
  "mcp__filesystem__directory_tree",
]);

function extractReadPath(event: PluginHookBeforeToolCallEvent): string {
  const p = event.params;
  if (typeof p["path"] === "string") {
    return p["path"];
  }
  if (typeof p["target"] === "string") {
    return p["target"];
  }
  if (typeof p["directory"] === "string") {
    return p["directory"];
  }
  return "";
}

function makeReadCtx(ctx: PluginHookToolContext) {
  return {
    agentId: ctx.agentId ?? "unknown",
    taskId: ctx.runId ?? "no-task-id",
    traceId: ctx.sessionId ?? ctx.sessionKey ?? "no-trace-id",
  };
}

/**
 * before_tool_call handler for TAR-005 (filesystem read_file / read_text_file).
 */
export async function tarFilesystemReadBeforeToolCallHandler(
  event: PluginHookBeforeToolCallEvent,
  ctx: PluginHookToolContext,
): Promise<PluginHookBeforeToolCallResult | void> {
  if (!TAR005_OPERATIONS.has(event.toolName)) {
    return;
  }

  const operationName = event.toolName.replace("mcp__filesystem__", "");
  const { agentId, taskId, traceId } = makeReadCtx(ctx);
  const requestedPath = extractReadPath(event);

  const result = enforceReadBeforeToolCall({
    serverName: "filesystem",
    operationName,
    agentId,
    taskId,
    traceId,
    requestedPath,
  });

  log.info(
    `TAR-005 read: capability=${result.record.capability_id} ` +
      `agent=${agentId} outcome=${result.record.outcome} path=${requestedPath}` +
      (result.denialReason ? ` denied=${result.denialReason}` : ""),
  );

  if (result.integrityEvent) {
    log.error(`INTEGRITY_EVENT: ${result.integrityEvent}`);
  }

  if (!result.allowed) {
    return {
      block: true,
      blockReason:
        `TAR-005 filesystem read denied: ${result.denialReason ?? "unauthorized"} ` +
        `[capability=${result.record.capability_id} agent=${agentId} path=${requestedPath}]`,
    };
  }
  return;
}

/**
 * before_tool_call handler for TAR-007 (filesystem list_directory / directory_tree).
 */
export async function tarFilesystemListBeforeToolCallHandler(
  event: PluginHookBeforeToolCallEvent,
  ctx: PluginHookToolContext,
): Promise<PluginHookBeforeToolCallResult | void> {
  if (!TAR007_OPERATIONS.has(event.toolName)) {
    return;
  }

  const operationName = event.toolName.replace("mcp__filesystem__", "");
  const { agentId, taskId, traceId } = makeReadCtx(ctx);
  const requestedPath = extractReadPath(event);

  const result = enforceReadBeforeToolCall({
    serverName: "filesystem",
    operationName,
    agentId,
    taskId,
    traceId,
    requestedPath,
  });

  log.info(
    `TAR-007 list: capability=${result.record.capability_id} ` +
      `agent=${agentId} outcome=${result.record.outcome} path=${requestedPath}` +
      (result.denialReason ? ` denied=${result.denialReason}` : ""),
  );

  if (result.integrityEvent) {
    log.error(`INTEGRITY_EVENT: ${result.integrityEvent}`);
  }

  if (!result.allowed) {
    return {
      block: true,
      blockReason:
        `TAR-007 filesystem list denied: ${result.denialReason ?? "unauthorized"} ` +
        `[capability=${result.record.capability_id} agent=${agentId} path=${requestedPath}]`,
    };
  }
  return;
}
