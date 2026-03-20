/**
 * continuum/governance/tar-create-enforcement.test.ts
 *
 * Work Order 4D tests — TAR-004 and TAR-008 new file creation enforcement
 *
 * TAR-004 (obsidian-vault write_file):
 *   - grant required
 *   - artifact shadowing check (System-Charter.md, Decision-Log.md, etc.)
 *
 * TAR-008 (filesystem write_file):
 *   - grant required
 *   - prohibited path check (.openclaw/, LaunchAgents/, outside repo root)
 *
 * Acceptance scenarios from PACS-IMPL-STAGE3-001 Priority 4:
 * 1.  Foundry creates a new vault artifact with valid grant → allowed (TAR-004)
 * 2.  Foundry attempts to overwrite System-Charter.md → denied_artifact_shadowing
 * 3.  Foundry attempts without grant (TAR-004) → grant_not_found
 * 4.  Locus (unauthorized) attempts vault creation → denied + INTEGRITY event
 * 5.  Foundry creates a new repo file with valid grant → allowed (TAR-008)
 * 6.  Foundry attempts to create in .openclaw/ → denied_path_out_of_scope
 * 7.  Foundry attempts path outside /Users/faheem/openclaw → denied_path_out_of_scope
 * 8.  Foundry attempts without grant (TAR-008) → grant_not_found
 * 9.  Signal (unauthorized) attempts repo creation → denied + INTEGRITY event
 * 10. Revoked grant → grant_revoked + INTEGRITY event
 *
 * Run: pnpm vitest run --config vitest.continuum.config.ts
 */

import { describe, expect, it, beforeEach } from "vitest";
import { ActionAuthorizationGateway } from "./action-authorization-gateway.js";
import {
  wouldShadowLockedArtifact,
  isRepoCreateProhibitedPath,
  enforceCreateBeforeToolCall,
} from "./tar-create-enforcement.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVaultGrant(
  gateway: ActionAuthorizationGateway,
  newFilePath: string,
  overrides?: Partial<Parameters<ActionAuthorizationGateway["issueGrant"]>[0]>,
) {
  return gateway.issueGrant({
    task_id: "task-001",
    trace_id: "trace-abc",
    authorized_action: "write_file",
    action_class: "side-effecting",
    allowed_target: newFilePath,
    scope: "vault-create",
    ttl_ms: 60_000,
    policy_hash: "policy-v1",
    grant_mode: "single-use",
    ...overrides,
  });
}

