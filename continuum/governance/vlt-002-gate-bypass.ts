/**
 * continuum/governance/vlt-002-gate-bypass.ts
 *
 * PACS-VALIDATION-001 INJ-001 detection surface.
 * VLT-002 — Intelligence Quality Gate bypass detection.
 *
 * Detects STRATEGIC_RECOMMENDATION_EMITTED events where gate_validation_event_id
 * is absent or null — indicating the Intelligence Quality Gate was bypassed.
 *
 * On detection:
 *   - VLT-002 rule violation alert emitted (A6 — emit_rule_violation_alert)
 *   - Affected analytical pathway halted
 *
 * Level 1 — Containment Architecture Failure.
 * Per PACS-PEAS-AGT6-002 A6: Vault surfaces, Bridge enforces.
 *
 * Governed by: PACS-VALIDATION-001 INJ-001, PACS-PEAS-AGT6-002 A6
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StrategicRecommendationEvent = {
  event_id: string;
  decision_id: string;
  /** Present and non-null when the Intelligence Quality Gate was satisfied. */
  gate_validation_event_id?: string | null;
  timestamp: string;
};

export type Vlt002RuleViolationAlert = {
  event_class: "GOVERNANCE";
  event_type: "RULE_VIOLATION_ALERT_EMITTED";
  alert_id: string;
  rule_id: "VLT-002";
  producer: "Vault";
  timestamp: string;
  decision_id: string;
  violation_detail: string;
  analytical_pathway_halted: boolean;
};

export type Vlt002CheckResult =
  | { compliant: true }
  | { compliant: false; alert: Vlt002RuleViolationAlert; pathway_halted: boolean };

// ---------------------------------------------------------------------------
// Vlt002GateBypassDetector
// ---------------------------------------------------------------------------

/**
 * Detects STRATEGIC_RECOMMENDATION_EMITTED events that bypass the
 * Intelligence Quality Gate by omitting gate_validation_event_id.
 *
 * Level 1 — Containment Architecture Failure.
 * Per PACS-PEAS-AGT6-002: A6 emit_rule_violation_alert fires on detection.
 * Vault surfaces the violation. Bridge enforces the consequence.
 */
export class Vlt002GateBypassDetector {
  private readonly alerts: Vlt002RuleViolationAlert[] = [];
  private readonly haltedPathways = new Set<string>();

  /**
   * Checks a STRATEGIC_RECOMMENDATION_EMITTED event for Intelligence Quality Gate bypass.
   * Returns compliant: true if gate_validation_event_id is present and non-null/non-empty.
   * Returns compliant: false + alert + pathway_halted if gate is missing.
   */
  checkStrategicRecommendation(event: StrategicRecommendationEvent): Vlt002CheckResult {
    if (event.gate_validation_event_id != null && event.gate_validation_event_id !== "") {
      return { compliant: true };
    }

    const alert: Vlt002RuleViolationAlert = {
      event_class: "GOVERNANCE",
      event_type: "RULE_VIOLATION_ALERT_EMITTED",
      alert_id: randomUUID(),
      rule_id: "VLT-002",
      producer: "Vault",
      timestamp: new Date().toISOString(),
      decision_id: event.decision_id,
      violation_detail:
        `STRATEGIC_RECOMMENDATION_EMITTED with absent or null gate_validation_event_id. ` +
        `Intelligence Quality Gate not satisfied. Analytical pathway halted. ` +
        `Level 1 — Containment Architecture Failure.`,
      analytical_pathway_halted: true,
    };

    this.alerts.push(alert);
    this.haltedPathways.add(event.decision_id);

    return { compliant: false, alert, pathway_halted: true };
  }

  isPathwayHalted(decisionId: string): boolean {
    return this.haltedPathways.has(decisionId);
  }

  getAlerts(): readonly Vlt002RuleViolationAlert[] {
    return this.alerts;
  }

  alertCount(): number {
    return this.alerts.length;
  }

  /** Resets detector state. For testing only. */
  _resetForTesting(): void {
    this.alerts.length = 0;
    this.haltedPathways.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const vlt002GateBypassDetector = new Vlt002GateBypassDetector();
