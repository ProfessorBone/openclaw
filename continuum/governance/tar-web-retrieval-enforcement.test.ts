/**
 * continuum/governance/tar-web-retrieval-enforcement.test.ts
 *
 * TAR-009: Signal web retrieval enforcement tests.
 *
 * Acceptance scenarios:
 * 1. Signal calls web_search → allowed
 * 2. Signal calls web_fetch → allowed
 * 3. Non-signal agent (foundry) calls web_search → denied + INTEGRITY event
 * 4. Non-TAR-009 tool → passes through without blocking
 *
 * Run: pnpm vitest run --config vitest.continuum.config.ts
 */

import { describe, expect, it } from "vitest";
import { enforceBeforeToolCall } from "./tar-enforcement.js";
import { tarSignalWebRetrievalBeforeToolCallHandler } from "./tar-web-retrieval-enforcement.js";

// ---------------------------------------------------------------------------
// Minimal mock for PluginHookToolContext
// ---------------------------------------------------------------------------

function makeCtx(
  agentId: string,
): Parameters<typeof tarSignalWebRetrievalBeforeToolCallHandler>[1] {
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
// TAR-009 registry tests (via enforceBeforeToolCall)
// ---------------------------------------------------------------------------

describe("TAR-009 registry — enforceBeforeToolCall", () => {
  it("resolves TAR-009 and allows signal to call web_search", () => {
    const result = enforceBeforeToolCall({
      serverName: "web",
      operationName: "web_search",
      agentId: "signal",
      taskId: "task-001",
      traceId: "trace-abc",
    });
    expect(result.allowed).toBe(true);
    expect(result.record.capability_id).toBe("TAR-009");
    expect(result.record.outcome).toBe("executed");
    expect(result.integrityEvent).toBeUndefined();
  });

  it("resolves TAR-009 and allows signal to call web_fetch", () => {
    const result = enforceBeforeToolCall({
      serverName: "web",
      operationName: "web_fetch",
      agentId: "signal",
      taskId: "task-001",
      traceId: "trace-abc",
    });
    expect(result.allowed).toBe(true);
    expect(result.record.capability_id).toBe("TAR-009");
    expect(result.record.outcome).toBe("executed");
  });

  it("denies foundry from web_search — INTEGRITY event emitted", () => {
    const result = enforceBeforeToolCall({
      serverName: "web",
      operationName: "web_search",
      agentId: "foundry",
      taskId: "task-001",
      traceId: "trace-abc",
    });
    expect(result.allowed).toBe(false);
    expect(result.record.capability_id).toBe("TAR-009");
    expect(result.record.denial_reason).toBe("unauthorized_agent");
    expect(result.integrityEvent).toBeDefined();
    expect(result.integrityEvent).toContain("unauthorized_agent");
    expect(result.integrityEvent).toContain("foundry");
  });

  it("denies the-bridge from web_fetch", () => {
    const result = enforceBeforeToolCall({
      serverName: "web",
      operationName: "web_fetch",
      agentId: "the-bridge",
      taskId: "task-001",
      traceId: "trace-abc",
    });
    expect(result.allowed).toBe(false);
    expect(result.record.denial_reason).toBe("unauthorized_agent");
    expect(result.integrityEvent).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// tarSignalWebRetrievalBeforeToolCallHandler hook tests
// ---------------------------------------------------------------------------

describe("tarSignalWebRetrievalBeforeToolCallHandler — TAR-009 hook", () => {
  /**
   * Allowed: Signal calls web_search
   */
  it("allows signal to call web_search", async () => {
    const result = await tarSignalWebRetrievalBeforeToolCallHandler(
      { toolName: "web_search", params: {} },
      makeCtx("signal"),
    );
    expect(result).toBeUndefined();
  });

  /**
   * Denied: non-signal agent (foundry) calls web_search
   */
  it("denies foundry from calling web_search", async () => {
    const result = await tarSignalWebRetrievalBeforeToolCallHandler(
      { toolName: "web_search", params: {} },
      makeCtx("foundry"),
    );
    expect(result?.block).toBe(true);
    expect(result?.blockReason).toContain("unauthorized");
    expect(result?.blockReason).toContain("foundry");
    expect(result?.blockReason).toContain("TAR-009");
  });

  /**
   * Pass-through: non-TAR-009 tool is not intercepted
   */
  it("passes through non-web tools without blocking", async () => {
    const result = await tarSignalWebRetrievalBeforeToolCallHandler(
      { toolName: "memory_search", params: {} },
      makeCtx("signal"),
    );
    expect(result).toBeUndefined();
  });
});
