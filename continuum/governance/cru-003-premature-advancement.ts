/**
 * continuum/governance/cru-003-premature-advancement.ts
 *
 * PACS-VALIDATION-001 INJ-018 detection surface.
 * CRU-003 — Premature Curriculum Advancement.
 *
 * Detects CURRICULUM_POSITION_ADVANCED events where no preceding
 * LEARNING_CONTENT_DELIVERED event with confirmed learner evidence exists
 * for the same learner_id in the current session.
 *
 * On detection:
 *   - GOVERNANCE_ESCALATION_EMITTED with bridge_notified: true
 *   - premature_advancement_count increments above zero
 *
 * Level 3 — Analytical Performance Degradation.
 *
 * Governed by: PACS-VALIDATION-001 INJ-018
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LearningContentDeliveredEvent = {
  event_id: string;
  learner_id: string;
  content_id: string;
  learner_evidence_confirmed: boolean;
  timestamp: string;
};

export type CurriculumPositionAdvancedEvent = {
  event_id: string;
  learner_id: string;
  agent_id: string;
  timestamp: string;
};

export type Cru003AlertEvent = {
  event_class: "GOVERNANCE";
  event_type: "GOVERNANCE_ESCALATION_EMITTED";
  alert_id: string;
  rule_id: "CRU-003";
  producer: "Crucible";
  timestamp: string;
  learner_id: string;
  agent_id: string;
  violation_detail: string;
  bridge_notified: true;
};

export type Cru003CheckResult =
  | { compliant: true }
  | { compliant: false; alert: Cru003AlertEvent; premature_advancement_count: number };

// ---------------------------------------------------------------------------
// Cru003PrematureAdvancementDetector
// ---------------------------------------------------------------------------

export class Cru003PrematureAdvancementDetector {
  /** learner_ids that have a confirmed delivery in the current session */
  private readonly confirmedDeliveries = new Set<string>();
  private prematureAdvancementCount = 0;
  private readonly alerts: Cru003AlertEvent[] = [];

  /**
   * Records a LEARNING_CONTENT_DELIVERED event.
   * Registers the learner_id as having confirmed delivery only if
   * learner_evidence_confirmed is true.
   */
  registerLearningContentDelivered(event: LearningContentDeliveredEvent): void {
    if (event.learner_evidence_confirmed) {
      this.confirmedDeliveries.add(event.learner_id);
    }
  }

  /**
   * Checks a CURRICULUM_POSITION_ADVANCED event for a prior confirmed delivery.
   * Returns compliant: true if the learner_id has a confirmed delivery record.
   * Returns compliant: false + alert + updated count otherwise.
   */
  checkCurriculumAdvancement(event: CurriculumPositionAdvancedEvent): Cru003CheckResult {
    if (this.confirmedDeliveries.has(event.learner_id)) {
      return { compliant: true };
    }

    this.prematureAdvancementCount++;

    const alert: Cru003AlertEvent = {
      event_class: "GOVERNANCE",
      event_type: "GOVERNANCE_ESCALATION_EMITTED",
      alert_id: randomUUID(),
      rule_id: "CRU-003",
      producer: "Crucible",
      timestamp: event.timestamp,
      learner_id: event.learner_id,
      agent_id: event.agent_id,
      violation_detail:
        `CURRICULUM_POSITION_ADVANCED for learner "${event.learner_id}" by agent "${event.agent_id}" ` +
        `with no preceding LEARNING_CONTENT_DELIVERED with confirmed learner evidence ` +
        `in the current session. Premature advancement without demonstrated readiness. ` +
        `Bridge notified. Level 3 — Analytical Performance Degradation.`,
      bridge_notified: true,
    };

    this.alerts.push(alert);
    return {
      compliant: false,
      alert,
      premature_advancement_count: this.prematureAdvancementCount,
    };
  }

  getPrematureAdvancementCount(): number {
    return this.prematureAdvancementCount;
  }

  getAlerts(): readonly Cru003AlertEvent[] {
    return this.alerts;
  }

  alertCount(): number {
    return this.alerts.length;
  }

  /** Resets detector state. For testing only. */
  _resetForTesting(): void {
    this.confirmedDeliveries.clear();
    this.prematureAdvancementCount = 0;
    this.alerts.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const cru003PrematureAdvancementDetector = new Cru003PrematureAdvancementDetector();
