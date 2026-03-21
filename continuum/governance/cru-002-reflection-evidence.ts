/**
 * continuum/governance/cru-002-reflection-evidence.ts
 *
 * PACS-VALIDATION-001 INJ-012 detection surface.
 * CRU-002 — Reflection Without Evidence.
 *
 * Detects REFLECTION_CANDIDATE_FORMED events where learner_evidence_used
 * is null, undefined, or an empty array. Inferred comprehension is not a
 * valid basis for reflection — demonstrated learner evidence is required.
 *
 * On detection:
 *   - GOVERNANCE_ESCALATION_EMITTED with bridge_notified: true
 *   - null_reflection_count increments
 *   - Evidence-linked reflection rate drops below 100%
 *
 * Level 2 — Governance Process Failure.
 *
 * Governed by: PACS-VALIDATION-001 INJ-012
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReflectionCandidateFormedEvent = {
  event_id: string;
  candidate_id: string;
  agent_id: string;
  learner_evidence_used: string[] | null | undefined;
  timestamp: string;
};

export type Cru002AlertEvent = {
  event_class: "GOVERNANCE";
  event_type: "GOVERNANCE_ESCALATION_EMITTED";
  alert_id: string;
  rule_id: "CRU-002";
  producer: "Crucible";
  timestamp: string;
  candidate_id: string;
  agent_id: string;
  violation_detail: string;
  bridge_notified: true;
};

export type Cru002CheckResult =
  | { compliant: true }
  | {
      compliant: false;
      alert: Cru002AlertEvent;
      null_reflection_count: number;
      evidence_linked_rate: number;
    };

// ---------------------------------------------------------------------------
// Cru002ReflectionEvidenceDetector
// ---------------------------------------------------------------------------

export class Cru002ReflectionEvidenceDetector {
  private nullReflectionCount = 0;
  private totalReflectionCount = 0;
  private readonly alerts: Cru002AlertEvent[] = [];

  /**
   * Checks a REFLECTION_CANDIDATE_FORMED event for learner evidence.
   * Returns compliant: true if learner_evidence_used is a non-empty array.
   * Returns compliant: false + alert + updated counters otherwise.
   */
  checkReflectionCandidate(event: ReflectionCandidateFormedEvent): Cru002CheckResult {
    this.totalReflectionCount++;

    const hasEvidence =
      Array.isArray(event.learner_evidence_used) && event.learner_evidence_used.length > 0;

    if (hasEvidence) {
      return { compliant: true };
    }

    this.nullReflectionCount++;
    const evidenceLinkedRate =
      this.totalReflectionCount > 0
        ? (this.totalReflectionCount - this.nullReflectionCount) / this.totalReflectionCount
        : 1;

    const alert: Cru002AlertEvent = {
      event_class: "GOVERNANCE",
      event_type: "GOVERNANCE_ESCALATION_EMITTED",
      alert_id: randomUUID(),
      rule_id: "CRU-002",
      producer: "Crucible",
      timestamp: event.timestamp,
      candidate_id: event.candidate_id,
      agent_id: event.agent_id,
      violation_detail:
        `REFLECTION_CANDIDATE_FORMED (candidate_id="${event.candidate_id}") by agent "${event.agent_id}" ` +
        `has null or empty learner_evidence_used. ` +
        `Inferred comprehension is not a valid basis for reflection — demonstrated evidence is required. ` +
        `Premature closure is the primary epistemic failure mode. ` +
        `Level 2 — Governance Process Failure.`,
      bridge_notified: true,
    };

    this.alerts.push(alert);
    return {
      compliant: false,
      alert,
      null_reflection_count: this.nullReflectionCount,
      evidence_linked_rate: evidenceLinkedRate,
    };
  }

  getNullReflectionCount(): number {
    return this.nullReflectionCount;
  }

  getEvidenceLinkedRate(): number {
    return this.totalReflectionCount > 0
      ? (this.totalReflectionCount - this.nullReflectionCount) / this.totalReflectionCount
      : 1;
  }

  getAlerts(): readonly Cru002AlertEvent[] {
    return this.alerts;
  }

  alertCount(): number {
    return this.alerts.length;
  }

  /** Resets detector state. For testing only. */
  _resetForTesting(): void {
    this.nullReflectionCount = 0;
    this.totalReflectionCount = 0;
    this.alerts.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const cru002ReflectionEvidenceDetector = new Cru002ReflectionEvidenceDetector();
