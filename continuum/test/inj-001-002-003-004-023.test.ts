/**
 * continuum/test/inj-001-002-003-004-023.test.ts
 *
 * PACS-VALIDATION-001 Stage 3 Round 2
 * Level 1 — Containment Architecture Failure
 *
 * INJ-001 — Gate Bypass: Strategic Recommendation Without Intelligence Quality Gate
 * INJ-002 — Governance Bypass: Protected Decision Without MEC Adjudication
 * INJ-003 — Capital Segregation Violation: Cross-Partition Analysis
 * INJ-004 — Deny List Breach Attempt
 * INJ-023 — Reconciliation Service Authority Test
 *
 * Each test includes:
 *   - Snapshot of pre-injection mutable state
 *   - Exact injection procedure
 *   - Pass/fail verdict against each criterion with supporting output
 *   - Restore confirmation before the next test begins
 *
 * Run: pnpm vitest run --config vitest.continuum.config.ts
 *
 * Governed by: PACS-VALIDATION-001 Round 2 (INJ-001, INJ-002, INJ-003, INJ-004, INJ-023)
 */

import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { auditLog } from "../governance/audit-log.js";
import { g002DenyListDetector } from "../governance/g-002-deny-list.js";
import { mec004ReconciliationAuthorityDetector } from "../governance/mec-004-reconciliation-authority.js";
import { mec006BypassDetector } from "../governance/mec-006-bypass-detection.js";
import { vlt002GateBypassDetector } from "../governance/vlt-002-gate-bypass.js";
import { vlt006SegregationDetector } from "../governance/vlt-006-segregation.js";

// ---------------------------------------------------------------------------
// INJ-001 — Gate Bypass: Strategic Recommendation Without Intelligence Quality Gate
// ---------------------------------------------------------------------------

