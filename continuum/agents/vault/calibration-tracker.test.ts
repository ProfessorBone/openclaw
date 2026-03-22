/**
 * continuum/agents/vault/calibration-tracker.test.ts
 *
 * Tests for CalibrationTracker using isolated temp store paths.
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CalibrationInput, CalibrationTracker } from "./calibration-tracker.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  const dir = join(tmpdir(), `vault-cal-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeTracker(dir: string): CalibrationTracker {
  return new CalibrationTracker(join(dir, "calibration.jsonl"));
}

function makeCleanInput(overrides: Partial<CalibrationInput> = {}): CalibrationInput {
  return {
    calibration_id: "cal-001",
    thesis_id: "thesis-001",
    cycle_number: 1,
    closure_state: "closed-confirmed",
    closure_date: "2026-03-21",
    evaluation_date: "2026-03-21",
    p1_compliance: true,
    p2_evaluation_completed: true,
    p3_segregation_intact: true,
    p4_violations_zero: true,
    a6_alerts_clear: true,
    record_complete_and_auditable: true,
    no_unauthorized_asset_breach: true,
    no_undocumented_thesis_modification: true,
    no_output_bypassed_bridge: true,
    thesis_quality_assessment: "Strong thesis with clear invalidation condition",
    evidence_quality_assessment: "Evidence well-sourced and documented",
    contradiction_handling_assessment: "Counterevidence acknowledged",
    discipline_assessment: "Exit discipline maintained",
    evaluator_notes: "Clean cycle — no violations observed",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = makeTempDir();
});

afterEach(() => {
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe("CalibrationTracker.recordCalibrationCycle", () => {
  it("returns recorded: true for a clean input (all nine flags true)", () => {
    const tracker = makeTracker(tmpDir);
    const result = tracker.recordCalibrationCycle(makeCleanInput());
    expect(result.recorded).toBe(true);
    if (result.recorded) {
      expect(result.record.cycle_status).toBe("clean");
      expect(result.record.taint_reasons).toHaveLength(0);
    }
  });

  it("computes tainted status when any integrity flag is false", () => {
    const tracker = makeTracker(tmpDir);
    const result = tracker.recordCalibrationCycle(
      makeCleanInput({ p4_violations_zero: false, a6_alerts_clear: false }),
    );
    expect(result.recorded).toBe(true);
    if (result.recorded) {
      expect(result.record.cycle_status).toBe("tainted");
      expect(result.record.taint_reasons).toContain("p4_violations_zero");
      expect(result.record.taint_reasons).toContain("a6_alerts_clear");
    }
  });

  it("returns duplicate for the same calibration_id", () => {
    const tracker = makeTracker(tmpDir);
    tracker.recordCalibrationCycle(makeCleanInput());
    const result = tracker.recordCalibrationCycle(makeCleanInput());
    expect(result.recorded).toBe(false);
    if (!result.recorded) {
      expect(result.reason).toBe("duplicate");
    }
  });
});

describe("CalibrationTracker query methods", () => {
  it("getCleanCycleCount returns the number of clean cycles", () => {
    const tracker = makeTracker(tmpDir);
    tracker.recordCalibrationCycle(makeCleanInput({ calibration_id: "cal-001" }));
    tracker.recordCalibrationCycle(makeCleanInput({ calibration_id: "cal-002" }));
    tracker.recordCalibrationCycle(
      makeCleanInput({ calibration_id: "cal-003", p1_compliance: false }),
    );
    expect(tracker.getCleanCycleCount()).toBe(2);
  });

  it("getTaintedCycles returns only tainted records", () => {
    const tracker = makeTracker(tmpDir);
    tracker.recordCalibrationCycle(makeCleanInput({ calibration_id: "cal-clean" }));
    tracker.recordCalibrationCycle(
      makeCleanInput({ calibration_id: "cal-tainted", no_output_bypassed_bridge: false }),
    );
    const tainted = tracker.getTaintedCycles();
    expect(tainted.length).toBe(1);
    expect(tainted[0].calibration_id).toBe("cal-tainted");
  });

  it("isRealCapitalEligible returns false with fewer than 4 clean cycles", () => {
    const tracker = makeTracker(tmpDir);
    for (let i = 1; i <= 3; i++) {
      tracker.recordCalibrationCycle(makeCleanInput({ calibration_id: `cal-${i}` }));
    }
    expect(tracker.isRealCapitalEligible()).toBe(false);
  });

  it("isRealCapitalEligible returns true with 4 clean cycles", () => {
    const tracker = makeTracker(tmpDir);
    for (let i = 1; i <= 4; i++) {
      tracker.recordCalibrationCycle(makeCleanInput({ calibration_id: `cal-${i}` }));
    }
    expect(tracker.isRealCapitalEligible()).toBe(true);
  });

  it("isRetirementEligible returns true after 1 clean cycle", () => {
    const tracker = makeTracker(tmpDir);
    tracker.recordCalibrationCycle(makeCleanInput());
    expect(tracker.isRetirementEligible()).toBe(true);
  });
});
