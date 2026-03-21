/**
 * continuum/test/inj-005-021.test.ts
 *
 * PACS-VALIDATION-001 Stage 1 Exit Gate
 * INJ-005 — Audit Chain Integrity
 * INJ-021 — MEC Fail-Closed Verification
 *
 * These tests operate against the MODULE SINGLETONS (auditLog, mecAvailabilityGuard)
 * wired into the live enforcement pipeline via enforceProtectedDecision().
 *
 * Each test includes:
 *   - Snapshot of pre-injection state
 *   - Exact injection procedure
 *   - Assertion against every pass criterion
 *   - Explicit restore + restore confirmation
 *
 * Run: pnpm vitest run --config vitest.continuum.config.ts
 *
 * Governed by: PACS-VALIDATION-001 INJ-005, INJ-021
 */

import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { auditLog } from "../governance/audit-log.js";
import { enforceProtectedDecision } from "../governance/continuum-governance-plugin.js";
import { mecAvailabilityGuard } from "../governance/mec-fail-closed.js";

// ---------------------------------------------------------------------------
// INJ-005 — Audit Chain Integrity
// ---------------------------------------------------------------------------

describe("INJ-005 — Audit Chain Integrity", () => {
  // Snapshot fields captured before injection
  let snapshot: { entryCount: number; frozen: boolean };

  beforeEach(() => {
    // Start each test with a clean singleton state
    auditLog._resetForTesting();
  });

  afterEach(() => {
    // Restore: reset singleton to clean state after each test
    auditLog._resetForTesting();
  });

  it("setup: enforceProtectedDecision writes entries to the singleton chain", () => {
    // Setup: write three routing entries via the wired pipeline
    for (let i = 1; i <= 3; i++) {
      const result = enforceProtectedDecision({
        agentId: "the-bridge",
        decisionClass: "SUMMARY_EMISSION",
        decisionId: `inj005-decision-${i}`,
        payload: { step: i },
      });
      expect(result.allowed).toBe(true);
    }
    expect(auditLog.entryCount()).toBe(3);
    // Clean chain before injection
    expect(auditLog.verifyChain().valid).toBe(true);
  });

  it("INJ-005 criterion 1: chain break detected after corruption", () => {
    // Setup: write 3 entries to the singleton
    for (let i = 1; i <= 3; i++) {
      enforceProtectedDecision({
        agentId: "the-bridge",
        decisionClass: "MEMORY_COMMIT_AUTH",
        decisionId: `inj005-dc1-${i}`,
        payload: { step: i },
      });
    }

    // Snapshot pre-injection state
    snapshot = { entryCount: auditLog.entryCount(), frozen: auditLog.isFrozen() };
    console.log(`[INJ-005 snapshot] entries=${snapshot.entryCount} frozen=${snapshot.frozen}`);
    expect(snapshot.entryCount).toBe(3);
    expect(snapshot.frozen).toBe(false);

    // Inject: corrupt entry at index 1 (middle of chain)
    console.log(
      "[INJ-005 inject] _corruptEntryForTesting(1) — mutating payload of entry at index 1",
    );
    auditLog._corruptEntryForTesting(1);

    // Observe: trigger chain integrity check
    const verifyResult = auditLog.verifyChain();
    console.log(`[INJ-005 observe] verifyChain result: valid=${verifyResult.valid}`);
    if (!verifyResult.valid) {
      console.log(
        `[INJ-005 observe] divergence_type=${verifyResult.divergence_type} ` +
          `first_divergence_entry_id=${verifyResult.first_divergence_entry_id} ` +
          `entries_verified_before_break=${verifyResult.entries_verified_before_break}`,
      );
    }

    // Criterion 1: break is detected
    expect(verifyResult.valid).toBe(false);
    if (!verifyResult.valid) {
      expect(verifyResult.divergence_type).toBe("hash_mismatch");
      expect(verifyResult.first_divergence_entry_id).toBeDefined();
    }
  });

  it("INJ-005 criterion 2: GOVERNANCE_ESCALATION_EMITTED fires with bypass_bridge: true", () => {
    for (let i = 1; i <= 3; i++) {
      enforceProtectedDecision({
        agentId: "the-bridge",
        decisionClass: "ESCALATION_DECISION",
        decisionId: `inj005-dc2-${i}`,
        payload: { step: i },
      });
    }

    auditLog._corruptEntryForTesting(0);
    auditLog.verifyChain();

    const escalation = auditLog.getLastEscalationEvent();
    console.log(`[INJ-005 criterion 2] escalation=${JSON.stringify(escalation)}`);

    // Criterion 2: GOVERNANCE_ESCALATION_EMITTED with bypass_bridge: true
    expect(escalation).not.toBeNull();
    expect(escalation?.event_type).toBe("GOVERNANCE_ESCALATION_EMITTED");
    expect(escalation?.event_class).toBe("GOVERNANCE");
    expect(escalation?.bypass_bridge).toBe(true);
    expect(escalation?.producer).toBe("Tamper-Evident Audit Log");
    expect(escalation?.first_divergence_entry_id).toBeDefined();
    console.log(
      "[INJ-005 criterion 2] PASS — GOVERNANCE_ESCALATION_EMITTED with bypass_bridge=true confirmed",
    );
  });

  it("INJ-005 criterion 3: audit log enters frozen state", () => {
    for (let i = 1; i <= 3; i++) {
      enforceProtectedDecision({
        agentId: "the-bridge",
        decisionClass: "SUMMARY_EMISSION",
        decisionId: `inj005-dc3-${i}`,
        payload: { step: i },
      });
    }

    auditLog._corruptEntryForTesting(1);
    auditLog.verifyChain();

    // Criterion 3: frozen state
    expect(auditLog.isFrozen()).toBe(true);
    console.log(`[INJ-005 criterion 3] isFrozen=${auditLog.isFrozen()} — PASS`);
  });

  it("INJ-005 criterion 4: protected decision execution is frozen after chain break", () => {
    for (let i = 1; i <= 3; i++) {
      enforceProtectedDecision({
        agentId: "the-bridge",
        decisionClass: "MEMORY_COMMIT_AUTH",
        decisionId: `inj005-dc4-${i}`,
        payload: { step: i },
      });
    }

    auditLog._corruptEntryForTesting(1);
    auditLog.verifyChain();
    expect(auditLog.isFrozen()).toBe(true);

    // Criterion 4: all three protected decision classes now blocked by frozen log
    const summaryResult = enforceProtectedDecision({
      agentId: "the-bridge",
      decisionClass: "SUMMARY_EMISSION",
      decisionId: randomUUID(),
      payload: {},
    });
    const memoryResult = enforceProtectedDecision({
      agentId: "the-bridge",
      decisionClass: "MEMORY_COMMIT_AUTH",
      decisionId: randomUUID(),
      payload: {},
    });
    const escalationResult = enforceProtectedDecision({
      agentId: "the-bridge",
      decisionClass: "ESCALATION_DECISION",
      decisionId: randomUUID(),
      payload: {},
    });

    console.log(
      `[INJ-005 criterion 4] SUMMARY_EMISSION allowed=${summaryResult.allowed}` +
        ` reason=${!summaryResult.allowed ? summaryResult.reason : "n/a"}`,
    );
    console.log(
      `[INJ-005 criterion 4] MEMORY_COMMIT_AUTH allowed=${memoryResult.allowed}` +
        ` reason=${!memoryResult.allowed ? memoryResult.reason : "n/a"}`,
    );
    console.log(
      `[INJ-005 criterion 4] ESCALATION_DECISION allowed=${escalationResult.allowed}` +
        ` reason=${!escalationResult.allowed ? escalationResult.reason : "n/a"}`,
    );

    expect(summaryResult.allowed).toBe(false);
    expect(memoryResult.allowed).toBe(false);
    expect(escalationResult.allowed).toBe(false);
    console.log("[INJ-005 criterion 4] PASS — all three protected classes frozen");

    // Restore confirmation
    auditLog._resetForTesting();
    expect(auditLog.isFrozen()).toBe(false);
    expect(auditLog.entryCount()).toBe(0);
    const postRestoreResult = enforceProtectedDecision({
      agentId: "the-bridge",
      decisionClass: "SUMMARY_EMISSION",
      decisionId: randomUUID(),
      payload: { restore_check: true },
    });
    expect(postRestoreResult.allowed).toBe(true);
    console.log("[INJ-005 restore] _resetForTesting() complete — protected decisions resume");
  });
});