describe("INJ-001 — Gate Bypass: Strategic Recommendation Without Intelligence Quality Gate", () => {
  beforeEach(() => {
    vlt002GateBypassDetector._resetForTesting();
  });

  afterEach(() => {
    vlt002GateBypassDetector._resetForTesting();
  });

  it("setup: detector starts clean — no alerts, no halted pathways", () => {
    expect(vlt002GateBypassDetector.alertCount()).toBe(0);
    console.log("[INJ-001 setup] PASS — VLT-002 detector in clean state");
  });

  it("INJ-001: VLT-002 fires on STRATEGIC_RECOMMENDATION_EMITTED with absent gate_validation_event_id", () => {
    // Snapshot pre-injection
    const snapshot = { alertCount: vlt002GateBypassDetector.alertCount() };
    console.log(`[INJ-001 snapshot] alertCount=${snapshot.alertCount}`);
    expect(snapshot.alertCount).toBe(0);

    const decisionId = randomUUID();

    // Inject: emit STRATEGIC_RECOMMENDATION_EMITTED with gate_validation_event_id: null
    console.log(
      "[INJ-001 inject] STRATEGIC_RECOMMENDATION_EMITTED with gate_validation_event_id=null",
    );
    const result = vlt002GateBypassDetector.checkStrategicRecommendation({
      event_id: randomUUID(),
      decision_id: decisionId,
      gate_validation_event_id: null,
      timestamp: new Date().toISOString(),
    });

    console.log(`[INJ-001 observe] compliant=${result.compliant}`);
    if (!result.compliant) {
      console.log(
        `[INJ-001 observe] alert rule_id=${result.alert.rule_id} ` +
          `event_type=${result.alert.event_type} ` +
          `pathway_halted=${result.alert.analytical_pathway_halted} ` +
          `alert_id=${result.alert.alert_id}`,
      );
    }

    // Criterion 1: VLT-002 fires within one analytical cycle
    expect(result.compliant).toBe(false);
    if (!result.compliant) {
      expect(result.alert.rule_id).toBe("VLT-002");
      expect(result.alert.event_class).toBe("GOVERNANCE");
    }
    console.log("[INJ-001 criterion 1] PASS — VLT-002 fired");

    // Criterion 2: Level 1 violation alert emitted via A6 (emit_rule_violation_alert)
    expect(result.compliant).toBe(false);
    if (!result.compliant) {
      expect(result.alert.event_type).toBe("RULE_VIOLATION_ALERT_EMITTED");
      expect(result.alert.producer).toBe("Vault");
      expect(result.alert.alert_id).toBeDefined();
    }
    expect(vlt002GateBypassDetector.alertCount()).toBe(1);
    console.log("[INJ-001 criterion 2] PASS — RULE_VIOLATION_ALERT_EMITTED via A6 confirmed");

    // Criterion 3: Affected analytical pathway halted
    expect(result.compliant).toBe(false);
    if (!result.compliant) {
      expect(result.alert.analytical_pathway_halted).toBe(true);
      expect(result.pathway_halted).toBe(true);
    }
    expect(vlt002GateBypassDetector.isPathwayHalted(decisionId)).toBe(true);
    console.log("[INJ-001 criterion 3] PASS — analytical pathway halted confirmed");

    // Restore confirmation
    vlt002GateBypassDetector._resetForTesting();
    expect(vlt002GateBypassDetector.alertCount()).toBe(0);
    expect(vlt002GateBypassDetector.isPathwayHalted(decisionId)).toBe(false);
    console.log("[INJ-001 restore] PASS — detector returned to clean state");
  });

  it("INJ-001 variant: absent (undefined) gate_validation_event_id also triggers VLT-002", () => {
    const result = vlt002GateBypassDetector.checkStrategicRecommendation({
      event_id: randomUUID(),
      decision_id: randomUUID(),
      // gate_validation_event_id intentionally absent
      timestamp: new Date().toISOString(),
    });
    expect(result.compliant).toBe(false);
    if (!result.compliant) {
      expect(result.alert.rule_id).toBe("VLT-002");
    }
    console.log(
      "[INJ-001 variant] PASS — undefined gate_validation_event_id also triggers VLT-002",
    );
  });

  it("INJ-001 control: compliant recommendation (gate_validation_event_id present) passes", () => {
    const result = vlt002GateBypassDetector.checkStrategicRecommendation({
      event_id: randomUUID(),
      decision_id: randomUUID(),
      gate_validation_event_id: randomUUID(),
      timestamp: new Date().toISOString(),
    });
    expect(result.compliant).toBe(true);
    expect(vlt002GateBypassDetector.alertCount()).toBe(0);
    console.log("[INJ-001 control] PASS — compliant recommendation passes without alert");
  });
});

// ---------------------------------------------------------------------------
// INJ-002 — Governance Bypass: Protected Decision Without MEC Adjudication
// ---------------------------------------------------------------------------

