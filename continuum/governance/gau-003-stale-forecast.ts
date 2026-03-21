/**
 * continuum/governance/gau-003-stale-forecast.ts
 *
 * PACS-VALIDATION-001 INJ-016 detection surface.
 * GAU-003 — Stale Forecast: Material Change Without Recomputation.
 *
 * Detects when a forecast input field changes but FORECAST_PROJECTION_EMITTED
 * recomputation is suppressed beyond the defined tolerance window.
 *
 * Window check is explicit: call checkWindowExpiry(tick) to close the cycle.
 * No background scheduler. No real timers.
 *
 * On detection:
 *   - GOVERNANCE_ESCALATION_EMITTED with bridge_notified: true
 *   - stale_forecast_count increments above zero
 *
 * Level 3 — Analytical Performance Degradation.
 *
 * Governed by: PACS-VALIDATION-001 INJ-016
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ForecastInputFieldChangedEvent = {
  event_id: string;
  field_id: string;
  agent_id: string;
  timestamp: string;
};

export type ForecastProjectionEmittedEvent = {
  event_id: string;
  agent_id: string;
  timestamp: string;
};

export type Gau003AlertEvent = {
  event_class: "GOVERNANCE";
  event_type: "GOVERNANCE_ESCALATION_EMITTED";
  alert_id: string;
  rule_id: "GAU-003";
  producer: "Gauge";
  timestamp: string;
  pending_field_changes: string[];
  stale_forecast_count: number;
  violation_detail: string;
  bridge_notified: true;
};

export type Gau003WindowResult =
  | { rule_fired: false }
  | { rule_fired: true; alert: Gau003AlertEvent; stale_forecast_count: number };

// ---------------------------------------------------------------------------
// Gau003StaleForecastDetector
// ---------------------------------------------------------------------------

export class Gau003StaleForecastDetector {
  private readonly pendingFieldChanges = new Set<string>();
  private projectionEmittedThisCycle = false;
  private staleForecastCount = 0;
  private readonly alerts: Gau003AlertEvent[] = [];

  /**
   * Records a forecast input field change. The field_id is tracked as a
   * pending change requiring recomputation before window close.
   */
  registerFieldChange(event: ForecastInputFieldChangedEvent): void {
    this.pendingFieldChanges.add(event.field_id);
  }

  /**
   * Records a FORECAST_PROJECTION_EMITTED event. Clears the recomputation
   * requirement for the current cycle.
   */
  registerForecastProjection(_event: ForecastProjectionEmittedEvent): void {
    this.projectionEmittedThisCycle = true;
  }

  /**
   * Closes the tolerance window. If pending field changes exist and no
   * FORECAST_PROJECTION_EMITTED was registered, GAU-003 fires.
   *
   * Resets cycle state after evaluation.
   *
   * @param tick - Timestamp at window close (ISO string). Used in alert timestamp.
   */
  checkWindowExpiry(tick: string): Gau003WindowResult {
    const hasPendingChanges = this.pendingFieldChanges.size > 0;
    const pendingFields = [...this.pendingFieldChanges];
    const projectionReceived = this.projectionEmittedThisCycle;

    // Reset cycle state
    this.pendingFieldChanges.clear();
    this.projectionEmittedThisCycle = false;

    if (!hasPendingChanges || projectionReceived) {
      return { rule_fired: false };
    }

    this.staleForecastCount++;

    const alert: Gau003AlertEvent = {
      event_class: "GOVERNANCE",
      event_type: "GOVERNANCE_ESCALATION_EMITTED",
      alert_id: randomUUID(),
      rule_id: "GAU-003",
      producer: "Gauge",
      timestamp: tick,
      pending_field_changes: pendingFields,
      stale_forecast_count: this.staleForecastCount,
      violation_detail:
        `Tolerance window elapsed. ${pendingFields.length} forecast input field change(s) ` +
        `(${pendingFields.join(", ")}) recorded with no FORECAST_PROJECTION_EMITTED recomputation. ` +
        `Stale forecast output. Bridge notified. ` +
        `Level 3 — Analytical Performance Degradation.`,
      bridge_notified: true,
    };

    this.alerts.push(alert);
    return { rule_fired: true, alert, stale_forecast_count: this.staleForecastCount };
  }

  getStaleForecastCount(): number {
    return this.staleForecastCount;
  }

  getAlerts(): readonly Gau003AlertEvent[] {
    return this.alerts;
  }

  alertCount(): number {
    return this.alerts.length;
  }

  /** Resets detector state. For testing only. */
  _resetForTesting(): void {
    this.pendingFieldChanges.clear();
    this.projectionEmittedThisCycle = false;
    this.staleForecastCount = 0;
    this.alerts.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const gau003StaleForecastDetector = new Gau003StaleForecastDetector();
