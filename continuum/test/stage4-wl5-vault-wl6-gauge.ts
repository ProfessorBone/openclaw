/**
 * continuum/test/stage4-wl5-vault-wl6-gauge.ts
 *
 * Stage 4 — WL5 Vault analytical cycle + WL6 Gauge coverage confirmation
 *
 * WL5: Vault paper portfolio cycle — Engine 1, 2, 3 all run.
 *      Captures: MARKET_REPORT_EMITTED (A3), IQG fired, A6 silent, P3 compliant.
 *
 * WL6: Second Gauge cycle — confirms all five workloads produced telemetry,
 *      coverage_rate = 1.0.
 *
 * Run with:
 *   bun continuum/test/stage4-wl5-vault-wl6-gauge.ts
 */

import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import {
  createGatewayWsClient,
  type GatewayResFrame,
} from "../../scripts/dev/gateway-ws-client.ts";
import { buildDeviceAuthPayloadV3 } from "../../src/gateway/device-auth.ts";
import {
  loadOrCreateDeviceIdentity,
  publicKeyRawBase64UrlFromPem,
  signDevicePayload,
} from "../../src/infra/device-identity.ts";

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL ?? "ws://127.0.0.1:18789";
const TOKEN =
  process.env.OPENCLAW_GATEWAY_TOKEN ?? "24d4cf55b103cee9aca7a7115f9089f71902881cb3f1714a";
const AGENT_RUN_TIMEOUT_MS = 180_000;

function waitForRunCompletion(
  ws: WebSocket,
  idempotencyKey: string,
  timeoutMs: number,
): Promise<{ status: string; result?: unknown; error?: unknown }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", handler);
      reject(new Error(`timeout after ${timeoutMs}ms (key=${idempotencyKey})`));
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

async function submitAgentTask(params: {
  request: ReturnType<typeof createGatewayWsClient>["request"];
  ws: WebSocket;
  sessionKey: string;
  prompt: string;
  label: string;
}): Promise<{ ok: boolean; status: string; result?: unknown }> {
  const { request, ws, sessionKey, prompt, label } = params;
  const idempotencyKey = randomUUID();

  console.log("\n" + "=".repeat(70));
  console.log(`[${label}]`);
  console.log(`  session:  ${sessionKey}`);
  console.log(`  key:      ${idempotencyKey}`);

  const completionPromise = waitForRunCompletion(ws, idempotencyKey, AGENT_RUN_TIMEOUT_MS);

  const acceptedRes = await request(
    "agent",
    { sessionKey, idempotencyKey, message: prompt },
    15_000,
  );
  if (!acceptedRes.ok) {
    console.error(`  ERROR rejected:`, acceptedRes.error);
    return { ok: false, status: "rejected" };
  }

  const ap = acceptedRes.payload as Record<string, unknown> | undefined;
  console.log(`  accepted: status=${String(ap?.["status"])} runId=${String(ap?.["runId"])}`);
  console.log(`  waiting (${AGENT_RUN_TIMEOUT_MS / 1000}s)...`);

  try {
    const c = await completionPromise;
    console.log(`  completed: status=${c.status}`);
    if (c.result) {
      const t = typeof c.result === "string" ? c.result : JSON.stringify(c.result, null, 2);
      console.log(`\n--- Agent Response ---`);
      console.log(t.slice(0, 4000));
      if (t.length > 4000) {
        console.log(`  ... [${t.length - 4000} more chars]`);
      }
      console.log(`--- End ---`);
    }
    if (c.error) {
      console.log(`  error:`, c.error);
    }
    return { ok: true, status: c.status, result: c.result };
  } catch (err) {
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, status: "timeout" };
  }
}

