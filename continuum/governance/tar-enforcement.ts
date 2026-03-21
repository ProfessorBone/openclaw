/**
 * continuum/governance/tar-enforcement.ts
 *
 * Work Order 1 — PACS-IMPL-STAGE3-001
 * Surface 1: Capability resolution
 * Surface 2: Agent authorization check
 *
 * Pure TypeScript logic. No runtime I/O. No hook wiring.
 * Governed by: PACS-ARCH-TAR-001, PACS-ARCH-ACM-001, ARCH-ADR-004
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionClass = "read-only" | "side-effecting";
export type TarStatus = "proposed" | "approved" | "active" | "deprecated" | "suspended" | "revoked";

export type TarEntry = {
  capability_id: string;
  mcp_server_name: string;
  /** One or more operation names that map to this entry. */
  operation_names: readonly string[];
  action_class: ActionClass;
  approved_agent_ids: readonly string[];
  status: TarStatus;
  grant_required: boolean;
};

export type InvocationRecord = {
  capability_id: string;
  capability_resolution_result: "resolved" | "unresolved";
  agent_id: string;
  task_id: string;
  trace_id: string;
  operation_name: string;
  invocation_timestamp: string;
  scope_basis: string; // 'envelope' for scope-based; grant_id for grant-required entries
  validation_result: "passed" | "failed";
  outcome: "executed" | "denied" | "failed";
  denial_reason?: string;
};

export type AuthorizationResult = {
  authorized: boolean;
  reason?: string;
};

export type EnforcementResult = {
  allowed: boolean;
  record: InvocationRecord;
  /** Present when an unauthorized invocation is an INTEGRITY event. */
  integrityEvent?: string;
};

// ---------------------------------------------------------------------------
// TAR Registry — active entries for Work Order 1
// ---------------------------------------------------------------------------

/**
 * ACTIVE_TAR_REGISTRY contains exactly the entries relevant to Work Order 1.
 * TAR-001: obsidian-vault read_file / read_text_file
 * TAR-002: obsidian-vault read_multiple_files
 *
 * Source of truth: PACS-ARCH-TAR-001 Section 5
 * Agent authorization: PACS-ARCH-ACM-001 Section 3
 */
export const ACTIVE_TAR_REGISTRY: readonly TarEntry[] = [
  {
    capability_id: "TAR-001",
    mcp_server_name: "obsidian-vault",
    operation_names: ["read_file", "read_text_file"],
    action_class: "read-only",
    approved_agent_ids: ["the-bridge", "mec", "crucible", "locus", "foundry", "gauge", "signal"],
    status: "active",
    grant_required: false,
  },
  {
    capability_id: "TAR-002",
    mcp_server_name: "obsidian-vault",
    operation_names: ["read_multiple_files"],
    action_class: "read-only",
    approved_agent_ids: [
      "the-bridge",
      "mec",
      "crucible",
      "locus",
      "foundry",
      "gauge",
      // signal is NOT authorized for TAR-002 per ACM Section 3
    ],
    status: "active",
    grant_required: false,
  },
  {
    capability_id: "TAR-003",
    mcp_server_name: "obsidian-vault",
    operation_names: ["edit_file"],
    action_class: "side-effecting",
    approved_agent_ids: ["the-bridge", "locus", "foundry"],
    status: "active",
    grant_required: true,
  },
  {
    capability_id: "TAR-004",
    mcp_server_name: "obsidian-vault",
    operation_names: ["write_file"],
    action_class: "side-effecting",
    approved_agent_ids: ["the-bridge", "foundry"],
    status: "active",
    grant_required: true,
  },
  {
    capability_id: "TAR-006",
    mcp_server_name: "filesystem",
    operation_names: ["edit_file"],
    action_class: "side-effecting",
    approved_agent_ids: ["the-bridge", "foundry"],
    status: "active",
    grant_required: true,
  },
  {
    capability_id: "TAR-005",
    mcp_server_name: "filesystem",
    operation_names: ["read_file", "read_text_file"],
    action_class: "read-only",
    approved_agent_ids: ["the-bridge", "foundry"],
    status: "active",
    grant_required: false,
  },
  {
    capability_id: "TAR-007",
    mcp_server_name: "filesystem",
    operation_names: ["list_directory", "directory_tree"],
    action_class: "read-only",
    approved_agent_ids: ["the-bridge", "mec", "foundry", "gauge", "locus"],
    status: "active",
    grant_required: false,
  },
  {
    capability_id: "TAR-008",
    mcp_server_name: "filesystem",
    operation_names: ["write_file"],
    action_class: "side-effecting",
    approved_agent_ids: ["the-bridge", "foundry"],
    status: "active",
    grant_required: true,
  },
  {
    capability_id: "TAR-009",
    mcp_server_name: "web",
    operation_names: ["web_search", "web_fetch"],
    action_class: "read-only",
    approved_agent_ids: ["signal"],
    status: "active",
    grant_required: false,
  },
] as const;

