/**
 * continuum/governance/vlt-010-persistent-miscalibration.ts
 *
 * PACS-VALIDATION-001 INJ-015 detection surface.
 * VLT-010 — Persistent Miscalibration.
 *
 * Detects three or more consecutive CALIBRATION_AUDIT_EMITTED events for a
 * given P2 surface where calibration_score is below CALIBRATION_THRESHOLD.
 *
 * Trigger: consecutive count per surface, not elapsed time.
 * A passing event (score >= threshold) resets the consecutive counter for
 * that surface.
 *
 * On detection:
 *   - GOVERNANCE_ESCALATION_EMITTED with bridge_notified: true
 *   - persistent_miscalibration: true
 *   - calibration_review_triggered: true
 *
 * Level 3 — Analytical Performance Degradation.
 *
 * Governed by: PACS-VALIDATION-001 INJ-015
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CALIBRATION_THRESHOLD = 0.8;
export const MISCALIBRATION_CONSECUTIVE_LIMIT = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CalibrationAuditEmittedEvent = {
  event_id: string;
  surface_id: string;
  calibration_score: number;
  agent_id: string;
  timestamp: string;
};

export type Vlt010AlertEvent = {
  event_class: "GOVERNANCE";
  event_type: "GOVERNANCE_ESCALATION_EMITTED";
  alert_id: string;
  rule_id: "VLT-010";
  producer: "Vault";
  timestamp: string;
  surface_id: string;
  agent_id: string;
  consecutive_failures: number;
  calibration_threshold: number;
  violation_detail: string;
  bridge_notified: true;
  persistent_miscalibration: true;
  calibration_review_triggered: true;
};

export type Vlt010CheckResult =
  | { triggered: false }
  | { triggered: true; alert: Vlt010AlertEvent; consecutive_failures: number };

// ---------------------------------------------------------------------------
// Vlt010PersistentMiscalibrationDetector
// ---------------------------------------------------------------------------

export class Vlt010PersistentMiscalibrationDetector {
  private readonly consecutiveCounts = new Map<string, number>();
  private readonly alerts: Vlt010AlertEvent[] = [];

  /**
   * Checks a CALIBRATION_AUDIT_EMITTED event.
   * Resets the consecutive counter for the surface if score >= threshold.
   * Increments and checks the counter otherwise.
   * Returns triggered: true after the third consecutive below-threshold event.
   */
  checkCalibrationAudit(event: CalibrationAuditEmittedEvent): Vlt010CheckResult {
    if (event.calibration_score >= CALIBRATION_THRESHOLD) {
      this.consecutiveCounts.set(event.surface_id, 0);
      return { triggered: false };
    }

    const prior = this.consecutiveCounts.get(event.surface_id) ?? 0;
    const consecutive = prior + 1;
    this.consecutiveCounts.set(event.surface_id, consecutive);

    if (consecutive < MISCALIBRATION_CONSECUTIVE_LIMIT) {
      return { triggered: false };
    }

    const alert: Vlt010AlertEvent = {
      event_class: "GOVERNANCE",
      event_type: "GOVERNANCE_ESCALATION_EMITTED",
      alert_id: randomUUID(),
      rule_id: "VLT-010",
      producer: "Vault",
      timestamp: event.timestamp,
      surface_id: event.surface_id,
      agent_id: event.agent_id,
      consecutive_failures: consecutive,
      calibration_threshold: CALIBRATION_THRESHOLD,
      violation_detail:
        `CALIBRATION_AUDIT_EMITTED for surface "${event.surface_id}" by agent "${event.agent_id}" ` +
        `has recorded ${consecutive} consecutive below-threshold scores ` +
        `(threshold: ${CALIBRATION_THRESHOLD}). ` +
        `Persistent miscalibration detected. Bridge calibration review triggered. ` +
        `Level 3 — Analytical Performance Degradation.`,
      bridge_notified: true,
      persistent_miscalibration: true,
      calibration_review_triggered: true,
    };

    this.alerts.push(alert);
    return { triggered: true, alert, consecutive_failures: consecutive };
  }

  getConsecutiveCount(surfaceId: string): number {
    return this.consecutiveCounts.get(surfaceId) ?? 0;
  }

  getAlerts(): readonly Vlt010AlertEvent[] {
    return this.alerts;
  }

  alertCount(): number {
    return this.alerts.length;
  }

  /** Resets detector state. For testing only. */
  _resetForTesting(): void {
    this.consecutiveCounts.clear();
    this.alerts.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const vlt010PersistentMiscalibrationDetector = new Vlt010PersistentMiscalibrationDetector();
