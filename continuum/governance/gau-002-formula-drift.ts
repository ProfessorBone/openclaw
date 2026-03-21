/**
 * continuum/governance/gau-002-formula-drift.ts
 *
 * PACS-VALIDATION-001 INJ-010 detection surface.
 * GAU-002 — Formula Version Drift.
 *
 * Detects when PERFORMANCE_REPORT_EMITTED contains metrics that reference a
 * formula_version not matching the current locked formula registry version.
 *
 * Exact string comparison only. No semantic version parsing. No dynamic loading.
 *
 * On detection:
 *   - GOVERNANCE_ESCALATION_EMITTED with bridge_notified: true
 *   - Affected metrics flagged as derived with stale formula
 *
 * Level 2 — Governance Process Failure.
 *
 * Governed by: PACS-VALIDATION-001 INJ-010
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Locked formula registry
// ---------------------------------------------------------------------------

export type FormulaRegistry = Record<string, { current_version: string; description?: string }>;

export const LOCKED_FORMULA_REGISTRY: FormulaRegistry = {
  portfolio_sharpe_ratio: { current_version: "v3" },
  strategy_confidence_score: { current_version: "v2" },
  drawdown_risk_index: { current_version: "v1" },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReportMetric = {
  metric_id: string;
  formula_version: string;
  value: number;
};

export type PerformanceReportEmittedEvent = {
  event_id: string;
  report_id: string;
  agent_id: string;
  metrics: ReportMetric[];
  timestamp: string;
};

export type StaleMetricEntry = {
  metric_id: string;
  reported_version: string;
  current_version: string;
};

export type Gau002AlertEvent = {
  event_class: "GOVERNANCE";
  event_type: "GOVERNANCE_ESCALATION_EMITTED";
  alert_id: string;
  rule_id: "GAU-002";
  producer: "Gauge";
  timestamp: string;
  report_id: string;
  agent_id: string;
  stale_metrics: StaleMetricEntry[];
  violation_detail: string;
  bridge_notified: true;
};

export type Gau002CheckResult = { compliant: true } | { compliant: false; alert: Gau002AlertEvent };

// ---------------------------------------------------------------------------
// Gau002FormulaVersionDetector
// ---------------------------------------------------------------------------

export class Gau002FormulaVersionDetector {
  private readonly alerts: Gau002AlertEvent[] = [];

  /**
   * Checks a PERFORMANCE_REPORT_EMITTED event for stale formula versions.
   * Only metrics whose metric_id appears in LOCKED_FORMULA_REGISTRY are checked.
   * Returns compliant: true if all known metrics are at current version.
   * Returns compliant: false + alert listing all stale metrics otherwise.
   */
  checkPerformanceReport(event: PerformanceReportEmittedEvent): Gau002CheckResult {
    const staleMetrics: StaleMetricEntry[] = [];

    for (const metric of event.metrics) {
      const entry = LOCKED_FORMULA_REGISTRY[metric.metric_id];
      if (entry !== undefined && metric.formula_version !== entry.current_version) {
        staleMetrics.push({
          metric_id: metric.metric_id,
          reported_version: metric.formula_version,
          current_version: entry.current_version,
        });
      }
    }

    if (staleMetrics.length === 0) {
      return { compliant: true };
    }

    const alert: Gau002AlertEvent = {
      event_class: "GOVERNANCE",
      event_type: "GOVERNANCE_ESCALATION_EMITTED",
      alert_id: randomUUID(),
      rule_id: "GAU-002",
      producer: "Gauge",
      timestamp: event.timestamp,
      report_id: event.report_id,
      agent_id: event.agent_id,
      stale_metrics: staleMetrics,
      violation_detail:
        `PERFORMANCE_REPORT_EMITTED (report_id="${event.report_id}") from agent "${event.agent_id}" ` +
        `contains ${staleMetrics.length} metric(s) with stale formula version(s): ` +
        staleMetrics
          .map((m) => `${m.metric_id}@${m.reported_version} (current: ${m.current_version})`)
          .join(", ") +
        `. Metrics derived from stale formulas are ungoverned. Level 2 — Governance Process Failure.`,
      bridge_notified: true,
    };

    this.alerts.push(alert);
    return { compliant: false, alert };
  }

  getAlerts(): readonly Gau002AlertEvent[] {
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

export const gau002FormulaVersionDetector = new Gau002FormulaVersionDetector();
