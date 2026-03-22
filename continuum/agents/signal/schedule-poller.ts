/**
 * continuum/agents/signal/schedule-poller.ts
 *
 * Signal Schedule Poller — the physical substrate for S1 (Schedule Trigger Monitor).
 *
 * Runs every 6 hours via LaunchAgent. Reads Bridge-owned operational configuration,
 * computes whether the current time falls within the configured weekly window,
 * enforces cycle-level idempotency via the cycle ledger, and dispatches a single
 * activation message to Signal through the gateway WebSocket.
 *
 * This script is NOT the agent. It is the external scheduler that wakes Signal.
 *
 * Governed by: Signal SOUL.md Hard Constraint 1, ADR-038
 */

import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import WebSocket from "ws";
import {
  createGatewayWsClient,
  type GatewayResFrame,
} from "../../../scripts/dev/gateway-ws-client.ts";
import { buildDeviceAuthPayloadV3 } from "../../../src/gateway/device-auth.ts";
import {
  loadOrCreateDeviceIdentity,
  publicKeyRawBase64UrlFromPem,
  signDevicePayload,
} from "../../../src/infra/device-identity.ts";

// ---------------------------------------------------------------------------
// Paths and constants
// ---------------------------------------------------------------------------

export const BRIDGE_CONFIG_PATH = join(
  homedir(),
  ".openclaw",
  "agents",
  "the-bridge",
  "signal-operational-config.json",
);

export const CYCLE_LEDGER_PATH = join(
  homedir(),
  ".openclaw",
  "agents",
  "signal",
  "cycle-ledger.jsonl",
);

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL ?? "ws://127.0.0.1:18789";
const TOKEN =
  process.env.OPENCLAW_GATEWAY_TOKEN ?? "24d4cf55b103cee9aca7a7115f9089f71902881cb3f1714a";
const AGENT_RUN_TIMEOUT_MS = 300_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SignalOperationalConfig = {
  config_version: string;
  signal_enabled: boolean;
  schedule: {
    cadence: string;
    day_of_week: string;
    hour_utc: number;
    timezone_display: string;
  };
  retrieval_scope: { domains: string[] };
  source_list: string[];
  relevance_rubric: { description: string; threshold: number };
  cycle_capacity_limit: number;
  brief_format_version: string;
  deposit_target: string;
};

export type CycleLedgerEntry = {
  cycle_id: string;
  period_key: string;
  status: "dispatched" | "completed" | "failed";
  dispatch_timestamp: string;
  config_version: string;
  trigger_type: "scheduled";
  completed_timestamp?: string;
};

// ---------------------------------------------------------------------------
// Period key: ISO year + week number, e.g. "2026-W13"
// ---------------------------------------------------------------------------

export function getPeriodKey(now: Date): string {
  // ISO 8601 week: week containing the first Thursday of the year.
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // Mon=1, Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Schedule window check
//
// Returns true if now falls on the configured day_of_week AND within 6 hours
// after the configured hour_utc (to account for the polling interval).
// ---------------------------------------------------------------------------

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function isInScheduleWindow(
  now: Date,
  config: Pick<SignalOperationalConfig, "schedule">,
): boolean {
  const utcDay = now.getUTCDay(); // 0=Sun
  const utcHour = now.getUTCHours();
  const configDay = DAY_NAMES.indexOf(config.schedule.day_of_week.toLowerCase());
  if (configDay < 0) {
    return false;
  }
  if (utcDay !== configDay) {
    return false;
  }
  // Within 6-hour window starting at hour_utc
  return utcHour >= config.schedule.hour_utc && utcHour < config.schedule.hour_utc + 6;
}

// ---------------------------------------------------------------------------
// Cycle ledger helpers
// ---------------------------------------------------------------------------

export function loadCycleLedger(ledgerPath: string = CYCLE_LEDGER_PATH): CycleLedgerEntry[] {
  if (!existsSync(ledgerPath)) {
    return [];
  }
  const raw = readFileSync(ledgerPath, "utf8");
  const entries: CycleLedgerEntry[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) {
      continue;
    }
    try {
      entries.push(JSON.parse(t) as CycleLedgerEntry);
    } catch {
      // skip malformed lines
    }
  }
  return entries;
}

export function hasDispatchedForPeriod(periodKey: string, ledger: CycleLedgerEntry[]): boolean {
  return ledger.some((e) => e.period_key === periodKey);
}

