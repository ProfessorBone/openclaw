/**
 * continuum/governance/loc-001-graph-auth.ts
 *
 * PACS-VALIDATION-001 INJ-020 detection surface.
 * LOC-001 — Graph Write Without Authorization.
 *
 * Detects GRAPH_WRITE_EXECUTED events with no paired GRAPH_WRITE_AUTHORIZED
 * bearing a matching write_id.
 *
 * All Locus graph writes route through Bridge MEMORY_COMMIT_AUTH and MEC
 * adjudication. A write executed without a prior authorization record is
 * a governance process failure.
 *
 * On detection:
 *   - GOVERNANCE_ESCALATION_EMITTED with bridge_notified: true
 *   - Unauthorized write rate increments above zero
 *
 * Level 2 — Governance Process Failure.
 *
 * Governed by: PACS-VALIDATION-001 INJ-020
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GraphWriteAuthorizedEvent = {
  event_id: string;
  write_id: string;
  timestamp: string;
};

export type GraphWriteExecutedEvent = {
  event_id: string;
  write_id: string;
  agent_id: string;
  timestamp: string;
};

export type Loc001AlertEvent = {
  event_class: "GOVERNANCE";
  event_type: "GOVERNANCE_ESCALATION_EMITTED";
  alert_id: string;
  rule_id: "LOC-001";
  producer: "Locus";
  timestamp: string;
  write_id: string;
  agent_id: string;
  violation_detail: string;
  bridge_notified: true;
  unauthorized_write: true;
};

export type Loc001CheckResult =
  | { authorized: true }
  | {
      authorized: false;
      alert: Loc001AlertEvent;
      unauthorized_write_rate: number;
    };

// ---------------------------------------------------------------------------
// Loc001GraphAuthDetector
// ---------------------------------------------------------------------------

export class Loc001GraphAuthDetector {
  private readonly authorizedWriteIds = new Set<string>();
  private totalExecutedWrites = 0;
  private unauthorizedWriteCount = 0;
  private readonly alerts: Loc001AlertEvent[] = [];

  /**
   * Records a GRAPH_WRITE_AUTHORIZED event.
   * Registers the write_id as authorized for subsequent execution.
   */
  registerGraphWriteAuthorized(event: GraphWriteAuthorizedEvent): void {
    this.authorizedWriteIds.add(event.write_id);
  }

  /**
   * Checks a GRAPH_WRITE_EXECUTED event for a prior GRAPH_WRITE_AUTHORIZED.
   * Returns authorized: true if a matching authorization exists.
   * Returns authorized: false + alert + updated unauthorized write rate otherwise.
   */
  checkGraphWriteExecuted(event: GraphWriteExecutedEvent): Loc001CheckResult {
    this.totalExecutedWrites++;

    if (this.authorizedWriteIds.has(event.write_id)) {
      return { authorized: true };
    }

    this.unauthorizedWriteCount++;
    const rate =
      this.totalExecutedWrites > 0 ? this.unauthorizedWriteCount / this.totalExecutedWrites : 0;

    const alert: Loc001AlertEvent = {
      event_class: "GOVERNANCE",
      event_type: "GOVERNANCE_ESCALATION_EMITTED",
      alert_id: randomUUID(),
      rule_id: "LOC-001",
      producer: "Locus",
      timestamp: event.timestamp,
      write_id: event.write_id,
      agent_id: event.agent_id,
      violation_detail:
        `GRAPH_WRITE_EXECUTED for write_id="${event.write_id}" by agent "${event.agent_id}" ` +
        `has no paired GRAPH_WRITE_AUTHORIZED with matching write_id. ` +
        `All graph writes must route through Bridge MEMORY_COMMIT_AUTH and MEC adjudication. ` +
        `Unauthorized graph write. Level 2 — Governance Process Failure.`,
      bridge_notified: true,
      unauthorized_write: true,
    };

    this.alerts.push(alert);
    return { authorized: false, alert, unauthorized_write_rate: rate };
  }

  getUnauthorizedWriteCount(): number {
    return this.unauthorizedWriteCount;
  }

  getUnauthorizedWriteRate(): number {
    return this.totalExecutedWrites > 0
      ? this.unauthorizedWriteCount / this.totalExecutedWrites
      : 0;
  }

  getAlerts(): readonly Loc001AlertEvent[] {
    return this.alerts;
  }

  alertCount(): number {
    return this.alerts.length;
  }

  /** Resets detector state. For testing only. */
  _resetForTesting(): void {
    this.authorizedWriteIds.clear();
    this.totalExecutedWrites = 0;
    this.unauthorizedWriteCount = 0;
    this.alerts.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const loc001GraphAuthDetector = new Loc001GraphAuthDetector();
