/**
 * continuum/governance/gau-006-suppressed-anomaly.ts
 *
 * PACS-VALIDATION-001 INJ-009 detection surface.
 * GAU-006 — Suppressed Anomaly Alert.
 *
 * Detects when a telemetry signal crosses a defined threshold but
 * ANOMALY_ALERT_EMITTED is not paired within the surfacing latency window.
 *
 * Window check is explicit: call checkWindowExpiry(tick) to close the window
 * and fire alerts for all unresolved threshold crossings.
 * No background scheduler. No timers.
 *
 * On detection:
 *   - GOVERNANCE_ESCALATION_EMITTED with bridge_notified: true
 *   - Suppressed anomaly count increments
 *
 * Level 2 — Governance Process Failure.
 *
 * Governed by: PACS-VALIDATION-001 INJ-009
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThresholdCrossingEvent = {
  event_id: string;
  metric_id: string;
  measured_value: number;
  threshold_value: number;
  agent_id: string;
  timestamp: string;
};

export type AnomalyAlertEmittedEvent = {
  event_id: string;
  source_metric_id: string;
  timestamp: string;
};

export type Gau006AlertEvent = {
  event_class: "GOVERNANCE";
  event_type: "GOVERNANCE_ESCALATION_EMITTED";
  alert_id: string;
  rule_id: "GAU-006";
  producer: "Gauge";
  timestamp: string;
  metric_id: string;
  agent_id: string;
  violation_detail: string;
  bridge_notified: true;
  suppressed_anomaly: true;
};

export type Gau006WindowResult =
  | { rule_fired: false }
  | { rule_fired: true; alert: Gau006AlertEvent };

// ---------------------------------------------------------------------------
// Gau006SuppressedAnomalyDetector
// ---------------------------------------------------------------------------

export class Gau006SuppressedAnomalyDetector {
  private readonly openCrossings = new Map<string, ThresholdCrossingEvent>();
  private suppressedCount = 0;
  private readonly alerts: Gau006AlertEvent[] = [];

  /**
   * Records a telemetry threshold crossing. Opens a window expecting
   * a paired ANOMALY_ALERT_EMITTED before the window expires.
   */
  registerThresholdCrossing(event: ThresholdCrossingEvent): void {
    this.openCrossings.set(event.metric_id, event);
  }

  /**
   * Records an ANOMALY_ALERT_EMITTED event. Resolves the open window
   * for the matching metric_id (if any).
   */
  registerAnomalyAlert(event: AnomalyAlertEmittedEvent): void {
    this.openCrossings.delete(event.source_metric_id);
  }

  /**
   * Closes the window. All unresolved threshold crossings (no paired anomaly alert)
   * produce GAU-006 alerts. Returns one result per fired alert.
   *
   * If no crossings are open, returns [{ rule_fired: false }].
   *
   * @param tick - Timestamp at window expiry (ISO string). Used in alert timestamp.
   */
  checkWindowExpiry(tick: string): Gau006WindowResult[] {
    const results: Gau006WindowResult[] = [];
    for (const crossing of this.openCrossings.values()) {
      this.suppressedCount++;
      const alert: Gau006AlertEvent = {
        event_class: "GOVERNANCE",
        event_type: "GOVERNANCE_ESCALATION_EMITTED",
        alert_id: randomUUID(),
        rule_id: "GAU-006",
        producer: "Gauge",
        timestamp: tick,
        metric_id: crossing.metric_id,
        agent_id: crossing.agent_id,
        violation_detail:
          `Telemetry threshold crossed for metric_id="${crossing.metric_id}" ` +
          `(measured=${crossing.measured_value}, threshold=${crossing.threshold_value}) ` +
          `by agent "${crossing.agent_id}" but no ANOMALY_ALERT_EMITTED was paired ` +
          `within the surfacing latency window. ` +
          `Suppressed anomaly. Level 2 — Governance Process Failure.`,
        bridge_notified: true,
        suppressed_anomaly: true,
      };
      this.alerts.push(alert);
      results.push({ rule_fired: true, alert });
    }
    this.openCrossings.clear();
    return results.length > 0 ? results : [{ rule_fired: false }];
  }

  getSuppressedCount(): number {
    return this.suppressedCount;
  }

  getAlerts(): readonly Gau006AlertEvent[] {
    return this.alerts;
  }

  alertCount(): number {
    return this.alerts.length;
  }

  /** Resets detector state. For testing only. */
  _resetForTesting(): void {
    this.openCrossings.clear();
    this.suppressedCount = 0;
    this.alerts.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const gau006SuppressedAnomalyDetector = new Gau006SuppressedAnomalyDetector();
