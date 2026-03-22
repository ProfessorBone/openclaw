/**
 * continuum/agents/signal/intake-queue-store.ts
 *
 * Governed append-only JSONL store for Signal's frontier intelligence intake queue.
 *
 * Storage path: ~/.openclaw/agents/signal/intake-queue/briefs.jsonl
 *
 * Rules:
 *   - Append-only. Never overwrites existing records.
 *   - Idempotent: a brief with the same brief_id is deposited at most once.
 *     Duplicate deposits return the existing record without writing.
 *   - Directory is created automatically on first write.
 *   - No external dependencies beyond Node built-ins.
 *
 * Governed by: Signal SOUL.md A4 (append-only deposit), ADR-038
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BriefProvenance = {
  source_identification: string;
  retrieval_timestamp: string;
  domain_classification: string;
  relevance_mapping: string;
};

export type IntakeQueueBrief = {
  brief_id: string;
  cycle_id: string;
  deposit_timestamp: string;
  domain: string;
  source_url: string;
  source_name: string;
  retrieval_timestamp: string;
  relevance_score: number;
  classification_result: string;
  brief_format_version: string;
  structured_summary: string;
  provenance: BriefProvenance;
  epistemic_status: string;
  config_version: string;
};

export type DepositResult =
  | { deposited: true; brief: IntakeQueueBrief }
  | { deposited: false; reason: "duplicate"; existing: IntakeQueueBrief };

// ---------------------------------------------------------------------------
// Default store path
// ---------------------------------------------------------------------------

export const DEFAULT_STORE_PATH = join(
  homedir(),
  ".openclaw",
  "agents",
  "signal",
  "intake-queue",
  "briefs.jsonl",
);

// ---------------------------------------------------------------------------
// IntakeQueueStore
// ---------------------------------------------------------------------------

export class IntakeQueueStore {
  private readonly storePath: string;

  constructor(storePath: string = DEFAULT_STORE_PATH) {
    this.storePath = storePath;
  }

  /**
   * Load all briefs from the store. Returns an empty array if the file does
   * not exist or contains no valid JSON lines.
   */
  getAllBriefs(): IntakeQueueBrief[] {
    if (!existsSync(this.storePath)) {
      return [];
    }
    const raw = readFileSync(this.storePath, "utf8");
    const briefs: IntakeQueueBrief[] = [];
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t) {
        continue;
      }
      try {
        briefs.push(JSON.parse(t) as IntakeQueueBrief);
      } catch {
        // Skip malformed lines
      }
    }
    return briefs;
  }

  /**
   * Retrieve a single brief by ID. Returns null if not found.
   */
  getBriefById(briefId: string): IntakeQueueBrief | null {
    return this.getAllBriefs().find((b) => b.brief_id === briefId) ?? null;
  }

  /**
   * Retrieve all briefs for a given cycle.
   */
  getBriefsByCycleId(cycleId: string): IntakeQueueBrief[] {
    return this.getAllBriefs().filter((b) => b.cycle_id === cycleId);
  }

  /**
   * Deposit a brief into the store.
   *
   * Returns { deposited: true } if the brief was appended.
   * Returns { deposited: false, reason: "duplicate", existing } if brief_id
   *   already exists in the store.
   */
  depositBrief(brief: IntakeQueueBrief): DepositResult {
    const existing = this.getBriefById(brief.brief_id);
    if (existing) {
      return { deposited: false, reason: "duplicate", existing };
    }

    const dir = dirname(this.storePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    appendFileSync(this.storePath, JSON.stringify(brief) + "\n", "utf8");
    return { deposited: true, brief };
  }
}

// ---------------------------------------------------------------------------
// Default instance
// ---------------------------------------------------------------------------

export const intakeQueueStore = new IntakeQueueStore();