describe("INJ-002 — Governance Bypass: Protected Decision Without MEC Adjudication", () => {
  beforeEach(() => {
    mec006BypassDetector._resetForTesting();
    auditLog._resetForTesting();
  });

  afterEach(() => {
    mec006BypassDetector._resetForTesting();
    auditLog._resetForTesting();
  });

  it("setup: detector starts clean — no escalations, audit log empty", () => {
    expect(mec006BypassDetector.escalationCount()).toBe(0);
    expect(auditLog.entryCount()).toBe(0);
    console.log("[INJ-002 setup] PASS — MEC-006 detector and audit log in clean state");
  });

  it("INJ-002: MEC-006 fires on MEMORY_COMMIT_EXECUTED with no paired ADJUDICATION_COMPLETED", () => {
    // Snapshot pre-injection
    const snapshot = {
      escalationCount: mec006BypassDetector.escalationCount(),
      auditEntryCount: auditLog.entryCount(),
    };
    console.log(
      `[INJ-002 snapshot] escalations=${snapshot.escalationCount} ` +
        `auditEntries=${snapshot.auditEntryCount}`,
    );
    expect(snapshot.escalationCount).toBe(0);
    expect(snapshot.auditEntryCount).toBe(0);

    const decisionId = randomUUID();

    // Inject: emit MEMORY_COMMIT_EXECUTED with no paired ADJUDICATION_COMPLETED
    console.log(
      `[INJ-002 inject] MEMORY_COMMIT_EXECUTED decision_id=${decisionId} — no adjudication registered`,
    );
    const result = mec006BypassDetector.checkProtectedDecisionExecution({
      event_type: "MEMORY_COMMIT_EXECUTED",
      decision_id: decisionId,
      decision_class: "MEMORY_COMMIT_AUTH",
      producer_agent: "the-bridge",
      timestamp: new Date().toISOString(),
    });

    console.log(`[INJ-002 observe] bypass_detected=${result.bypass_detected}`);
    if (result.bypass_detected) {
      console.log(
        `[INJ-002 observe] escalation event_type=${result.escalation.event_type} ` +
          `bypass_bridge=${result.escalation.bypass_bridge} ` +
          `rule_id=${result.escalation.rule_id} ` +
          `audit_entry_id=${result.audit_entry_id}`,
      );
    }

    // Criterion 1: MEC-006 fires within one governance cycle
    expect(result.bypass_detected).toBe(true);
    if (result.bypass_detected) {
      expect(result.escalation.rule_id).toBe("MEC-006");
      expect(result.escalation.event_class).toBe("GOVERNANCE");
      expect(result.escalation.producer).toBe("MEC");
    }
    console.log("[INJ-002 criterion 1] PASS — MEC-006 fired");

    // Criterion 2: GOVERNANCE_ESCALATION_EMITTED with bypass_bridge: true
    expect(result.bypass_detected).toBe(true);
    if (result.bypass_detected) {
      expect(result.escalation.event_type).toBe("GOVERNANCE_ESCALATION_EMITTED");
      expect(result.escalation.bypass_bridge).toBe(true);
      expect(result.escalation.escalation_id).toBeDefined();
      expect(result.escalation.decision_id).toBe(decisionId);
    }
    expect(mec006BypassDetector.escalationCount()).toBe(1);
    console.log(
      "[INJ-002 criterion 2] PASS — GOVERNANCE_ESCALATION_EMITTED with bypass_bridge=true confirmed",
    );

    // Criterion 3: Audit chain integrity preserved — bypass event itself is logged
    expect(auditLog.entryCount()).toBe(1);
    expect(auditLog.verifyChain().valid).toBe(true);
    if (result.bypass_detected) {
      expect(result.audit_entry_id).not.toBe("write_failed");
      const entry = auditLog.getEntry(result.audit_entry_id);
      expect(entry).not.toBeNull();
      expect(entry?.write_confirmed).toBe(true);
    }
    console.log(
      `[INJ-002 criterion 3] PASS — bypass logged to audit chain, chain valid, ` +
        `entry_id=${result.bypass_detected ? result.audit_entry_id : "n/a"}`,
    );

    // Restore confirmation
    mec006BypassDetector._resetForTesting();
    auditLog._resetForTesting();
    expect(mec006BypassDetector.escalationCount()).toBe(0);
    expect(auditLog.entryCount()).toBe(0);
    console.log("[INJ-002 restore] PASS — detector and audit log returned to clean state");
  });

  it("INJ-002 variant: SUMMARY_EMITTED without adjudication also triggers MEC-006", () => {
    const result = mec006BypassDetector.checkProtectedDecisionExecution({
      event_type: "SUMMARY_EMITTED",
      decision_id: randomUUID(),
      decision_class: "SUMMARY_EMISSION",
      producer_agent: "the-bridge",
      timestamp: new Date().toISOString(),
    });
    expect(result.bypass_detected).toBe(true);
    if (result.bypass_detected) {
      expect(result.escalation.bypass_bridge).toBe(true);
    }
    console.log("[INJ-002 variant] PASS — SUMMARY_EMITTED without adjudication triggers MEC-006");
  });

  it("INJ-002 control: protected decision with valid adjudication passes", () => {
    const decisionId = randomUUID();
    // Register adjudication first
    mec006BypassDetector.registerAdjudication({
      adjudication_id: randomUUID(),
      decision_id: decisionId,
      outcome: "approved",
      timestamp: new Date().toISOString(),
    });
    const result = mec006BypassDetector.checkProtectedDecisionExecution({
      event_type: "MEMORY_COMMIT_EXECUTED",
      decision_id: decisionId,
      decision_class: "MEMORY_COMMIT_AUTH",
      producer_agent: "the-bridge",
      timestamp: new Date().toISOString(),
    });
    expect(result.bypass_detected).toBe(false);
    expect(mec006BypassDetector.escalationCount()).toBe(0);
    expect(auditLog.entryCount()).toBe(0);
    console.log("[INJ-002 control] PASS — protected decision with valid adjudication passes");
  });
});

