/**
 * continuum/governance/vlt-009-risk-coverage.ts
 *
 * PACS-VALIDATION-001 INJ-017 detection surface.
 * VLT-009 — Risk Coverage Gap: Required Risk Category Absent.
 *
 * Detects MARKET_REPORT_EMITTED events where one or more required risk
 * categories from VAULT_RISK_COVERAGE_REGISTRY are absent from the report.
 *
 * On detection:
 *   - GOVERNANCE_ESCALATION_EMITTED with bridge_notified: true
 *   - coverage_gap: true
 *   - bridge_review_triggered: true
 *   - absent_categories listed
 *
 * Level 3 — Analytical Performance Degradation.
 *
 * Governed by: PACS-VALIDATION-001 INJ-017
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Locked registry
// ---------------------------------------------------------------------------

export const VAULT_RISK_COVERAGE_REGISTRY: string[] = [
  "market_risk",
  "liquidity_risk",
  "concentration_risk",
  "drawdown_risk",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarketReportEmittedEvent = {
  event_id: string;
  report_id: string;
  agent_id: string;
  risk_categories: string[];
  timestamp: string;
};

export type Vlt009AlertEvent = {
  event_class: "GOVERNANCE";
  event_type: "GOVERNANCE_ESCALATION_EMITTED";
  alert_id: string;
  rule_id: "VLT-009";
  producer: "Vault";
  timestamp: string;
  report_id: string;
  agent_id: string;
  absent_categories: string[];
  violation_detail: string;
  bridge_notified: true;
  coverage_gap: true;
  bridge_review_triggered: true;
};

export type Vlt009CheckResult = { compliant: true } | { compliant: false; alert: Vlt009AlertEvent };

// ---------------------------------------------------------------------------
// Vlt009RiskCoverageDetector
// ---------------------------------------------------------------------------

export class Vlt009RiskCoverageDetector {
  private readonly alerts: Vlt009AlertEvent[] = [];

  /**
   * Checks a MARKET_REPORT_EMITTED event for risk category coverage.
   * Returns compliant: true if all VAULT_RISK_COVERAGE_REGISTRY categories are present.
   * Returns compliant: false + alert listing absent categories otherwise.
   */
  checkMarketReport(event: MarketReportEmittedEvent): Vlt009CheckResult {
    const presentCategories = new Set(event.risk_categories);
    const absentCategories = VAULT_RISK_COVERAGE_REGISTRY.filter(
      (cat) => !presentCategories.has(cat),
    );

    if (absentCategories.length === 0) {
      return { compliant: true };
    }

    const alert: Vlt009AlertEvent = {
      event_class: "GOVERNANCE",
      event_type: "GOVERNANCE_ESCALATION_EMITTED",
      alert_id: randomUUID(),
      rule_id: "VLT-009",
      producer: "Vault",
      timestamp: event.timestamp,
      report_id: event.report_id,
      agent_id: event.agent_id,
      absent_categories: absentCategories,
      violation_detail:
        `MARKET_REPORT_EMITTED (report_id="${event.report_id}") by agent "${event.agent_id}" ` +
        `is missing ${absentCategories.length} required risk category(ies): ` +
        absentCategories.join(", ") +
        `. All categories in VAULT_RISK_COVERAGE_REGISTRY must be present. ` +
        `Bridge review triggered. Level 3 — Analytical Performance Degradation.`,
      bridge_notified: true,
      coverage_gap: true,
      bridge_review_triggered: true,
    };

    this.alerts.push(alert);
    return { compliant: false, alert };
  }

  getAlerts(): readonly Vlt009AlertEvent[] {
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

export const vlt009RiskCoverageDetector = new Vlt009RiskCoverageDetector();
