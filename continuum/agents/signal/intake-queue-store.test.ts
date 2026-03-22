/**
 * continuum/agents/signal/intake-queue-store.test.ts
 *
 * Focused tests for IntakeQueueStore.
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IntakeQueueBrief, IntakeQueueStore } from "./intake-queue-store.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempStorePath(): string {
  const dir = join(tmpdir(), `signal-queue-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return join(dir, "briefs.jsonl");
}

function makeBrief(overrides: Partial<IntakeQueueBrief> = {}): IntakeQueueBrief {
  return {
    brief_id: "brief-test-001",
    cycle_id: "cycle-test-001",
    deposit_timestamp: "2026-03-22T07:00:00.000Z",
    domain: "agentic-systems-architecture",
    source_url: "https://arxiv.org/abs/test",
    source_name: "arxiv.org",
    retrieval_timestamp: "2026-03-22T07:00:00.000Z",
    relevance_score: 0.82,
    classification_result: "cleared",
    brief_format_version: "1.0.0",
    structured_summary: "Test summary.",
    provenance: {
      source_identification: "arxiv",
      retrieval_timestamp: "2026-03-22T07:00:00.000Z",
      domain_classification: "agentic-systems-architecture",
      relevance_mapping: "direct",
    },
    epistemic_status: "unvalidated",
    config_version: "1.0.0",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("IntakeQueueStore", () => {
  let storePath: string;
  let store: IntakeQueueStore;

  beforeEach(() => {
    storePath = makeTempStorePath();
    store = new IntakeQueueStore(storePath);
  });

  afterEach(() => {
    const dir = join(storePath, "..");
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("getAllBriefs returns empty array when file does not exist", () => {
    expect(store.getAllBriefs()).toEqual([]);
  });

  it("depositBrief writes a record and getAllBriefs returns it", () => {
    const brief = makeBrief();
    const result = store.depositBrief(brief);
    expect(result.deposited).toBe(true);
    const all = store.getAllBriefs();
    expect(all).toHaveLength(1);
    expect(all[0].brief_id).toBe("brief-test-001");
  });

  it("duplicate brief_id is idempotent — no second write", () => {
    const brief = makeBrief();
    const r1 = store.depositBrief(brief);
    const r2 = store.depositBrief(brief);
    expect(r1.deposited).toBe(true);
    expect(r2.deposited).toBe(false);
    if (!r2.deposited) {
      expect(r2.reason).toBe("duplicate");
      expect(r2.existing.brief_id).toBe("brief-test-001");
    }
    expect(store.getAllBriefs()).toHaveLength(1);
  });

  it("getBriefsByCycleId returns only matching briefs", () => {
    store.depositBrief(makeBrief({ brief_id: "b1", cycle_id: "cycle-A" }));
    store.depositBrief(makeBrief({ brief_id: "b2", cycle_id: "cycle-B" }));
    store.depositBrief(makeBrief({ brief_id: "b3", cycle_id: "cycle-A" }));
    expect(store.getBriefsByCycleId("cycle-A")).toHaveLength(2);
    expect(store.getBriefsByCycleId("cycle-B")).toHaveLength(1);
    expect(store.getBriefsByCycleId("cycle-X")).toHaveLength(0);
  });

  it("getAllBriefs returns all records across cycles", () => {
    store.depositBrief(makeBrief({ brief_id: "b1", cycle_id: "c1" }));
    store.depositBrief(makeBrief({ brief_id: "b2", cycle_id: "c2" }));
    expect(store.getAllBriefs()).toHaveLength(2);
  });

  it("getBriefById returns null for nonexistent ID", () => {
    expect(store.getBriefById("nonexistent")).toBeNull();
  });

  it("getBriefById returns the correct brief", () => {
    store.depositBrief(makeBrief({ brief_id: "find-me" }));
    const found = store.getBriefById("find-me");
    expect(found).not.toBeNull();
    expect(found!.brief_id).toBe("find-me");
  });

  it("creates the store directory if it does not exist", () => {
    const nestedPath = join(
      tmpdir(),
      `signal-queue-nested-${Date.now()}`,
      "intake-queue",
      "briefs.jsonl",
    );
    const nestedStore = new IntakeQueueStore(nestedPath);
    nestedStore.depositBrief(makeBrief());
    expect(existsSync(nestedPath)).toBe(true);
    rmSync(join(tmpdir(), nestedPath.split("/").at(-3)!), { recursive: true, force: true });
  });
});