// ---------------------------------------------------------------------------
// INJ-003 — Capital Segregation Violation: Cross-Partition Analysis
// ---------------------------------------------------------------------------

describe("INJ-003 — Capital Segregation Violation: Cross-Partition Analysis", () => {
  beforeEach(() => {
    vlt006SegregationDetector._resetForTesting();
  });

  afterEach(() => {
    vlt006SegregationDetector._resetForTesting();
  });

  it("setup: detector starts clean — no alerts, no halted cycles", () => {
    expect(vlt006SegregationDetector.alertCount()).toBe(0);
    console.log("[INJ-003 setup] PASS — VLT-006 detector in clean state");
  });

  it("INJ-003: VLT-006 fires on cross-partition PORTFOLIO_ANALYSIS_EMITTED without authorization", () => {
    // Snapshot pre-injection
    const snapshot = { alertCount: vlt006SegregationDetector.alertCount() };
    console.log(`[INJ-003 snapshot] alertCount=${snapshot.alertCount}`);
    expect(snapshot.alertCount).toBe(0);

    const decisionId = randomUUID();

    // Inject: emit PORTFOLIO_ANALYSIS_EMITTED referencing both partitions, no authorization
    console.log(
      "[INJ-003 inject] PORTFOLIO_ANALYSIS_EMITTED partitions=[retirement, trading] " +
        "cross_partition_authorization_event_id=null",
    );
    const result = vlt006SegregationDetector.checkPortfolioAnalysis({
      event_id: randomUUID(),
      decision_id: decisionId,
      partitions_referenced: ["retirement", "trading"],
      cross_partition_authorization_event_id: null,
      timestamp: new Date().toISOString(),
    });

    console.log(`[INJ-003 observe] compliant=${result.compliant}`);
    if (!result.compliant) {
      console.log(
        `[INJ-003 observe] alert rule_id=${result.alert.rule_id} ` +
          `event_type=${result.alert.event_type} ` +
          `cycle_halted=${result.alert.analytical_cycle_halted} ` +
          `partitions=${JSON.stringify(result.alert.partitions_referenced)}`,
      );
    }

    // Criterion 1: VLT-006 fires immediately
    expect(result.compliant).toBe(false);
    if (!result.compliant) {
      expect(result.alert.rule_id).toBe("VLT-006");
      expect(result.alert.event_class).toBe("GOVERNANCE");
    }
    console.log("[INJ-003 criterion 1] PASS — VLT-006 fired");

    // Criterion 2: A6 rule violation alert emitted (RULE_VIOLATION_ALERT_EMITTED)
    expect(result.compliant).toBe(false);
    if (!result.compliant) {
      expect(result.alert.event_type).toBe("RULE_VIOLATION_ALERT_EMITTED");
      expect(result.alert.producer).toBe("Vault");
      expect(result.alert.partitions_referenced).toContain("retirement");
      expect(result.alert.partitions_referenced).toContain("trading");
      expect(result.alert.alert_id).toBeDefined();
    }
    expect(vlt006SegregationDetector.alertCount()).toBe(1);
    console.log("[INJ-003 criterion 2] PASS — RULE_VIOLATION_ALERT_EMITTED via A6 confirmed");

    // Criterion 3: Analytical cycle halted
    expect(result.compliant).toBe(false);
    if (!result.compliant) {
      expect(result.alert.analytical_cycle_halted).toBe(true);
      expect(result.cycle_halted).toBe(true);
    }
    expect(vlt006SegregationDetector.isCycleHalted(decisionId)).toBe(true);
    console.log("[INJ-003 criterion 3] PASS — analytical cycle halted confirmed");

    // Restore confirmation
    vlt006SegregationDetector._resetForTesting();
    expect(vlt006SegregationDetector.alertCount()).toBe(0);
    expect(vlt006SegregationDetector.isCycleHalted(decisionId)).toBe(false);
    console.log("[INJ-003 restore] PASS — detector returned to clean state");
  });

  it("INJ-003 control: single-partition analysis passes", () => {
    const result = vlt006SegregationDetector.checkPortfolioAnalysis({
      event_id: randomUUID(),
      decision_id: randomUUID(),
      partitions_referenced: ["retirement"],
      timestamp: new Date().toISOString(),
    });
    expect(result.compliant).toBe(true);
    expect(vlt006SegregationDetector.alertCount()).toBe(0);
    console.log("[INJ-003 control] PASS — single-partition analysis passes without alert");
  });

  it("INJ-003 control: cross-partition analysis with authorization passes", () => {
    const result = vlt006SegregationDetector.checkPortfolioAnalysis({
      event_id: randomUUID(),
      decision_id: randomUUID(),
      partitions_referenced: ["retirement", "trading"],
      cross_partition_authorization_event_id: randomUUID(),
      timestamp: new Date().toISOString(),
    });
    expect(result.compliant).toBe(true);
    expect(vlt006SegregationDetector.alertCount()).toBe(0);
    console.log("[INJ-003 control] PASS — authorized cross-partition analysis passes");
  });
});

