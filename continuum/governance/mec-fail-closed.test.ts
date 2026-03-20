/**
 * continuum/governance/mec-fail-closed.test.ts
 *
 * Work Order 6 — INJ-021: MEC Availability Failure (Fail-Closed Verification)
 *
 * Simulates the exact INJ-021 injection scenario:
 *   1. Set MEC to unavailable
 *   2. Attempt to execute each protected decision class
 *   3. Assert: FAIL_CLOSED_TRIGGERED fires, all protected decisions halt,
 *      routing decisions continue
 *
 * Also tests recovery: MEC comes back online, protected decisions resume.
 *
 * Run: pnpm vitest run --config vitest.continuum.config.ts
 */

import { describe, expect, it, beforeEach } from "vitest";
import { MecAvailabilityGuard } from "./mec-fail-closed.js";

// ---------------------------------------------------------------------------
// Normal path tests
// ---------------------------------------------------------------------------

describe("MecAvailabilityGuard — normal path (MEC available)", () => {
  let guard: MecAvailabilityGuard;

  beforeEach(() => {
    guard = new MecAvailabilityGuard();
  });

  it("allows SUMMARY_EMISSION when MEC is available", () => {
    const result = guard.checkDecision("SUMMARY_EMISSION");
    expect(result.allowed).toBe(true);
  });

  it("allows MEMORY_COMMIT_AUTH when MEC is available", () => {
    const result = guard.checkDecision("MEMORY_COMMIT_AUTH");
    expect(result.allowed).toBe(true);
  });

  it("allows ESCALATION_DECISION when MEC is available", () => {
    const result = guard.checkDecision("ESCALATION_DECISION");
    expect(result.allowed).toBe(true);
  });

  it("allows routing decisions when MEC is available", () => {
    const result = guard.checkDecision("routing");
    expect(result.allowed).toBe(true);
  });

  it("does not fire FAIL_CLOSED_TRIGGERED when MEC is available", () => {
    guard.checkDecision("SUMMARY_EMISSION");
    guard.checkDecision("MEMORY_COMMIT_AUTH");
    guard.checkDecision("ESCALATION_DECISION");
    expect(guard.wasFailClosedTriggered()).toBe(false);
    expect(guard.failClosedEventCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// INJ-021 — MEC Availability Failure: Fail-Closed Verification
// ---------------------------------------------------------------------------

describe("INJ-021 — MEC Availability Failure: Fail-Closed", () => {
  let guard: MecAvailabilityGuard;

  beforeEach(() => {
    guard = new MecAvailabilityGuard();
  });

  /**
   * INJ-021 pass criterion 1: FAIL_CLOSED_TRIGGERED fires immediately
   * on MEC unavailability detection
   */
  it("fires FAIL_CLOSED_TRIGGERED immediately when MEC goes unavailable", () => {
    // INJ-021 inject: take MEC offline
    guard.setAvailable(false);

    // Attempt protected decision
    const result = guard.checkDecision("SUMMARY_EMISSION");

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe("mec_unavailable");
      expect(result.fail_closed_event).toBeDefined();
      expect(result.fail_closed_event?.event_type).toBe("FAIL_CLOSED_TRIGGERED");
      expect(result.fail_closed_event?.event_class).toBe("GOVERNANCE");
      expect(result.fail_closed_event?.producer).toBe("MEC");
    }
  });

  /**
   * INJ-021 pass criterion 2: ALL three protected decision classes halt
   */
  it("halts all three protected decision classes when MEC is unavailable", () => {
    guard.setAvailable(false);

    const summaryResult = guard.checkDecision("SUMMARY_EMISSION");
    const memoryResult = guard.checkDecision("MEMORY_COMMIT_AUTH");
    const escalationResult = guard.checkDecision("ESCALATION_DECISION");

    expect(summaryResult.allowed).toBe(false);
    expect(memoryResult.allowed).toBe(false);
    expect(escalationResult.allowed).toBe(false);
  });

  /**
   * INJ-021 pass criterion 3: No protected decision executes during unavailability window
   * (confirmed by allowed: false on every check)
   */
  it("blocks all protected decisions throughout the unavailability window", () => {
    guard.setAvailable(false);

    // Multiple attempts — all must be blocked
    for (let i = 0; i < 5; i++) {
      expect(guard.checkDecision("SUMMARY_EMISSION").allowed).toBe(false);
      expect(guard.checkDecision("MEMORY_COMMIT_AUTH").allowed).toBe(false);
      expect(guard.checkDecision("ESCALATION_DECISION").allowed).toBe(false);
    }
  });

  /**
   * Routing decisions continue during MEC unavailability
   * Per PACS-ARCH-AUDIT-001 Section 5: "Routing decisions continue when
   * they do not constitute protected decisions"
   */
  it("allows routing decisions to continue when MEC is unavailable", () => {
    guard.setAvailable(false);
    const result = guard.checkDecision("routing");
    expect(result.allowed).toBe(true);
  });

  /**
   * FAIL_CLOSED_TRIGGERED carries correct fields
   */
  it("FAIL_CLOSED_TRIGGERED event has required fields", () => {
    guard.setAvailable(false);
    const result = guard.checkDecision("MEMORY_COMMIT_AUTH");

    if (!result.allowed && result.fail_closed_event) {
      const event = result.fail_closed_event;
      expect(event.event_id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.blocked_decision_class).toBe("MEMORY_COMMIT_AUTH");
      expect(event.condition_detail).toContain("MEMORY_COMMIT_AUTH");
      expect(event.bypass_bridge).toBe(false);
    } else {
      throw new Error("Expected fail_closed_event to be present");
    }
  });

  /**
   * wasFailClosedTriggered() returns true after any block
   */
  it("wasFailClosedTriggered() returns true after first blocked decision", () => {
    guard.setAvailable(false);
    expect(guard.wasFailClosedTriggered()).toBe(false);
    guard.checkDecision("ESCALATION_DECISION");
    expect(guard.wasFailClosedTriggered()).toBe(true);
  });

  /**
   * Each protected decision attempt during unavailability generates a FAIL_CLOSED event
   */
  it("emits a FAIL_CLOSED_TRIGGERED event for each blocked attempt", () => {
    guard.setAvailable(false);

    guard.checkDecision("SUMMARY_EMISSION");
    guard.checkDecision("MEMORY_COMMIT_AUTH");
    guard.checkDecision("ESCALATION_DECISION");

    expect(guard.failClosedEventCount()).toBe(3);
    const events = guard.getFailClosedEvents();
    expect(events[0].blocked_decision_class).toBe("SUMMARY_EMISSION");
    expect(events[1].blocked_decision_class).toBe("MEMORY_COMMIT_AUTH");
    expect(events[2].blocked_decision_class).toBe("ESCALATION_DECISION");
  });
});

// ---------------------------------------------------------------------------
// Recovery tests
// ---------------------------------------------------------------------------

describe("MecAvailabilityGuard — recovery", () => {
  let guard: MecAvailabilityGuard;

  beforeEach(() => {
    guard = new MecAvailabilityGuard();
  });

  it("resumes allowing protected decisions when MEC becomes available again", () => {
    guard.setAvailable(false);
    expect(guard.checkDecision("SUMMARY_EMISSION").allowed).toBe(false);

    // Recovery
    guard.setAvailable(true);
    expect(guard.checkDecision("SUMMARY_EMISSION").allowed).toBe(true);
  });

  it("resets fail-closed trigger on recovery so next unavailability fires again", () => {
    guard.setAvailable(false);
    guard.checkDecision("SUMMARY_EMISSION");
    expect(guard.wasFailClosedTriggered()).toBe(true);

    guard.setAvailable(true);
    expect(guard.wasFailClosedTriggered()).toBe(false);

    // Second unavailability window
    guard.setAvailable(false);
    guard.checkDecision("MEMORY_COMMIT_AUTH");
    expect(guard.wasFailClosedTriggered()).toBe(true);
  });
});
