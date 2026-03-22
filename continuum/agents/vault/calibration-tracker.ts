/**
 * continuum/agents/vault/calibration-tracker.ts
 *
 * Governed append-only JSONL store for Vault paper portfolio calibration cycles.
 *
 * Storage path: ~/.openclaw/agents/vault/paper-portfolio/calibration.jsonl
 *
 * Rules:
 *   - Append-only. Records are never overwritten.
 *   - Idempotent on calibration_id.
 *   - cycle_status is computed from the nine boolean fields:
 *       all true → "clean", any false → "tainted" with reasons populated.
 *   - isRealCapitalEligible requires >= 4 clean cycles.
 *   - isRetirementEligible requires >= 1 clean cycle.
 *
 * Governed by: Vault SOUL.md Hard Constraint 9, PACS-VAULT-CAL-001, ADR-039
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CalibrationRecord = {
  calibration_id: string;
  thesis_id: string;
  cycle_number: number;
  closure_state: "closed-confirmed" | "closed-contradicted" | "closed-inconclusive";
  closure_date: string;
  evaluation_date: string;

  // Nine integrity flags — all must be true for a clean cycle
  p1_compliance: boolean;
  p2_evaluation_completed: boolean;
  p3_segregation_intact: boolean;
  p4_violations_zero: boolean;
  a6_alerts_clear: boolean;
  record_complete_and_auditable: boolean;
  no_unauthorized_asset_breach: boolean;
  no_undocumented_thesis_modification: boolean;
  no_output_bypassed_bridge: boolean;

  // Computed
  cycle_status: "clean" | "tainted";
  taint_reasons: string[];

  thesis_quality_assessment: string;
  evidence_quality_assessment: string;
  contradiction_handling_assessment: string;
  discipline_assessment: string;
  evaluator_notes: string;
};

// Input type before cycle_status is computed
export type CalibrationInput = Omit<CalibrationRecord, "cycle_status" | "taint_reasons">;

export type RecordResult =
  | { recorded: true; record: CalibrationRecord }
  | { recorded: false; reason: "duplicate" };

// ---------------------------------------------------------------------------
// Flag names for taint reason messages
// ---------------------------------------------------------------------------

const FLAG_NAMES: Array<keyof CalibrationInput> = [
  "p1_compliance",
  "p2_evaluation_completed",
  "p3_segregation_intact",
  "p4_violations_zero",
  "a6_alerts_clear",
  "record_complete_and_auditable",
  "no_unauthorized_asset_breach",
  "no_undocumented_thesis_modification",
  "no_output_bypassed_bridge",
];

// ---------------------------------------------------------------------------
// Default store path
// ---------------------------------------------------------------------------

export const DEFAULT_STORE_PATH = join(
  homedir(),
  ".openclaw",
  "agents",
  "vault",
  "paper-portfolio",
  "calibration.jsonl",
);

// ---------------------------------------------------------------------------
// CalibrationTracker
// ---------------------------------------------------------------------------

export class CalibrationTracker {
  private readonly storePath: string;

  constructor(storePath: string = DEFAULT_STORE_PATH) {
    this.storePath = storePath;
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private loadAll(): CalibrationRecord[] {
    if (!existsSync(this.storePath)) {
      return [];
    }
    const raw = readFileSync(this.storePath, "utf8");
    const records: CalibrationRecord[] = [];
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t) {
        continue;
      }
      try {
        records.push(JSON.parse(t) as CalibrationRecord);
      } catch {
        // skip malformed lines
      }
    }
    return records;
  }

  private append(record: CalibrationRecord): void {
    const dir = dirname(this.storePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    appendFileSync(this.storePath, JSON.stringify(record) + "\n", "utf8");
  }

  // -------------------------------------------------------------------------
  // Compute cycle_status and taint_reasons from input
  // -------------------------------------------------------------------------

  private computeStatus(
    input: CalibrationInput,
  ): Pick<CalibrationRecord, "cycle_status" | "taint_reasons"> {
    const taint_reasons: string[] = [];
    for (const flag of FLAG_NAMES) {
      if (!(input as unknown as Record<string, unknown>)[flag]) {
        taint_reasons.push(flag);
      }
    }
    return {
      cycle_status: taint_reasons.length === 0 ? "clean" : "tainted",
      taint_reasons,
    };
  }

  // -------------------------------------------------------------------------
  // recordCalibrationCycle
  // -------------------------------------------------------------------------

  recordCalibrationCycle(input: CalibrationInput): RecordResult {
    const existing = this.loadAll();
    if (existing.some((r) => r.calibration_id === input.calibration_id)) {
      return { recorded: false, reason: "duplicate" };
    }

    const { cycle_status, taint_reasons } = this.computeStatus(input);
    const record: CalibrationRecord = { ...input, cycle_status, taint_reasons };
    this.append(record);
    return { recorded: true, record };
  }

  // -------------------------------------------------------------------------
  // Query methods
  // -------------------------------------------------------------------------

  getAllCycles(): CalibrationRecord[] {
    return this.loadAll();
  }

  getCleanCycleCount(): number {
    return this.loadAll().filter((r) => r.cycle_status === "clean").length;
  }

  getTaintedCycles(): CalibrationRecord[] {
    return this.loadAll().filter((r) => r.cycle_status === "tainted");
  }

  getCycleByThesisId(thesisId: string): CalibrationRecord | null {
    return this.loadAll().find((r) => r.thesis_id === thesisId) ?? null;
  }

  isRealCapitalEligible(): boolean {
    return this.getCleanCycleCount() >= 4;
  }

  isRetirementEligible(): boolean {
    return this.getCleanCycleCount() >= 1;
  }
}

// ---------------------------------------------------------------------------
// Default instance
// ---------------------------------------------------------------------------

export const calibrationTracker = new CalibrationTracker();
