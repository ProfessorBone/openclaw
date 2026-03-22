/**
 * continuum/agents/vault/thesis-store.ts
 *
 * Governed append-only JSONL store for Vault paper portfolio thesis records.
 *
 * Storage path: ~/.openclaw/agents/vault/paper-portfolio/theses.jsonl
 *
 * Rules:
 *   - Append-only. Original records are never overwritten.
 *   - Lifecycle updates (updateThesisStatus, closeThesis) append new records
 *     with the same thesis_id and incremented record_version.
 *   - createThesis is idempotent on thesis_id.
 *   - P1 validation and asset universe validation are enforced at create time.
 *   - Closure state must be one of the three valid terminal states from Bridge config.
 *
 * Governed by: Vault SOUL.md Hard Constraints 1–10, ADR-039
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_CONFIG_PATH, VaultConfig, VaultConfigReader } from "./vault-config-reader.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThesisRecord = {
  thesis_id: string;
  created_at: string;
  capital_domain: string;
  mode: string;
  analyst_engine: string;
  upstream_engines: string[];
  strategy_bucket: string;
  asset_symbol: string;
  asset_type: string;
  record_version: number;

  thesis_statement: string;
  directional_view: "long" | "short" | "neutral";
  time_horizon: string;
  supporting_evidence: string;
  counterevidence: string;
  invalidation_condition: string;
  confidence_level: number;
  uncertainty_statement: string;

  source_list: string[];
  bridge_policy_version: string;
  p1_gate_status: "pass" | "fail";
  segregation_check_status: "pass" | "fail";
  risk_flag_status: "none" | "flagged";
  approval_status: "pending" | "approved" | "rejected";

  paper_entry_date: string;
  paper_entry_price: number;
  target_condition: string;
  stop_or_exit_condition: string;
  planned_review_interval: string;
  max_allowed_notional: number;
  simulated_position_size: number;

  status: string;
  last_review_at: string | null;
  closure_date: string | null;
  closure_state: string | null;
  closure_reason: string | null;

  outcome_summary: string | null;
  thesis_quality_assessment: string | null;
  evidence_quality_assessment: string | null;
  contradiction_handling_assessment: string | null;
  discipline_assessment: string | null;
  calibration_result: string | null;
  evaluator_notes: string | null;

  // Present on update/closure records
  updated_at?: string;
};

export type P1ValidationResult = { valid: true } | { valid: false; missing: string[] };

export type SizingValidationResult =
  | { compliant: true }
  | { compliant: false; violations: string[] };

export type CreateThesisResult =
  | { created: true; thesis: ThesisRecord }
  | { created: false; reason: "duplicate" }
  | { created: false; reason: "p1_validation_failed"; missing: string[] }
  | { created: false; reason: "asset_not_allowed"; violation: string }
  | { created: false; reason: "asset_class_excluded"; violation: string };

export type CloseThesisResult =
  | { closed: true; record: ThesisRecord }
  | { closed: false; reason: "not_found" }
  | { closed: false; reason: "invalid_closure_state"; state: string };

// ---------------------------------------------------------------------------
// Default store path
// ---------------------------------------------------------------------------

export const DEFAULT_STORE_PATH = join(
  homedir(),
  ".openclaw",
  "agents",
  "vault",
  "paper-portfolio",
  "theses.jsonl",
);

// ---------------------------------------------------------------------------
// ThesisStore
// ---------------------------------------------------------------------------

export class ThesisStore {
  private readonly storePath: string;
  private readonly configReader: VaultConfigReader;

  constructor(storePath: string = DEFAULT_STORE_PATH, configPath: string = DEFAULT_CONFIG_PATH) {
    this.storePath = storePath;
    this.configReader = new VaultConfigReader(configPath);
  }

  // -------------------------------------------------------------------------
  // Internal: load all raw records from file
  // -------------------------------------------------------------------------

  private loadAllRecords(): ThesisRecord[] {
    if (!existsSync(this.storePath)) {
      return [];
    }
    const raw = readFileSync(this.storePath, "utf8");
    const records: ThesisRecord[] = [];
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t) {
        continue;
      }
      try {
        records.push(JSON.parse(t) as ThesisRecord);
      } catch {
        // skip malformed lines
      }
    }
    return records;
  }

  private append(record: ThesisRecord): void {
    const dir = dirname(this.storePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    appendFileSync(this.storePath, JSON.stringify(record) + "\n", "utf8");
  }

  // -------------------------------------------------------------------------
  // Internal: get latest record for a thesis_id
  // -------------------------------------------------------------------------

  private latestRecord(thesisId: string, records: ThesisRecord[]): ThesisRecord | null {
    const matching = records.filter((r) => r.thesis_id === thesisId);
    if (matching.length === 0) {
      return null;
    }
    return matching.reduce((a, b) => (a.record_version >= b.record_version ? a : b));
  }

  // -------------------------------------------------------------------------
  // validateP1
  // -------------------------------------------------------------------------

  validateP1(thesis: Partial<ThesisRecord>): P1ValidationResult {
    const required = this.configReader.getIQGRequiredFields();
    const missing: string[] = [];
    for (const field of required) {
      const val = (thesis as Record<string, unknown>)[field];
      if (
        val === null ||
        val === undefined ||
        val === "" ||
        (Array.isArray(val) && val.length === 0)
      ) {
        missing.push(field);
      }
    }
    return missing.length === 0 ? { valid: true } : { valid: false, missing };
  }

  // -------------------------------------------------------------------------
  // validateSizingCompliance
  // -------------------------------------------------------------------------

  validateSizingCompliance(
    thesis: Pick<ThesisRecord, "simulated_position_size" | "paper_entry_price" | "thesis_id">,
    config: VaultConfig,
  ): SizingValidationResult {
    const rules = config.sizing_rules;
    const violations: string[] = [];

    const notional = thesis.simulated_position_size * thesis.paper_entry_price;
    if (notional > rules.max_notional_per_position) {
      violations.push(
        `Notional ${notional} exceeds max_notional_per_position ${rules.max_notional_per_position}`,
      );
    }

    const active = this.getActiveTheses();
    if (active.length >= rules.max_total_concurrent_positions) {
      violations.push(
        `Active thesis count ${active.length} meets or exceeds max_total_concurrent_positions ${rules.max_total_concurrent_positions}`,
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const allRecords = this.loadAllRecords();
    const todayNew = allRecords.filter(
      (r) => r.record_version === 1 && r.created_at.startsWith(today),
    ).length;
    if (todayNew >= rules.max_daily_new_thesis_openings) {
      violations.push(
        `Daily new thesis count ${todayNew} meets or exceeds max_daily_new_thesis_openings ${rules.max_daily_new_thesis_openings}`,
      );
    }

    return violations.length === 0 ? { compliant: true } : { compliant: false, violations };
  }

  // -------------------------------------------------------------------------
  // createThesis
  // -------------------------------------------------------------------------

  createThesis(thesis: ThesisRecord): CreateThesisResult {
    // Idempotency check
    const records = this.loadAllRecords();
    if (records.some((r) => r.thesis_id === thesis.thesis_id)) {
      return { created: false, reason: "duplicate" };
    }

    // P1 validation
    const p1 = this.validateP1(thesis);
    if (!p1.valid) {
      return { created: false, reason: "p1_validation_failed", missing: p1.missing };
    }

    // Asset universe check
    if (!this.configReader.isAssetAllowed(thesis.asset_symbol)) {
      return {
        created: false,
        reason: "asset_not_allowed",
        violation: `Asset symbol "${thesis.asset_symbol}" is not in any allowed category.`,
      };
    }

    // Asset class exclusion check
    if (thesis.asset_type && this.configReader.isAssetClassExcluded(thesis.asset_type)) {
      return {
        created: false,
        reason: "asset_class_excluded",
        violation: `Asset class "${thesis.asset_type}" is in the excluded list.`,
      };
    }

    const record: ThesisRecord = { ...thesis, record_version: 1, p1_gate_status: "pass" };
    this.append(record);
    return { created: true, thesis: record };
  }

  // -------------------------------------------------------------------------
  // updateThesisStatus
  // -------------------------------------------------------------------------

  updateThesisStatus(
    thesisId: string,
    updates: Partial<ThesisRecord>,
  ): { updated: true; record: ThesisRecord } | { updated: false; reason: "not_found" } {
    const records = this.loadAllRecords();
    const latest = this.latestRecord(thesisId, records);
    if (!latest) {
      return { updated: false, reason: "not_found" };
    }

    const updated: ThesisRecord = {
      ...latest,
      ...updates,
      thesis_id: thesisId,
      record_version: latest.record_version + 1,
      updated_at: new Date().toISOString(),
    };
    this.append(updated);
    return { updated: true, record: updated };
  }

  // -------------------------------------------------------------------------
  // closeThesis
  // -------------------------------------------------------------------------

  closeThesis(thesisId: string, closureState: string, closureReason: string): CloseThesisResult {
    const validStates = this.configReader.getCalibrationConfig().valid_closure_states;
    if (!validStates.includes(closureState)) {
      return { closed: false, reason: "invalid_closure_state", state: closureState };
    }

    const records = this.loadAllRecords();
    const latest = this.latestRecord(thesisId, records);
    if (!latest) {
      return { closed: false, reason: "not_found" };
    }

    const closed: ThesisRecord = {
      ...latest,
      record_version: latest.record_version + 1,
      status: "closed",
      closure_date: new Date().toISOString(),
      closure_state: closureState,
      closure_reason: closureReason,
      updated_at: new Date().toISOString(),
    };
    this.append(closed);
    return { closed: true, record: closed };
  }

  // -------------------------------------------------------------------------
  // Query methods
  // -------------------------------------------------------------------------

  getThesisById(thesisId: string): ThesisRecord | null {
    return this.latestRecord(thesisId, this.loadAllRecords());
  }

  getActiveTheses(): ThesisRecord[] {
    const records = this.loadAllRecords();
    const allIds = [...new Set(records.map((r) => r.thesis_id))];
    return allIds.map((id) => this.latestRecord(id, records)!).filter((r) => r.status === "active");
  }

  getClosedTheses(): ThesisRecord[] {
    const records = this.loadAllRecords();
    const allIds = [...new Set(records.map((r) => r.thesis_id))];
    return allIds
      .map((id) => this.latestRecord(id, records)!)
      .filter((r) => r.closure_state !== null);
  }

  getThesesByAsset(symbol: string): ThesisRecord[] {
    const records = this.loadAllRecords();
    const allIds = [...new Set(records.map((r) => r.thesis_id))];
    return allIds
      .map((id) => this.latestRecord(id, records)!)
      .filter((r) => r.asset_symbol === symbol);
  }
}

// ---------------------------------------------------------------------------
// Default instance
// ---------------------------------------------------------------------------

export const thesisStore = new ThesisStore();
