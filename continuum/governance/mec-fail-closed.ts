/**
 * continuum/governance/mec-fail-closed.ts
 *
 * Work Order 6 — Failure Injection Readiness Gate (INJ-021)
 * Minimal Stage 3 MEC Availability Guard — fail-closed enforcement.
 *
 * When MEC is unavailable, all protected decision classes must halt immediately.
 * FAIL_CLOSED_TRIGGERED event fires on first unavailability detection.
 *
 * Three protected decision classes per PACS-ARCH-AUDIT-001 and TC-BRIDGE-005:
 *   - SUMMARY_EMISSION
 *   - MEMORY_COMMIT_AUTH
 *   - ESCALATION_DECISION
 *
 * Routing decisions (decision_class: "routing") are NOT frozen by MEC unavailability —
 * only protected decision classes freeze.
 *
 * Per PACS-ARCH-AUDIT-001 Section 5:
 * "No retry-and-proceed. The freeze is not a retry loop."
 * "Do not proceed with the protected decision on the assumption that
 *  the write will eventually succeed."
 *
 * Governed by: PACS-VALIDATION-001 INJ-021, PACS-ARCH-AUDIT-001 Section 5
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProtectedDecisionClass =
  | "SUMMARY_EMISSION"
  | "MEMORY_COMMIT_AUTH"
  | "ESCALATION_DECISION";

export type RoutingDecisionClass = "routing";

export type AnyDecisionClass = ProtectedDecisionClass | RoutingDecisionClass;

const PROTECTED_DECISION_CLASSES = new Set<AnyDecisionClass>([
  "SUMMARY_EMISSION",
  "MEMORY_COMMIT_AUTH",
  "ESCALATION_DECISION",
]);

export function isProtectedDecisionClass(cls: AnyDecisionClass): cls is ProtectedDecisionClass {
  return PROTECTED_DECISION_CLASSES.has(cls);
}

export type FailClosedEvent = {
  event_class: "GOVERNANCE";
  event_type: "FAIL_CLOSED_TRIGGERED";
  event_id: string;
  producer: "MEC";
  timestamp: string;
  condition_detail: string;
  blocked_decision_class: ProtectedDecisionClass;
  bypass_bridge: false;
};

export type MecDecisionCheckResult =
  | { allowed: true }
  | { allowed: false; reason: MecDenialReason; fail_closed_event?: FailClosedEvent };

export type MecDenialReason = "mec_unavailable" | "mec_frozen";

// ---------------------------------------------------------------------------
// MecAvailabilityGuard
// ---------------------------------------------------------------------------

/**
 * Stage 3 minimum viable MEC Availability Guard.
 *
 * Tracks MEC availability state and blocks protected decisions
 * when MEC is unavailable or frozen.
 *
 * Fires FAIL_CLOSED_TRIGGERED on first unavailability detection per
 * protected decision class per unavailability window.
 */
export class MecAvailabilityGuard {
  private available = true;
  private failClosedEvents: FailClosedEvent[] = [];
  private failClosedTriggered = false;

  // ---------------------------------------------------------------------------
  // Availability control
  // ---------------------------------------------------------------------------

  setAvailable(available: boolean): void {
    this.available = available;
    if (available) {
      // Recovery: reset fail-closed trigger so new unavailability window
      // will fire again if MEC goes down again
      this.failClosedTriggered = false;
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  // ---------------------------------------------------------------------------
  // Protected decision gate (INJ-021 enforcement surface)
  // ---------------------------------------------------------------------------

  /**
   * Checks whether a protected decision is allowed to proceed.
   *
   * Per PACS-ARCH-AUDIT-001 Section 5 Freeze Protocol:
   *   - Routing decisions continue when MEC is unavailable
   *   - Protected decisions freeze immediately
   *   - FAIL_CLOSED_TRIGGERED fires on first blocked attempt per window
   */
  checkDecision(decisionClass: AnyDecisionClass): MecDecisionCheckResult {
    // Routing decisions are never frozen by MEC unavailability
    if (!isProtectedDecisionClass(decisionClass)) {
      return { allowed: true };
    }

    // MEC available — allow
    if (this.available) {
      return { allowed: true };
    }

    // MEC unavailable — block and emit FAIL_CLOSED_TRIGGERED
    const failClosedEvent = this.emitFailClosedEvent(decisionClass);

    return {
      allowed: false,
      reason: "mec_unavailable",
      fail_closed_event: failClosedEvent,
    };
  }

  // ---------------------------------------------------------------------------
  // FAIL_CLOSED_TRIGGERED event emission
  // ---------------------------------------------------------------------------

  private emitFailClosedEvent(decisionClass: ProtectedDecisionClass): FailClosedEvent {
    const event: FailClosedEvent = {
      event_class: "GOVERNANCE",
      event_type: "FAIL_CLOSED_TRIGGERED",
      event_id: randomUUID(),
      producer: "MEC",
      timestamp: new Date().toISOString(),
      condition_detail:
        `MEC unavailable. Protected decision class ${decisionClass} blocked. ` +
        `No protected decision may execute until MEC availability is restored ` +
        `and recovery conditions are satisfied per PACS-ARCH-AUDIT-001 Section 5.`,
      blocked_decision_class: decisionClass,
      bypass_bridge: false,
    };

    this.failClosedEvents.push(event);
    this.failClosedTriggered = true;

    return event;
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  wasFailClosedTriggered(): boolean {
    return this.failClosedTriggered;
  }

  getFailClosedEvents(): readonly FailClosedEvent[] {
    return this.failClosedEvents;
  }

  failClosedEventCount(): number {
    return this.failClosedEvents.length;
  }

  /** Resets guard state. For testing only. */
  _resetForTesting(): void {
    this.available = true;
    this.failClosedEvents.length = 0;
    this.failClosedTriggered = false;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const mecAvailabilityGuard = new MecAvailabilityGuard();
