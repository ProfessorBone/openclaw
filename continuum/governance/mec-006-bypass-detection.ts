/**
 * continuum/governance/mec-006-bypass-detection.ts
 *
 * PACS-VALIDATION-001 INJ-002 detection surface.
 * MEC-006 — Governance bypass detection.
 *
 * Detects when a protected decision (MEMORY_COMMIT_EXECUTED, SUMMARY_EMITTED,
 * ESCALATION_EXECUTED) is executed without a paired ADJUDICATION_COMPLETED
 * event bearing matching decision_id and outcome=approved.
 *
 * On detection:
 *   - GOVERNANCE_ESCALATION_EMITTED with bypass_bridge: true
 *   - Bypass event logged to Tamper-Evident Audit Log (preserves chain integrity
 *     even through a governance bypass scenario)
 *
 * Level 1 — Containment Architecture Failure.
 *
 * Governed by: PACS-VALIDATION-001 INJ-002, Meta-Evaluation-Checkpoint.md MEC-006
 */

import { randomUUID } from "node:crypto";
import { auditLog } from "./audit-log.js";
import type { ProtectedDecisionClass } from "./mec-fail-closed.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdjudicationRecord = {
  adjudication_id: string;
  decision_id: string;
  outcome: "approved" | "rejected" | "escalated";
  timestamp: string;
};

export type ProtectedDecisionExecutionEvent = {
  event_type: "MEMORY_COMMIT_EXECUTED" | "SUMMARY_EMITTED" | "ESCALATION_EXECUTED";
  decision_id: string;
  decision_class: ProtectedDecisionClass;
  producer_agent: string;
  timestamp: string;
};

export type Mec006EscalationEvent = {
  event_class: "GOVERNANCE";
  event_type: "GOVERNANCE_ESCALATION_EMITTED";
  escalation_id: string;
  rule_id: "MEC-006";
  producer: "MEC";
  timestamp: string;
  bypass_bridge: true;
  decision_id: string;
  execution_event_type: string;
  violation_detail: string;
};

export type Mec006CheckResult =
  | { bypass_detected: false }
  | { bypass_detected: true; escalation: Mec006EscalationEvent; audit_entry_id: string };

// ---------------------------------------------------------------------------
// Mec006BypassDetector
// ---------------------------------------------------------------------------

/**
 * Detects governance bypasses: protected decisions executed without a paired
 * ADJUDICATION_COMPLETED with outcome=approved.
 *
 * Maintains a registry of adjudication records. When a protected decision
 * execution event arrives, checks for a valid adjudication pairing.
 * If none found: emits GOVERNANCE_ESCALATION_EMITTED and logs to audit chain.
 *
 * Level 1 — Containment Architecture Failure.
 */
export class Mec006BypassDetector {
  private readonly adjudicationRecords = new Map<string, AdjudicationRecord>();
  private readonly escalations: Mec006EscalationEvent[] = [];

  // ---------------------------------------------------------------------------
  // Adjudication registry
  // ---------------------------------------------------------------------------

  /**
   * Registers an ADJUDICATION_COMPLETED record.
   * Must be called before the corresponding protected decision execution
   * for the decision to be considered legitimately adjudicated.
   */
  registerAdjudication(record: AdjudicationRecord): void {
    this.adjudicationRecords.set(record.decision_id, record);
  }

  // ---------------------------------------------------------------------------
  // Bypass detection (INJ-002 enforcement surface)
  // ---------------------------------------------------------------------------

  /**
   * Checks a protected decision execution event for governance bypass.
   *
   * A bypass is detected when:
   *   - No ADJUDICATION_COMPLETED record exists for the decision_id, OR
   *   - The adjudication outcome is not "approved"
   *
   * On bypass detection:
   *   1. GOVERNANCE_ESCALATION_EMITTED with bypass_bridge: true
   *   2. Bypass event written to Tamper-Evident Audit Log
   */
  checkProtectedDecisionExecution(event: ProtectedDecisionExecutionEvent): Mec006CheckResult {
    const adjudication = this.adjudicationRecords.get(event.decision_id);
    if (adjudication?.outcome === "approved") {
      return { bypass_detected: false };
    }

    const escalation: Mec006EscalationEvent = {
      event_class: "GOVERNANCE",
      event_type: "GOVERNANCE_ESCALATION_EMITTED",
      escalation_id: randomUUID(),
      rule_id: "MEC-006",
      producer: "MEC",
      timestamp: new Date().toISOString(),
      bypass_bridge: true,
      decision_id: event.decision_id,
      execution_event_type: event.event_type,
      violation_detail:
        `${event.event_type} with decision_id=${event.decision_id} executed without ` +
        `paired ADJUDICATION_COMPLETED (outcome=approved). ` +
        `MEC-006 governance bypass detected. Level 1 — Containment Architecture Failure.`,
    };

    this.escalations.push(escalation);

    // Log bypass to audit chain — preserves tamper-evident record of the bypass detection
    const writeResult = auditLog.write({
      producer_agent: event.producer_agent,
      decision_id: event.decision_id,
      decision_class: event.decision_class,
      payload: {
        governance_bypass: true,
        rule_id: "MEC-006",
        execution_event_type: event.event_type,
        escalation_id: escalation.escalation_id,
      },
    });

    const audit_entry_id = writeResult.write_confirmed ? writeResult.entry_id : "write_failed";

    return { bypass_detected: true, escalation, audit_entry_id };
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  getEscalations(): readonly Mec006EscalationEvent[] {
    return this.escalations;
  }

  escalationCount(): number {
    return this.escalations.length;
  }

  /** Resets detector state. For testing only. */
  _resetForTesting(): void {
    this.adjudicationRecords.clear();
    this.escalations.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const mec006BypassDetector = new Mec006BypassDetector();
