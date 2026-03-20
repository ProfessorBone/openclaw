/**
 * continuum/governance/tar-repo-enforcement.test.ts
 *
 * Work Order 4C tests — TAR-006 filesystem edit_file enforcement
 *
 * Three-tier path classification tests:
 *   - Tier A: openclaw.json, .env → denied_categorically_prohibited + INTEGRITY event
 *   - Tier B: .claude/hooks/** → human_approval_required without approval
 *   - Tier C: source files → grant-required, no human approval needed
 *
 * Acceptance scenarios from PACS-IMPL-STAGE3-001 Priority 3:
 * 1. Foundry edits a Tier C source file with valid grant → allowed
 * 2. Foundry edits openclaw.json → denied_categorically_prohibited (even with grant)
 * 3. Foundry edits a governance hook file with grant but no human approval → denied
 * 4. Foundry edits a governance hook file with grant + human approval → allowed
 * 5. Foundry edits with revoked grant → denied_revoked_grant + INTEGRITY event
 * 6. Locus (unauthorized) attempts repo edit → denied + INTEGRITY event
 * 7. File outside authorized scope → out_of_scope
 *
 * Run: pnpm vitest run --config vitest.continuum.config.ts
 */

import { describe, expect, it, beforeEach } from "vitest";
import { ActionAuthorizationGateway } from "./action-authorization-gateway.js";
import { classifyRepoPath, enforceRepoWriteBeforeToolCall } from "./tar-repo-enforcement.js";

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
    allowed_target: "/Users/faheem/openclaw/src/agents/tool-policy.ts",
    scope: "repo-write",
    ttl_ms: 60_000,
    policy_hash: "policy-v1",
    grant_mode: "single-use",
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// classifyRepoPath unit tests
// ---------------------------------------------------------------------------

describe("classifyRepoPath", () => {
  it("classifies openclaw.json as tier-a-prohibited", () => {
    expect(classifyRepoPath("/Users/faheem/openclaw/openclaw.json")).toBe("tier-a-prohibited");
  });

  it("classifies .env as tier-a-prohibited", () => {
    expect(classifyRepoPath("/Users/faheem/openclaw/.env")).toBe("tier-a-prohibited");
  });

  it("classifies .env in a subdirectory as tier-a-prohibited", () => {
    expect(classifyRepoPath("/Users/faheem/openclaw/src/.env")).toBe("tier-a-prohibited");
  });

  it("classifies .claude/hooks/ files as tier-b-human-gated", () => {
    expect(classifyRepoPath("/Users/faheem/openclaw/.claude/hooks/protected-files.sh")).toBe(
      "tier-b-human-gated",
    );
  });

  it("classifies source files as tier-c-grant-required", () => {
    expect(classifyRepoPath("/Users/faheem/openclaw/src/agents/tool-policy.ts")).toBe(
      "tier-c-grant-required",
    );
  });

  it("classifies continuum governance files as tier-c-grant-required", () => {
    expect(classifyRepoPath("/Users/faheem/openclaw/continuum/governance/tar-enforcement.ts")).toBe(
      "tier-c-grant-required",
    );
  });

  it("returns out-of-scope for paths outside the repo root", () => {
    expect(classifyRepoPath("/Users/faheem/.openclaw/openclaw.json")).toBe("out-of-scope");
  });

  it("returns out-of-scope for vault paths", () => {
    expect(
      classifyRepoPath(
        "/Users/faheem/Library/Mobile Documents/iCloud~md~obsidian/Documents/MyBrain/Projects/test.md",
      ),
    ).toBe("out-of-scope");
  });
});

// ---------------------------------------------------------------------------
// enforceRepoWriteBeforeToolCall acceptance tests
// ---------------------------------------------------------------------------