// ---------------------------------------------------------------------------
// Surface 1 — Capability resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a server + operation pair to an active TAR entry.
 * Returns null if no active entry matches — fails closed upstream.
 *
 * TAR-001 aliases: read_file and read_text_file both resolve to TAR-001.
 */
export function resolveCapability(serverName: string, operationName: string): TarEntry | null {
  for (const entry of ACTIVE_TAR_REGISTRY) {
    if (
      entry.status === "active" &&
      entry.mcp_server_name === serverName &&
      entry.operation_names.includes(operationName)
    ) {
      return entry;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Surface 2 — Agent authorization check
// ---------------------------------------------------------------------------

/**
 * Checks whether an agent is in the approved_agent_ids list for a capability.
 * Returns authorized: false with a reason when not authorized.
 */
export function checkAgentAuthorization(
  capabilityId: string,
  agentId: string,
): AuthorizationResult {
  const entry = ACTIVE_TAR_REGISTRY.find((e) => e.capability_id === capabilityId);

  if (!entry) {
    return {
      authorized: false,
      reason: `capability_not_found: ${capabilityId}`,
    };
  }

  if (entry.approved_agent_ids.includes(agentId)) {
    return { authorized: true };
  }

  return {
    authorized: false,
    reason: `unauthorized_agent: ${agentId} is not in approved_agent_ids for ${capabilityId}`,
  };
}

// ---------------------------------------------------------------------------
// Invocation record builder
// ---------------------------------------------------------------------------

export function buildInvocationRecord(params: {
  capabilityId: string;
  capabilityResolutionResult: "resolved" | "unresolved";
  agentId: string;
  taskId: string;
  traceId: string;
  operationName: string;
  outcome: "executed" | "denied" | "failed";
  denialReason?: string;
  scopeBasis?: string; // 'envelope' or grant_id
}): InvocationRecord {
  return {
    capability_id: params.capabilityId,
    capability_resolution_result: params.capabilityResolutionResult,
    agent_id: params.agentId,
    task_id: params.taskId,
    trace_id: params.traceId,
    operation_name: params.operationName,
    invocation_timestamp: new Date().toISOString(),
    scope_basis: params.scopeBasis ?? "envelope",
    validation_result: params.outcome === "executed" ? "passed" : "failed",
    outcome: params.outcome,
    ...(params.denialReason ? { denial_reason: params.denialReason } : {}),
  };
}

// ---------------------------------------------------------------------------
// Top-level enforcement function
// ---------------------------------------------------------------------------

/**
 * Runs capability resolution and agent authorization in sequence.
 * Returns a deterministic EnforcementResult with a complete invocation record.
 *
 * Enforcement order per PACS-IMPL-STAGE3-001 Section 2:
 * 1. Resolve capability_id from server + operation
 * 2. If unresolved: allowed = false, denialReason = capability_resolution_failed
 * 3. Check agent authorization against approved_agent_ids
 * 4. If unauthorized: allowed = false, integrityEvent = unauthorized_agent
 * 5. If authorized: allowed = true
 */
export function enforceBeforeToolCall(params: {
  serverName: string;
  operationName: string;
  agentId: string;
  taskId: string;
  traceId: string;
}): EnforcementResult {
  const { serverName, operationName, agentId, taskId, traceId } = params;

  // Step 1: capability resolution
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
    return { allowed: false, record };
  }

  // Step 2: agent authorization
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
      integrityEvent: `INTEGRITY_EVENT: unauthorized_agent — agent=${agentId} attempted ${entry.capability_id} (${operationName})`,
    };
  }

  // Authorized
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
