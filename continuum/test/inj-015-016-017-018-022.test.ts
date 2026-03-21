/**
 * continuum/test/inj-015-016-017-018-022.test.ts
 *
 * PACS-VALIDATION-001 Stage 3 Round 4 Injection Tests
 * Level 3 — Analytical Performance Degradation
 *
 * INJ-015: VLT-010 — Persistent Miscalibration (three consecutive P2b failures)
 * INJ-016: GAU-003 — Stale Forecast (material change without recomputation)
 * INJ-017: VLT-009 — Risk Coverage Gap (required risk category absent)
 * INJ-018: CRU-003 — Premature Curriculum Advancement
 * INJ-022: GAU-009 — Gauge Self-Evaluation Attempt
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cru003PrematureAdvancementDetector } from "../governance/cru-003-premature-advancement.js";
import { gau003StaleForecastDetector } from "../governance/gau-003-stale-forecast.js";
import {
  GAUGE_SELF_METRIC_IDS,
  gau009SelfEvaluationDetector,
} from "../governance/gau-009-self-evaluation.js";
import {
  VAULT_RISK_COVERAGE_REGISTRY,
  vlt009RiskCoverageDetector,
} from "../governance/vlt-009-risk-coverage.js";
import {
  CALIBRATION_THRESHOLD,
  MISCALIBRATION_CONSECUTIVE_LIMIT,
  vlt010PersistentMiscalibrationDetector,
} from "../governance/vlt-010-persistent-miscalibration.js";

beforeEach(() => {
  vlt010PersistentMiscalibrationDetector._resetForTesting();
  gau003StaleForecastDetector._resetForTesting();
  vlt009RiskCoverageDetector._resetForTesting();
  cru003PrematureAdvancementDetector._resetForTesting();
  gau009SelfEvaluationDetector._resetForTesting();
});

afterEach(() => {
  vlt010PersistentMiscalibrationDetector._resetForTesting();
  gau003StaleForecastDetector._resetForTesting();
  vlt009RiskCoverageDetector._resetForTesting();
  cru003PrematureAdvancementDetector._resetForTesting();
  gau009SelfEvaluationDetector._resetForTesting();
});

// ---------------------------------------------------------------------------
// INJ-015 — VLT-010 — Persistent Miscalibration
// ---------------------------------------------------------------------------

describe("INJ-015 — VLT-010 — Persistent Miscalibration", () => {
  it("VLT-010 fires after three consecutive below-threshold calibration events for P2b surface", () => {
    console.log(
      `[INJ-015] Snapshot: alertCount=${vlt010PersistentMiscalibrationDetector.alertCount()}, ` +
        `consecutiveCount(p2b)=${vlt010PersistentMiscalibrationDetector.getConsecutiveCount("p2b")}, ` +
        `threshold=${CALIBRATION_THRESHOLD}, limit=${MISCALIBRATION_CONSECUTIVE_LIMIT}`,
    );

    const base = { surface_id: "p2b", agent_id: "vault", timestamp: new Date().toISOString() };

    console.log(
      "[INJ-015] Injecting CALIBRATION_AUDIT_EMITTED #1: score=0.65 (below threshold=0.8)",
    );
    const r1 = vlt010PersistentMiscalibrationDetector.checkCalibrationAudit({
      event_id: "cal-001",
      ...base,
      calibration_score: 0.65,
    });
    expect(r1.triggered).toBe(false);

    console.log("[INJ-015] Injecting CALIBRATION_AUDIT_EMITTED #2: score=0.70 (below threshold)");
    const r2 = vlt010PersistentMiscalibrationDetector.checkCalibrationAudit({
      event_id: "cal-002",
      ...base,
      calibration_score: 0.7,
    });
    expect(r2.triggered).toBe(false);

    console.log(
      "[INJ-015] Injecting CALIBRATION_AUDIT_EMITTED #3: score=0.72 (below threshold) — VLT-010 must fire",
    );
    const r3 = vlt010PersistentMiscalibrationDetector.checkCalibrationAudit({
      event_id: "cal-003",
      ...base,
      calibration_score: 0.72,
    });

    // C1: VLT-010 fires after 3rd consecutive failure
    expect(r3.triggered).toBe(true);
    if (!r3.triggered) {
      return;
    }
    console.log(`[INJ-015] C1 triggered=true ✓, consecutive_failures=${r3.consecutive_failures}`);

    // C2: persistent_miscalibration flag set
    expect(r3.alert.persistent_miscalibration).toBe(true);
    console.log(`[INJ-015] C2 persistent_miscalibration=true ✓`);

    // C3: Bridge calibration review triggered
    expect(r3.alert.calibration_review_triggered).toBe(true);
    console.log(`[INJ-015] C3 calibration_review_triggered=true ✓`);

    // C4: bridge_notified
    expect(r3.alert.bridge_notified).toBe(true);
    console.log(`[INJ-015] C4 bridge_notified=true ✓`);

    // Restore
    vlt010PersistentMiscalibrationDetector._resetForTesting();
    expect(vlt010PersistentMiscalibrationDetector.alertCount()).toBe(0);
    expect(vlt010PersistentMiscalibrationDetector.getConsecutiveCount("p2b")).toBe(0);
    console.log("[INJ-015] Restore: alertCount=0, consecutiveCount(p2b)=0 ✓");
  });

  it("VLT-010 does not fire when a passing event resets the consecutive count", () => {
    const base = { surface_id: "p2b", agent_id: "vault", timestamp: new Date().toISOString() };
    // 2 below-threshold
    vlt010PersistentMiscalibrationDetector.checkCalibrationAudit({
      event_id: "c1",
      ...base,
      calibration_score: 0.65,
    });
    vlt010PersistentMiscalibrationDetector.checkCalibrationAudit({
      event_id: "c2",
      ...base,
      calibration_score: 0.7,
    });
    // Passing event — resets counter
    vlt010PersistentMiscalibrationDetector.checkCalibrationAudit({
      event_id: "c3",
      ...base,
      calibration_score: 0.9,
    });
    // 2 more below-threshold — counter restarts from 1, should not reach 3
    vlt010PersistentMiscalibrationDetector.checkCalibrationAudit({
      event_id: "c4",
      ...base,
      calibration_score: 0.65,
    });
    const r = vlt010PersistentMiscalibrationDetector.checkCalibrationAudit({
      event_id: "c5",
      ...base,
      calibration_score: 0.7,
    });
    expect(r.triggered).toBe(false);
    expect(vlt010PersistentMiscalibrationDetector.alertCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// INJ-016 — GAU-003 — Stale Forecast
// ---------------------------------------------------------------------------

describe("INJ-016 — GAU-003 — Stale Forecast", () => {
  it("GAU-003 fires when tolerance window elapses without forecast recomputation", () => {
    console.log(
      `[INJ-016] Snapshot: alertCount=${gau003StaleForecastDetector.alertCount()}, ` +
        `staleForecastCount=${gau003StaleForecastDetector.getStaleForecastCount()}`,
    );

    const tick = new Date().toISOString();

    console.log(
      "[INJ-016] Injecting: registerFieldChange(macro_rate_environment) — suppressing FORECAST_PROJECTION_EMITTED",
    );
    gau003StaleForecastDetector.registerFieldChange({
      event_id: "fld-001",
      field_id: "macro_rate_environment",
      agent_id: "gauge",
      timestamp: tick,
    });

    // No registerForecastProjection call — recomputation suppressed
    console.log("[INJ-016] checkWindowExpiry — no projection registered");
    const result = gau003StaleForecastDetector.checkWindowExpiry(tick);

    // C1: GAU-003 fires
    expect(result.rule_fired).toBe(true);
    if (!result.rule_fired) {
      return;
    }
    console.log(`[INJ-016] C1 rule_fired=true ✓`);

    // C2: stale_forecast_count increments above zero
    expect(result.stale_forecast_count).toBeGreaterThan(0);
    console.log(`[INJ-016] C2 stale_forecast_count=${result.stale_forecast_count} > 0 ✓`);

    // C3: Bridge notified
    expect(result.alert.bridge_notified).toBe(true);
    console.log(`[INJ-016] C3 bridge_notified=true ✓`);

    // Restore
    gau003StaleForecastDetector._resetForTesting();
    expect(gau003StaleForecastDetector.alertCount()).toBe(0);
    expect(gau003StaleForecastDetector.getStaleForecastCount()).toBe(0);
    console.log("[INJ-016] Restore: alertCount=0, staleForecastCount=0 ✓");
  });

  it("GAU-003 does not fire when forecast is recomputed before window closes", () => {
    const tick = new Date().toISOString();
    gau003StaleForecastDetector.registerFieldChange({
      event_id: "fld-002",
      field_id: "macro_rate_environment",
      agent_id: "gauge",
      timestamp: tick,
    });
    gau003StaleForecastDetector.registerForecastProjection({
      event_id: "proj-001",
      agent_id: "gauge",
      timestamp: tick,
    });
    const result = gau003StaleForecastDetector.checkWindowExpiry(tick);
    expect(result.rule_fired).toBe(false);
    expect(gau003StaleForecastDetector.alertCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// INJ-017 — VLT-009 — Risk Coverage Gap
// ---------------------------------------------------------------------------

describe("INJ-017 — VLT-009 — Risk Coverage Gap", () => {
  it("VLT-009 fires when MARKET_REPORT_EMITTED is missing required risk categories", () => {
    console.log(
      `[INJ-017] Snapshot: alertCount=${vlt009RiskCoverageDetector.alertCount()}, ` +
        `required_categories=${JSON.stringify(VAULT_RISK_COVERAGE_REGISTRY)}`,
    );

    const timestamp = new Date().toISOString();

    // Omit "liquidity_risk" from the report
    console.log(
      "[INJ-017] Injecting MARKET_REPORT_EMITTED: risk_categories=[market_risk, concentration_risk, drawdown_risk] — liquidity_risk absent",
    );
    const result = vlt009RiskCoverageDetector.checkMarketReport({
      event_id: "rpt-001",
      report_id: "mkt-report-001",
      agent_id: "vault",
      risk_categories: ["market_risk", "concentration_risk", "drawdown_risk"],
      timestamp,
    });

    // C1: VLT-009 fires
    expect(result.compliant).toBe(false);
    if (result.compliant) {
      return;
    }
    console.log(`[INJ-017] C1 compliant=false ✓`);

    // C2: coverage_gap flag set
    expect(result.alert.coverage_gap).toBe(true);
    console.log(`[INJ-017] C2 coverage_gap=true ✓`);

    // C3: absent category identified
    expect(result.alert.absent_categories).toContain("liquidity_risk");
    console.log(
      `[INJ-017] C3 absent_categories=${JSON.stringify(result.alert.absent_categories)} — liquidity_risk present ✓`,
    );

    // C4: Bridge review triggered
    expect(result.alert.bridge_review_triggered).toBe(true);
    console.log(`[INJ-017] C4 bridge_review_triggered=true ✓`);

    // Restore
    vlt009RiskCoverageDetector._resetForTesting();
    expect(vlt009RiskCoverageDetector.alertCount()).toBe(0);
    console.log("[INJ-017] Restore: alertCount=0 ✓");
  });

  it("VLT-009 does not fire when all required risk categories are present", () => {
    const result = vlt009RiskCoverageDetector.checkMarketReport({
      event_id: "rpt-002",
      report_id: "mkt-report-002",
      agent_id: "vault",
      risk_categories: ["market_risk", "liquidity_risk", "concentration_risk", "drawdown_risk"],
      timestamp: new Date().toISOString(),
    });
    expect(result.compliant).toBe(true);
    expect(vlt009RiskCoverageDetector.alertCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// INJ-018 — CRU-003 — Premature Curriculum Advancement
// ---------------------------------------------------------------------------

describe("INJ-018 — CRU-003 — Premature Curriculum Advancement", () => {
  it("CRU-003 fires when CURRICULUM_POSITION_ADVANCED has no prior confirmed delivery", () => {
    console.log(
      `[INJ-018] Snapshot: alertCount=${cru003PrematureAdvancementDetector.alertCount()}, ` +
        `prematureAdvancementCount=${cru003PrematureAdvancementDetector.getPrematureAdvancementCount()}`,
    );

    const timestamp = new Date().toISOString();

    console.log(
      "[INJ-018] Injecting CURRICULUM_POSITION_ADVANCED for learner-alpha — no prior confirmed delivery registered",
    );
    const result = cru003PrematureAdvancementDetector.checkCurriculumAdvancement({
      event_id: "adv-001",
      learner_id: "learner-alpha",
      agent_id: "crucible",
      timestamp,
    });

    // C1: CRU-003 fires
    expect(result.compliant).toBe(false);
    if (result.compliant) {
      return;
    }
    console.log(`[INJ-018] C1 compliant=false ✓`);

    // C2: premature_advancement_count increments above zero
    expect(result.premature_advancement_count).toBeGreaterThan(0);
    console.log(
      `[INJ-018] C2 premature_advancement_count=${result.premature_advancement_count} > 0 ✓`,
    );

    // C3: Bridge notified
    expect(result.alert.bridge_notified).toBe(true);
    console.log(`[INJ-018] C3 bridge_notified=true ✓`);

    // Restore
    cru003PrematureAdvancementDetector._resetForTesting();
    expect(cru003PrematureAdvancementDetector.alertCount()).toBe(0);
    expect(cru003PrematureAdvancementDetector.getPrematureAdvancementCount()).toBe(0);
    console.log("[INJ-018] Restore: alertCount=0, prematureAdvancementCount=0 ✓");
  });

  it("CRU-003 does not fire when confirmed delivery precedes advancement", () => {
    const timestamp = new Date().toISOString();
    cru003PrematureAdvancementDetector.registerLearningContentDelivered({
      event_id: "del-001",
      learner_id: "learner-beta",
      content_id: "module-3",
      learner_evidence_confirmed: true,
      timestamp,
    });
    const result = cru003PrematureAdvancementDetector.checkCurriculumAdvancement({
      event_id: "adv-002",
      learner_id: "learner-beta",
      agent_id: "crucible",
      timestamp,
    });
    expect(result.compliant).toBe(true);
    expect(cru003PrematureAdvancementDetector.alertCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// INJ-022 — GAU-009 — Gauge Self-Evaluation Attempt
// ---------------------------------------------------------------------------

describe("INJ-022 — GAU-009 — Gauge Self-Evaluation Attempt", () => {
  it("GAU-009 fires when PERFORMANCE_REPORT_EMITTED includes Gauge self-metrics", () => {
    console.log(
      `[INJ-022] Snapshot: alertCount=${gau009SelfEvaluationDetector.alertCount()}, ` +
        `gauge_self_metric_ids=${JSON.stringify(GAUGE_SELF_METRIC_IDS)}`,
    );

    const timestamp = new Date().toISOString();

    console.log(
      "[INJ-022] Injecting PERFORMANCE_REPORT_EMITTED with metric gauge_coverage_rate (Gauge self-metric)",
    );
    const result = gau009SelfEvaluationDetector.checkPerformanceReport({
      event_id: "rpt-003",
      report_id: "perf-report-001",
      agent_id: "gauge",
      metrics: [
        { metric_id: "portfolio_sharpe_ratio", value: 1.4 },
        { metric_id: "gauge_coverage_rate", value: 0.95 },
      ],
      timestamp,
    });

    // C1: GAU-009 fires
    expect(result.compliant).toBe(false);
    if (result.compliant) {
      return;
    }
    console.log(`[INJ-022] C1 compliant=false ✓`);

    // C2: self_evaluation flag set
    expect(result.alert.self_evaluation).toBe(true);
    console.log(
      `[INJ-022] C2 self_evaluation=true ✓, self_metric_ids=${JSON.stringify(result.alert.self_metric_ids)}`,
    );

    // C3: Bridge notified
    expect(result.alert.bridge_notified).toBe(true);
    console.log(`[INJ-022] C3 bridge_notified=true ✓`);

    // Restore
    gau009SelfEvaluationDetector._resetForTesting();
    expect(gau009SelfEvaluationDetector.alertCount()).toBe(0);
    console.log("[INJ-022] Restore: alertCount=0 ✓");
  });

  it("GAU-009 does not fire when report contains no Gauge self-metrics", () => {
    const result = gau009SelfEvaluationDetector.checkPerformanceReport({
      event_id: "rpt-004",
      report_id: "perf-report-002",
      agent_id: "gauge",
      metrics: [
        { metric_id: "portfolio_sharpe_ratio", value: 1.4 },
        { metric_id: "strategy_confidence_score", value: 0.82 },
      ],
      timestamp: new Date().toISOString(),
    });
    expect(result.compliant).toBe(true);
    expect(gau009SelfEvaluationDetector.alertCount()).toBe(0);
  });
});