async function main() {
  console.log("Stage 4 — WL5 Vault + WL6 Gauge Coverage Confirmation");
  console.log(`Gateway: ${GATEWAY_URL}`);
  console.log(`Date:    ${new Date().toISOString()}`);

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
      } else {
        console.log(`  [event] ${evt.event}`);
      }
    },
  });

  await waitOpen();
  console.log("WebSocket open");

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
      displayName: "Stage4 WL5+WL6",
      version: "dev",
      platform: CLIENT_PLATFORM,
      mode: CLIENT_MODE,
      instanceId: "stage4-wl5-wl6",
    },
    locale: "en-US",
    userAgent: "stage4-wl5-wl6",
    role: "operator",
    scopes: [...CONNECT_SCOPES],
    caps: [],
    auth: { token: TOKEN },
    device,
  });

  if (!connectRes.ok) {
    console.error("connect failed:", connectRes.error);
    close();
    process.exit(1);
  }
  console.log("Authenticated\n");

  // -------------------------------------------------------------------------
  // WL5 — Vault analytical cycle (paper portfolio)
  // sandbox.mode="all" requires Docker — confirmed running before this script.
  // -------------------------------------------------------------------------

  const wl5 = await submitAgentTask({
    request,
    ws: ws as unknown as WebSocket,
    sessionKey: "agent:vault:main",
    label: "WL5 — Vault Analytical Cycle (paper portfolio, three engines)",
    prompt:
      "You are Vault, the Financial Strategy and Economic Intelligence engine for Continuum. " +
      "Run one analytical cycle against paper portfolio data only. No real capital. " +
      "Capital domain: paper_portfolio. " +
      "All three engines must run: " +
      "Engine 1 (Economic Regime Engine): classify the current macroeconomic regime. " +
      "Use available indicators: inflation trajectory, employment conditions, yield curve posture, " +
      "credit spreads. Provide a regime label and confidence level (0.0–1.0). " +
      "Engine 2 (Cross-Market Intelligence Engine): assess cross-market signals. " +
      "Cover: equities posture, fixed income signals, and one commodity signal. " +
      "Engine 3 (Narrative Intelligence Engine): synthesize Engines 1 and 2 " +
      "into a narrative conclusion for the paper portfolio. " +
      "Apply the Intelligence Quality Gate before emission: " +
      "verify thesis statement, data sources with timestamps, regime context with confidence, " +
      "supporting signals, risk assessment with invalidation conditions, " +
      "capital domain designation (paper_portfolio), scenario assessment. " +
      "Emit A3 emit_market_report with IQG result field. " +
      "Report A6 emit_rule_violation_alert status — should be silent (no violations). " +
      "Confirm P3 capital segregation: paper_portfolio only, no co-mingling. " +
      "Include: cycle_id (UUID), engine_1_output, engine_2_output, engine_3_output, " +
      "iqg_result, a6_status, p3_status.",
  });

  // -------------------------------------------------------------------------
  // WL6 — Second Gauge cycle: coverage confirmation across all five workloads
  // -------------------------------------------------------------------------

  const wl6 = await submitAgentTask({
    request,
    ws: ws as unknown as WebSocket,
    sessionKey: "agent:gauge:main",
    label: "WL6 — Gauge Coverage Confirmation (target coverage_rate=1.0)",
    prompt:
      "You are Gauge, the Performance Intelligence Dashboard. " +
      "Execute a second performance report cycle for Stage 4 Operational Validation. " +
      "This cycle confirms telemetry coverage across all five prior workloads. " +
      "Confirm telemetry presence for each workload: " +
      "WL1 — Gauge baseline (gauge: A1 emit_performance_report, coverage_rate=1.0, 8/8 agents), " +
      "WL2 — Crucible learning (crucible: A1 emit_learning_content + A2 emit_reflection_candidate + A3 MEMORY_COMMIT_AUTH), " +
      "WL3 — Signal retrieval (signal: TAR-009 fired on web_search/web_fetch + A1 deposit_discovery_brief, cycle_id=065168ee-4720-4fed-a266-b94beaab7ec7), " +
      "WL4 — Foundry synthesis (foundry: A1 emit_artifact, source_trace=ADR-029+ADR-036, A5=no new commitment), " +
      "WL5 — Vault analytical (vault: A3 emit_market_report + IQG fired + A6 silent + P3 compliant). " +
      "Report: report_cycle_id (new UUID), formula_registry_version (PACS-OBS-003 v1.0.0), " +
      "agents_with_confirmed_telemetry (list), workloads_confirmed (count), " +
      "coverage_rate (target: 1.0 = 5/5 workloads confirmed), " +
      "anomaly_alerts (any threshold crossings detected). " +
      "State clearly: Stage 4 coverage gate PASSED or FAILED.",
  });

  close();

  const today = new Date().toISOString().slice(0, 10);
  console.log("\n" + "=".repeat(70));
  console.log("Stage 4 WL5+WL6 Summary");
  console.log("=".repeat(70));
  console.log(`WL5 Vault analytical:   ${wl5.ok ? "ok" : "FAILED"} (status=${wl5.status})`);
  console.log(`WL6 Gauge confirmation: ${wl6.ok ? "ok" : "FAILED"} (status=${wl6.status})`);
  console.log(`\nTAR + governance logs:`);
  console.log(`  tail -n 200 /tmp/openclaw/openclaw-${today}.log | grep -E 'TAR|tar|continuum'`);
}

await main();