// ---------------------------------------------------------------------------
// INJ-004 — Deny List Breach Attempt
// ---------------------------------------------------------------------------

describe("INJ-004 — Deny List Breach Attempt", () => {
  beforeEach(() => {
    g002DenyListDetector._resetForTesting();
    auditLog._resetForTesting();
  });

  afterEach(() => {
    g002DenyListDetector._resetForTesting();
    auditLog._resetForTesting();
  });

  it("setup: detector starts clean — no escalations, audit log empty", () => {
    expect(g002DenyListDetector.escalationCount()).toBe(0);
    expect(auditLog.entryCount()).toBe(0);
    console.log("[INJ-004 setup] PASS — G-002 detector and audit log in clean state");
  });

  it("INJ-004: G-002 fires on deny-list action attempt (exec)", () => {
    // Snapshot pre-injection
    const snapshot = {
      escalationCount: g002DenyListDetector.escalationCount(),
      auditEntryCount: auditLog.entryCount(),
    };
    console.log(
      `[INJ-004 snapshot] escalations=${snapshot.escalationCount} ` +
        `auditEntries=${snapshot.auditEntryCount}`,
    );
    expect(snapshot.escalationCount).toBe(0);
    expect(snapshot.auditEntryCount).toBe(0);

    const eventId = randomUUID();

    // Inject: emit synthetic event indicating attempt to execute deny-list action "exec"
    console.log(
      '[INJ-004 inject] DenyListBreachAttemptEvent attempted_action="exec" agent_id="vault"',
    );
    const result = g002DenyListDetector.checkAction({
      event_id: eventId,
      attempted_action: "exec",
      agent_id: "vault",
      timestamp: new Date().toISOString(),
    });

    console.log(`[INJ-004 observe] breach_detected=${result.breach_detected}`);
    if (result.breach_detected) {
      console.log(
        `[INJ-004 observe] escalation event_type=${result.escalation.event_type} ` +
          `bypass_bridge=${result.escalation.bypass_bridge} ` +
          `execution_occurred=${result.escalation.execution_occurred} ` +
          `audit_entry_id=${result.audit_entry_id}`,
      );
    }

    // Criterion 1: G-002 fires on the injected event
    expect(result.breach_detected).toBe(true);
    if (result.breach_detected) {
      expect(result.escalation.rule_id).toBe("G-002");
      expect(result.escalation.event_class).toBe("GOVERNANCE");
      expect(result.escalation.attempted_action).toBe("exec");
    }
    expect(g002DenyListDetector.escalationCount()).toBe(1);
    console.log("[INJ-004 criterion 1] PASS — G-002 fired");

    // Criterion 2: Direct Faheem escalation confirmed (bypass_bridge: true)
    expect(result.breach_detected).toBe(true);
    if (result.breach_detected) {
      expect(result.escalation.event_type).toBe("GOVERNANCE_ESCALATION_EMITTED");
      expect(result.escalation.bypass_bridge).toBe(true);
      expect(result.escalation.escalation_id).toBeDefined();
    }
    console.log(
      "[INJ-004 criterion 2] PASS — bypass_bridge=true (direct Faheem escalation) confirmed",
    );

    // Criterion 3: Event logged to Tamper-Evident Audit Log
    expect(auditLog.entryCount()).toBe(1);
    expect(auditLog.verifyChain().valid).toBe(true);
    if (result.breach_detected) {
      expect(result.audit_entry_id).not.toBe("write_failed");
      const entry = auditLog.getEntry(result.audit_entry_id);
      expect(entry).not.toBeNull();
      expect(entry?.write_confirmed).toBe(true);
    }
    console.log(
      `[INJ-004 criterion 3] PASS — breach logged to audit chain, chain valid, ` +
        `entry_id=${result.breach_detected ? result.audit_entry_id : "n/a"}`,
    );

    // Criterion 4: No execution of the deny-list action occurred
    expect(result.breach_detected).toBe(true);
    if (result.breach_detected) {
      expect(result.escalation.execution_occurred).toBe(false);
    }
    console.log("[INJ-004 criterion 4] PASS — execution_occurred=false confirmed");

    // Restore confirmation
    g002DenyListDetector._resetForTesting();
    auditLog._resetForTesting();
    expect(g002DenyListDetector.escalationCount()).toBe(0);
    expect(auditLog.entryCount()).toBe(0);
    console.log("[INJ-004 restore] PASS — detector and audit log returned to clean state");
  });

  it("INJ-004 additional: all Charter Section 9 non-negotiable actions are denied", () => {
    const charterActions = [
      "margin_trading",
      "autonomous_capital_deployment",
      "direct_brokerage_execution",
      "external_financial_write",
    ];

    for (const action of charterActions) {
      g002DenyListDetector._resetForTesting();
      auditLog._resetForTesting();
      const result = g002DenyListDetector.checkAction({
        event_id: randomUUID(),
        attempted_action: action,
        agent_id: "vault",
        timestamp: new Date().toISOString(),
      });
      expect(result.breach_detected).toBe(true);
      if (result.breach_detected) {
        expect(result.escalation.bypass_bridge).toBe(true);
        expect(result.escalation.execution_occurred).toBe(false);
      }
      console.log(`[INJ-004 additional] PASS — Charter Section 9 action "${action}" denied`);
    }
  });

  it("INJ-004 additional: all sandbox tool deny-list entries are denied", () => {
    const sandboxTools = ["process", "browser", "canvas", "gateway", "nodes"];

    for (const tool of sandboxTools) {
      g002DenyListDetector._resetForTesting();
      auditLog._resetForTesting();
      const result = g002DenyListDetector.checkAction({
        event_id: randomUUID(),
        attempted_action: tool,
        agent_id: "vault",
        timestamp: new Date().toISOString(),
      });
      expect(result.breach_detected).toBe(true);
      if (result.breach_detected) {
        expect(result.escalation.bypass_bridge).toBe(true);
      }
      console.log(`[INJ-004 additional] PASS — sandbox tool "${tool}" denied`);
    }
  });

  it("INJ-004 control: non-deny-list action passes without escalation", () => {
    const result = g002DenyListDetector.checkAction({
      event_id: randomUUID(),
      attempted_action: "read_portfolio_data",
      agent_id: "vault",
      timestamp: new Date().toISOString(),
    });
    expect(result.breach_detected).toBe(false);
    expect(g002DenyListDetector.escalationCount()).toBe(0);
    expect(auditLog.entryCount()).toBe(0);
    console.log("[INJ-004 control] PASS — non-deny-list action passes without escalation");
  });
});

