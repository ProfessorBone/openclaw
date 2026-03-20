/**
 * continuum/governance/tar-write-enforcement.test.ts
 *
 * Work Order 4B tests — TAR-003 write surface enforcement
 *
 * Five acceptance scenarios from PACS-IMPL-STAGE3-001 Priority 2:
 * 1. Foundry edits a vault file with valid grant → allowed
 * 2. Foundry edits without a grant → denied_no_grant (grant_not_found)
 * 3. Foundry edits with expired grant → denied_expired_grant
 * 4. Foundry edits with revoked grant → denied_revoked_grant + INTEGRITY event
 * 5. Foundry edits System-Charter.md with grant but no human approval → denied
 * 6. Foundry edits System-Charter.md with grant + human approval → allowed
 * 7. Crucible (unauthorized) attempts edit → denied + INTEGRITY event
 * 8. Unknown operation → capability_resolution_failed
 *
 * Run: pnpm vitest run --config vitest.continuum.config.ts
 */

import { describe, expect, it, beforeEach } from "vitest";
import { ActionAuthorizationGateway } from "./action-authorization-gateway.js";
import { actionAuthorizationGateway } from "./action-authorization-gateway.js";
import {
  enforceWriteBeforeToolCall,
  tarWriteBeforeToolCallHandler,
} from "./tar-write-enforcement.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGrant(
  gateway: ActionAuthorizationGateway,
  overrides?: Partial<Parameters<ActionAuthorizationGateway["issueGrant"]>[0]>,
) {
  return gateway.issueGrant({
    task_id: "task-001",
    trace_id: "trace-abc",
    authorized_action: "edit_file",
    action_class: "side-effecting",
    allowed_target: "/vault/architecture/ADR-001.md",
    scope: "vault-write",
    ttl_ms: 60_000,
    policy_hash: "policy-v1",
    grant_mode: "single-use",
    ...overrides,
  });
}

function makeCtx(agentId: string): Parameters<typeof tarWriteBeforeToolCallHandler>[1] {
  return {
    agentId,
    sessionKey: "session-test",
    sessionId: "trace-test",
    runId: "task-test",
    toolName: "mcp__obsidian-vault__edit_file",
    toolCallId: undefined,
  };
}

// ---------------------------------------------------------------------------
// enforceWriteBeforeToolCall unit tests
// ---------------------------------------------------------------------------

describe("enforceWriteBeforeToolCall", () => {
  let gateway: ActionAuthorizationGateway;

  beforeEach(() => {
    gateway = new ActionAuthorizationGateway();
  });

  /**
   * Scenario 1: Authorized agent with valid grant → allowed
   */
  it("allows foundry to edit a vault file with a valid grant", () => {
    const grant = makeGrant(gateway);
    const result = enforceWriteBeforeToolCall({
      serverName: "obsidian-vault",
      operationName: "edit_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      requestedTarget: "/vault/architecture/ADR-001.md",
      gateway,
    });
    expect(result.allowed).toBe(true);
    expect(result.record.outcome).toBe("executed");
    expect(result.record.capability_id).toBe("TAR-003");
    expect(result.integrityEvent).toBeUndefined();
  });

  /**
   * Scenario 2: No grant submitted → grant_not_found
   */
  it("denies edit when no grant is submitted", () => {
    const result = enforceWriteBeforeToolCall({
      serverName: "obsidian-vault",
      operationName: "edit_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: undefined,
      requestedTarget: "/vault/architecture/ADR-001.md",
    });
    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("grant_not_found");
    expect(result.record.denial_reason).toBe("grant_not_found");
  });

  /**
   * Scenario 3: Expired grant → grant_expired
   */
  it("denies edit with expired grant", async () => {
    const grant = makeGrant(gateway, { ttl_ms: 1 });
    await new Promise((r) => setTimeout(r, 5));
    const result = enforceWriteBeforeToolCall({
      serverName: "obsidian-vault",
      operationName: "edit_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      requestedTarget: "/vault/architecture/ADR-001.md",
      gateway,
    });
    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("grant_expired");
  });

  /**
   * Scenario 4: Revoked grant → grant_revoked + INTEGRITY event
   */
  it("denies edit with revoked grant and emits INTEGRITY event", () => {
    const grant = makeGrant(gateway);
    gateway.revokeGrant(grant.grant_id);
    const result = enforceWriteBeforeToolCall({
      serverName: "obsidian-vault",
      operationName: "edit_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      requestedTarget: "/vault/architecture/ADR-001.md",
      gateway,
    });
    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("grant_revoked");
    expect(result.integrityEvent).toBeDefined();
    expect(result.integrityEvent).toContain("revoked_grant_used");
  });

  /**
   * Scenario 5: Protected target (System-Charter.md) without human approval → denied
   */
  it("denies edit of System-Charter.md when grant has no human approval record", () => {
    const grant = makeGrant(gateway, {
      allowed_target: "System-Charter.md",
    });
    const result = enforceWriteBeforeToolCall({
      serverName: "obsidian-vault",
      operationName: "edit_file",
      agentId: "the-bridge",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      requestedTarget: "System-Charter.md",
      gateway,
    });
    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("human_approval_required");
  });

  /**
   * Scenario 6: Protected target with human approval record → allowed
   */
  it("allows edit of System-Charter.md when grant carries human approval record", () => {
    const grant = makeGrant(gateway, {
      allowed_target: "System-Charter.md",
      human_approval_record_id: "approval-faheem-001",
    });
    const result = enforceWriteBeforeToolCall({
      serverName: "obsidian-vault",
      operationName: "edit_file",
      agentId: "the-bridge",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      requestedTarget: "System-Charter.md",
      gateway,
    });
    expect(result.allowed).toBe(true);
    expect(result.record.outcome).toBe("executed");
  });

  /**
   * Scenario 7: Unauthorized agent (crucible not in TAR-003 approved_agent_ids) → denied + INTEGRITY
   */
  it("denies edit by unauthorized agent and emits INTEGRITY event", () => {
    const grant = makeGrant(gateway);
    const result = enforceWriteBeforeToolCall({
      serverName: "obsidian-vault",
      operationName: "edit_file",
      agentId: "crucible",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      requestedTarget: "/vault/architecture/ADR-001.md",
      gateway,
    });
    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("unauthorized_agent");
    expect(result.integrityEvent).toBeDefined();
    expect(result.integrityEvent).toContain("unauthorized_agent");
  });

  /**
   * Scenario 8: Unknown operation → capability_resolution_failed
   */
  it("denies unknown operations with capability_resolution_failed", () => {
    const result = enforceWriteBeforeToolCall({
      serverName: "obsidian-vault",
      operationName: "delete_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: "any-grant-id",
      requestedTarget: "/vault/architecture/ADR-001.md",
    });
    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("capability_resolution_failed");
  });

  /**
   * Target mismatch: grant issued for one target, edit attempted on different target
   */
  it("denies edit when target does not match grant allowed_target", () => {
    const grant = makeGrant(gateway, {
      allowed_target: "/vault/architecture/ADR-001.md",
    });
    const result = enforceWriteBeforeToolCall({
      serverName: "obsidian-vault",
      operationName: "edit_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      requestedTarget: "/vault/security/different-file.md",
      gateway,
    });
    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("target_mismatch");
  });
});

