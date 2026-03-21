/**
 * continuum/governance/sig-005-deposit-pathway.ts
 *
 * PACS-VALIDATION-001 INJ-019 detection surface.
 * SIG-005 — Deposit Pathway Integrity Failure.
 *
 * Detects BRIEF_DEPOSITED events where deposit_target is any store other than
 * the Exogenous Intelligence Intake Queue (AUTHORIZED_DEPOSIT_TARGET).
 *
 * Signal's perceptual boundary ends at the deposit confirmation. The only
 * authorized deposit surface is the Exogenous Intelligence Intake Queue.
 *
 * On detection:
 *   - GOVERNANCE_ESCALATION_EMITTED with bridge_notified: true
 *   - Deposit pathway compliance rate drops below 1.0
 *
 * Level 2 — Governance Process Failure.
 *
 * Governed by: PACS-VALIDATION-001 INJ-019
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Authorized deposit target
// ---------------------------------------------------------------------------

export const AUTHORIZED_DEPOSIT_TARGET = "exogenous_intelligence_intake_queue";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BriefDepositedEvent = {
  event_id: string;
  brief_id: string;
  agent_id: string;
  deposit_target: string;
  timestamp: string;
};

export type Sig005AlertEvent = {
  event_class: "GOVERNANCE";
  event_type: "GOVERNANCE_ESCALATION_EMITTED";
  alert_id: string;
  rule_id: "SIG-005";
  producer: "Signal";
  timestamp: string;
  brief_id: string;
  agent_id: string;
  actual_target: string;
  authorized_target: string;
  violation_detail: string;
  bridge_notified: true;
};

export type Sig005CheckResult =
  | { compliant: true }
  | {
      compliant: false;
      alert: Sig005AlertEvent;
      deposit_pathway_compliance_rate: number;
    };

// ---------------------------------------------------------------------------
// Sig005DepositPathwayDetector
// ---------------------------------------------------------------------------

export class Sig005DepositPathwayDetector {
  private totalDeposits = 0;
  private compliantDeposits = 0;
  private readonly alerts: Sig005AlertEvent[] = [];

  /**
   * Checks a BRIEF_DEPOSITED event for deposit_target compliance.
   * Returns compliant: true if deposit_target equals AUTHORIZED_DEPOSIT_TARGET.
   * Returns compliant: false + alert + updated compliance rate otherwise.
   */
  checkBriefDeposit(event: BriefDepositedEvent): Sig005CheckResult {
    this.totalDeposits++;

    if (event.deposit_target === AUTHORIZED_DEPOSIT_TARGET) {
      this.compliantDeposits++;
      return { compliant: true };
    }

    const complianceRate = this.totalDeposits > 0 ? this.compliantDeposits / this.totalDeposits : 1;

    const alert: Sig005AlertEvent = {
      event_class: "GOVERNANCE",
      event_type: "GOVERNANCE_ESCALATION_EMITTED",
      alert_id: randomUUID(),
      rule_id: "SIG-005",
      producer: "Signal",
      timestamp: event.timestamp,
      brief_id: event.brief_id,
      agent_id: event.agent_id,
      actual_target: event.deposit_target,
      authorized_target: AUTHORIZED_DEPOSIT_TARGET,
      violation_detail:
        `BRIEF_DEPOSITED (brief_id="${event.brief_id}") by agent "${event.agent_id}" ` +
        `targets "${event.deposit_target}" — not the authorized Exogenous Intelligence Intake Queue. ` +
        `Signal's perceptual boundary ends at the deposit confirmation. ` +
        `Deposit pathway integrity failure. Level 2 — Governance Process Failure.`,
      bridge_notified: true,
    };

    this.alerts.push(alert);
    return { compliant: false, alert, deposit_pathway_compliance_rate: complianceRate };
  }

  getComplianceRate(): number {
    return this.totalDeposits > 0 ? this.compliantDeposits / this.totalDeposits : 1;
  }

  getAlerts(): readonly Sig005AlertEvent[] {
    return this.alerts;
  }

  alertCount(): number {
    return this.alerts.length;
  }

  /** Resets detector state. For testing only. */
  _resetForTesting(): void {
    this.totalDeposits = 0;
    this.compliantDeposits = 0;
    this.alerts.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const sig005DepositPathwayDetector = new Sig005DepositPathwayDetector();