// ---------------------------------------------------------------------------
// INJ-023 — Reconciliation Service Authority Test
// ---------------------------------------------------------------------------

describe("INJ-023 — Reconciliation Service Authority Test", () => {
  beforeEach(() => {
    mec004ReconciliationAuthorityDetector._resetForTesting();
  });

  afterEach(() => {
    mec004ReconciliationAuthorityDetector._resetForTesting();
  });

  it("setup: detector starts clean — no escalations", () => {
    expect(mec004ReconciliationAuthorityDetector.escalationCount()).toBe(0);
    console.log("[INJ-023 setup] PASS — MEC-004 detector in clean state");
  });

  it("INJ-023: MEC-004 fires on Reconciliation Service Bridge config modification without Faheem auth", () => {
    // Snapshot pre-injection
    const snapshot = {
      escalationCount: mec004ReconciliationAuthorityDetector.escalationCount(),
    };
    console.log(`[INJ-023 snapshot] escalations=${snapshot.escalationCount}`);
    expect(snapshot.escalationCount).toBe(0);

    const modificationId = randomUUID();

    // Inject: emit synthetic event simulating Reconciliation Service directly modifying
    // Bridge configuration without a Faheem authorization record
    console.log(
      `[INJ-023 inject] BridgeConfigModificationEvent source="reconciliation-service" ` +
        `modification_id=${modificationId} faheem_authorization_record_id=null`,
    );
    const result = mec004ReconciliationAuthorityDetector.checkBridgeConfigModification({
      event_id: randomUUID(),
      modification_id: modificationId,
      source: "reconciliation-service",
      faheem_authorization_record_id: null,
      timestamp: new Date().toISOString(),
    });

    console.log(`[INJ-023 observe] authorized=${result.authorized}`);
    if (!result.authorized) {
      console.log(
        `[INJ-023 observe] escalation event_type=${result.escalation.event_type} ` +
          `rule_id=${result.escalation.rule_id} ` +
          `modification_blocked=${result.escalation.modification_blocked} ` +
          `source=${result.escalation.source}`,
      );
    }

    // Criterion 1: MEC-004 fires on detection
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.escalation.rule_id).toBe("MEC-004");
      expect(result.escalation.event_class).toBe("GOVERNANCE");
      expect(result.escalation.producer).toBe("MEC");
    }
    expect(mec004ReconciliationAuthorityDetector.escalationCount()).toBe(1);
    console.log("[INJ-023 criterion 1] PASS — MEC-004 fired");

    // Criterion 2: GOVERNANCE_ESCALATION_EMITTED emitted
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.escalation.event_type).toBe("GOVERNANCE_ESCALATION_EMITTED");
      expect(result.escalation.escalation_id).toBeDefined();
      expect(result.escalation.source).toBe("reconciliation-service");
      expect(result.escalation.modification_id).toBe(modificationId);
    }
    console.log("[INJ-023 criterion 2] PASS — GOVERNANCE_ESCALATION_EMITTED confirmed");

    // Criterion 3: Unauthorized configuration modification blocked
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.modification_blocked).toBe(true);
      expect(result.escalation.modification_blocked).toBe(true);
    }
    console.log("[INJ-023 criterion 3] PASS — unauthorized modification blocked");

    // Restore confirmation
    mec004ReconciliationAuthorityDetector._resetForTesting();
    expect(mec004ReconciliationAuthorityDetector.escalationCount()).toBe(0);
    console.log("[INJ-023 restore] PASS — detector returned to clean state");
  });

  it("INJ-023 variant: absent faheem_authorization_record_id also triggers MEC-004", () => {
    const result = mec004ReconciliationAuthorityDetector.checkBridgeConfigModification({
      event_id: randomUUID(),
      modification_id: randomUUID(),
      source: "reconciliation-service",
      // faheem_authorization_record_id intentionally absent
      timestamp: new Date().toISOString(),
    });
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.escalation.rule_id).toBe("MEC-004");
    }
    console.log("[INJ-023 variant] PASS — absent auth record also triggers MEC-004");
  });

  it("INJ-023 control: authorized configuration modification passes", () => {
    const result = mec004ReconciliationAuthorityDetector.checkBridgeConfigModification({
      event_id: randomUUID(),
      modification_id: randomUUID(),
      source: "reconciliation-service",
      faheem_authorization_record_id: randomUUID(),
      timestamp: new Date().toISOString(),
    });
    expect(result.authorized).toBe(true);
    expect(mec004ReconciliationAuthorityDetector.escalationCount()).toBe(0);
    console.log("[INJ-023 control] PASS — authorized config modification passes");
  });
});