describe("enforceRepoWriteBeforeToolCall", () => {
  let gateway: ActionAuthorizationGateway;

  beforeEach(() => {
    gateway = new ActionAuthorizationGateway();
  });

  /**
   * Scenario 1: Authorized agent (foundry) edits Tier C source file with valid grant
   */
  it("allows foundry to edit a Tier C source file with valid grant", () => {
    const target = "/Users/faheem/openclaw/src/agents/tool-policy.ts";
    const grant = makeGrant(gateway, { allowed_target: target });

    const result = enforceRepoWriteBeforeToolCall({
      serverName: "filesystem",
      operationName: "edit_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      requestedTarget: target,
      gateway,
    });

    expect(result.allowed).toBe(true);
    expect(result.pathTier).toBe("tier-c-grant-required");
    expect(result.record.outcome).toBe("executed");
    expect(result.record.capability_id).toBe("TAR-006");
  });

  /**
   * Scenario 2: Foundry attempts to edit openclaw.json — Tier A, hard deny even with valid grant
   */
  it("denies edit of openclaw.json regardless of grant presence", () => {
    const target = "/Users/faheem/openclaw/openclaw.json";
    const grant = makeGrant(gateway, { allowed_target: target });

    const result = enforceRepoWriteBeforeToolCall({
      serverName: "filesystem",
      operationName: "edit_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      requestedTarget: target,
      gateway,
    });

    expect(result.allowed).toBe(false);
    expect(result.pathTier).toBe("tier-a-prohibited");
    expect(result.denialReason).toBe("denied_categorically_prohibited");
    expect(result.integrityEvent).toBeDefined();
    expect(result.integrityEvent).toContain("prohibited_path_access");
  });

  /**
   * Tier A: .env also hard denied
   */
  it("denies edit of .env regardless of grant", () => {
    const target = "/Users/faheem/openclaw/.env";
    const grant = makeGrant(gateway, { allowed_target: target });

    const result = enforceRepoWriteBeforeToolCall({
      serverName: "filesystem",
      operationName: "edit_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      requestedTarget: target,
      gateway,
    });

    expect(result.allowed).toBe(false);
    expect(result.pathTier).toBe("tier-a-prohibited");
    expect(result.denialReason).toBe("denied_categorically_prohibited");
  });

  /**
   * Scenario 3: Foundry edits a governance hook file with grant but no human approval → denied
   */
  it("denies edit of governance hook file without human approval record", () => {
    const target = "/Users/faheem/openclaw/.claude/hooks/protected-files.sh";
    const grant = makeGrant(gateway, { allowed_target: target });

    const result = enforceRepoWriteBeforeToolCall({
      serverName: "filesystem",
      operationName: "edit_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      requestedTarget: target,
      gateway,
    });

    expect(result.allowed).toBe(false);
    expect(result.pathTier).toBe("tier-b-human-gated");
    expect(result.denialReason).toBe("human_approval_required");
  });

  /**
   * Scenario 4: Foundry edits governance hook file with grant + human approval → allowed
   */
  it("allows edit of governance hook file with grant and human approval record", () => {
    const target = "/Users/faheem/openclaw/.claude/hooks/protected-files.sh";
    const grant = makeGrant(gateway, {
      allowed_target: target,
      human_approval_record_id: "approval-faheem-001",
    });

    const result = enforceRepoWriteBeforeToolCall({
      serverName: "filesystem",
      operationName: "edit_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      requestedTarget: target,
      gateway,
    });

    expect(result.allowed).toBe(true);
    expect(result.pathTier).toBe("tier-b-human-gated");
    expect(result.record.outcome).toBe("executed");
  });

  /**
   * Scenario 5: Revoked grant → denied_revoked_grant + INTEGRITY event
   */
  it("denies edit with revoked grant and emits INTEGRITY event", () => {
    const target = "/Users/faheem/openclaw/src/agents/tool-policy.ts";
    const grant = makeGrant(gateway, { allowed_target: target });
    gateway.revokeGrant(grant.grant_id);

    const result = enforceRepoWriteBeforeToolCall({
      serverName: "filesystem",
      operationName: "edit_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      requestedTarget: target,
      gateway,
    });

    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("grant_revoked");
    expect(result.integrityEvent).toBeDefined();
    expect(result.integrityEvent).toContain("revoked_grant_used");
  });

  /**
   * Scenario 6: Locus (not in TAR-006 approved_agent_ids) attempts repo edit
   */
  it("denies locus from editing filesystem files", () => {
    const target = "/Users/faheem/openclaw/src/agents/tool-policy.ts";
    const grant = makeGrant(gateway, { allowed_target: target });

    const result = enforceRepoWriteBeforeToolCall({
      serverName: "filesystem",
      operationName: "edit_file",
      agentId: "locus",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      requestedTarget: target,
      gateway,
    });

    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("unauthorized_agent");
    expect(result.integrityEvent).toBeDefined();
    expect(result.integrityEvent).toContain("unauthorized_agent");
  });

  /**
   * Scenario 7: Path outside authorized scope
   */
  it("denies edit of path outside /Users/faheem/openclaw", () => {
    const result = enforceRepoWriteBeforeToolCall({
      serverName: "filesystem",
      operationName: "edit_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: "any-grant",
      requestedTarget: "/Users/faheem/.openclaw/openclaw.json",
      gateway,
    });

    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("out_of_scope");
    expect(result.pathTier).toBe("out-of-scope");
  });

  /**
   * No grant submitted for Tier C
   */
  it("denies Tier C edit when no grant is submitted", () => {
    const result = enforceRepoWriteBeforeToolCall({
      serverName: "filesystem",
      operationName: "edit_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: undefined,
      requestedTarget: "/Users/faheem/openclaw/src/agents/tool-policy.ts",
      gateway,
    });

    expect(result.allowed).toBe(false);
    expect(result.pathTier).toBe("tier-c-grant-required");
    expect(result.denialReason).toBe("grant_not_found");
  });

  /**
   * Target mismatch: grant for one file, edit attempted on another
   */
  it("denies edit when target does not match grant allowed_target", () => {
    const grant = makeGrant(gateway, {
      allowed_target: "/Users/faheem/openclaw/src/agents/tool-policy.ts",
    });

    const result = enforceRepoWriteBeforeToolCall({
      serverName: "filesystem",
      operationName: "edit_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      requestedTarget: "/Users/faheem/openclaw/src/gateway/server.ts",
      gateway,
    });

    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("target_mismatch");
  });
});
