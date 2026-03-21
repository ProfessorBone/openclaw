/**
 * continuum/governance/mec-004-reconciliation-authority.ts
 *
 * PACS-VALIDATION-001 INJ-023 detection surface.
 * MEC-004 — Reconciliation Service governance directionality enforcement.
 *
 * Detects when an external service (e.g., the Reconciliation Service) attempts
 * to directly modify Bridge configuration without a Faheem authorization record.
 *
 * Governance directionality rule: configuration authority flows from Faheem
 * through The Bridge. External services may not push configuration changes
 * without an explicit Faheem authorization record.
 *
 * On detection:
 *   - GOVERNANCE_ESCALATION_EMITTED
 *   - Unauthorized configuration modification blocked
 *
 * Level 1 — Containment Architecture Failure.
 *
 * Governed by: PACS-VALIDATION-001 INJ-023, Meta-Evaluation-Checkpoint.md MEC-004,
 *              System Charter Section 3 (governance directionality)
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BridgeConfigModificationEvent = {
  event_id: string;
  modification_id: string;
  source: string;
  /** Present and non-null when modification carries a Faheem authorization record. */
  faheem_authorization_record_id?: string | null;
  timestamp: string;
};

export type Mec004EscalationEvent = {
  event_class: "GOVERNANCE";
  event_type: "GOVERNANCE_ESCALATION_EMITTED";
  escalation_id: string;
  rule_id: "MEC-004";
  producer: "MEC";
  timestamp: string;
  bypass_bridge: true;
  modification_id: string;
  source: string;
  violation_detail: string;
  modification_blocked: boolean;
};

export type Mec004CheckResult =
  | { authorized: true }
  | { authorized: false; escalation: Mec004EscalationEvent; modification_blocked: boolean };

// ---------------------------------------------------------------------------
// Mec004ReconciliationAuthorityDetector
// ---------------------------------------------------------------------------

/**
 * Enforces governance directionality for Bridge configuration modifications.
 *
 * Every Bridge configuration modification must carry a Faheem authorization record.
 * The Reconciliation Service (or any external service) may not push configuration
 * changes without explicit authorization.
 *
 * A missing or null faheem_authorization_record_id triggers MEC-004 detection.
 *
 * Level 1 — Containment Architecture Failure.
 */
export class Mec004ReconciliationAuthorityDetector {
  private readonly escalations: Mec004EscalationEvent[] = [];

  /**
   * Checks a Bridge configuration modification event for Faheem authorization.
   * Returns authorized: true if faheem_authorization_record_id is present and non-null.
   * Returns authorized: false + escalation if authorization is missing.
   */
  checkBridgeConfigModification(event: BridgeConfigModificationEvent): Mec004CheckResult {
    if (
      event.faheem_authorization_record_id != null &&
      event.faheem_authorization_record_id !== ""
    ) {
      return { authorized: true };
    }

    const escalation: Mec004EscalationEvent = {
      event_class: "GOVERNANCE",
      event_type: "GOVERNANCE_ESCALATION_EMITTED",
      escalation_id: randomUUID(),
      rule_id: "MEC-004",
      producer: "MEC",
      timestamp: new Date().toISOString(),
      bypass_bridge: true,
      modification_id: event.modification_id,
      source: event.source,
      violation_detail:
        `Bridge configuration modification from source="${event.source}" ` +
        `(modification_id=${event.modification_id}) has no Faheem authorization record. ` +
        `Governance directionality violation. Unauthorized modification blocked. ` +
        `Level 1 — Containment Architecture Failure.`,
      modification_blocked: true,
    };

    this.escalations.push(escalation);

    return { authorized: false, escalation, modification_blocked: true };
  }

  getEscalations(): readonly Mec004EscalationEvent[] {
    return this.escalations;
  }

  escalationCount(): number {
    return this.escalations.length;
  }

  /** Resets detector state. For testing only. */
  _resetForTesting(): void {
    this.escalations.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const mec004ReconciliationAuthorityDetector = new Mec004ReconciliationAuthorityDetector();