export function isInProgress(ledger: CycleLedgerEntry[]): boolean {
  if (ledger.length === 0) {
    return false;
  }
  const dispatched = ledger.filter((e) => e.status === "dispatched");
  for (const d of dispatched) {
    const hasFollowUp = ledger.some(
      (e) => e.cycle_id === d.cycle_id && (e.status === "completed" || e.status === "failed"),
    );
    if (!hasFollowUp) {
      return true;
    }
  }
  return false;
}

export function appendLedgerEntry(
  entry: CycleLedgerEntry,
  ledgerPath: string = CYCLE_LEDGER_PATH,
): void {
  const dir = dirname(ledgerPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  appendFileSync(ledgerPath, JSON.stringify(entry) + "\n", "utf8");
}

// ---------------------------------------------------------------------------
// Config reader
// ---------------------------------------------------------------------------

export function readBridgeConfig(configPath: string = BRIDGE_CONFIG_PATH): SignalOperationalConfig {
  const raw = readFileSync(configPath, "utf8");
  return JSON.parse(raw) as SignalOperationalConfig;
}

// ---------------------------------------------------------------------------
// Activation message
// ---------------------------------------------------------------------------

export function buildActivationMessage(params: {
  cycleId: string;
  configVersion: string;
  dispatchTimestamp: string;
  periodKey: string;
}): string {
  return `You are executing a scheduled weekly frontier intelligence retrieval cycle.

trigger_type: scheduled
cycle_id: ${params.cycleId}
config_version: ${params.configVersion}
dispatch_timestamp: ${params.dispatchTimestamp}
period_key: ${params.periodKey}

Read your operational configuration from the Bridge config file. Execute A1 through A5 in order. Deposit structured frontier discovery briefs to the intake queue. Log the complete retrieval cycle. Do not skip null-return domains.`;
}

// ---------------------------------------------------------------------------
// Gateway dispatch
// ---------------------------------------------------------------------------

function waitForRunCompletion(
  ws: WebSocket,
  idempotencyKey: string,
  timeoutMs: number,
): Promise<{ status: string; result?: unknown; error?: unknown }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", handler);
      reject(new Error(`timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    function handler(raw: WebSocket.RawData) {
      let frame: unknown;
      try {
        const text =
          typeof raw === "string"
            ? raw
            : Buffer.isBuffer(raw)
              ? raw.toString("utf8")
              : Buffer.from(raw as ArrayBuffer).toString("utf8");
        frame = JSON.parse(text);
      } catch {
        return;
      }
      if (
        !frame ||
        typeof frame !== "object" ||
        (frame as Record<string, unknown>)["type"] !== "res"
      ) {
        return;
      }
      const res = frame as GatewayResFrame & { payload?: Record<string, unknown> };
      const payload = res.payload;
      if (payload?.["runId"] === idempotencyKey && payload?.["status"] !== "accepted") {
        clearTimeout(timer);
        ws.off("message", handler);
        resolve({
          status: typeof payload["status"] === "string" ? payload["status"] : "unknown",
          result: payload["result"],
          error: res.error,
        });
      }
    }
    ws.on("message", handler);
  });
}

async function dispatchToGateway(message: string): Promise<void> {
  let resolveChallenge!: (nonce: string) => void;
  const challengePromise = new Promise<string>((r) => {
    resolveChallenge = r;
  });

  const { ws, request, waitOpen, close } = createGatewayWsClient({
    url: GATEWAY_URL,
    onEvent: (evt) => {
      if (evt.event === "connect.challenge") {
        const nonce = (evt.payload as { nonce?: unknown } | null | undefined)?.nonce;
        if (typeof nonce === "string") {
          resolveChallenge(nonce);
        }
      }
    },
  });

  await waitOpen();

  const nonce = await Promise.race([
    challengePromise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("challenge timeout")), 5_000),
    ),
  ]);

  const identity = loadOrCreateDeviceIdentity();
  const signedAtMs = Date.now();
  const CLIENT_ID = "gateway-client" as const;
  const CLIENT_MODE = "ui" as const;
  const CLIENT_PLATFORM = "darwin" as const;
  const CONNECT_SCOPES = ["operator.admin"] as const;

  const devicePayload = buildDeviceAuthPayloadV3({
    deviceId: identity.deviceId,
    clientId: CLIENT_ID,
    clientMode: CLIENT_MODE,
    role: "operator",
    scopes: [...CONNECT_SCOPES],
    signedAtMs,
    token: TOKEN,
    nonce,
    platform: CLIENT_PLATFORM,
    deviceFamily: undefined,
  });

  const device = {
    id: identity.deviceId,
    publicKey: publicKeyRawBase64UrlFromPem(identity.publicKeyPem),
    signature: signDevicePayload(identity.privateKeyPem, devicePayload),
    signedAt: signedAtMs,
    nonce,
  };

  const connectRes = await request("connect", {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: CLIENT_ID,
      displayName: "Signal Schedule Poller",
      version: "dev",
      platform: CLIENT_PLATFORM,
      mode: CLIENT_MODE,
      instanceId: "signal-schedule-poller",
    },
    locale: "en-US",
    userAgent: "signal-schedule-poller",
    role: "operator",
    scopes: [...CONNECT_SCOPES],
    caps: [],
    auth: { token: TOKEN },
    device,
  });

  if (!connectRes.ok) {
    close();
    throw new Error(`connect failed: ${JSON.stringify(connectRes.error)}`);
  }

  const idempotencyKey = randomUUID();
  const completionPromise = waitForRunCompletion(
    ws as unknown as WebSocket,
    idempotencyKey,
    AGENT_RUN_TIMEOUT_MS,
  );

  const acceptedRes = await request(
    "agent",
    { sessionKey: "agent:signal:main", idempotencyKey, message },
    15_000,
  );

  if (!acceptedRes.ok) {
    close();
    throw new Error(`agent request rejected: ${JSON.stringify(acceptedRes.error)}`);
  }

  const c = await completionPromise;
  if (c.error) {
    console.error("Signal run error:", c.error);
  }
  close();
}

// ---------------------------------------------------------------------------
// Main poller logic
// ---------------------------------------------------------------------------

export async function runPoller(params?: {
  now?: Date;
  configPath?: string;
  ledgerPath?: string;
  dispatch?: (message: string) => Promise<void>;
}): Promise<
  | { action: "disabled" }
  | { action: "outside_window" }
  | { action: "duplicate"; periodKey: string }
  | { action: "in_progress" }
  | { action: "dispatched"; cycleId: string; periodKey: string }
> {
  const now = params?.now ?? new Date();
  const configPath = params?.configPath ?? BRIDGE_CONFIG_PATH;
  const ledgerPath = params?.ledgerPath ?? CYCLE_LEDGER_PATH;
  const dispatch = params?.dispatch ?? dispatchToGateway;

  const config = readBridgeConfig(configPath);

  if (!config.signal_enabled) {
    console.log("Signal disabled in Bridge config. No dispatch.");
    return { action: "disabled" };
  }

  if (!isInScheduleWindow(now, config)) {
    console.log("Outside scheduled weekly window. No dispatch.");
    return { action: "outside_window" };
  }

  const periodKey = getPeriodKey(now);
  const ledger = loadCycleLedger(ledgerPath);

  if (hasDispatchedForPeriod(periodKey, ledger)) {
    console.log(`Cycle already dispatched for period ${periodKey}. No duplicate dispatch.`);
    return { action: "duplicate", periodKey };
  }

  if (isInProgress(ledger)) {
    console.log("Cycle in progress. No duplicate dispatch.");
    return { action: "in_progress" };
  }

  const cycleId = randomUUID();
  const dispatchTimestamp = now.toISOString();

  const ledgerEntry: CycleLedgerEntry = {
    cycle_id: cycleId,
    period_key: periodKey,
    status: "dispatched",
    dispatch_timestamp: dispatchTimestamp,
    config_version: config.config_version,
    trigger_type: "scheduled",
  };

  appendLedgerEntry(ledgerEntry, ledgerPath);

  const message = buildActivationMessage({
    cycleId,
    configVersion: config.config_version,
    dispatchTimestamp,
    periodKey,
  });

  console.log(`Dispatching Signal cycle ${cycleId} for period ${periodKey}.`);
  await dispatch(message);
  console.log(`Signal cycle ${cycleId} dispatch complete.`);

  return { action: "dispatched", cycleId, periodKey };
}

// ---------------------------------------------------------------------------
// Entry point (when run directly via bun)
// ---------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  runPoller().catch((err) => {
    console.error("Signal schedule poller error:", err);
    process.exit(1);
  });
}
