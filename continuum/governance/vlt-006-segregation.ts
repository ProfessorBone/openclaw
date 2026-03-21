/**
 * continuum/governance/vlt-006-segregation.ts
 *
 * PACS-VALIDATION-001 INJ-003 detection surface.
 * VLT-006 — Capital segregation violation detection.
 *
 * Detects PORTFOLIO_ANALYSIS_EMITTED events that reference both retirement
 * and trading partition data without a CROSS_PARTITION_AUTHORIZATION_GRANTED event.
 *
 * On detection:
 *   - VLT-006 rule violation alert emitted (A6 — emit_rule_violation_alert)
 *   - Analytical cycle halted
 *
 * Level 1 — Containment Architecture Failure.
 * Per System Charter Section 6: retirement and speculative activities remain
 * structurally separated. Capital segregation is a non-negotiable constraint.
 *
 * Governed by: PACS-VALIDATION-001 INJ-003, PACS-PEAS-AGT6-002 Section 2.2,
 *              System Charter Section 6
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CapitalPartition = "retirement" | "trading";

export type PortfolioAnalysisEvent = {
  event_id: string;
  decision_id: string;
  partitions_referenced: CapitalPartition[];
  /** Present and non-null when cross-partition analysis is explicitly authorized. */
  cross_partition_authorization_event_id?: string | null;
  timestamp: string;
};

export type Vlt006RuleViolationAlert = {
  event_class: "GOVERNANCE";
  event_type: "RULE_VIOLATION_ALERT_EMITTED";
  alert_id: string;
  rule_id: "VLT-006";
  producer: "Vault";
  timestamp: string;
  decision_id: string;
  partitions_referenced: CapitalPartition[];
  violation_detail: string;
  analytical_cycle_halted: boolean;
};

export type Vlt006CheckResult =
  | { compliant: true }
  | { compliant: false; alert: Vlt006RuleViolationAlert; cycle_halted: boolean };

// ---------------------------------------------------------------------------
// Vlt006SegregationDetector
// ---------------------------------------------------------------------------

/**
 * Detects capital segregation violations in PORTFOLIO_ANALYSIS_EMITTED events.
 *
 * A violation is detected when:
 *   - The event references both "retirement" and "trading" partitions, AND
 *   - No cross_partition_authorization_event_id is present
 *
 * Level 1 — Containment Architecture Failure.
 * Capital segregation is a Charter Section 6 non-negotiable.
 */
export class Vlt006SegregationDetector {
  private readonly alerts: Vlt006RuleViolationAlert[] = [];
  private readonly haltedCycles = new Set<string>();

  /**
   * Checks a PORTFOLIO_ANALYSIS_EMITTED event for capital segregation violations.
   */
  checkPortfolioAnalysis(event: PortfolioAnalysisEvent): Vlt006CheckResult {
    const crossPartition =
      event.partitions_referenced.includes("retirement") &&
      event.partitions_referenced.includes("trading");

    if (!crossPartition) {
      return { compliant: true };
    }

    // Cross-partition event — check for explicit authorization
    if (
      event.cross_partition_authorization_event_id != null &&
      event.cross_partition_authorization_event_id !== ""
    ) {
      return { compliant: true };
    }

    const alert: Vlt006RuleViolationAlert = {
      event_class: "GOVERNANCE",
      event_type: "RULE_VIOLATION_ALERT_EMITTED",
      alert_id: randomUUID(),
      rule_id: "VLT-006",
      producer: "Vault",
      timestamp: new Date().toISOString(),
      decision_id: event.decision_id,
      partitions_referenced: [...event.partitions_referenced],
      violation_detail:
        `PORTFOLIO_ANALYSIS_EMITTED references both retirement and trading partitions ` +
        `without CROSS_PARTITION_AUTHORIZATION_GRANTED event. ` +
        `Capital segregation violation. Analytical cycle halted. ` +
        `Level 1 — Containment Architecture Failure.`,
      analytical_cycle_halted: true,
    };

    this.alerts.push(alert);
    this.haltedCycles.add(event.decision_id);

    return { compliant: false, alert, cycle_halted: true };
  }

  isCycleHalted(decisionId: string): boolean {
    return this.haltedCycles.has(decisionId);
  }

  getAlerts(): readonly Vlt006RuleViolationAlert[] {
    return this.alerts;
  }

  alertCount(): number {
    return this.alerts.length;
  }

  /** Resets detector state. For testing only. */
  _resetForTesting(): void {
    this.alerts.length = 0;
    this.haltedCycles.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const vlt006SegregationDetector = new Vlt006SegregationDetector();
