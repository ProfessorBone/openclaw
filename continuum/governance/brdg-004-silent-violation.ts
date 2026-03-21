/**
 * continuum/governance/brdg-004-silent-violation.ts
 *
 * PACS-VALIDATION-001 INJ-006 detection surface.
 * BRDG-004 — Silent Violation: Policy Violation Without Escalation Candidate.
 *
 * Detects when POLICY_VIOLATION_DETECTED fires but no ESCALATION_CANDIDATE_FORMED
 * is paired within the escalation latency window (≤600s in production).
 *
 * Window check is explicit: call checkWindowExpiry(tick) to close the window and
 * fire alerts for all unresolved violations. No background scheduler. No timers.
 *
 * On detection:
 *   - GOVERNANCE_ESCALATION_EMITTED with bridge_notified: true
 *   - Gauge anomaly alert emitted (anomaly_alert_emitted: true)
 *
 * Level 2 — Governance Process Failure.
 *
 * Governed by: PACS-VALIDATION-001 INJ-006
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PolicyViolationEvent = {
  event_id: string;
  decision_id: string;
  agent_id: string;
  timestamp: string;
};

export type EscalationCandidateFormedEvent = {
  event_id: string;
  source_decision_id: string;
  timestamp: string;
};

export type Brdg004AlertEvent = {
  event_class: "GOVERNANCE";
  event_type: "GOVERNANCE_ESCALATION_EMITTED";
  alert_id: string;
  rule_id: "BRDG-004";
  producer: "Gauge";
  timestamp: string;
  decision_id: string;
  agent_id: string;
  violation_detail: string;
  bridge_notified: true;
  anomaly_type: "SILENT_VIOLATION";
};

export type Brdg004WindowResult =
  | { rule_fired: false }
  | { rule_fired: true; alert: Brdg004AlertEvent; anomaly_alert_emitted: true };

// ---------------------------------------------------------------------------
// Brdg004SilentViolationDetector
// ---------------------------------------------------------------------------

export class Brdg004SilentViolationDetector {
  private readonly openViolations = new Map<string, PolicyViolationEvent>();
  private readonly alerts: Brdg004AlertEvent[] = [];

  /**
   * Records a POLICY_VIOLATION_DETECTED event. Opens a window expecting
   * a paired ESCALATION_CANDIDATE_FORMED before the window expires.
   */
  registerPolicyViolation(event: PolicyViolationEvent): void {
    this.openViolations.set(event.decision_id, event);
  }

  /**
   * Records an ESCALATION_CANDIDATE_FORMED event. Resolves the open window
   * for the matching decision_id (if any).
   */
  registerEscalationCandidate(event: EscalationCandidateFormedEvent): void {
    this.openViolations.delete(event.source_decision_id);
  }

  /**
   * Closes the window. All unresolved violations (no paired escalation candidate)
   * produce BRDG-004 alerts. Returns one result per fired violation.
   *
   * If no violations are open, returns [{ rule_fired: false }].
   *
   * @param tick - Timestamp at window expiry (ISO string). Used in alert timestamp.
   */
  checkWindowExpiry(tick: string): Brdg004WindowResult[] {
    const results: Brdg004WindowResult[] = [];
    for (const violation of this.openViolations.values()) {
      const alert: Brdg004AlertEvent = {
        event_class: "GOVERNANCE",
        event_type: "GOVERNANCE_ESCALATION_EMITTED",
        alert_id: randomUUID(),
        rule_id: "BRDG-004",
        producer: "Gauge",
        timestamp: tick,
        decision_id: violation.decision_id,
        agent_id: violation.agent_id,
        violation_detail:
          `Policy violation for decision_id="${violation.decision_id}" by agent "${violation.agent_id}" ` +
          `produced no paired ESCALATION_CANDIDATE_FORMED within the escalation latency window. ` +
          `Silent violation. Level 2 — Governance Process Failure.`,
        bridge_notified: true,
        anomaly_type: "SILENT_VIOLATION",
      };
      this.alerts.push(alert);
      results.push({ rule_fired: true, alert, anomaly_alert_emitted: true });
    }
    this.openViolations.clear();
    return results.length > 0 ? results : [{ rule_fired: false }];
  }

  getAlerts(): readonly Brdg004AlertEvent[] {
    return this.alerts;
  }

  alertCount(): number {
    return this.alerts.length;
  }

  openViolationCount(): number {
    return this.openViolations.size;
  }

  /** Resets detector state. For testing only. */
  _resetForTesting(): void {
    this.openViolations.clear();
    this.alerts.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const brdg004SilentViolationDetector = new Brdg004SilentViolationDetector();
