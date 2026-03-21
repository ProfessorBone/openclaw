/**
 * continuum/test/inj-006-007-008-009-010-011-012-019-020.test.ts
 *
 * PACS-VALIDATION-001 Stage 3 Round 3 — Governance Process Failure Tests.
 *
 * Nine Level 2 injection tests. All nine may run in parallel within this round.
 * All nine must pass before Round 4 begins.
 *
 *   INJ-006  BRDG-004 — Silent Violation (policy violation without escalation candidate)
 *   INJ-007  BRDG-002 — Untraced Routing Decision
 *   INJ-008  BRDG-007 + MEC-003 — Unauthorized Memory Commit
 *   INJ-009  GAU-006  — Suppressed Anomaly Alert
 *   INJ-010  GAU-002  — Formula Version Drift
 *   INJ-011  GAU-001  — Coverage Gap: Active Agent Telemetry Absent
 *   INJ-012  CRU-002  — Reflection Without Evidence
 *   INJ-019  SIG-005  — Deposit Pathway Integrity Failure
 *   INJ-020  LOC-001  — Graph Write Without Authorization
 *
 * Pattern per test:
 *   1. Snapshot pre-injection state
 *   2. Inject the failure condition
 *   3. Assert each criterion
 *   4. Restore and confirm clean state
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  brdg002UntracedRoutingDetector,
  type RoutingDecisionFormedEvent,
  type RoutingDecisionExecutedEvent,
} from "../governance/brdg-002-untraced-routing.js";
import {
  brdg004SilentViolationDetector,
  type PolicyViolationEvent,
  type EscalationCandidateFormedEvent,
} from "../governance/brdg-004-silent-violation.js";
import {
  brdg007Mec003MemoryAuthDetector,
  type AdjudicationCompletedEvent,
  type MemoryWriteExecutedEvent,
} from "../governance/brdg-007-mec-003-memory-auth.js";
import {
  cru002ReflectionEvidenceDetector,
  type ReflectionCandidateFormedEvent,
} from "../governance/cru-002-reflection-evidence.js";
import {
  gau001CoverageGapDetector,
  type AgentTelemetryEvent,
} from "../governance/gau-001-coverage-gap.js";
import {
  gau002FormulaVersionDetector,
  LOCKED_FORMULA_REGISTRY,
  type PerformanceReportEmittedEvent,
} from "../governance/gau-002-formula-drift.js";
import {
  gau006SuppressedAnomalyDetector,
  type ThresholdCrossingEvent,
  type AnomalyAlertEmittedEvent,
} from "../governance/gau-006-suppressed-anomaly.js";
import {
  loc001GraphAuthDetector,
  type GraphWriteAuthorizedEvent,
  type GraphWriteExecutedEvent,
} from "../governance/loc-001-graph-auth.js";
import {
  sig005DepositPathwayDetector,
  AUTHORIZED_DEPOSIT_TARGET,
  type BriefDepositedEvent,
} from "../governance/sig-005-deposit-pathway.js";

// ---------------------------------------------------------------------------
// Global reset — every detector resets before and after each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  brdg004SilentViolationDetector._resetForTesting();
  brdg002UntracedRoutingDetector._resetForTesting();
  brdg007Mec003MemoryAuthDetector._resetForTesting();
  gau006SuppressedAnomalyDetector._resetForTesting();
  gau002FormulaVersionDetector._resetForTesting();
  gau001CoverageGapDetector._resetForTesting();
  cru002ReflectionEvidenceDetector._resetForTesting();
  sig005DepositPathwayDetector._resetForTesting();
  loc001GraphAuthDetector._resetForTesting();
});

afterEach(() => {
  brdg004SilentViolationDetector._resetForTesting();
  brdg002UntracedRoutingDetector._resetForTesting();
  brdg007Mec003MemoryAuthDetector._resetForTesting();
  gau006SuppressedAnomalyDetector._resetForTesting();
  gau002FormulaVersionDetector._resetForTesting();
  gau001CoverageGapDetector._resetForTesting();
  cru002ReflectionEvidenceDetector._resetForTesting();
  sig005DepositPathwayDetector._resetForTesting();
  loc001GraphAuthDetector._resetForTesting();
});

// ---------------------------------------------------------------------------
// INJ-006 — BRDG-004 — Silent Violation
// ---------------------------------------------------------------------------

describe("INJ-006 — BRDG-004 — Silent Violation: Policy Violation Without Escalation Candidate", () => {
  it("BRDG-004 fires at window expiry when no escalation candidate is paired", () => {
    // --- Snapshot ---
    console.log("[INJ-006] Snapshot: openViolationCount=0, alertCount=0");
    expect(brdg004SilentViolationDetector.openViolationCount()).toBe(0);
    expect(brdg004SilentViolationDetector.alertCount()).toBe(0);

    // --- Inject ---
    const violation: PolicyViolationEvent = {
      event_id: "inj006-violation-001",
      decision_id: "decision-silent-001",
      agent_id: "the-bridge",
      timestamp: "2026-03-21T12:00:00.000Z",
    };
    console.log(
      "[INJ-006] Injecting POLICY_VIOLATION_DETECTED — suppressing ESCALATION_CANDIDATE_FORMED",
    );
    brdg004SilentViolationDetector.registerPolicyViolation(violation);
    console.log(
      "[INJ-006] Violation registered. Triggering checkWindowExpiry (no candidate paired)",
    );
    const tick = "2026-03-21T12:10:00.000Z";
    const results = brdg004SilentViolationDetector.checkWindowExpiry(tick);
    console.log("[INJ-006] checkWindowExpiry returned:", JSON.stringify(results[0], null, 2));

    // --- Criterion 1: BRDG-004 fires ---
    console.log("[INJ-006] Criterion 1: BRDG-004 fires within window");
    expect(results).toHaveLength(1);
    expect(results[0].rule_fired).toBe(true);
    if (results[0].rule_fired) {
      expect(results[0].alert.rule_id).toBe("BRDG-004");
      expect(results[0].alert.decision_id).toBe("decision-silent-001");
    }

    // --- Criterion 2: Gauge anomaly alert emitted ---
    console.log("[INJ-006] Criterion 2: Gauge anomaly alert emitted");
    expect(results[0].rule_fired).toBe(true);
    if (results[0].rule_fired) {
      expect(results[0].anomaly_alert_emitted).toBe(true);
      expect(results[0].alert.anomaly_type).toBe("SILENT_VIOLATION");
      expect(results[0].alert.producer).toBe("Gauge");
    }

    // --- Criterion 3: Bridge notified ---
    console.log("[INJ-006] Criterion 3: Bridge notified");
    if (results[0].rule_fired) {
      expect(results[0].alert.bridge_notified).toBe(true);
    }

    expect(brdg004SilentViolationDetector.alertCount()).toBe(1);

    // --- Restore ---
    brdg004SilentViolationDetector._resetForTesting();
    console.log("[INJ-006] Restore: alertCount=", brdg004SilentViolationDetector.alertCount());
    expect(brdg004SilentViolationDetector.alertCount()).toBe(0);
    expect(brdg004SilentViolationDetector.openViolationCount()).toBe(0);
    console.log("[INJ-006] PASS — clean state confirmed");
  });

  it("control: BRDG-004 does not fire when escalation candidate is paired before window", () => {
    const violation: PolicyViolationEvent = {
      event_id: "inj006-ctrl-violation",
      decision_id: "decision-ctrl-001",
      agent_id: "the-bridge",
      timestamp: "2026-03-21T12:00:00.000Z",
    };
    const candidate: EscalationCandidateFormedEvent = {
      event_id: "inj006-ctrl-candidate",
      source_decision_id: "decision-ctrl-001",
      timestamp: "2026-03-21T12:01:00.000Z",
    };
    brdg004SilentViolationDetector.registerPolicyViolation(violation);
    brdg004SilentViolationDetector.registerEscalationCandidate(candidate);
    const results = brdg004SilentViolationDetector.checkWindowExpiry("2026-03-21T12:10:00.000Z");
    expect(results[0].rule_fired).toBe(false);
    expect(brdg004SilentViolationDetector.alertCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// INJ-007 — BRDG-002 — Untraced Routing Decision
// ---------------------------------------------------------------------------

describe("INJ-007 — BRDG-002 — Untraced Routing Decision", () => {
  it("BRDG-002 fires when ROUTING_DECISION_EXECUTED has no prior ROUTING_DECISION_FORMED", () => {
    // --- Snapshot ---
    console.log("[INJ-007] Snapshot: coverage_rate=1.0, alertCount=0");
    expect(brdg002UntracedRoutingDetector.getCoverageRate()).toBe(1.0);
    expect(brdg002UntracedRoutingDetector.alertCount()).toBe(0);

    // --- Inject ---
    const executed: RoutingDecisionExecutedEvent = {
      event_id: "inj007-exec-001",
      decision_id: "routing-untraced-001",
      agent_id: "the-bridge",
      timestamp: "2026-03-21T12:00:00.000Z",
    };
    console.log(
      "[INJ-007] Injecting ROUTING_DECISION_EXECUTED with no prior ROUTING_DECISION_FORMED",
    );
    const result = brdg002UntracedRoutingDetector.checkRoutingDecisionExecuted(executed);
    console.log(
      "[INJ-007] checkRoutingDecisionExecuted returned:",
      JSON.stringify(result, null, 2),
    );

    // --- Criterion 1: BRDG-002 fires ---
    console.log("[INJ-007] Criterion 1: BRDG-002 fires");
    expect(result.compliant).toBe(false);
    if (!result.compliant) {
      expect(result.alert.rule_id).toBe("BRDG-002");
      expect(result.alert.decision_id).toBe("routing-untraced-001");
    }

    // --- Criterion 2: Coverage rate drops below 100% ---
    console.log("[INJ-007] Criterion 2: coverage rate drops below 100%");
    if (!result.compliant) {
      expect(result.coverage_rate).toBeLessThan(1.0);
      expect(result.coverage_rate).toBe(0);
    }
    expect(brdg002UntracedRoutingDetector.getCoverageRate()).toBeLessThan(1.0);

    // --- Criterion 3: Gauge anomaly alert emitted ---
    console.log("[INJ-007] Criterion 3: Gauge anomaly alert emitted");
    if (!result.compliant) {
      expect(result.anomaly_alert_emitted).toBe(true);
      expect(result.alert.anomaly_type).toBe("UNTRACED_ROUTING");
      expect(result.alert.producer).toBe("Gauge");
      expect(result.alert.bridge_notified).toBe(true);
    }

    expect(brdg002UntracedRoutingDetector.alertCount()).toBe(1);

    // --- Restore ---
    brdg002UntracedRoutingDetector._resetForTesting();
    console.log(
      "[INJ-007] Restore: coverage_rate=",
      brdg002UntracedRoutingDetector.getCoverageRate(),
    );
    expect(brdg002UntracedRoutingDetector.getCoverageRate()).toBe(1.0);
    expect(brdg002UntracedRoutingDetector.alertCount()).toBe(0);
    console.log("[INJ-007] PASS — clean state confirmed");
  });

  it("control: BRDG-002 does not fire when ROUTING_DECISION_FORMED precedes execution", () => {
    const formed: RoutingDecisionFormedEvent = {
      event_id: "inj007-ctrl-formed",
      decision_id: "routing-ctrl-001",
      agent_id: "the-bridge",
      timestamp: "2026-03-21T12:00:00.000Z",
    };
    const executed: RoutingDecisionExecutedEvent = {
      event_id: "inj007-ctrl-exec",
      decision_id: "routing-ctrl-001",
      agent_id: "the-bridge",
      timestamp: "2026-03-21T12:00:01.000Z",
    };
    brdg002UntracedRoutingDetector.registerRoutingDecisionFormed(formed);
    const result = brdg002UntracedRoutingDetector.checkRoutingDecisionExecuted(executed);
    expect(result.compliant).toBe(true);
    expect(brdg002UntracedRoutingDetector.alertCount()).toBe(0);
    expect(brdg002UntracedRoutingDetector.getCoverageRate()).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// INJ-008 — BRDG-007 + MEC-003 — Unauthorized Memory Commit
// ---------------------------------------------------------------------------

describe("INJ-008 — BRDG-007 + MEC-003 — Unauthorized Memory Commit", () => {
  it("BRDG-007 and MEC-003 both fire when MEMORY_WRITE_EXECUTED has no valid commit_token", () => {
    // --- Snapshot ---
    console.log(
      "[INJ-008] Snapshot: unauthorizedWriteCount=0, brdg007AlertCount=0, mec003AlertCount=0",
    );
    expect(brdg007Mec003MemoryAuthDetector.getUnauthorizedWriteCount()).toBe(0);
    expect(brdg007Mec003MemoryAuthDetector.brdg007AlertCount()).toBe(0);
    expect(brdg007Mec003MemoryAuthDetector.mec003AlertCount()).toBe(0);

    // --- Inject ---
    const write: MemoryWriteExecutedEvent = {
      event_id: "inj008-write-001",
      write_id: "mem-write-unauthorized-001",
      agent_id: "locus",
      commit_token: null,
      timestamp: "2026-03-21T12:00:00.000Z",
    };
    console.log("[INJ-008] Injecting MEMORY_WRITE_EXECUTED with no valid commit_token");
    const result = brdg007Mec003MemoryAuthDetector.checkMemoryWrite(write);
    console.log("[INJ-008] checkMemoryWrite returned:", JSON.stringify(result, null, 2));

    // --- Criterion 1: BRDG-007 fires ---
    console.log("[INJ-008] Criterion 1: BRDG-007 fires");
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.brdg007_alert.rule_id).toBe("BRDG-007");
      expect(result.brdg007_alert.unauthorized_commit).toBe(true);
      expect(result.brdg007_alert.write_id).toBe("mem-write-unauthorized-001");
    }

    // --- Criterion 2: Unauthorized commit rate increments above zero ---
    console.log("[INJ-008] Criterion 2: unauthorized commit rate > 0");
    if (!result.authorized) {
      expect(result.unauthorized_commit_rate).toBeGreaterThan(0);
    }
    expect(brdg007Mec003MemoryAuthDetector.getUnauthorizedWriteCount()).toBeGreaterThan(0);

    // --- Criterion 3: MEC-003 flags missing authorization ---
    console.log("[INJ-008] Criterion 3: MEC-003 flags missing authorization");
    if (!result.authorized) {
      expect(result.mec003_alert.rule_id).toBe("MEC-003");
      expect(result.mec003_alert.authorization_missing).toBe(true);
      expect(result.mec003_alert.bypass_bridge).toBe(true);
    }

    // --- Criterion 4: Bridge notified ---
    console.log("[INJ-008] Criterion 4: Bridge notified");
    if (!result.authorized) {
      expect(result.bridge_notified).toBe(true);
      expect(result.brdg007_alert.bridge_notified).toBe(true);
    }

    expect(brdg007Mec003MemoryAuthDetector.brdg007AlertCount()).toBe(1);
    expect(brdg007Mec003MemoryAuthDetector.mec003AlertCount()).toBe(1);

    // --- Restore ---
    brdg007Mec003MemoryAuthDetector._resetForTesting();
    console.log(
      "[INJ-008] Restore: unauthorizedWriteCount=",
      brdg007Mec003MemoryAuthDetector.getUnauthorizedWriteCount(),
    );
    expect(brdg007Mec003MemoryAuthDetector.getUnauthorizedWriteCount()).toBe(0);
    expect(brdg007Mec003MemoryAuthDetector.brdg007AlertCount()).toBe(0);
    expect(brdg007Mec003MemoryAuthDetector.mec003AlertCount()).toBe(0);
    console.log("[INJ-008] PASS — clean state confirmed");
  });

  it("control: authorized when commit_token matches approved adjudication", () => {
    const adjudication: AdjudicationCompletedEvent = {
      event_id: "inj008-ctrl-adj",
      commit_token: "token-approved-abc123",
      outcome: "approved",
      timestamp: "2026-03-21T11:59:00.000Z",
    };
    const write: MemoryWriteExecutedEvent = {
      event_id: "inj008-ctrl-write",
      write_id: "mem-write-ctrl-001",
      agent_id: "locus",
      commit_token: "token-approved-abc123",
      timestamp: "2026-03-21T12:00:00.000Z",
    };
    brdg007Mec003MemoryAuthDetector.registerAdjudication(adjudication);
    const result = brdg007Mec003MemoryAuthDetector.checkMemoryWrite(write);
    expect(result.authorized).toBe(true);
    expect(brdg007Mec003MemoryAuthDetector.brdg007AlertCount()).toBe(0);
    expect(brdg007Mec003MemoryAuthDetector.mec003AlertCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// INJ-009 — GAU-006 — Suppressed Anomaly Alert
// ---------------------------------------------------------------------------

describe("INJ-009 — GAU-006 — Suppressed Anomaly Alert", () => {
  it("GAU-006 fires at window expiry when ANOMALY_ALERT_EMITTED is suppressed", () => {
    // --- Snapshot ---
    console.log("[INJ-009] Snapshot: suppressedCount=0, alertCount=0");
    expect(gau006SuppressedAnomalyDetector.getSuppressedCount()).toBe(0);
    expect(gau006SuppressedAnomalyDetector.alertCount()).toBe(0);

    // --- Inject ---
    const crossing: ThresholdCrossingEvent = {
      event_id: "inj009-crossing-001",
      metric_id: "drawdown_risk_index",
      measured_value: 0.35,
      threshold_value: 0.2,
      agent_id: "vault",
      timestamp: "2026-03-21T12:00:00.000Z",
    };
    console.log("[INJ-009] Injecting threshold crossing — suppressing ANOMALY_ALERT_EMITTED");
    gau006SuppressedAnomalyDetector.registerThresholdCrossing(crossing);
    console.log("[INJ-009] Triggering checkWindowExpiry (no anomaly alert paired)");
    const tick = "2026-03-21T12:10:00.000Z";
    const results = gau006SuppressedAnomalyDetector.checkWindowExpiry(tick);
    console.log("[INJ-009] checkWindowExpiry returned:", JSON.stringify(results[0], null, 2));

    // --- Criterion 1: GAU-006 fires when window elapses ---
    console.log("[INJ-009] Criterion 1: GAU-006 fires at window expiry");
    expect(results).toHaveLength(1);
    expect(results[0].rule_fired).toBe(true);
    if (results[0].rule_fired) {
      expect(results[0].alert.rule_id).toBe("GAU-006");
      expect(results[0].alert.suppressed_anomaly).toBe(true);
      expect(results[0].alert.metric_id).toBe("drawdown_risk_index");
    }

    // --- Criterion 2: Suppressed anomaly count increments ---
    console.log("[INJ-009] Criterion 2: suppressed anomaly count > 0");
    expect(gau006SuppressedAnomalyDetector.getSuppressedCount()).toBeGreaterThan(0);
    expect(gau006SuppressedAnomalyDetector.getSuppressedCount()).toBe(1);

    // --- Criterion 3: Bridge notified ---
    console.log("[INJ-009] Criterion 3: Bridge notified");
    if (results[0].rule_fired) {
      expect(results[0].alert.bridge_notified).toBe(true);
    }

    // --- Restore ---
    gau006SuppressedAnomalyDetector._resetForTesting();
    console.log(
      "[INJ-009] Restore: suppressedCount=",
      gau006SuppressedAnomalyDetector.getSuppressedCount(),
    );
    expect(gau006SuppressedAnomalyDetector.getSuppressedCount()).toBe(0);
    expect(gau006SuppressedAnomalyDetector.alertCount()).toBe(0);
    console.log("[INJ-009] PASS — clean state confirmed");
  });

  it("control: GAU-006 does not fire when anomaly alert is paired before window", () => {
    const crossing: ThresholdCrossingEvent = {
      event_id: "inj009-ctrl-crossing",
      metric_id: "portfolio_risk",
      measured_value: 0.9,
      threshold_value: 0.8,
      agent_id: "gauge",
      timestamp: "2026-03-21T12:00:00.000Z",
    };
    const alert: AnomalyAlertEmittedEvent = {
      event_id: "inj009-ctrl-alert",
      source_metric_id: "portfolio_risk",
      timestamp: "2026-03-21T12:01:00.000Z",
    };
    gau006SuppressedAnomalyDetector.registerThresholdCrossing(crossing);
    gau006SuppressedAnomalyDetector.registerAnomalyAlert(alert);
    const results = gau006SuppressedAnomalyDetector.checkWindowExpiry("2026-03-21T12:10:00.000Z");
    expect(results[0].rule_fired).toBe(false);
    expect(gau006SuppressedAnomalyDetector.getSuppressedCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// INJ-010 — GAU-002 — Formula Version Drift
// ---------------------------------------------------------------------------

describe("INJ-010 — GAU-002 — Formula Version Drift", () => {
  it("GAU-002 fires when PERFORMANCE_REPORT_EMITTED references stale formula_version", () => {
    // --- Snapshot ---
    console.log(
      "[INJ-010] Snapshot: alertCount=0, locked registry:",
      JSON.stringify(LOCKED_FORMULA_REGISTRY),
    );
    expect(gau002FormulaVersionDetector.alertCount()).toBe(0);

    // --- Inject ---
    const report: PerformanceReportEmittedEvent = {
      event_id: "inj010-report-001",
      report_id: "perf-report-stale-001",
      agent_id: "vault",
      metrics: [
        {
          metric_id: "portfolio_sharpe_ratio",
          formula_version: "v1", // stale — current is v3
          value: 1.42,
        },
        {
          metric_id: "drawdown_risk_index",
          formula_version: "v1", // current — OK
          value: 0.18,
        },
      ],
      timestamp: "2026-03-21T12:00:00.000Z",
    };
    console.log(
      "[INJ-010] Injecting PERFORMANCE_REPORT_EMITTED with portfolio_sharpe_ratio@v1 (stale, current=v3)",
    );
    const result = gau002FormulaVersionDetector.checkPerformanceReport(report);
    console.log("[INJ-010] checkPerformanceReport returned:", JSON.stringify(result, null, 2));

    // --- Criterion 1: GAU-002 fires ---
    console.log("[INJ-010] Criterion 1: GAU-002 fires");
    expect(result.compliant).toBe(false);
    if (!result.compliant) {
      expect(result.alert.rule_id).toBe("GAU-002");
      expect(result.alert.report_id).toBe("perf-report-stale-001");
    }

    // --- Criterion 2: Affected metric flagged as stale ---
    console.log("[INJ-010] Criterion 2: stale metric flagged");
    if (!result.compliant) {
      expect(result.alert.stale_metrics).toHaveLength(1);
      expect(result.alert.stale_metrics[0].metric_id).toBe("portfolio_sharpe_ratio");
      expect(result.alert.stale_metrics[0].reported_version).toBe("v1");
      expect(result.alert.stale_metrics[0].current_version).toBe("v3");
    }

    // --- Criterion 3: Bridge notified ---
    console.log("[INJ-010] Criterion 3: Bridge notified");
    if (!result.compliant) {
      expect(result.alert.bridge_notified).toBe(true);
    }

    // --- Restore ---
    gau002FormulaVersionDetector._resetForTesting();
    console.log("[INJ-010] Restore: alertCount=", gau002FormulaVersionDetector.alertCount());
    expect(gau002FormulaVersionDetector.alertCount()).toBe(0);
    console.log("[INJ-010] PASS — clean state confirmed");
  });

  it("control: GAU-002 does not fire when all metrics use current formula versions", () => {
    const report: PerformanceReportEmittedEvent = {
      event_id: "inj010-ctrl-report",
      report_id: "perf-report-ctrl-001",
      agent_id: "vault",
      metrics: [
        { metric_id: "portfolio_sharpe_ratio", formula_version: "v3", value: 1.5 },
        { metric_id: "strategy_confidence_score", formula_version: "v2", value: 0.8 },
        { metric_id: "drawdown_risk_index", formula_version: "v1", value: 0.1 },
      ],
      timestamp: "2026-03-21T12:00:00.000Z",
    };
    const result = gau002FormulaVersionDetector.checkPerformanceReport(report);
    expect(result.compliant).toBe(true);
    expect(gau002FormulaVersionDetector.alertCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// INJ-011 — GAU-001 — Coverage Gap: Active Agent Telemetry Absent
// ---------------------------------------------------------------------------

describe("INJ-011 — GAU-001 — Coverage Gap: Active Agent Telemetry Absent", () => {
  it("GAU-001 fires at cycle close when active agent telemetry is absent", () => {
    // --- Snapshot ---
    console.log("[INJ-011] Snapshot: expectedAgents=[], alertCount=0");
    expect(gau001CoverageGapDetector.alertCount()).toBe(0);

    // --- Inject ---
    console.log("[INJ-011] Registering active agents: vault, signal, locus");
    gau001CoverageGapDetector.registerActiveAgents(["vault", "signal", "locus"]);

    console.log("[INJ-011] Silencing locus telemetry — only vault and signal report");
    const vaultTelemetry: AgentTelemetryEvent = {
      event_id: "inj011-tel-vault",
      agent_id: "vault",
      timestamp: "2026-03-21T12:05:00.000Z",
    };
    const signalTelemetry: AgentTelemetryEvent = {
      event_id: "inj011-tel-signal",
      agent_id: "signal",
      timestamp: "2026-03-21T12:06:00.000Z",
    };
    gau001CoverageGapDetector.registerTelemetry(vaultTelemetry);
    gau001CoverageGapDetector.registerTelemetry(signalTelemetry);
    // locus does NOT report

    const tick = "2026-03-21T12:15:00.000Z";
    console.log("[INJ-011] Triggering checkWindowExpiry (locus absent for full cycle)");
    const result = gau001CoverageGapDetector.checkWindowExpiry(tick);
    console.log("[INJ-011] checkWindowExpiry returned:", JSON.stringify(result, null, 2));

    // --- Criterion 1: GAU-001 fires at cycle close ---
    console.log("[INJ-011] Criterion 1: GAU-001 fires");
    expect(result.rule_fired).toBe(true);
    if (result.rule_fired) {
      expect(result.alert.rule_id).toBe("GAU-001");
    }

    // --- Criterion 2: Coverage rate drops below 1.0 ---
    console.log("[INJ-011] Criterion 2: coverage rate < 1.0");
    if (result.rule_fired) {
      expect(result.coverage_rate).toBeLessThan(1.0);
      // 2 of 3 reported → 0.666...
      expect(result.coverage_rate).toBeCloseTo(2 / 3, 5);
    }

    // --- Criterion 3: Absent agent identified by name ---
    console.log("[INJ-011] Criterion 3: absent agent identified");
    if (result.rule_fired) {
      expect(result.alert.absent_agents).toContain("locus");
      expect(result.alert.absent_agents).not.toContain("vault");
      expect(result.alert.absent_agents).not.toContain("signal");
    }

    // --- Criterion 4: Bridge notified ---
    console.log("[INJ-011] Criterion 4: Bridge notified");
    if (result.rule_fired) {
      expect(result.alert.bridge_notified).toBe(true);
    }

    expect(gau001CoverageGapDetector.alertCount()).toBe(1);

    // --- Restore ---
    gau001CoverageGapDetector._resetForTesting();
    console.log("[INJ-011] Restore: alertCount=", gau001CoverageGapDetector.alertCount());
    expect(gau001CoverageGapDetector.alertCount()).toBe(0);
    console.log("[INJ-011] PASS — clean state confirmed");
  });

  it("control: GAU-001 does not fire when all active agents report", () => {
    gau001CoverageGapDetector.registerActiveAgents(["vault", "signal"]);
    gau001CoverageGapDetector.registerTelemetry({
      event_id: "t1",
      agent_id: "vault",
      timestamp: "2026-03-21T12:01:00.000Z",
    });
    gau001CoverageGapDetector.registerTelemetry({
      event_id: "t2",
      agent_id: "signal",
      timestamp: "2026-03-21T12:02:00.000Z",
    });
    const result = gau001CoverageGapDetector.checkWindowExpiry("2026-03-21T12:15:00.000Z");
    expect(result.rule_fired).toBe(false);
    expect(gau001CoverageGapDetector.alertCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// INJ-012 — CRU-002 — Reflection Without Evidence
// ---------------------------------------------------------------------------

describe("INJ-012 — CRU-002 — Reflection Without Evidence", () => {
  it("CRU-002 fires when REFLECTION_CANDIDATE_FORMED has null learner_evidence_used", () => {
    // --- Snapshot ---
    console.log("[INJ-012] Snapshot: nullReflectionCount=0, alertCount=0");
    expect(cru002ReflectionEvidenceDetector.getNullReflectionCount()).toBe(0);
    expect(cru002ReflectionEvidenceDetector.alertCount()).toBe(0);

    // --- Inject ---
    const candidate: ReflectionCandidateFormedEvent = {
      event_id: "inj012-candidate-001",
      candidate_id: "reflection-no-evidence-001",
      agent_id: "crucible",
      learner_evidence_used: null,
      timestamp: "2026-03-21T12:00:00.000Z",
    };
    console.log("[INJ-012] Injecting REFLECTION_CANDIDATE_FORMED with learner_evidence_used=null");
    const result = cru002ReflectionEvidenceDetector.checkReflectionCandidate(candidate);
    console.log("[INJ-012] checkReflectionCandidate returned:", JSON.stringify(result, null, 2));

    // --- Criterion 1: CRU-002 fires ---
    console.log("[INJ-012] Criterion 1: CRU-002 fires");
    expect(result.compliant).toBe(false);
    if (!result.compliant) {
      expect(result.alert.rule_id).toBe("CRU-002");
      expect(result.alert.candidate_id).toBe("reflection-no-evidence-001");
    }

    // --- Criterion 2: null_reflection_count increments above zero ---
    console.log("[INJ-012] Criterion 2: null_reflection_count > 0");
    if (!result.compliant) {
      expect(result.null_reflection_count).toBeGreaterThan(0);
      expect(result.null_reflection_count).toBe(1);
    }
    expect(cru002ReflectionEvidenceDetector.getNullReflectionCount()).toBeGreaterThan(0);

    // --- Criterion 3: Evidence-linked reflection rate drops below 100% ---
    console.log("[INJ-012] Criterion 3: evidence_linked_rate < 1.0");
    if (!result.compliant) {
      expect(result.evidence_linked_rate).toBeLessThan(1.0);
      expect(result.evidence_linked_rate).toBe(0);
    }

    // --- Criterion 4: Bridge notified ---
    console.log("[INJ-012] Criterion 4: Bridge notified");
    if (!result.compliant) {
      expect(result.alert.bridge_notified).toBe(true);
    }

    // --- Restore ---
    cru002ReflectionEvidenceDetector._resetForTesting();
    console.log(
      "[INJ-012] Restore: nullReflectionCount=",
      cru002ReflectionEvidenceDetector.getNullReflectionCount(),
    );
    expect(cru002ReflectionEvidenceDetector.getNullReflectionCount()).toBe(0);
    expect(cru002ReflectionEvidenceDetector.alertCount()).toBe(0);
    console.log("[INJ-012] PASS — clean state confirmed");
  });

  it("control: CRU-002 does not fire when learner evidence is present", () => {
    const candidate: ReflectionCandidateFormedEvent = {
      event_id: "inj012-ctrl-candidate",
      candidate_id: "reflection-with-evidence-001",
      agent_id: "crucible",
      learner_evidence_used: ["quiz-result-007", "exercise-completion-003"],
      timestamp: "2026-03-21T12:00:00.000Z",
    };
    const result = cru002ReflectionEvidenceDetector.checkReflectionCandidate(candidate);
    expect(result.compliant).toBe(true);
    expect(cru002ReflectionEvidenceDetector.getNullReflectionCount()).toBe(0);
    expect(cru002ReflectionEvidenceDetector.alertCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// INJ-019 — SIG-005 — Deposit Pathway Integrity Failure
// ---------------------------------------------------------------------------

describe("INJ-019 — SIG-005 — Deposit Pathway Integrity Failure", () => {
  it("SIG-005 fires immediately when BRIEF_DEPOSITED targets wrong store", () => {
    // --- Snapshot ---
    console.log(
      "[INJ-019] Snapshot: complianceRate=1.0, alertCount=0, authorizedTarget=",
      AUTHORIZED_DEPOSIT_TARGET,
    );
    expect(sig005DepositPathwayDetector.getComplianceRate()).toBe(1);
    expect(sig005DepositPathwayDetector.alertCount()).toBe(0);

    // --- Inject ---
    const deposit: BriefDepositedEvent = {
      event_id: "inj019-deposit-001",
      brief_id: "brief-wrong-target-001",
      agent_id: "signal",
      deposit_target: "main_knowledge_graph", // wrong — not AUTHORIZED_DEPOSIT_TARGET
      timestamp: "2026-03-21T12:00:00.000Z",
    };
    console.log(
      "[INJ-019] Injecting BRIEF_DEPOSITED targeting 'main_knowledge_graph' (unauthorized)",
    );
    const result = sig005DepositPathwayDetector.checkBriefDeposit(deposit);
    console.log("[INJ-019] checkBriefDeposit returned:", JSON.stringify(result, null, 2));

    // --- Criterion 1: SIG-005 fires immediately ---
    console.log("[INJ-019] Criterion 1: SIG-005 fires immediately");
    expect(result.compliant).toBe(false);
    if (!result.compliant) {
      expect(result.alert.rule_id).toBe("SIG-005");
      expect(result.alert.actual_target).toBe("main_knowledge_graph");
      expect(result.alert.authorized_target).toBe(AUTHORIZED_DEPOSIT_TARGET);
    }

    // --- Criterion 2: Deposit pathway compliance rate drops below 1.0 ---
    console.log("[INJ-019] Criterion 2: compliance rate < 1.0");
    if (!result.compliant) {
      expect(result.deposit_pathway_compliance_rate).toBeLessThan(1.0);
      expect(result.deposit_pathway_compliance_rate).toBe(0);
    }
    expect(sig005DepositPathwayDetector.getComplianceRate()).toBeLessThan(1.0);

    // --- Criterion 3: Bridge notified ---
    console.log("[INJ-019] Criterion 3: Bridge notified");
    if (!result.compliant) {
      expect(result.alert.bridge_notified).toBe(true);
    }

    // --- Restore ---
    sig005DepositPathwayDetector._resetForTesting();
    console.log(
      "[INJ-019] Restore: complianceRate=",
      sig005DepositPathwayDetector.getComplianceRate(),
    );
    expect(sig005DepositPathwayDetector.getComplianceRate()).toBe(1);
    expect(sig005DepositPathwayDetector.alertCount()).toBe(0);
    console.log("[INJ-019] PASS — clean state confirmed");
  });

  it("control: SIG-005 does not fire when deposit_target is authorized", () => {
    const deposit: BriefDepositedEvent = {
      event_id: "inj019-ctrl-deposit",
      brief_id: "brief-correct-target-001",
      agent_id: "signal",
      deposit_target: AUTHORIZED_DEPOSIT_TARGET,
      timestamp: "2026-03-21T12:00:00.000Z",
    };
    const result = sig005DepositPathwayDetector.checkBriefDeposit(deposit);
    expect(result.compliant).toBe(true);
    expect(sig005DepositPathwayDetector.getComplianceRate()).toBe(1);
    expect(sig005DepositPathwayDetector.alertCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// INJ-020 — LOC-001 — Graph Write Without Authorization
// ---------------------------------------------------------------------------

describe("INJ-020 — LOC-001 — Graph Write Without Authorization", () => {
  it("LOC-001 fires when GRAPH_WRITE_EXECUTED has no paired GRAPH_WRITE_AUTHORIZED", () => {
    // --- Snapshot ---
    console.log("[INJ-020] Snapshot: unauthorizedWriteCount=0, alertCount=0");
    expect(loc001GraphAuthDetector.getUnauthorizedWriteCount()).toBe(0);
    expect(loc001GraphAuthDetector.alertCount()).toBe(0);

    // --- Inject ---
    const executed: GraphWriteExecutedEvent = {
      event_id: "inj020-write-001",
      write_id: "graph-write-unauthorized-001",
      agent_id: "locus",
      timestamp: "2026-03-21T12:00:00.000Z",
    };
    console.log("[INJ-020] Injecting GRAPH_WRITE_EXECUTED with no prior GRAPH_WRITE_AUTHORIZED");
    const result = loc001GraphAuthDetector.checkGraphWriteExecuted(executed);
    console.log("[INJ-020] checkGraphWriteExecuted returned:", JSON.stringify(result, null, 2));

    // --- Criterion 1: LOC-001 fires ---
    console.log("[INJ-020] Criterion 1: LOC-001 fires");
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.alert.rule_id).toBe("LOC-001");
      expect(result.alert.unauthorized_write).toBe(true);
      expect(result.alert.write_id).toBe("graph-write-unauthorized-001");
    }

    // --- Criterion 2: Unauthorized write rate increments above zero ---
    console.log("[INJ-020] Criterion 2: unauthorized write rate > 0");
    if (!result.authorized) {
      expect(result.unauthorized_write_rate).toBeGreaterThan(0);
      expect(result.unauthorized_write_rate).toBe(1.0);
    }
    expect(loc001GraphAuthDetector.getUnauthorizedWriteCount()).toBeGreaterThan(0);

    // --- Criterion 3: Bridge notified ---
    console.log("[INJ-020] Criterion 3: Bridge notified");
    if (!result.authorized) {
      expect(result.alert.bridge_notified).toBe(true);
    }

    expect(loc001GraphAuthDetector.alertCount()).toBe(1);

    // --- Restore ---
    loc001GraphAuthDetector._resetForTesting();
    console.log(
      "[INJ-020] Restore: unauthorizedWriteCount=",
      loc001GraphAuthDetector.getUnauthorizedWriteCount(),
    );
    expect(loc001GraphAuthDetector.getUnauthorizedWriteCount()).toBe(0);
    expect(loc001GraphAuthDetector.alertCount()).toBe(0);
    console.log("[INJ-020] PASS — clean state confirmed");
  });

  it("control: LOC-001 does not fire when GRAPH_WRITE_AUTHORIZED precedes execution", () => {
    const authorized: GraphWriteAuthorizedEvent = {
      event_id: "inj020-ctrl-auth",
      write_id: "graph-write-ctrl-001",
      timestamp: "2026-03-21T11:59:00.000Z",
    };
    const executed: GraphWriteExecutedEvent = {
      event_id: "inj020-ctrl-exec",
      write_id: "graph-write-ctrl-001",
      agent_id: "locus",
      timestamp: "2026-03-21T12:00:00.000Z",
    };
    loc001GraphAuthDetector.registerGraphWriteAuthorized(authorized);
    const result = loc001GraphAuthDetector.checkGraphWriteExecuted(executed);
    expect(result.authorized).toBe(true);
    expect(loc001GraphAuthDetector.getUnauthorizedWriteCount()).toBe(0);
    expect(loc001GraphAuthDetector.alertCount()).toBe(0);
  });
});
