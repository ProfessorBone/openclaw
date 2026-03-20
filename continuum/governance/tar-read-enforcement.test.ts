/**
 * continuum/governance/tar-read-enforcement.test.ts
 *
 * Work Order 4E tests — TAR-005 and TAR-007 filesystem read enforcement
 *
 * Acceptance scenarios from PACS-IMPL-STAGE3-001 Priority 5:
 * 1.  Authorized agent (foundry) reads repo file → allowed (TAR-005)
 * 2.  Unauthorized agent (signal) reads repo file → denied + INTEGRITY event
 * 3.  Vault path via filesystem server (TAR-005) → vault_fallback_prohibited
 * 4.  Path outside authorized scope → scope_violation
 * 5.  Authorized agent (foundry) lists repo directory → allowed (TAR-007)
 * 6.  Authorized agent (gauge) lists repo directory → allowed (TAR-007)
 * 7.  Unauthorized agent (signal) lists directory → denied + INTEGRITY event
 * 8.  TAR-007 does NOT apply vault-fallback prohibition (listing only)
 * 9.  Unknown operation → capability_resolution_failed
 * 10. the-bridge reads from /Users/faheem/Projects → allowed (in authorized scope)
 *
 * Run: pnpm vitest run --config vitest.continuum.config.ts
 */

import { describe, expect, it } from "vitest";
import {
  isWithinAuthorizedScope,
  isVaultFallbackPath,
  enforceReadBeforeToolCall,
} from "./tar-read-enforcement.js";

// ---------------------------------------------------------------------------
// isWithinAuthorizedScope unit tests
// ---------------------------------------------------------------------------

