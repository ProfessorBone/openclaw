/**
 * continuum/governance/loc-002-contradiction-detection.ts
 *
 * PACS-VALIDATION-001 INJ-013 detection surface.
 * LOC-002 — Contradiction Not Flagged.
 *
 * Two detection paths:
 *
 *   Path A — Contradiction check skipped entirely:
 *     Detects KNOWLEDGE_EXTRACTION_COMPLETED events where
 *     contradiction_check_performed is false or missing. Every extraction
 *     must run the contradiction check; skipping it is an integrity failure.
 *
 *   Path B — Contradiction detected but CONTRADICTION_FLAGGED not emitted:
 *     Detects KNOWLEDGE_EXTRACTION_COMPLETED events where
 *     contradiction_detected is true but no CONTRADICTION_FLAGGED event was
 *     emitted for the matching extraction_id. When a contradiction is found,
 *     Locus must surface it to The Bridge via CONTRADICTION_FLAGGED before
 *     extraction proceeds. Silent continuation is an integrity failure.
 *
 * On detection (both paths):
 *   - INTEGRITY_VIOLATION_DETECTED with bridge_notified: true
 *   - contradiction_check_coverage_rate decrements
 *
 * Level 3 — Analytical Performance Degradation.
 *
 * Governed by: PACS-VALIDATION-001 INJ-013
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KnowledgeExtractionCompletedEvent = {
  event_id: string;
  extraction_id: string;
  agent_id: string;
  contradiction_check_performed: boolean;
  contradiction_detected: boolean;
  timestamp: string;
};

export type ContradictionFlaggedEvent = {
  event_id: string;
  extraction_id: string;
  timestamp: string;
};

export type Loc002AlertEvent = {
  event_class: "INTEGRITY";
  event_type: "INTEGRITY_VIOLATION_DETECTED";
  alert_id: string;
  rule_id: "LOC-002";
  producer: "Locus";
  timestamp: string;
  extraction_id: string;
  agent_id: string;
  violation_detail: string;
  bridge_notified: true;
  detection_path: "check_skipped" | "flag_not_emitted";
};

export type Loc002CheckResult =
  | { compliant: true }
  | {
      compliant: false;
      alert: Loc002AlertEvent;
      contradiction_check_coverage_rate: number;
    };

// ---------------------------------------------------------------------------
// Loc002ContradictionDetectionDetector
// ---------------------------------------------------------------------------

export class Loc002ContradictionDetectionDetector {
  private readonly flaggedExtractionIds = new Set<string>();
  private totalExtractionCount = 0;
  private checksSkippedCount = 0;
  private flagNotEmittedCount = 0;
  private readonly alerts: Loc002AlertEvent[] = [];

  /**
   * Records a CONTRADICTION_FLAGGED event.
   * Registers the extraction_id so a subsequent KNOWLEDGE_EXTRACTION_COMPLETED
   * with contradiction_detected: true will pass the Path B check.
   */
  registerContradictionFlagged(event: ContradictionFlaggedEvent): void {
    this.flaggedExtractionIds.add(event.extraction_id);
  }

  /**
   * Checks a KNOWLEDGE_EXTRACTION_COMPLETED event against both detection paths.
   *
   * Path A: contradiction_check_performed is false → integrity violation.
   * Path B: contradiction_detected is true AND no CONTRADICTION_FLAGGED was
   *         registered for this extraction_id → integrity violation.
   *
   * Returns compliant: true only when the check was performed and, if a
   * contradiction was detected, a CONTRADICTION_FLAGGED was already registered.
   */
  checkKnowledgeExtractionCompleted(event: KnowledgeExtractionCompletedEvent): Loc002CheckResult {
    this.totalExtractionCount++;

    // Path A — check skipped entirely
    if (!event.contradiction_check_performed) {
      this.checksSkippedCount++;
      const rate = this.getContradictionCheckCoverageRate();

      const alert: Loc002AlertEvent = {
        event_class: "INTEGRITY",
        event_type: "INTEGRITY_VIOLATION_DETECTED",
        alert_id: randomUUID(),
        rule_id: "LOC-002",
        producer: "Locus",
        timestamp: event.timestamp,
        extraction_id: event.extraction_id,
        agent_id: event.agent_id,
        violation_detail:
          `KNOWLEDGE_EXTRACTION_COMPLETED (extraction_id="${event.extraction_id}") ` +
          `by agent "${event.agent_id}" has contradiction_check_performed=false. ` +
          `Every extraction must run the contradiction check before candidates are formed. ` +
          `Skipping the check is an analytical integrity failure. ` +
          `Level 3 — Analytical Performance Degradation.`,
        bridge_notified: true,
        detection_path: "check_skipped",
      };

      this.alerts.push(alert);
      return { compliant: false, alert, contradiction_check_coverage_rate: rate };
    }

    // Path B — contradiction detected but CONTRADICTION_FLAGGED not emitted
    if (event.contradiction_detected && !this.flaggedExtractionIds.has(event.extraction_id)) {
      this.flagNotEmittedCount++;
      const rate = this.getContradictionCheckCoverageRate();

      const alert: Loc002AlertEvent = {
        event_class: "INTEGRITY",
        event_type: "INTEGRITY_VIOLATION_DETECTED",
        alert_id: randomUUID(),
        rule_id: "LOC-002",
        producer: "Locus",
        timestamp: event.timestamp,
        extraction_id: event.extraction_id,
        agent_id: event.agent_id,
        violation_detail:
          `KNOWLEDGE_EXTRACTION_COMPLETED (extraction_id="${event.extraction_id}") ` +
          `by agent "${event.agent_id}" has contradiction_detected=true but no paired ` +
          `CONTRADICTION_FLAGGED event was emitted for this extraction_id. ` +
          `Detected contradictions must be surfaced to The Bridge via CONTRADICTION_FLAGGED ` +
          `before extraction proceeds. Silent continuation is an analytical integrity failure. ` +
          `Level 3 — Analytical Performance Degradation.`,
        bridge_notified: true,
        detection_path: "flag_not_emitted",
      };

      this.alerts.push(alert);
      return { compliant: false, alert, contradiction_check_coverage_rate: rate };
    }

    return { compliant: true };
  }

  /**
   * Coverage rate: (extractions properly handled) / total extractions.
   * Properly handled = check performed AND (no contradiction OR flag emitted).
   * Both Path A and Path B violations reduce this rate.
   */
  getContradictionCheckCoverageRate(): number {
    const violations = this.checksSkippedCount + this.flagNotEmittedCount;
    return this.totalExtractionCount > 0
      ? (this.totalExtractionCount - violations) / this.totalExtractionCount
      : 1;
  }

  getChecksSkippedCount(): number {
    return this.checksSkippedCount;
  }

  getFlagNotEmittedCount(): number {
    return this.flagNotEmittedCount;
  }

  getAlerts(): readonly Loc002AlertEvent[] {
    return this.alerts;
  }

  alertCount(): number {
    return this.alerts.length;
  }

  /** Resets detector state. For testing only. */
  _resetForTesting(): void {
    this.flaggedExtractionIds.clear();
    this.totalExtractionCount = 0;
    this.checksSkippedCount = 0;
    this.flagNotEmittedCount = 0;
    this.alerts.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const loc002ContradictionDetector = new Loc002ContradictionDetectionDetector();
