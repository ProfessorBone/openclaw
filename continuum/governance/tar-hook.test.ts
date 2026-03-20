/**
 * continuum/governance/tar-hook.test.ts
 *
 * Work Order 2 tests — PACS-IMPL-STAGE3-001 Priority 1 + 2
 * Tests parseMcpToolName() and tarBeforeToolCallHandler().
 *
 * Run: pnpm vitest run --config vitest.continuum.config.ts
 */

import { describe, expect, it } from "vitest";
import { parseMcpToolName, tarBeforeToolCallHandler } from "./tar-hook.js";

// ---------------------------------------------------------------------------
// Minimal mock for PluginHookToolContext
// ---------------------------------------------------------------------------

function makeCtx(agentId: string): Parameters<typeof tarBeforeToolCallHandler>[1] {
  return {
    agentId,
    sessionKey: "session-test",
    sessionId: "trace-test",
    runId: "task-test",
    toolName: "",
    toolCallId: undefined,
  };
}

// ---------------------------------------------------------------------------
// parseMcpToolName unit tests
// ---------------------------------------------------------------------------

describe("parseMcpToolName", () => {
  it("parses a well-formed mcp__ tool name", () => {
    const result = parseMcpToolName("mcp__obsidian-vault__read_file");
    expect(result.isMcp).toBe(true);
    if (result.isMcp) {
      expect(result.serverName).toBe("obsidian-vault");
      expect(result.operationName).toBe("read_file");
    }
  });

  it("parses read_text_file correctly", () => {
    const result = parseMcpToolName("mcp__obsidian-vault__read_text_file");
    expect(result.isMcp).toBe(true);
    if (result.isMcp) {
      expect(result.serverName).toBe("obsidian-vault");
      expect(result.operationName).toBe("read_text_file");
    }
  });

  it("parses read_multiple_files correctly", () => {
    const result = parseMcpToolName("mcp__obsidian-vault__read_multiple_files");
    expect(result.isMcp).toBe(true);
    if (result.isMcp) {
      expect(result.serverName).toBe("obsidian-vault");
      expect(result.operationName).toBe("read_multiple_files");
    }
  });

  it("returns isMcp: false for a native tool", () => {
    const result = parseMcpToolName("memory_search");
    expect(result.isMcp).toBe(false);
  });

  it("returns isMcp: false for a tool with mcp__ prefix but no double separator", () => {
    const result = parseMcpToolName("mcp__obsidian-vault");
    expect(result.isMcp).toBe(false);
  });

  it("returns isMcp: false for an empty string", () => {
    const result = parseMcpToolName("");
    expect(result.isMcp).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// tarBeforeToolCallHandler — Work Order 2 acceptance tests
// ---------------------------------------------------------------------------

describe("tarBeforeToolCallHandler", () => {
  /**
   * Non-MCP tool: must pass through with no result
   */
  it("passes through non-MCP tools without blocking", async () => {
    const result = await tarBeforeToolCallHandler(
      { toolName: "memory_search", params: {} },
      makeCtx("crucible"),
    );
    expect(result).toBeUndefined();
  });

  /**
   * Authorized agent (crucible) requests TAR-001 via hook
   * Expected: no block, passes through
   */
  it("allows authorized agent to call obsidian-vault read_file", async () => {
    const result = await tarBeforeToolCallHandler(
      { toolName: "mcp__obsidian-vault__read_file", params: {} },
      makeCtx("crucible"),
    );
    expect(result).toBeUndefined();
  });

  /**
   * Authorized agent requests read_text_file (TAR-001 alias)
   * Expected: no block
   */
  it("allows authorized agent to call obsidian-vault read_text_file alias", async () => {
    const result = await tarBeforeToolCallHandler(
      { toolName: "mcp__obsidian-vault__read_text_file", params: {} },
      makeCtx("locus"),
    );
    expect(result).toBeUndefined();
  });

  /**
   * Unauthorized agent (vault) requests TAR-001
   * Expected: blocked with blockReason containing denial info
   */
  it("blocks vault from calling obsidian-vault read_file", async () => {
    const result = await tarBeforeToolCallHandler(
      { toolName: "mcp__obsidian-vault__read_file", params: {} },
      makeCtx("vault"),
    );
    expect(result).toBeDefined();
    expect(result?.block).toBe(true);
    expect(result?.blockReason).toContain("unauthorized");
    expect(result?.blockReason).toContain("vault");
  });

  /**
   * Signal requests TAR-002 (not in approved_agent_ids)
   * Expected: blocked
   */
  it("blocks signal from calling obsidian-vault read_multiple_files", async () => {
    const result = await tarBeforeToolCallHandler(
      { toolName: "mcp__obsidian-vault__read_multiple_files", params: {} },
      makeCtx("signal"),
    );
    expect(result).toBeDefined();
    expect(result?.block).toBe(true);
    expect(result?.blockReason).toContain("unauthorized");
  });

  /**
   * Unknown MCP operation (no TAR match)
   * Expected: blocked with capability_resolution_failed in reason
   */
  it("blocks unknown MCP operation with capability_resolution_failed", async () => {
    const result = await tarBeforeToolCallHandler(
      { toolName: "mcp__obsidian-vault__delete_file", params: {} },
      makeCtx("foundry"),
    );
    expect(result).toBeDefined();
    expect(result?.block).toBe(true);
    expect(result?.blockReason).toContain("capability_resolution_failed");
  });

  /**
   * Authorized agent (locus) requests TAR-002 via hook
   * Expected: passes through
   */
  it("allows locus to call obsidian-vault read_multiple_files", async () => {
    const result = await tarBeforeToolCallHandler(
      { toolName: "mcp__obsidian-vault__read_multiple_files", params: {} },
      makeCtx("locus"),
    );
    expect(result).toBeUndefined();
  });

  /**
   * MCP tool from an unrecognized server
   * Expected: blocked with capability_resolution_failed
   */
  it("blocks tools from unregistered MCP servers", async () => {
    const result = await tarBeforeToolCallHandler(
      { toolName: "mcp__unknown-server__read_file", params: {} },
      makeCtx("the-bridge"),
    );
    expect(result).toBeDefined();
    expect(result?.block).toBe(true);
    expect(result?.blockReason).toContain("capability_resolution_failed");
  });

  /**
   * agentId fallback: ctx with no agentId treats it as "unknown"
   * Should still block properly when the tool is unregistered
   */
  it("handles missing agentId gracefully", async () => {
    const ctx = { ...makeCtx("foundry"), agentId: undefined };
    const result = await tarBeforeToolCallHandler(
      { toolName: "mcp__obsidian-vault__read_file", params: {} },
      ctx,
    );
    // "unknown" is not in approved_agent_ids → blocked
    expect(result?.block).toBe(true);
  });
});