describe("isWithinAuthorizedScope", () => {
  it("returns true for a path in /Users/faheem/openclaw", () => {
    expect(isWithinAuthorizedScope("/Users/faheem/openclaw/src/agents/tool-policy.ts")).toBe(true);
  });

  it("returns true for a path in /Users/faheem/Projects", () => {
    expect(isWithinAuthorizedScope("/Users/faheem/Projects/some-project/file.ts")).toBe(true);
  });

  it("returns true for a vault path (in authorized scope)", () => {
    expect(
      isWithinAuthorizedScope(
        "/Users/faheem/Library/Mobile Documents/iCloud~md~obsidian/Documents/MyBrain/test.md",
      ),
    ).toBe(true);
  });

  it("returns false for a path outside all authorized roots", () => {
    expect(isWithinAuthorizedScope("/Users/faheem/Desktop/secret.txt")).toBe(false);
  });

  it("returns false for a path in .openclaw agent workspace", () => {
    expect(isWithinAuthorizedScope("/Users/faheem/.openclaw/agents/the-bridge/SOUL.md")).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// isVaultFallbackPath unit tests
// ---------------------------------------------------------------------------

describe("isVaultFallbackPath", () => {
  it("returns true for vault paths", () => {
    expect(
      isVaultFallbackPath(
        "/Users/faheem/Library/Mobile Documents/iCloud~md~obsidian/Documents/MyBrain/test.md",
      ),
    ).toBe(true);
  });

  it("returns false for repo paths", () => {
    expect(isVaultFallbackPath("/Users/faheem/openclaw/src/agents/tool-policy.ts")).toBe(false);
  });

  it("returns false for Projects paths", () => {
    expect(isVaultFallbackPath("/Users/faheem/Projects/some-project/file.ts")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TAR-005 enforcement tests
// ---------------------------------------------------------------------------

describe("enforceReadBeforeToolCall — TAR-005 (filesystem reads)", () => {
  const BASE = { serverName: "filesystem", taskId: "task-001", traceId: "trace-abc" };

  /**
   * Scenario 1: Authorized agent reads a repo file
   */
  it("allows foundry to read a repo file", () => {
    const result = enforceReadBeforeToolCall({
      ...BASE,
      operationName: "read_file",
      agentId: "foundry",
      requestedPath: "/Users/faheem/openclaw/src/agents/tool-policy.ts",
    });
    expect(result.allowed).toBe(true);
    expect(result.record.capability_id).toBe("TAR-005");
    expect(result.record.outcome).toBe("executed");
    expect(result.integrityEvent).toBeUndefined();
  });

  it("allows foundry to read_text_file (alias)", () => {
    const result = enforceReadBeforeToolCall({
      ...BASE,
      operationName: "read_text_file",
      agentId: "foundry",
      requestedPath: "/Users/faheem/openclaw/src/agents/tool-policy.ts",
    });
    expect(result.allowed).toBe(true);
    expect(result.record.capability_id).toBe("TAR-005");
  });

  it("allows the-bridge to read from /Users/faheem/Projects", () => {
    const result = enforceReadBeforeToolCall({
      ...BASE,
      operationName: "read_file",
      agentId: "the-bridge",
      requestedPath: "/Users/faheem/Projects/some-project/notes.md",
    });
    expect(result.allowed).toBe(true);
  });

  /**
   * Scenario 2: Unauthorized agent (signal) attempts filesystem read
   */
  it("denies signal from reading repo files", () => {
    const result = enforceReadBeforeToolCall({
      ...BASE,
      operationName: "read_file",
      agentId: "signal",
      requestedPath: "/Users/faheem/openclaw/src/agents/tool-policy.ts",
    });
    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("unauthorized_agent");
    expect(result.integrityEvent).toBeDefined();
    expect(result.integrityEvent).toContain("unauthorized_agent");
  });

  /**
   * Scenario 3: Vault path via filesystem server → vault_fallback_prohibited
   */
  it("denies vault path access through filesystem server", () => {
    const result = enforceReadBeforeToolCall({
      ...BASE,
      operationName: "read_file",
      agentId: "foundry",
      requestedPath:
        "/Users/faheem/Library/Mobile Documents/iCloud~md~obsidian/Documents/MyBrain/Projects/test.md",
    });
    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("vault_fallback_prohibited");
  });

  /**
   * Scenario 4: Path outside authorized scope
   */
  it("denies read of path outside authorized scope", () => {
    const result = enforceReadBeforeToolCall({
      ...BASE,
      operationName: "read_file",
      agentId: "foundry",
      requestedPath: "/Users/faheem/Desktop/secret.txt",
    });
    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("scope_violation");
  });

  /**
   * Scenario 9: Unknown operation
   */
  it("returns capability_resolution_failed for unknown filesystem operation", () => {
    const result = enforceReadBeforeToolCall({
      ...BASE,
      operationName: "delete_file",
      agentId: "foundry",
      requestedPath: "/Users/faheem/openclaw/src/agents/tool-policy.ts",
    });
    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("capability_resolution_failed");
  });
});

// ---------------------------------------------------------------------------
// TAR-007 enforcement tests
// ---------------------------------------------------------------------------

describe("enforceReadBeforeToolCall — TAR-007 (filesystem listing)", () => {
  const BASE = { serverName: "filesystem", taskId: "task-001", traceId: "trace-abc" };

  /**
   * Scenario 5: Authorized agent (foundry) lists repo directory
   */
  it("allows foundry to list a repo directory", () => {
    const result = enforceReadBeforeToolCall({
      ...BASE,
      operationName: "list_directory",
      agentId: "foundry",
      requestedPath: "/Users/faheem/openclaw/src/agents",
    });
    expect(result.allowed).toBe(true);
    expect(result.record.capability_id).toBe("TAR-007");
    expect(result.record.outcome).toBe("executed");
  });

  /**
   * Scenario 6: Authorized agent (gauge) lists repo directory
   */
  it("allows gauge to list a repo directory", () => {
    const result = enforceReadBeforeToolCall({
      ...BASE,
      operationName: "list_directory",
      agentId: "gauge",
      requestedPath: "/Users/faheem/openclaw/continuum",
    });
    expect(result.allowed).toBe(true);
    expect(result.record.capability_id).toBe("TAR-007");
  });

  it("allows directory_tree operation", () => {
    const result = enforceReadBeforeToolCall({
      ...BASE,
      operationName: "directory_tree",
      agentId: "locus",
      requestedPath: "/Users/faheem/openclaw/continuum",
    });
    expect(result.allowed).toBe(true);
  });

  /**
   * Scenario 7: Unauthorized agent (signal) attempts directory listing
   */
  it("denies signal from listing directories", () => {
    const result = enforceReadBeforeToolCall({
      ...BASE,
      operationName: "list_directory",
      agentId: "signal",
      requestedPath: "/Users/faheem/openclaw/src",
    });
    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("unauthorized_agent");
    expect(result.integrityEvent).toBeDefined();
  });

  /**
   * Scenario 8: TAR-007 does NOT apply vault-fallback prohibition
   * Directory listings of the vault path should only be scope-checked, not vault-prohibited
   */
  it("allows directory listing of vault path (no vault-fallback prohibition for listings)", () => {
    const result = enforceReadBeforeToolCall({
      ...BASE,
      operationName: "list_directory",
      agentId: "foundry",
      requestedPath: "/Users/faheem/Library/Mobile Documents/iCloud~md~obsidian/Documents/MyBrain",
    });
    // TAR-007 does not carry vault-fallback prohibition — only TAR-005 does
    expect(result.allowed).toBe(true);
    expect(result.denialReason).toBeUndefined();
  });

  it("denies listing of path outside authorized scope", () => {
    const result = enforceReadBeforeToolCall({
      ...BASE,
      operationName: "list_directory",
      agentId: "foundry",
      requestedPath: "/Users/faheem/Desktop",
    });
    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("scope_violation");
  });
});
