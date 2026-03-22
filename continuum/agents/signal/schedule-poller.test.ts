/**
 * continuum/agents/signal/schedule-poller.test.ts
 *
 * Focused tests for the Signal schedule poller logic.
 * Does NOT test gateway dispatch — that pathway is already proven by Stage 4 WL3.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SignalOperationalConfig,
  appendLedgerEntry,
  buildActivationMessage,
  getPeriodKey,
  hasDispatchedForPeriod,
  isInProgress,
  isInScheduleWindow,
  runPoller,
} from "./schedule-poller.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  const dir = join(tmpdir(), `signal-poller-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeConfig(overrides: Partial<SignalOperationalConfig> = {}): SignalOperationalConfig {
  return {
    config_version: "1.0.0",
    signal_enabled: true,
    schedule: {
      cadence: "weekly",
      day_of_week: "sunday",
      hour_utc: 6,
      timezone_display: "America/New_York",
    },
    retrieval_scope: { domains: ["agentic-systems-architecture"] },
    source_list: ["arxiv.org"],
    relevance_rubric: { description: "test", threshold: 0.6 },
    cycle_capacity_limit: 20,
    brief_format_version: "1.0.0",
    deposit_target: "~/.openclaw/agents/signal/intake-queue/",
    ...overrides,
  };
}

function writeConfig(dir: string, config: SignalOperationalConfig): string {
  const path = join(dir, "signal-operational-config.json");
  writeFileSync(path, JSON.stringify(config), "utf8");
  return path;
}

// A Sunday at 07:00 UTC (within the 06:00–12:00 window)
const SUNDAY_07UTC = new Date("2026-03-22T07:00:00.000Z"); // 2026-03-22 is a Sunday
// A Wednesday at 07:00 UTC (outside the window)
const WEDNESDAY_07UTC = new Date("2026-03-18T07:00:00.000Z");
// A Sunday at 05:00 UTC (before the window)
const SUNDAY_05UTC = new Date("2026-03-22T05:00:00.000Z");

// ---------------------------------------------------------------------------
// getPeriodKey
// ---------------------------------------------------------------------------

describe("getPeriodKey", () => {
  it("returns ISO week key for a known date", () => {
    // 2026-03-22 is in week 12 of 2026
    expect(getPeriodKey(SUNDAY_07UTC)).toMatch(/^2026-W\d{2}$/);
  });

  it("returns the same period key for two days in the same ISO week", () => {
    const mon = new Date("2026-03-16T00:00:00.000Z");
    const fri = new Date("2026-03-20T00:00:00.000Z");
    expect(getPeriodKey(mon)).toBe(getPeriodKey(fri));
  });
});

// ---------------------------------------------------------------------------
// isInScheduleWindow
// ---------------------------------------------------------------------------

describe("isInScheduleWindow", () => {
  const config = makeConfig();

  it("returns true when day and hour match (within window)", () => {
    expect(isInScheduleWindow(SUNDAY_07UTC, config)).toBe(true);
  });

  it("returns false when day does not match", () => {
    expect(isInScheduleWindow(WEDNESDAY_07UTC, config)).toBe(false);
  });

  it("returns false when hour is before window", () => {
    expect(isInScheduleWindow(SUNDAY_05UTC, config)).toBe(false);
  });

  it("returns false for an unknown day_of_week", () => {
    const bad = makeConfig({ schedule: { ...config.schedule, day_of_week: "funday" } });
    expect(isInScheduleWindow(SUNDAY_07UTC, bad)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasDispatchedForPeriod / isInProgress
// ---------------------------------------------------------------------------

describe("hasDispatchedForPeriod", () => {
  it("returns false for empty ledger", () => {
    expect(hasDispatchedForPeriod("2026-W12", [])).toBe(false);
  });

  it("returns true if period_key matches an entry", () => {
    const ledger = [
      {
        cycle_id: "c1",
        period_key: "2026-W12",
        status: "dispatched" as const,
        dispatch_timestamp: "2026-03-22T06:00:00.000Z",
        config_version: "1.0.0",
        trigger_type: "scheduled" as const,
      },
    ];
    expect(hasDispatchedForPeriod("2026-W12", ledger)).toBe(true);
  });

  it("returns false if period_key does not match", () => {
    const ledger = [
      {
        cycle_id: "c1",
        period_key: "2026-W11",
        status: "dispatched" as const,
        dispatch_timestamp: "2026-03-15T06:00:00.000Z",
        config_version: "1.0.0",
        trigger_type: "scheduled" as const,
      },
    ];
    expect(hasDispatchedForPeriod("2026-W12", ledger)).toBe(false);
  });
});

describe("isInProgress", () => {
  it("returns false for empty ledger", () => {
    expect(isInProgress([])).toBe(false);
  });

  it("returns true if dispatched entry has no follow-up", () => {
    const ledger = [
      {
        cycle_id: "c1",
        period_key: "2026-W12",
        status: "dispatched" as const,
        dispatch_timestamp: "t",
        config_version: "1.0.0",
        trigger_type: "scheduled" as const,
      },
    ];
    expect(isInProgress(ledger)).toBe(true);
  });

  it("returns false if dispatched entry has completed follow-up", () => {
    const ledger = [
      {
        cycle_id: "c1",
        period_key: "2026-W12",
        status: "dispatched" as const,
        dispatch_timestamp: "t",
        config_version: "1.0.0",
        trigger_type: "scheduled" as const,
      },
      {
        cycle_id: "c1",
        period_key: "2026-W12",
        status: "completed" as const,
        dispatch_timestamp: "t",
        config_version: "1.0.0",
        trigger_type: "scheduled" as const,
      },
    ];
    expect(isInProgress(ledger)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildActivationMessage
// ---------------------------------------------------------------------------

describe("buildActivationMessage", () => {
  it("contains all required fields", () => {
    const msg = buildActivationMessage({
      cycleId: "uuid-123",
      configVersion: "1.0.0",
      dispatchTimestamp: "2026-03-22T07:00:00.000Z",
      periodKey: "2026-W12",
    });
    expect(msg).toContain("trigger_type: scheduled");
    expect(msg).toContain("cycle_id: uuid-123");
    expect(msg).toContain("config_version: 1.0.0");
    expect(msg).toContain("dispatch_timestamp: 2026-03-22T07:00:00.000Z");
    expect(msg).toContain("period_key: 2026-W12");
  });
});

// ---------------------------------------------------------------------------
// runPoller integration (no real gateway)
// ---------------------------------------------------------------------------

describe("runPoller", () => {
  let tmpDir: string;
  let configPath: string;
  let ledgerPath: string;
  const noopDispatch = vi.fn(async (_msg: string) => {});

  beforeEach(() => {
    tmpDir = makeTempDir();
    configPath = writeConfig(tmpDir, makeConfig());
    ledgerPath = join(tmpDir, "cycle-ledger.jsonl");
    noopDispatch.mockClear();
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns disabled when signal_enabled is false — no dispatch", async () => {
    writeConfig(tmpDir, makeConfig({ signal_enabled: false }));
    const result = await runPoller({
      now: SUNDAY_07UTC,
      configPath,
      ledgerPath,
      dispatch: noopDispatch,
    });
    expect(result.action).toBe("disabled");
    expect(noopDispatch).not.toHaveBeenCalled();
  });

  it("returns outside_window when not in schedule window — no dispatch", async () => {
    const result = await runPoller({
      now: WEDNESDAY_07UTC,
      configPath,
      ledgerPath,
      dispatch: noopDispatch,
    });
    expect(result.action).toBe("outside_window");
    expect(noopDispatch).not.toHaveBeenCalled();
  });

  it("dispatches when in window and no prior cycle", async () => {
    const result = await runPoller({
      now: SUNDAY_07UTC,
      configPath,
      ledgerPath,
      dispatch: noopDispatch,
    });
    expect(result.action).toBe("dispatched");
    expect(noopDispatch).toHaveBeenCalledOnce();
    if (result.action === "dispatched") {
      expect(result.cycleId).toBeTruthy();
      expect(result.periodKey).toMatch(/^2026-W\d{2}$/);
    }
  });

  it("returns duplicate when cycle already dispatched for this period — no second dispatch", async () => {
    // First dispatch
    await runPoller({ now: SUNDAY_07UTC, configPath, ledgerPath, dispatch: noopDispatch });
    noopDispatch.mockClear();

    // Second call in same window
    const result = await runPoller({
      now: SUNDAY_07UTC,
      configPath,
      ledgerPath,
      dispatch: noopDispatch,
    });
    expect(result.action).toBe("duplicate");
    expect(noopDispatch).not.toHaveBeenCalled();
  });

  it("returns in_progress when dispatched entry has no completion — no second dispatch", async () => {
    // Manually write a dispatched entry with no follow-up
    appendLedgerEntry(
      {
        cycle_id: "in-progress-cycle",
        period_key: "2099-W01", // different period so period check doesn't fire
        status: "dispatched",
        dispatch_timestamp: SUNDAY_07UTC.toISOString(),
        config_version: "1.0.0",
        trigger_type: "scheduled",
      },
      ledgerPath,
    );
    // Use a config with a different schedule day to skip window check but not period check
    // Actually we need to hit the in_progress path: period check must be false, in_progress must be true.
    // The dispatched entry above has period_key "2099-W01", so hasDispatchedForPeriod for the current period returns false.
    const result = await runPoller({
      now: SUNDAY_07UTC,
      configPath,
      ledgerPath,
      dispatch: noopDispatch,
    });
    expect(result.action).toBe("in_progress");
    expect(noopDispatch).not.toHaveBeenCalled();
  });
});
