/**
 * continuum/agents/crucible/cross-session-memory-store.test.ts
 *
 * Focused tests for CrossSessionMemoryStore.
 */

import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CrossSessionMemoryRecord, CrossSessionMemoryStore } from "./cross-session-memory-store.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempStorePath(): string {
  const dir = join(tmpdir(), `cru-mem-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return join(dir, "cross-session-memory.jsonl");
}

function makeRecord(overrides: Partial<CrossSessionMemoryRecord> = {}): CrossSessionMemoryRecord {
  return {
    memory_commit_id: "mc-test-001",
    reflection_candidate_id: "rc-test-001",
    session_id: "test-session",
    commit_timestamp: "2026-03-21T00:00:00.000Z",
    adjudication_outcome: "approved",
    adjudication_rationale: "Test rationale.",
    key_insight: "Test insight.",
    learner_evidence_references: [{ source: "test", anchor: "S1", excerpt: "excerpt" }],
    source_agent: "Crucible",
    commit_status: "approved_written",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CrossSessionMemoryStore", () => {
  let storePath: string;
  let store: CrossSessionMemoryStore;

  beforeEach(() => {
    storePath = makeTempStorePath();
    store = new CrossSessionMemoryStore(storePath);
  });

  afterEach(() => {
    const dir = join(storePath, "..");
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("loadAll returns empty array when file does not exist", () => {
    expect(store.loadAll()).toEqual([]);
  });

  it("writes an approved record and loadAll returns it", () => {
    const record = makeRecord();
    const result = store.write(record);
    expect(result.written).toBe(true);

    const loaded = store.loadAll();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].reflection_candidate_id).toBe("rc-test-001");
  });

  it("rejects a non-approved record", () => {
    const record = makeRecord({ adjudication_outcome: "rejected" as "approved" });
    const result = store.write(record);
    expect(result.written).toBe(false);
    if (!result.written) {
      expect(result.reason).toBe("not_approved");
    }
    expect(store.loadAll()).toHaveLength(0);
  });

  it("idempotent: duplicate reflection_candidate_id is not written twice", () => {
    const record = makeRecord();
    const r1 = store.write(record);
    const r2 = store.write(record);
    expect(r1.written).toBe(true);
    expect(r2.written).toBe(false);
    if (!r2.written) {
      expect(r2.reason).toBe("duplicate");
    }
    expect(store.loadAll()).toHaveLength(1);
  });

  it("appends multiple distinct records", () => {
    store.write(makeRecord({ reflection_candidate_id: "rc-001", memory_commit_id: "mc-001" }));
    store.write(makeRecord({ reflection_candidate_id: "rc-002", memory_commit_id: "mc-002" }));
    expect(store.loadAll()).toHaveLength(2);
  });

  it("store file is valid JSONL — each line independently parseable", () => {
    store.write(makeRecord({ reflection_candidate_id: "rc-a", memory_commit_id: "mc-a" }));
    store.write(makeRecord({ reflection_candidate_id: "rc-b", memory_commit_id: "mc-b" }));
    const raw = readFileSync(storePath, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim());
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it("creates the store directory if it does not exist", () => {
    const nestedPath = join(tmpdir(), `cru-mem-nested-${Date.now()}`, "sub", "store.jsonl");
    const nestedStore = new CrossSessionMemoryStore(nestedPath);
    nestedStore.write(makeRecord());
    expect(existsSync(nestedPath)).toBe(true);
    rmSync(join(tmpdir(), nestedPath.split("/").at(-3)!), { recursive: true, force: true });
  });
});
