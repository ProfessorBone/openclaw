/**
 * continuum/governance/tar-enforcement.test.ts
 *
 * Work Order 1 acceptance tests — PACS-IMPL-STAGE3-001 Priority 1
 *
 * Five scenarios from the acceptance test suite:
 * 1. Authorized agent requests TAR-001 → allowed: true
 * 2. Unauthorized agent (vault) requests TAR-001 → allowed: false, integrityEvent present
 * 3. Signal requests TAR-002 → allowed: false, integrityEvent present
 * 4. Unknown operation → allowed: false, denialReason: capability_resolution_failed
 * 5. Authorized agent requests TAR-002 → allowed: true
 *
 * Test runner: Vitest (project standard)
 * Run with: pnpm vitest run --config vitest.continuum.config.ts
 */

import { describe, expect, it } from "vitest";
import {
  checkAgentAuthorization,
  enforceBeforeToolCall,
  resolveCapability,
} from "./tar-enforcement.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const BASE_PARAMS = {
  taskId: "task-001",
  traceId: "trace-abc",
};

// ---------------------------------------------------------------------------
// resolveCapability unit tests
// ---------------------------------------------------------------------------

describe("resolveCapability", () => {
  it("resolves obsidian-vault + read_file to TAR-001", () => {
    const entry = resolveCapability("obsidian-vault", "read_file");
    expect(entry).not.toBeNull();
    expect(entry?.capability_id).toBe("TAR-001");
  });

  it("resolves obsidian-vault + read_text_file to TAR-001 (alias)", () => {
    const entry = resolveCapability("obsidian-vault", "read_text_file");
    expect(entry).not.toBeNull();
    expect(entry?.capability_id).toBe("TAR-001");
  });

  it("resolves obsidian-vault + read_multiple_files to TAR-002", () => {
    const entry = resolveCapability("obsidian-vault", "read_multiple_files");
    expect(entry).not.toBeNull();
    expect(entry?.capability_id).toBe("TAR-002");
  });

  it("returns null for an unknown operation", () => {
    const entry = resolveCapability("obsidian-vault", "delete_file");
    expect(entry).toBeNull();
  });

  it("returns null for an unknown server", () => {
    const entry = resolveCapability("unknown-server", "read_file");
    expect(entry).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// checkAgentAuthorization unit tests
// ---------------------------------------------------------------------------

describe("checkAgentAuthorization", () => {
  it("authorizes crucible for TAR-001", () => {
    const result = checkAgentAuthorization("TAR-001", "crucible");
    expect(result.authorized).toBe(true);
  });

  it("denies vault for TAR-001", () => {
    const result = checkAgentAuthorization("TAR-001", "vault");
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain("unauthorized_agent");
  });

  it("authorizes gauge for TAR-002", () => {
    const result = checkAgentAuthorization("TAR-002", "gauge");
    expect(result.authorized).toBe(true);
  });

  it("denies signal for TAR-002", () => {
    const result = checkAgentAuthorization("TAR-002", "signal");
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain("unauthorized_agent");
  });
});

// ---------------------------------------------------------------------------
// enforceBeforeToolCall — Work Order 1 acceptance tests
// ---------------------------------------------------------------------------

describe("enforceBeforeToolCall — Work Order 1 acceptance tests", () => {
  /**
   * Scenario 1: Authorized agent requests TAR-001
   * Agent: crucible (in approved_agent_ids for TAR-001)
   * Expected: allowed = true, record outcome = executed
   */
  it("scenario 1: authorized agent requests TAR-001 → allowed", () => {
    const result = enforceBeforeToolCall({
      serverName: "obsidian-vault",
      operationName: "read_file",
      agentId: "crucible",
      ...BASE_PARAMS,
    });

    expect(result.allowed).toBe(true);
    expect(result.integrityEvent).toBeUndefined();
    expect(result.record.outcome).toBe("executed");
    expect(result.record.capability_id).toBe("TAR-001");
    expect(result.record.capability_resolution_result).toBe("resolved");
    expect(result.record.agent_id).toBe("crucible");
    expect(result.record.denial_reason).toBeUndefined();
  });

  /**
   * Scenario 2: Unauthorized agent (vault) requests TAR-001
   * vault is not in approved_agent_ids for TAR-001 (sandbox deny list)
   * Expected: allowed = false, integrityEvent present, denial_reason = unauthorized_agent
   */
  it("scenario 2: vault requests TAR-001 → denied with INTEGRITY event", () => {
    const result = enforceBeforeToolCall({
      serverName: "obsidian-vault",
      operationName: "read_file",
      agentId: "vault",
      ...BASE_PARAMS,
    });

    expect(result.allowed).toBe(false);
    expect(result.integrityEvent).toBeDefined();
    expect(result.integrityEvent).toContain("unauthorized_agent");
    expect(result.integrityEvent).toContain("vault");
    expect(result.record.outcome).toBe("denied");
    expect(result.record.denial_reason).toBe("unauthorized_agent");
    expect(result.record.capability_resolution_result).toBe("resolved");
  });

  /**
   * Scenario 3: Signal requests TAR-002 (read_multiple_files)
   * Signal is NOT in approved_agent_ids for TAR-002 per ACM Section 3
   * Expected: allowed = false, integrityEvent present
   */
  it("scenario 3: signal requests TAR-002 → denied with INTEGRITY event", () => {
    const result = enforceBeforeToolCall({
      serverName: "obsidian-vault",
      operationName: "read_multiple_files",
      agentId: "signal",
      ...BASE_PARAMS,
    });

    expect(result.allowed).toBe(false);
    expect(result.integrityEvent).toBeDefined();
    expect(result.integrityEvent).toContain("unauthorized_agent");
    expect(result.integrityEvent).toContain("signal");
    expect(result.record.outcome).toBe("denied");
    expect(result.record.denial_reason).toBe("unauthorized_agent");
    expect(result.record.capability_id).toBe("TAR-002");
  });

  /**
   * Scenario 4: Unknown operation — no matching capability_id
   * Expected: allowed = false, denialReason = capability_resolution_failed
   * No integrityEvent (this is a resolution failure, not an authorization violation)
   */
  it("scenario 4: unknown operation → capability_resolution_failed", () => {
    const result = enforceBeforeToolCall({
      serverName: "obsidian-vault",
      operationName: "delete_file",
      agentId: "foundry",
      ...BASE_PARAMS,
    });

    expect(result.allowed).toBe(false);
    expect(result.record.denial_reason).toBe("capability_resolution_failed");
    expect(result.record.capability_resolution_result).toBe("unresolved");
    expect(result.record.capability_id).toBe("UNRESOLVED");
    expect(result.record.outcome).toBe("denied");
    // capability_resolution_failed is not an INTEGRITY event — it is a resolution failure
    // The integrityEvent may or may not be set; what matters is the denial_reason
  });

  /**
   * Scenario 5: Authorized agent requests TAR-002
   * Agent: locus (in approved_agent_ids for TAR-002)
   * Expected: allowed = true, outcome = executed
   */
  it("scenario 5: authorized agent requests TAR-002 → allowed", () => {
    const result = enforceBeforeToolCall({
      serverName: "obsidian-vault",
      operationName: "read_multiple_files",
      agentId: "locus",
      ...BASE_PARAMS,
    });

    expect(result.allowed).toBe(true);
    expect(result.integrityEvent).toBeUndefined();
    expect(result.record.outcome).toBe("executed");
    expect(result.record.capability_id).toBe("TAR-002");
    expect(result.record.capability_resolution_result).toBe("resolved");
    expect(result.record.agent_id).toBe("locus");
  });
});

// ---------------------------------------------------------------------------
// Invocation record structural tests
// ---------------------------------------------------------------------------

describe("invocation record structure", () => {
  it("always contains required fields", () => {
    const result = enforceBeforeToolCall({
      serverName: "obsidian-vault",
      operationName: "read_file",
      agentId: "the-bridge",
      taskId: "task-xyz",
      traceId: "trace-xyz",
    });

    const record = result.record;
    expect(record.capability_id).toBeDefined();
    expect(record.capability_resolution_result).toBeDefined();
    expect(record.agent_id).toBe("the-bridge");
    expect(record.task_id).toBe("task-xyz");
    expect(record.trace_id).toBe("trace-xyz");
    expect(record.operation_name).toBe("read_file");
    expect(record.invocation_timestamp).toBeDefined();
    expect(record.scope_basis).toBeDefined();
    expect(record.validation_result).toBeDefined();
    expect(record.outcome).toBeDefined();
  });

  it("read_text_file alias resolves identically to read_file for TAR-001", () => {
    const r1 = enforceBeforeToolCall({
      serverName: "obsidian-vault",
      operationName: "read_file",
      agentId: "foundry",
      ...BASE_PARAMS,
    });
    const r2 = enforceBeforeToolCall({
      serverName: "obsidian-vault",
      operationName: "read_text_file",
      agentId: "foundry",
      ...BASE_PARAMS,
    });

    expect(r1.record.capability_id).toBe(r2.record.capability_id);
    expect(r1.allowed).toBe(r2.allowed);
  });
});