// ---------------------------------------------------------------------------
// tarWriteBeforeToolCallHandler integration tests
// ---------------------------------------------------------------------------

describe("tarWriteBeforeToolCallHandler", () => {
  beforeEach(() => {
    // Use the singleton but clear it between tests
    actionAuthorizationGateway.clearAll();
  });

  it("passes through non-edit-file tool calls", async () => {
    const result = await tarWriteBeforeToolCallHandler(
      { toolName: "mcp__obsidian-vault__read_file", params: {} },
      makeCtx("foundry"),
    );
    expect(result).toBeUndefined();
  });

  it("blocks edit_file call with no grant_id in params", async () => {
    const result = await tarWriteBeforeToolCallHandler(
      {
        toolName: "mcp__obsidian-vault__edit_file",
        params: { path: "/vault/architecture/ADR-001.md" },
      },
      makeCtx("foundry"),
    );
    expect(result?.block).toBe(true);
    expect(result?.blockReason).toContain("grant_not_found");
  });

  it("allows edit_file call with valid grant and matching target", async () => {
    const grant = actionAuthorizationGateway.issueGrant({
      task_id: "task-test",
      trace_id: "trace-test",
      authorized_action: "edit_file",
      action_class: "side-effecting",
      allowed_target: "/vault/architecture/ADR-001.md",
      scope: "vault-write",
      ttl_ms: 60_000,
      policy_hash: "hash-v1",
      grant_mode: "single-use",
    });

    const result = await tarWriteBeforeToolCallHandler(
      {
        toolName: "mcp__obsidian-vault__edit_file",
        params: {
          grant_id: grant.grant_id,
          path: "/vault/architecture/ADR-001.md",
        },
      },
      makeCtx("foundry"),
    );
    expect(result).toBeUndefined(); // allowed — passes through
  });

  it("blocks unauthorized agent (gauge) from edit_file", async () => {
    const grant = actionAuthorizationGateway.issueGrant({
      task_id: "task-test",
      trace_id: "trace-test",
      authorized_action: "edit_file",
      action_class: "side-effecting",
      allowed_target: "/vault/architecture/ADR-001.md",
      scope: "vault-write",
      ttl_ms: 60_000,
      policy_hash: "hash-v1",
      grant_mode: "single-use",
    });

    const result = await tarWriteBeforeToolCallHandler(
      {
        toolName: "mcp__obsidian-vault__edit_file",
        params: {
          grant_id: grant.grant_id,
          path: "/vault/architecture/ADR-001.md",
        },
      },
      makeCtx("gauge"), // gauge not in TAR-003 approved_agent_ids
    );
    expect(result?.block).toBe(true);
    expect(result?.blockReason).toContain("unauthorized");
  });
});
