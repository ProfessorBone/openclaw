/**
 * continuum/agents/vault/vault-config-reader.test.ts
 *
 * Tests for VaultConfigReader against a fixture config file.
 * The test environment isolates HOME to a temp dir, so we write the config fixture
 * to a temp location and pass the path explicitly — do not mock VaultConfigReader.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VaultConfigReader } from "./vault-config-reader.ts";

// ---------------------------------------------------------------------------
// Fixture — matches the real Bridge-owned config structure
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
      description: "Broad market and sector ETFs",
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
      description: "Volatility, index, and rate proxies",
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
  notes: "Paper mode. Trading domain only.",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let configPath: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `vault-config-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  configPath = join(tmpDir, "vault-paper-trading-config.json");
  writeFileSync(configPath, JSON.stringify(FIXTURE_CONFIG), "utf8");
});

afterEach(() => {
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VaultConfigReader", () => {
  it("readVaultConfig returns a valid config object", () => {
    const reader = new VaultConfigReader(configPath);
    const config = reader.readVaultConfig();
    expect(config).toBeDefined();
    expect(config.config_version).toBe("1.0.0");
    expect(config.last_updated_by).toBe("the-bridge");
    expect(Array.isArray(config.intelligence_quality_gate.required_fields)).toBe(true);
  });

  it("isAssetAllowed returns true for AAPL (core equity)", () => {
    expect(new VaultConfigReader(configPath).isAssetAllowed("AAPL")).toBe(true);
  });

  it("isAssetAllowed returns true for SPY (broad market ETF)", () => {
    expect(new VaultConfigReader(configPath).isAssetAllowed("SPY")).toBe(true);
  });

  it("isAssetAllowed returns false for DOGE (not in any allowed list)", () => {
    expect(new VaultConfigReader(configPath).isAssetAllowed("DOGE")).toBe(false);
  });

  it("isAssetClassExcluded returns true for crypto", () => {
    expect(new VaultConfigReader(configPath).isAssetClassExcluded("crypto")).toBe(true);
  });

  it("isPaperMode returns true", () => {
    expect(new VaultConfigReader(configPath).isPaperMode()).toBe(true);
  });

  it("isRealCapitalAuthorized returns false", () => {
    expect(new VaultConfigReader(configPath).isRealCapitalAuthorized()).toBe(false);
  });
});
