/**
 * continuum/agents/vault/vault-config-reader.ts
 *
 * Reads the Bridge-owned Vault paper trading configuration.
 * Vault code accesses config exclusively through this module.
 * Vault never reads the config file directly from other modules.
 * Vault never writes to the config file.
 *
 * Config path: ~/.openclaw/agents/the-bridge/vault-paper-trading-config.json
 *
 * Governed by: Vault SOUL.md Hard Constraint 4, ADR-039
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TradingUniverse = {
  core_equities: { description: string; allowed_symbols: string[] };
  broad_market_etfs: { description: string; allowed_symbols: string[] };
  market_context_instruments: { description: string; allowed_symbols: string[] };
};

export type SizingRules = {
  max_notional_per_position: number;
  max_exposure_per_sector: number;
  max_total_concurrent_positions: number;
  max_exposure_per_strategy_bucket: number;
  max_portfolio_drawdown_tolerance_pct: number;
  max_daily_new_thesis_openings: number;
  prohibited_concentration_rules: {
    max_single_name_pct_of_portfolio: number;
    max_correlated_cluster_pct_of_portfolio: number;
  };
};

export type CalibrationConfig = {
  cycles_required_for_real_capital: number;
  cycles_required_for_retirement_activation: number;
  valid_closure_states: string[];
};

export type VaultConfig = {
  config_version: string;
  last_updated_by: string;
  last_updated_at: string;
  vault_paper_mode: boolean;
  vault_real_capital_authorized: boolean;
  active_capital_domains: string[];
  inactive_capital_domains: string[];
  trading_universe: TradingUniverse;
  excluded_asset_classes: string[];
  sizing_rules: SizingRules;
  intelligence_quality_gate: { required_fields: string[] };
  calibration: CalibrationConfig;
  cooldown_rules: {
    rule_violation_cooldown_hours: number;
    consecutive_tainted_cycle_cooldown_hours: number;
  };
  report_schedule: {
    daily_market_brief: boolean;
    weekly_portfolio_review: boolean;
    thesis_review_interval_days: number;
  };
  notes: string;
};

// ---------------------------------------------------------------------------
// Default config path
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG_PATH = join(
  homedir(),
  ".openclaw",
  "agents",
  "the-bridge",
  "vault-paper-trading-config.json",
);

// ---------------------------------------------------------------------------
// VaultConfigReader
// ---------------------------------------------------------------------------

export class VaultConfigReader {
  private readonly configPath: string;

  constructor(configPath: string = DEFAULT_CONFIG_PATH) {
    this.configPath = configPath;
  }

  /**
   * Reads and parses the Bridge-owned config file.
   * Throws if the file is missing or malformed — fail closed.
   */
  readVaultConfig(): VaultConfig {
    let raw: string;
    try {
      raw = readFileSync(this.configPath, "utf8");
    } catch (err) {
      throw new Error(
        `Vault config unavailable at ${this.configPath}: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
    try {
      return JSON.parse(raw) as VaultConfig;
    } catch {
      throw new Error(`Vault config at ${this.configPath} is not valid JSON.`);
    }
  }

  /** Returns true if symbol is in any allowed category. */
  isAssetAllowed(symbol: string): boolean {
    const config = this.readVaultConfig();
    const u = config.trading_universe;
    return (
      u.core_equities.allowed_symbols.includes(symbol) ||
      u.broad_market_etfs.allowed_symbols.includes(symbol) ||
      u.market_context_instruments.allowed_symbols.includes(symbol)
    );
  }

  /** Returns true if assetClass is in the excluded list. */
  isAssetClassExcluded(assetClass: string): boolean {
    const config = this.readVaultConfig();
    return config.excluded_asset_classes.includes(assetClass);
  }

  /** Returns the sizing_rules object. */
  getSizingRules(): SizingRules {
    return this.readVaultConfig().sizing_rules;
  }

  /** Returns the intelligence_quality_gate required_fields array. */
  getIQGRequiredFields(): string[] {
    return this.readVaultConfig().intelligence_quality_gate.required_fields;
  }

  /** Returns the calibration config object. */
  getCalibrationConfig(): CalibrationConfig {
    return this.readVaultConfig().calibration;
  }

  /** Returns vault_paper_mode. */
  isPaperMode(): boolean {
    return this.readVaultConfig().vault_paper_mode;
  }

  /** Returns vault_real_capital_authorized. */
  isRealCapitalAuthorized(): boolean {
    return this.readVaultConfig().vault_real_capital_authorized;
  }
}

// ---------------------------------------------------------------------------
// Default instance
// ---------------------------------------------------------------------------

export const vaultConfigReader = new VaultConfigReader();
