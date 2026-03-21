/**
 * continuum/governance/gau-001-coverage-gap.ts
 *
 * PACS-VALIDATION-001 INJ-011 detection surface.
 * GAU-001 — Coverage Gap: Active Agent Telemetry Absent.
 *
 * Detects when one or more registered active agents produce no telemetry
 * for a full report cycle window.
 *
 * Window check is explicit: call checkWindowExpiry(tick) to close the cycle.
 * Resets the reported-agents set for the next cycle after firing.
 * No background scheduler. No timers.
 *
 * On detection:
 *   - GOVERNANCE_ESCALATION_EMITTED with bridge_notified: true
 *   - Coverage rate drops below 1.0
 *   - Absent agents identified by name
 *
 * Level 2 — Governance Process Failure.
 *
 * Governed by: PACS-VALIDATION-001 INJ-011
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentTelemetryEvent = {
  event_id: string;
  agent_id: string;
  timestamp: string;
};

export type Gau001AlertEvent = {
  event_class: "GOVERNANCE";
  event_type: "GOVERNANCE_ESCALATION_EMITTED";
  alert_id: string;
  rule_id: "GAU-001";
  producer: "Gauge";
  timestamp: string;
  absent_agents: string[];
  coverage_rate: number;
  violation_detail: string;
  bridge_notified: true;
};

export type Gau001CycleResult =
  | { rule_fired: false; coverage_rate: 1 }
  | { rule_fired: true; alert: Gau001AlertEvent; coverage_rate: number };

// ---------------------------------------------------------------------------
// Gau001CoverageGapDetector
// ---------------------------------------------------------------------------

export class Gau001CoverageGapDetector {
  private readonly expectedAgents = new Set<string>();
  private readonly reportedAgents = new Set<string>();
  private readonly alerts: Gau001AlertEvent[] = [];

  /**
   * Registers the set of active agents expected to report each cycle.
   * Additive — existing registrations are preserved.
   */
  registerActiveAgents(agentIds: string[]): void {
    for (const id of agentIds) {
      this.expectedAgents.add(id);
    }
  }

  /**
   * Records a telemetry event from an agent. Marks the agent as having
   * reported in the current cycle.
   */
  registerTelemetry(event: AgentTelemetryEvent): void {
    this.reportedAgents.add(event.agent_id);
  }

  /**
   * Closes the cycle. Agents in expectedAgents that have not reported are
   * identified as absent. If any agents are absent, GAU-001 fires.
   *
   * Reported agents are reset after firing so the next cycle starts clean.
   * Expected agents are preserved (the active set does not change between cycles).
   *
   * @param tick - Timestamp at cycle close (ISO string). Used in alert timestamp.
   */
  checkWindowExpiry(tick: string): Gau001CycleResult {
    const absentAgents = [...this.expectedAgents].filter((id) => !this.reportedAgents.has(id));

    const coverageRate =
      this.expectedAgents.size > 0
        ? (this.expectedAgents.size - absentAgents.length) / this.expectedAgents.size
        : 1;

    // Reset reported agents for the next cycle
    this.reportedAgents.clear();

    if (absentAgents.length === 0) {
      return { rule_fired: false, coverage_rate: 1 };
    }

    const alert: Gau001AlertEvent = {
      event_class: "GOVERNANCE",
      event_type: "GOVERNANCE_ESCALATION_EMITTED",
      alert_id: randomUUID(),
      rule_id: "GAU-001",
      producer: "Gauge",
      timestamp: tick,
      absent_agents: absentAgents,
      coverage_rate: coverageRate,
      violation_detail:
        `Report cycle closed. ${absentAgents.length} active agent(s) produced no telemetry: ` +
        absentAgents.join(", ") +
        `. Coverage rate: ${coverageRate.toFixed(2)}. Level 2 — Governance Process Failure.`,
      bridge_notified: true,
    };

    this.alerts.push(alert);
    return { rule_fired: true, alert, coverage_rate: coverageRate };
  }

  /**
   * Returns coverage rate for the current (open) cycle.
   * Useful for in-cycle inspection without closing the window.
   */
  getCurrentCoverageRate(): number {
    if (this.expectedAgents.size === 0) {
      return 1;
    }
    const reportedCount = [...this.expectedAgents].filter((id) =>
      this.reportedAgents.has(id),
    ).length;
    return reportedCount / this.expectedAgents.size;
  }

  getAlerts(): readonly Gau001AlertEvent[] {
    return this.alerts;
  }

  alertCount(): number {
    return this.alerts.length;
  }

  /** Resets detector state. For testing only. */
  _resetForTesting(): void {
    this.expectedAgents.clear();
    this.reportedAgents.clear();
    this.alerts.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const gau001CoverageGapDetector = new Gau001CoverageGapDetector();
