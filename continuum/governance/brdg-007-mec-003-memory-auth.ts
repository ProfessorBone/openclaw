/**
 * continuum/governance/brdg-007-mec-003-memory-auth.ts
 *
 * PACS-VALIDATION-001 INJ-008 detection surface.
 * BRDG-007 — Unauthorized Memory Commit (Bridge monitoring rule).
 * MEC-003  — Missing Authorization (MEC governance rule).
 *
 * One causal surface, two rule outputs.
 *
 * Detects MEMORY_WRITE_EXECUTED events where the commit_token is absent or does
 * not match any ADJUDICATION_COMPLETED (outcome=approved) event. Both BRDG-007
 * and MEC-003 fire together on the same causal event.
 *
 * On detection:
 *   - BRDG-007: GOVERNANCE_ESCALATION_EMITTED (Bridge monitoring), bridge_notified: true
 *   - MEC-003: GOVERNANCE_ESCALATION_EMITTED (MEC authority), bypass_bridge: true
 *   - Unauthorized commit rate increments above zero
 *
 * Level 2 — Governance Process Failure.
 *
 * Governed by: PACS-VALIDATION-001 INJ-008
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdjudicationCompletedEvent = {
  event_id: string;
  commit_token: string;
  outcome: "approved" | "rejected";
  timestamp: string;
};

export type MemoryWriteExecutedEvent = {
  event_id: string;
  write_id: string;
  agent_id: string;
  commit_token?: string | null;
  timestamp: string;
};

export type Brdg007AlertEvent = {
  event_class: "GOVERNANCE";
  event_type: "GOVERNANCE_ESCALATION_EMITTED";
  alert_id: string;
  rule_id: "BRDG-007";
  producer: "Bridge";
  timestamp: string;
  write_id: string;
  agent_id: string;
  violation_detail: string;
  bridge_notified: true;
  unauthorized_commit: true;
};

export type Mec003AlertEvent = {
  event_class: "GOVERNANCE";
  event_type: "GOVERNANCE_ESCALATION_EMITTED";
  alert_id: string;
  rule_id: "MEC-003";
  producer: "MEC";
  timestamp: string;
  write_id: string;
  agent_id: string;
  violation_detail: string;
  bypass_bridge: true;
  authorization_missing: true;
};

export type MemoryAuthCheckResult =
  | { authorized: true }
  | {
      authorized: false;
      brdg007_alert: Brdg007AlertEvent;
      mec003_alert: Mec003AlertEvent;
      unauthorized_commit_rate: number;
      bridge_notified: true;
    };

// ---------------------------------------------------------------------------
// Brdg007Mec003MemoryAuthDetector
// ---------------------------------------------------------------------------

export class Brdg007Mec003MemoryAuthDetector {
  private readonly validTokens = new Set<string>();
  private totalWriteCount = 0;
  private unauthorizedWriteCount = 0;
  private readonly brdg007Alerts: Brdg007AlertEvent[] = [];
  private readonly mec003Alerts: Mec003AlertEvent[] = [];

  /**
   * Records an ADJUDICATION_COMPLETED event.
   * Only approved adjudications register their commit_token as valid.
   */
  registerAdjudication(event: AdjudicationCompletedEvent): void {
    if (event.outcome === "approved") {
      this.validTokens.add(event.commit_token);
    }
  }

  /**
   * Checks a MEMORY_WRITE_EXECUTED event for a valid commit_token.
   * Returns authorized: true if the token matches an approved adjudication.
   * Returns authorized: false + both BRDG-007 and MEC-003 alerts otherwise.
   */
  checkMemoryWrite(event: MemoryWriteExecutedEvent): MemoryAuthCheckResult {
    this.totalWriteCount++;
    const tokenValid =
      event.commit_token != null &&
      event.commit_token !== "" &&
      this.validTokens.has(event.commit_token);

    if (tokenValid) {
      return { authorized: true };
    }

    this.unauthorizedWriteCount++;
    const rate = this.totalWriteCount > 0 ? this.unauthorizedWriteCount / this.totalWriteCount : 0;

    const brdg007Alert: Brdg007AlertEvent = {
      event_class: "GOVERNANCE",
      event_type: "GOVERNANCE_ESCALATION_EMITTED",
      alert_id: randomUUID(),
      rule_id: "BRDG-007",
      producer: "Bridge",
      timestamp: event.timestamp,
      write_id: event.write_id,
      agent_id: event.agent_id,
      violation_detail:
        `MEMORY_WRITE_EXECUTED for write_id="${event.write_id}" by agent "${event.agent_id}" ` +
        `has no valid commit_token matching an ADJUDICATION_COMPLETED (outcome=approved) record. ` +
        `Unauthorized memory commit. Level 2 — Governance Process Failure.`,
      bridge_notified: true,
      unauthorized_commit: true,
    };

    const mec003Alert: Mec003AlertEvent = {
      event_class: "GOVERNANCE",
      event_type: "GOVERNANCE_ESCALATION_EMITTED",
      alert_id: randomUUID(),
      rule_id: "MEC-003",
      producer: "MEC",
      timestamp: event.timestamp,
      write_id: event.write_id,
      agent_id: event.agent_id,
      violation_detail:
        `MEC-003: memory write authorization missing for write_id="${event.write_id}" ` +
        `by agent "${event.agent_id}". No approved adjudication commit_token found. ` +
        `Bypass bridge — direct MEC escalation. Level 2 — Governance Process Failure.`,
      bypass_bridge: true,
      authorization_missing: true,
    };

    this.brdg007Alerts.push(brdg007Alert);
    this.mec003Alerts.push(mec003Alert);
    return {
      authorized: false,
      brdg007_alert: brdg007Alert,
      mec003_alert: mec003Alert,
      unauthorized_commit_rate: rate,
      bridge_notified: true,
    };
  }

  getUnauthorizedWriteCount(): number {
    return this.unauthorizedWriteCount;
  }

  getUnauthorizedWriteRate(): number {
    return this.totalWriteCount > 0 ? this.unauthorizedWriteCount / this.totalWriteCount : 0;
  }

  brdg007AlertCount(): number {
    return this.brdg007Alerts.length;
  }

  mec003AlertCount(): number {
    return this.mec003Alerts.length;
  }

  /** Resets detector state. For testing only. */
  _resetForTesting(): void {
    this.validTokens.clear();
    this.totalWriteCount = 0;
    this.unauthorizedWriteCount = 0;
    this.brdg007Alerts.length = 0;
    this.mec003Alerts.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const brdg007Mec003MemoryAuthDetector = new Brdg007Mec003MemoryAuthDetector();