// ---------------------------------------------------------------------------
// INJ-021 — MEC Fail-Closed Verification
// ---------------------------------------------------------------------------

describe("INJ-021 — MEC Fail-Closed Verification", () => {
  let snapshot: { mecAvailable: boolean };

  beforeEach(() => {
    // Start clean: MEC available, no events
    auditLog._resetForTesting();
    mecAvailabilityGuard._resetForTesting();
  });

  afterEach(() => {
    // Restore MEC to available state after each test
    mecAvailabilityGuard.setAvailable(true);
    mecAvailabilityGuard._resetForTesting();
    auditLog._resetForTesting();
  });

  it("setup: MEC is available and protected decisions proceed", () => {
    // Setup: confirm MEC available
    snapshot = { mecAvailable: mecAvailabilityGuard.isAvailable() };
    console.log(`[INJ-021 snapshot] mecAvailable=${snapshot.mecAvailable}`);
    expect(snapshot.mecAvailable).toBe(true);

    // Confirm protected decisions proceed when MEC is available
    const result = enforceProtectedDecision({
      agentId: "the-bridge",
      decisionClass: "SUMMARY_EMISSION",
      decisionId: randomUUID(),
      payload: { pre_injection_check: true },
    });
    expect(result.allowed).toBe(true);
    console.log("[INJ-021 setup] SUMMARY_EMISSION allowed=true — MEC available confirmed");
  });

  it("INJ-021 criterion 1: FAIL_CLOSED_TRIGGERED fires immediately on MEC unavailability", () => {
    snapshot = { mecAvailable: mecAvailabilityGuard.isAvailable() };
    expect(snapshot.mecAvailable).toBe(true);

    // Inject: take MEC offline
    console.log("[INJ-021 inject] mecAvailabilityGuard.setAvailable(false)");
    mecAvailabilityGuard.setAvailable(false);

    // Observe: attempt protected decision
    const result = enforceProtectedDecision({
      agentId: "the-bridge",
      decisionClass: "SUMMARY_EMISSION",
      decisionId: randomUUID(),
      payload: {},
    });

    console.log(
      `[INJ-021 criterion 1] SUMMARY_EMISSION allowed=${result.allowed}` +
        ` reason=${!result.allowed ? result.reason : "n/a"}`,
    );

    // Criterion 1: FAIL_CLOSED_TRIGGERED fires
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe("mec_unavailable");
    }

    // The guard captured the event
    expect(mecAvailabilityGuard.wasFailClosedTriggered()).toBe(true);
    const events = mecAvailabilityGuard.getFailClosedEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].event_type).toBe("FAIL_CLOSED_TRIGGERED");
    expect(events[0].bypass_bridge).toBe(false);
    console.log(
      `[INJ-021 criterion 1] FAIL_CLOSED_TRIGGERED confirmed: event_id=${events[0].event_id}`,
    );
  });

  it("INJ-021 criterion 2+3: all three protected decision classes halt during unavailability", () => {
    snapshot = { mecAvailable: mecAvailabilityGuard.isAvailable() };
    expect(snapshot.mecAvailable).toBe(true);

    // Inject: MEC offline
    console.log("[INJ-021 inject] mecAvailabilityGuard.setAvailable(false)");
    mecAvailabilityGuard.setAvailable(false);

    // Observe: attempt all three protected classes
    const summaryResult = enforceProtectedDecision({
      agentId: "the-bridge",
      decisionClass: "SUMMARY_EMISSION",
      decisionId: randomUUID(),
      payload: {},
    });
    const memoryResult = enforceProtectedDecision({
      agentId: "the-bridge",
      decisionClass: "MEMORY_COMMIT_AUTH",
      decisionId: randomUUID(),
      payload: {},
    });
    const escalationResult = enforceProtectedDecision({
      agentId: "the-bridge",
      decisionClass: "ESCALATION_DECISION",
      decisionId: randomUUID(),
      payload: {},
    });

    console.log(`[INJ-021 criterion 2] SUMMARY_EMISSION allowed=${summaryResult.allowed}`);
    console.log(`[INJ-021 criterion 2] MEMORY_COMMIT_AUTH allowed=${memoryResult.allowed}`);
    console.log(`[INJ-021 criterion 2] ESCALATION_DECISION allowed=${escalationResult.allowed}`);

    // Criterion 2: all three protected classes blocked
    expect(summaryResult.allowed).toBe(false);
    expect(memoryResult.allowed).toBe(false);
    expect(escalationResult.allowed).toBe(false);
    console.log("[INJ-021 criterion 2] PASS — all three protected classes blocked");

    // Criterion 3: no protected decision executed during unavailability
    // (audit log has no entries — all were blocked before write)
    expect(auditLog.entryCount()).toBe(0);
    console.log(
      `[INJ-021 criterion 3] audit log entries=${auditLog.entryCount()} — no protected decision executed`,
    );

    // Routing decisions must still be allowed (not a protected class)
    // (checked separately — not through enforceProtectedDecision which only accepts protected classes)
    const routingResult = mecAvailabilityGuard.checkDecision("routing");
    expect(routingResult.allowed).toBe(true);
    console.log("[INJ-021] routing decisions unaffected — allowed=true confirmed");

    // Restore
    console.log("[INJ-021 restore] mecAvailabilityGuard.setAvailable(true)");
    mecAvailabilityGuard.setAvailable(true);
    mecAvailabilityGuard._resetForTesting();

    // Restore confirmation
    expect(mecAvailabilityGuard.isAvailable()).toBe(true);
    expect(mecAvailabilityGuard.wasFailClosedTriggered()).toBe(false);

    const postRestoreResult = enforceProtectedDecision({
      agentId: "the-bridge",
      decisionClass: "SUMMARY_EMISSION",
      decisionId: randomUUID(),
      payload: { restore_check: true },
    });
    expect(postRestoreResult.allowed).toBe(true);
    console.log("[INJ-021 restore] SUMMARY_EMISSION allowed=true — MEC available confirmed");
    console.log("[INJ-021 restore] PASS — system returned to normal state");
  });
});
