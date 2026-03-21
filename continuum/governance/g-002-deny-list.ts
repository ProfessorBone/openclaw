/**
 * continuum/governance/g-002-deny-list.ts
 *
 * PACS-VALIDATION-001 INJ-004 detection surface.
 * G-002 / VLT-007 — Deny list breach detection.
 *
 * Detects attempts to execute deny-listed actions.
 * Deny list is per System Charter Section 9 non-negotiables and the Vault
 * sandbox configuration established in ADR-028.
 *
 * On detection:
 *   - GOVERNANCE_ESCALATION_EMITTED with bypass_bridge: true (direct Faheem escalation)
 *   - Breach event logged to Tamper-Evident Audit Log
 *   - No execution of the deny-list action (structurally blocked)
 *
 * Level 1 — Containment Architecture Failure.
 * The deny list is constitutionally mandated — no authorization pathway exists.
 *
 * Governed by: PACS-VALIDATION-001 INJ-004, System Charter Section 9,
 *              ADR-028 (Vault deny list)
 */

import { randomUUID } from "node:crypto";
import { auditLog } from "./audit-log.js";

// ---------------------------------------------------------------------------
// Deny list — System Charter Section 9 non-negotiables + Vault sandbox config
// ---------------------------------------------------------------------------

/**
 * Vault deny list per ADR-028 and System Charter Section 9.
 * These actions may never execute regardless of any authorization pathway.
 */
export const VAULT_DENY_LIST: readonly string[] = [
  // OpenClaw sandbox tool deny list (ADR-028 tools.deny)
  "exec",
  "process",
  "browser",
  "canvas",
  "gateway",
  "nodes",
  // System Charter Section 9 non-negotiables
  "margin_trading",
  "autonomous_capital_deployment",
  "direct_brokerage_execution",
  "external_financial_write",
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DenyListBreachAttemptEvent = {
  event_id: string;
  attempted_action: string;
  agent_id: string;
  timestamp: string;
};

export type G002EscalationEvent = {
  event_class: "GOVERNANCE";
  event_type: "GOVERNANCE_ESCALATION_EMITTED";
  escalation_id: string;
  rule_id: "G-002";
  producer: "Vault";
  timestamp: string;
  bypass_bridge: true;
  attempted_action: string;
  agent_id: string;
  violation_detail: string;
  execution_occurred: false;
};

export type G002CheckResult =
  | { breach_detected: false }
  | { breach_detected: true; escalation: G002EscalationEvent; audit_entry_id: string };

// ---------------------------------------------------------------------------
// G002DenyListDetector
// ---------------------------------------------------------------------------

/**
 * Detects deny-list breach attempts and emits direct Faheem escalations.
 *
 * When a deny-list breach attempt is detected:
 *   1. GOVERNANCE_ESCALATION_EMITTED with bypass_bridge: true
 *   2. Breach event logged to Tamper-Evident Audit Log
 *   3. No execution — the action is structurally blocked
 *
 * Level 1 — Containment Architecture Failure.
 * The deny list is constitutionally mandated — no authorization pathway exists.
 */
export class G002DenyListDetector {
  private readonly escalations: G002EscalationEvent[] = [];

  /**
   * Checks whether an attempted action is on the deny list.
   * If denied: emits escalation event and logs to audit chain.
   */
  checkAction(event: DenyListBreachAttemptEvent): G002CheckResult {
    const isDenied = VAULT_DENY_LIST.includes(event.attempted_action);

    if (!isDenied) {
      return { breach_detected: false };
    }

    const escalation: G002EscalationEvent = {
      event_class: "GOVERNANCE",
      event_type: "GOVERNANCE_ESCALATION_EMITTED",
      escalation_id: randomUUID(),
      rule_id: "G-002",
      producer: "Vault",
      timestamp: new Date().toISOString(),
      bypass_bridge: true,
      attempted_action: event.attempted_action,
      agent_id: event.agent_id,
      violation_detail:
        `Deny-list action attempted: "${event.attempted_action}" by agent "${event.agent_id}". ` +
        `Action structurally blocked. Direct Faheem escalation. No execution occurred. ` +
        `Level 1 — Containment Architecture Failure.`,
      execution_occurred: false,
    };

    this.escalations.push(escalation);

    // Log to audit chain — deny list breaches are tamper-evident governance events
    const writeResult = auditLog.write({
      producer_agent: event.agent_id,
      decision_id: event.event_id,
      decision_class: "routing",
      payload: {
        deny_list_breach: true,
        rule_id: "G-002",
        attempted_action: event.attempted_action,
        escalation_id: escalation.escalation_id,
        execution_occurred: false,
      },
    });

    const audit_entry_id = writeResult.write_confirmed ? writeResult.entry_id : "write_failed";

    return { breach_detected: true, escalation, audit_entry_id };
  }

  getEscalations(): readonly G002EscalationEvent[] {
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

export const g002DenyListDetector = new G002DenyListDetector();
