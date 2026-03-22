/**
 * continuum/agents/vault/thesis-store.test.ts
 *
 * Tests for ThesisStore against a temp store file and the live Bridge config.
 * Do not mock the config file — use the real Bridge config at DEFAULT_CONFIG_PATH.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThesisRecord, ThesisStore } from "./thesis-store.ts";

// ---------------------------------------------------------------------------
// Fixture config — matches Bridge-owned structure
// ---------------------------------------------------------------------------

const FIXTURE_CONFIG = {
  config_version: "1.0.0",
  last_updated_by: "the-bridge",
  last_updated_at: "2026-03-21T22:00:00.000Z",
  vault_paper_mode: true,
  vault_real_capital_authorized: false,
  active_capital_domains: ["trading"],
  inactive_capital_domains: ["retirement"],
  trading_universe: {
    core_equities: {
      description: "Large-cap U.S. equities",
      allowed_symbols: [
        "AAPL",
        "MSFT",
        "AMZN",
        "GOOGL",
        "META",
        "NVDA",
        "TSLA",
        "BRK.B",
        "JPM",
        "JNJ",
        "V",
        "UNH",
        "HD",
        "PG",
        "MA",
      ],
    },
    broad_market_etfs: {
      description: "Broad market ETFs",
      allowed_symbols: [
        "SPY",
        "QQQ",
        "IWM",
        "DIA",
        "XLF",
        "XLE",
        "XLK",
        "XLV",
        "XLI",
        "XLU",
        "XLP",
        "XLY",
      ],
    },
    market_context_instruments: {
      description: "Volatility and rate proxies",
      allowed_symbols: ["VIX", "VXX", "TLT", "IEF", "SHY", "GLD", "USO"],
    },
  },
  excluded_asset_classes: [
    "options",
    "leveraged_etfs",
    "inverse_etfs",
    "penny_stocks",
    "crypto",
    "otc_instruments",
    "illiquid_small_caps",
    "commodities_futures",
    "fx_spot_or_derivatives",
    "margin_or_synthetic_exposure",
  ],
  sizing_rules: {
    max_notional_per_position: 10000,
    max_exposure_per_sector: 25000,
    max_total_concurrent_positions: 5,
    max_exposure_per_strategy_bucket: 20000,
    max_portfolio_drawdown_tolerance_pct: 10,
    max_daily_new_thesis_openings: 2,
    prohibited_concentration_rules: {
      max_single_name_pct_of_portfolio: 25,
      max_correlated_cluster_pct_of_portfolio: 40,
    },
  },
  intelligence_quality_gate: {
    required_fields: [
      "thesis_statement",
      "supporting_evidence",
      "counterevidence",
      "invalidation_condition",
      "source_list",
      "time_horizon",
      "confidence_level",
      "uncertainty_statement",
      "capital_domain",
      "segregation_check_status",
    ],
  },
  calibration: {
    cycles_required_for_real_capital: 4,
    cycles_required_for_retirement_activation: 1,
    valid_closure_states: ["closed-confirmed", "closed-contradicted", "closed-inconclusive"],
  },
  cooldown_rules: {
    rule_violation_cooldown_hours: 48,
    consecutive_tainted_cycle_cooldown_hours: 72,
  },
  report_schedule: {
    daily_market_brief: true,
    weekly_portfolio_review: true,
    thesis_review_interval_days: 7,
  },
  notes: "Paper mode.",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  const dir = join(tmpdir(), `vault-thesis-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeStore(dir: string): ThesisStore {
  const configPath = join(dir, "vault-config.json");
  writeFileSync(configPath, JSON.stringify(FIXTURE_CONFIG), "utf8");
  return new ThesisStore(join(dir, "theses.jsonl"), configPath);
}

function makeValidThesis(overrides: Partial<ThesisRecord> = {}): ThesisRecord {
  return {
    thesis_id: "thesis-001",
    created_at: "2026-03-21T12:00:00.000Z",
    capital_domain: "trading",
    mode: "paper",
    analyst_engine: "vault",
    upstream_engines: ["signal"],
    strategy_bucket: "momentum",
    asset_symbol: "AAPL",
    asset_type: "equity",
    record_version: 1,
    thesis_statement: "AAPL is positioned for a breakout",
    directional_view: "long",
    time_horizon: "4 weeks",
    supporting_evidence: "Strong earnings and technical breakout pattern",
    counterevidence: "Broader market headwinds could dampen momentum",
    invalidation_condition: "Close below the 200-day moving average",
    confidence_level: 0.7,
    uncertainty_statement: "Macro environment introduces elevated uncertainty",
    source_list: ["signal-brief-001"],
    bridge_policy_version: "1.0.0",
    p1_gate_status: "pass",
    segregation_check_status: "pass",
    risk_flag_status: "none",
    approval_status: "pending",
    paper_entry_date: "2026-03-21",
    paper_entry_price: 175.0,
    target_condition: "Price above 185",
    stop_or_exit_condition: "Close below 170",
    planned_review_interval: "7 days",
    max_allowed_notional: 10000,
    simulated_position_size: 50,
    status: "active",
    last_review_at: null,
    closure_date: null,
    closure_state: null,
    closure_reason: null,
    outcome_summary: null,
    thesis_quality_assessment: null,
    evidence_quality_assessment: null,
    contradiction_handling_assessment: null,
    discipline_assessment: null,
    calibration_result: null,
    evaluator_notes: null,
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

describe("ThesisStore.createThesis", () => {
  it("returns created: true for a valid thesis", () => {
    const store = makeStore(tmpDir);
    const result = store.createThesis(makeValidThesis());
    expect(result.created).toBe(true);
    if (result.created) {
      expect(result.thesis.thesis_id).toBe("thesis-001");
      expect(result.thesis.p1_gate_status).toBe("pass");
      expect(result.thesis.record_version).toBe(1);
    }
  });

  it("returns duplicate for the same thesis_id", () => {
    const store = makeStore(tmpDir);
    store.createThesis(makeValidThesis());
    const result = store.createThesis(makeValidThesis());
    expect(result.created).toBe(false);
    if (!result.created) {
      expect(result.reason).toBe("duplicate");
    }
  });

  it("returns p1_validation_failed when required fields are missing", () => {
    const store = makeStore(tmpDir);
    const thesis = makeValidThesis({ thesis_statement: "" });
    const result = store.createThesis(thesis);
    expect(result.created).toBe(false);
    if (!result.created) {
      expect(result.reason).toBe("p1_validation_failed");
      if (result.reason === "p1_validation_failed") {
        expect(result.missing).toContain("thesis_statement");
      }
    }
  });

  it("returns asset_not_allowed for a symbol outside the trading universe", () => {
    const store = makeStore(tmpDir);
    const result = store.createThesis(makeValidThesis({ asset_symbol: "DOGE" }));
    expect(result.created).toBe(false);
    if (!result.created) {
      expect(result.reason).toBe("asset_not_allowed");
    }
  });

  it("returns asset_class_excluded for a forbidden asset type", () => {
    const store = makeStore(tmpDir);
    const result = store.createThesis(makeValidThesis({ asset_type: "crypto" }));
    expect(result.created).toBe(false);
    if (!result.created) {
      expect(result.reason).toBe("asset_class_excluded");
    }
  });
});

describe("ThesisStore.updateThesisStatus", () => {
  it("appends an update record with incremented record_version", () => {
    const store = makeStore(tmpDir);
    store.createThesis(makeValidThesis());
    const result = store.updateThesisStatus("thesis-001", { status: "under_review" });
    expect(result.updated).toBe(true);
    if (result.updated) {
      expect(result.record.record_version).toBe(2);
      expect(result.record.status).toBe("under_review");
    }
  });

  it("returns not_found for an unknown thesis_id", () => {
    const store = makeStore(tmpDir);
    const result = store.updateThesisStatus("no-such-thesis", { status: "under_review" });
    expect(result.updated).toBe(false);
    if (!result.updated) {
      expect(result.reason).toBe("not_found");
    }
  });
});

describe("ThesisStore.closeThesis", () => {
  it("closes a thesis with a valid closure state", () => {
    const store = makeStore(tmpDir);
    store.createThesis(makeValidThesis());
    const result = store.closeThesis("thesis-001", "closed-confirmed", "Target condition met");
    expect(result.closed).toBe(true);
    if (result.closed) {
      expect(result.record.status).toBe("closed");
      expect(result.record.closure_state).toBe("closed-confirmed");
    }
  });

  it("returns invalid_closure_state for an unrecognized state", () => {
    const store = makeStore(tmpDir);
    store.createThesis(makeValidThesis());
    const result = store.closeThesis("thesis-001", "closed-invalid", "reason");
    expect(result.closed).toBe(false);
    if (!result.closed) {
      expect(result.reason).toBe("invalid_closure_state");
    }
  });

  it("returns not_found when thesis does not exist", () => {
    const store = makeStore(tmpDir);
    const result = store.closeThesis("no-such-id", "closed-confirmed", "reason");
    expect(result.closed).toBe(false);
    if (!result.closed) {
      expect(result.reason).toBe("not_found");
    }
  });
});

describe("ThesisStore query methods", () => {
  it("getActiveTheses returns only active theses", () => {
    const store = makeStore(tmpDir);
    store.createThesis(makeValidThesis({ thesis_id: "t-active", status: "active" }));
    store.createThesis(
      makeValidThesis({
        thesis_id: "t-to-close",
        asset_symbol: "MSFT",
        status: "active",
      }),
    );
    store.closeThesis("t-to-close", "closed-confirmed", "done");
    const active = store.getActiveTheses();
    expect(active.length).toBe(1);
    expect(active[0].thesis_id).toBe("t-active");
  });

  it("getThesesByAsset returns all versions under a symbol using latest record", () => {
    const store = makeStore(tmpDir);
    store.createThesis(makeValidThesis({ thesis_id: "t-aapl", asset_symbol: "AAPL" }));
    store.createThesis(
      makeValidThesis({
        thesis_id: "t-msft",
        asset_symbol: "MSFT",
      }),
    );
    const aapl = store.getThesesByAsset("AAPL");
    expect(aapl.length).toBe(1);
    expect(aapl[0].thesis_id).toBe("t-aapl");
  });
});
