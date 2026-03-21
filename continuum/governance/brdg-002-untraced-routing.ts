/**
 * continuum/governance/brdg-002-untraced-routing.ts
 *
 * PACS-VALIDATION-001 INJ-007 detection surface.
 * BRDG-002 — Untraced Routing Decision.
 *
 * Detects when ROUTING_DECISION_EXECUTED fires with no prior
 * ROUTING_DECISION_FORMED bearing a matching decision_id.
 *
 * On detection:
 *   - GOVERNANCE_ESCALATION_EMITTED with bridge_notified: true
 *   - Coverage rate drops below 100%
 *   - Gauge anomaly alert emitted (anomaly_alert_emitted: true)
 *
 * Level 2 — Governance Process Failure.
 *
 * Governed by: PACS-VALIDATION-001 INJ-007
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RoutingDecisionFormedEvent = {
  event_id: string;
  decision_id: string;
  agent_id: string;
  timestamp: string;
};

export type RoutingDecisionExecutedEvent = {
  event_id: string;
  decision_id: string;
  agent_id: string;
  timestamp: string;
};

export type Brdg002AlertEvent = {
  event_class: "GOVERNANCE";
  event_type: "GOVERNANCE_ESCALATION_EMITTED";
  alert_id: string;
  rule_id: "BRDG-002";
  producer: "Gauge";
  timestamp: string;
  decision_id: string;
  agent_id: string;
  violation_detail: string;
  bridge_notified: true;
  anomaly_type: "UNTRACED_ROUTING";
};

export type Brdg002CheckResult =
  | { compliant: true }
  | {
      compliant: false;
      alert: Brdg002AlertEvent;
      coverage_rate: number;
      anomaly_alert_emitted: true;
    };

// ---------------------------------------------------------------------------
// Brdg002UntracedRoutingDetector
// ---------------------------------------------------------------------------

export class Brdg002UntracedRoutingDetector {
  private readonly formedDecisions = new Set<string>();
  private executedCount = 0;
  private untracedCount = 0;
  private readonly alerts: Brdg002AlertEvent[] = [];

  /**
   * Records a ROUTING_DECISION_FORMED event.
   * Registers the decision_id as available for pairing.
   */
  registerRoutingDecisionFormed(event: RoutingDecisionFormedEvent): void {
    this.formedDecisions.add(event.decision_id);
  }

  /**
   * Checks a ROUTING_DECISION_EXECUTED event for a prior ROUTING_DECISION_FORMED.
   * Returns compliant: true if a matching formed decision exists.
   * Returns compliant: false + BRDG-002 alert + updated coverage rate otherwise.
   */
  checkRoutingDecisionExecuted(event: RoutingDecisionExecutedEvent): Brdg002CheckResult {
    this.executedCount++;
    if (this.formedDecisions.has(event.decision_id)) {
      return { compliant: true };
    }

    this.untracedCount++;
    const coverageRate =
      this.executedCount > 0 ? (this.executedCount - this.untracedCount) / this.executedCount : 1.0;

    const alert: Brdg002AlertEvent = {
      event_class: "GOVERNANCE",
      event_type: "GOVERNANCE_ESCALATION_EMITTED",
      alert_id: randomUUID(),
      rule_id: "BRDG-002",
      producer: "Gauge",
      timestamp: event.timestamp,
      decision_id: event.decision_id,
      agent_id: event.agent_id,
      violation_detail:
        `ROUTING_DECISION_EXECUTED for decision_id="${event.decision_id}" by agent "${event.agent_id}" ` +
        `has no prior ROUTING_DECISION_FORMED with matching decision_id. ` +
        `Routing decision is untraced. Coverage rate: ${coverageRate.toFixed(2)}. ` +
        `Level 2 — Governance Process Failure.`,
      bridge_notified: true,
      anomaly_type: "UNTRACED_ROUTING",
    };
    this.alerts.push(alert);
    return { compliant: false, alert, coverage_rate: coverageRate, anomaly_alert_emitted: true };
  }

  getCoverageRate(): number {
    return this.executedCount > 0
      ? (this.executedCount - this.untracedCount) / this.executedCount
      : 1.0;
  }

  getAlerts(): readonly Brdg002AlertEvent[] {
    return this.alerts;
  }

  alertCount(): number {
    return this.alerts.length;
  }

  /** Resets detector state. For testing only. */
  _resetForTesting(): void {
    this.formedDecisions.clear();
    this.executedCount = 0;
    this.untracedCount = 0;
    this.alerts.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const brdg002UntracedRoutingDetector = new Brdg002UntracedRoutingDetector();
