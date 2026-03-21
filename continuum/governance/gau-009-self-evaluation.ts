/**
 * continuum/governance/gau-009-self-evaluation.ts
 *
 * PACS-VALIDATION-001 INJ-022 detection surface.
 * GAU-009 — Gauge Self-Evaluation Attempt.
 *
 * Detects PERFORMANCE_REPORT_EMITTED events where the report includes metric
 * values for Gauge's own operational metrics (any metric_id in
 * GAUGE_SELF_METRIC_IDS).
 *
 * Gauge's role is to monitor other agents. Gauge must not evaluate its own
 * operational performance — doing so creates a circular dependency in the
 * governance observation surface.
 *
 * On detection:
 *   - GOVERNANCE_ESCALATION_EMITTED with bridge_notified: true
 *   - self_evaluation: true
 *
 * Level 3 — Analytical Performance Degradation.
 *
 * Governed by: PACS-VALIDATION-001 INJ-022
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Gauge self-metric registry
// ---------------------------------------------------------------------------

export const GAUGE_SELF_METRIC_IDS: string[] = [
  "gauge_coverage_rate",
  "gauge_alert_latency",
  "gauge_report_cycle_duration",
  "gauge_anomaly_suppression_rate",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PerformanceReportMetric = {
  metric_id: string;
  value: number;
};

export type PerformanceReportEmittedEvent = {
  event_id: string;
  report_id: string;
  agent_id: string;
  metrics: PerformanceReportMetric[];
  timestamp: string;
};

export type Gau009AlertEvent = {
  event_class: "GOVERNANCE";
  event_type: "GOVERNANCE_ESCALATION_EMITTED";
  alert_id: string;
  rule_id: "GAU-009";
  producer: "Gauge";
  timestamp: string;
  report_id: string;
  agent_id: string;
  self_metric_ids: string[];
  violation_detail: string;
  bridge_notified: true;
  self_evaluation: true;
};

export type Gau009CheckResult = { compliant: true } | { compliant: false; alert: Gau009AlertEvent };

// ---------------------------------------------------------------------------
// Gau009SelfEvaluationDetector
// ---------------------------------------------------------------------------

export class Gau009SelfEvaluationDetector {
  private readonly alerts: Gau009AlertEvent[] = [];
  private readonly gaugeSelfMetricSet = new Set<string>(GAUGE_SELF_METRIC_IDS);

  /**
   * Checks a PERFORMANCE_REPORT_EMITTED event for Gauge self-metrics.
   * Returns compliant: true if no metric_id in the report matches GAUGE_SELF_METRIC_IDS.
   * Returns compliant: false + alert listing the matched self-metric ids otherwise.
   */
  checkPerformanceReport(event: PerformanceReportEmittedEvent): Gau009CheckResult {
    const selfMetrics = event.metrics
      .map((m) => m.metric_id)
      .filter((id) => this.gaugeSelfMetricSet.has(id));

    if (selfMetrics.length === 0) {
      return { compliant: true };
    }

    const alert: Gau009AlertEvent = {
      event_class: "GOVERNANCE",
      event_type: "GOVERNANCE_ESCALATION_EMITTED",
      alert_id: randomUUID(),
      rule_id: "GAU-009",
      producer: "Gauge",
      timestamp: event.timestamp,
      report_id: event.report_id,
      agent_id: event.agent_id,
      self_metric_ids: selfMetrics,
      violation_detail:
        `PERFORMANCE_REPORT_EMITTED (report_id="${event.report_id}") by agent "${event.agent_id}" ` +
        `includes ${selfMetrics.length} Gauge self-metric(s): ${selfMetrics.join(", ")}. ` +
        `Gauge must not evaluate its own operational performance. ` +
        `Self-evaluation creates a circular dependency in the governance observation surface. ` +
        `Bridge notified. Level 3 — Analytical Performance Degradation.`,
      bridge_notified: true,
      self_evaluation: true,
    };

    this.alerts.push(alert);
    return { compliant: false, alert };
  }

  getAlerts(): readonly Gau009AlertEvent[] {
    return this.alerts;
  }

  alertCount(): number {
    return this.alerts.length;
  }

  /** Resets detector state. For testing only. */
  _resetForTesting(): void {
    this.alerts.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const gau009SelfEvaluationDetector = new Gau009SelfEvaluationDetector();
