/**
 * continuum/agents/crucible/cross-session-memory-store.ts
 *
 * Governed append-only JSONL store for Crucible's cross-session memory.
 *
 * Storage path: ~/.openclaw/agents/crucible/memory/cross-session-memory.jsonl
 *
 * Rules:
 *   - Append-only. Never overwrites existing records.
 *   - Idempotent: a record with the same reflection_candidate_id is written
 *     at most once. Duplicate writes are silently skipped.
 *   - Only approved commits are accepted (adjudication_outcome === "approved").
 *   - No external dependencies beyond Node built-ins.
 *
 * Governed by: PACS-MEM-001 / ADR-037
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LearnerEvidenceReference = {
  source: string;
  anchor: string;
  excerpt: string;
};

export type CrossSessionMemoryRecord = {
  memory_commit_id: string;
  reflection_candidate_id: string;
  session_id: string;
  commit_timestamp: string;
  adjudication_outcome: "approved";
  adjudication_rationale: string;
  key_insight: string;
  learner_evidence_references: LearnerEvidenceReference[];
  source_agent: string;
  commit_status: "approved_written";
};

export type WriteResult =
  | { written: true; record: CrossSessionMemoryRecord }
  | { written: false; reason: "duplicate" | "not_approved" };

// ---------------------------------------------------------------------------
// Default store path
// ---------------------------------------------------------------------------

export const DEFAULT_STORE_PATH = join(
  homedir(),
  ".openclaw",
  "agents",
  "crucible",
  "memory",
  "cross-session-memory.jsonl",
);

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export class CrossSessionMemoryStore {
  private readonly storePath: string;

  constructor(storePath: string = DEFAULT_STORE_PATH) {
    this.storePath = storePath;
  }

  /**
   * Load all records from the store. Returns an empty array if the file does
   * not exist or contains no valid JSON lines.
   */
  loadAll(): CrossSessionMemoryRecord[] {
    if (!existsSync(this.storePath)) {
      return [];
    }
    const raw = readFileSync(this.storePath, "utf8");
    const records: CrossSessionMemoryRecord[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      try {
        records.push(JSON.parse(trimmed) as CrossSessionMemoryRecord);
      } catch {
        // Skip malformed lines silently — store integrity is maintained by
        // the append-only write path, not by re-parsing.
      }
    }
    return records;
  }

  /**
   * Write a single approved record to the store.
   *
   * Returns { written: true } if the record was appended.
   * Returns { written: false, reason: "duplicate" } if the
   *   reflection_candidate_id is already present.
   * Returns { written: false, reason: "not_approved" } if
   *   adjudication_outcome is not "approved".
   */
  write(record: CrossSessionMemoryRecord): WriteResult {
    if (record.adjudication_outcome !== "approved") {
      return { written: false, reason: "not_approved" };
    }

    // Idempotency check
    const existing = this.loadAll();
    if (existing.some((r) => r.reflection_candidate_id === record.reflection_candidate_id)) {
      return { written: false, reason: "duplicate" };
    }

    // Ensure directory exists
    const dir = dirname(this.storePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    appendFileSync(this.storePath, JSON.stringify(record) + "\n", "utf8");
    return { written: true, record };
  }
}

// ---------------------------------------------------------------------------
// Default instance
// ---------------------------------------------------------------------------

export const crossSessionMemoryStore = new CrossSessionMemoryStore();