function makeRepoGrant(
  gateway: ActionAuthorizationGateway,
  newFilePath: string,
  overrides?: Partial<Parameters<ActionAuthorizationGateway["issueGrant"]>[0]>,
) {
  return gateway.issueGrant({
    task_id: "task-001",
    trace_id: "trace-abc",
    authorized_action: "write_file",
    action_class: "side-effecting",
    allowed_target: newFilePath,
    scope: "repo-create",
    ttl_ms: 60_000,
    policy_hash: "policy-v1",
    grant_mode: "single-use",
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// wouldShadowLockedArtifact unit tests
// ---------------------------------------------------------------------------

describe("wouldShadowLockedArtifact", () => {
  it("returns true for System-Charter.md", () => {
    expect(wouldShadowLockedArtifact("/vault/00-Project-Hub/System-Charter.md")).toBe(true);
  });

  it("returns true for Decision-Log.md", () => {
    expect(wouldShadowLockedArtifact("/vault/00-Project-Hub/Decision-Log.md")).toBe(true);
  });

  it("returns true for PACS-Session-State.md", () => {
    expect(wouldShadowLockedArtifact("/vault/00-Project-Hub/PACS-Session-State.md")).toBe(true);
  });

  it("returns false for a normal new artifact", () => {
    expect(wouldShadowLockedArtifact("/vault/02-Architecture/New-Component.md")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isRepoCreateProhibitedPath unit tests
// ---------------------------------------------------------------------------

describe("isRepoCreateProhibitedPath", () => {
  it("returns true for .openclaw/ subdirectory", () => {
    expect(isRepoCreateProhibitedPath("/Users/faheem/openclaw/.openclaw/somefile.json")).toBe(true);
  });

  it("returns true for LaunchAgents/ path", () => {
    expect(
      isRepoCreateProhibitedPath("/Users/faheem/Library/LaunchAgents/ai.openclaw.gateway.plist"),
    ).toBe(true);
  });

  it("returns true for path outside repo root", () => {
    expect(isRepoCreateProhibitedPath("/Users/faheem/Desktop/test.ts")).toBe(true);
  });

  it("returns false for a valid source file in the repo", () => {
    expect(
      isRepoCreateProhibitedPath("/Users/faheem/openclaw/continuum/governance/new-module.ts"),
    ).toBe(false);
  });

  it("returns false for a new file in src/", () => {
    expect(isRepoCreateProhibitedPath("/Users/faheem/openclaw/src/new-feature.ts")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TAR-004 enforcement tests (obsidian-vault write_file)
// ---------------------------------------------------------------------------

describe("enforceCreateBeforeToolCall — TAR-004 (vault)", () => {
  let gateway: ActionAuthorizationGateway;

  beforeEach(() => {
    gateway = new ActionAuthorizationGateway();
  });

  /**
   * Scenario 1: Authorized agent creates a new vault artifact with valid grant
   */
  it("allows foundry to create a new vault artifact", () => {
    const newPath = "/vault/02-Architecture/New-Component.md";
    const grant = makeVaultGrant(gateway, newPath);

    const result = enforceCreateBeforeToolCall({
      serverName: "obsidian-vault",
      operationName: "write_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      newFilePath: newPath,
      gateway,
    });

    expect(result.allowed).toBe(true);
    expect(result.record.capability_id).toBe("TAR-004");
    expect(result.record.outcome).toBe("executed");
    expect(result.integrityEvent).toBeUndefined();
  });

  /**
   * Scenario 2: Foundry attempts to create System-Charter.md (shadowing locked artifact)
   */
  it("denies creation that would shadow System-Charter.md", () => {
    const newPath = "/vault/00-Project-Hub/System-Charter.md";
    const grant = makeVaultGrant(gateway, newPath);

    const result = enforceCreateBeforeToolCall({
      serverName: "obsidian-vault",
      operationName: "write_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      newFilePath: newPath,
      gateway,
    });

    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("denied_artifact_shadowing");
    expect(result.integrityEvent).toBeDefined();
    expect(result.integrityEvent).toContain("artifact_shadowing_attempt");
  });

  /**
   * Scenario 3: No grant submitted for TAR-004
   */
  it("denies vault creation when no grant is submitted", () => {
    const result = enforceCreateBeforeToolCall({
      serverName: "obsidian-vault",
      operationName: "write_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: undefined,
      newFilePath: "/vault/02-Architecture/New-Component.md",
      gateway,
    });

    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("grant_not_found");
  });

  /**
   * Scenario 4: Locus (unauthorized) attempts vault creation
   */
  it("denies locus from creating vault files", () => {
    const newPath = "/vault/02-Architecture/New-Component.md";
    const grant = makeVaultGrant(gateway, newPath);

    const result = enforceCreateBeforeToolCall({
      serverName: "obsidian-vault",
      operationName: "write_file",
      agentId: "locus",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      newFilePath: newPath,
      gateway,
    });

    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("unauthorized_agent");
    expect(result.integrityEvent).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// TAR-008 enforcement tests (filesystem write_file)
// ---------------------------------------------------------------------------

describe("enforceCreateBeforeToolCall — TAR-008 (repo)", () => {
  let gateway: ActionAuthorizationGateway;

  beforeEach(() => {
    gateway = new ActionAuthorizationGateway();
  });

  /**
   * Scenario 5: Authorized agent creates a new repo file with valid grant
   */
  it("allows foundry to create a new source file in the repo", () => {
    const newPath = "/Users/faheem/openclaw/continuum/governance/new-module.ts";
    const grant = makeRepoGrant(gateway, newPath);

    const result = enforceCreateBeforeToolCall({
      serverName: "filesystem",
      operationName: "write_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      newFilePath: newPath,
      gateway,
    });

    expect(result.allowed).toBe(true);
    expect(result.record.capability_id).toBe("TAR-008");
    expect(result.record.outcome).toBe("executed");
  });

  /**
   * Scenario 6: Foundry attempts to create in .openclaw/
   */
  it("denies creation in .openclaw/ directory", () => {
    const newPath = "/Users/faheem/openclaw/.openclaw/agents/new-agent/SOUL.md";
    const grant = makeRepoGrant(gateway, newPath);

    const result = enforceCreateBeforeToolCall({
      serverName: "filesystem",
      operationName: "write_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      newFilePath: newPath,
      gateway,
    });

    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("denied_path_out_of_scope");
  });

  /**
   * Scenario 7: Foundry attempts path outside repo root
   */
  it("denies creation outside /Users/faheem/openclaw", () => {
    const newPath = "/Users/faheem/Desktop/malicious.ts";
    const grant = makeRepoGrant(gateway, newPath);

    const result = enforceCreateBeforeToolCall({
      serverName: "filesystem",
      operationName: "write_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      newFilePath: newPath,
      gateway,
    });

    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("denied_path_out_of_scope");
  });

  /**
   * Scenario 8: No grant submitted for TAR-008
   */
  it("denies repo creation when no grant is submitted", () => {
    const result = enforceCreateBeforeToolCall({
      serverName: "filesystem",
      operationName: "write_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: undefined,
      newFilePath: "/Users/faheem/openclaw/src/new.ts",
      gateway,
    });

    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("grant_not_found");
  });

  /**
   * Scenario 9: Signal (unauthorized) attempts repo creation
   */
  it("denies signal from creating repo files", () => {
    const newPath = "/Users/faheem/openclaw/src/new.ts";
    const grant = makeRepoGrant(gateway, newPath);

    const result = enforceCreateBeforeToolCall({
      serverName: "filesystem",
      operationName: "write_file",
      agentId: "signal",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      newFilePath: newPath,
      gateway,
    });

    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("unauthorized_agent");
    expect(result.integrityEvent).toBeDefined();
  });

  /**
   * Scenario 10: Revoked grant → grant_revoked + INTEGRITY event
   */
  it("denies creation with revoked grant and emits INTEGRITY event", () => {
    const newPath = "/Users/faheem/openclaw/src/new.ts";
    const grant = makeRepoGrant(gateway, newPath);
    gateway.revokeGrant(grant.grant_id);

    const result = enforceCreateBeforeToolCall({
      serverName: "filesystem",
      operationName: "write_file",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
      grantId: grant.grant_id,
      newFilePath: newPath,
      gateway,
    });

    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("grant_revoked");
    expect(result.integrityEvent).toBeDefined();
    expect(result.integrityEvent).toContain("revoked_grant_used");
  });
});
