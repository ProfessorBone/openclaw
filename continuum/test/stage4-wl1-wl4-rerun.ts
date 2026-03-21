/**
 * continuum/test/stage4-wl1-wl4-rerun.ts
 *
 * Stage 4 — Workloads 1–4 Rerun (post-fix)
 *
 * Fixes applied before this run:
 *   - gpt-5.4-mini → gpt-5.4 for Gauge, Signal, Locus
 *   - BOOTSTRAP.md renamed to .disabled-stage4 in gauge/signal/vault workspaces
 *   - Gateway restarted (TAR-001-009 confirmed active)
 *
 * WL5 Vault held pending Faheem Docker start confirmation.
 *
 * Run with:
 *   bun continuum/test/stage4-wl1-wl4-rerun.ts
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

const SESSION_KEYS = {
  gauge: "agent:gauge:main",
  crucible: "agent:crucible:main",
  signal: "agent:signal:main",
  foundry: "agent:foundry:main",
};

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
    console.error(`  ERROR: rejected:`, acceptedRes.error);
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
      console.log(t.slice(0, 3000));
      if (t.length > 3000) {
        console.log(`  ... [${t.length - 3000} more chars]`);
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
  console.log("Stage 4 — Workloads 1–4 Rerun (post-fix)");
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
      displayName: "Stage4 WL1-4 Rerun",
      version: "dev",
      platform: CLIENT_PLATFORM,
      mode: CLIENT_MODE,
      instanceId: "stage4-rerun",
    },
    locale: "en-US",
    userAgent: "stage4-rerun",
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

  // ---------------------------------------------------------------------------
  // WL1 — Gauge Baseline
  // ---------------------------------------------------------------------------

  const wl1 = await submitAgentTask({
    request,
    ws: ws as unknown as WebSocket,
    sessionKey: SESSION_KEYS.gauge,
    label: "WL1 — Gauge Baseline (performance report cycle)",
    prompt:
      "You are Gauge, the Performance Intelligence Dashboard for the Continuum system. " +
      "Execute one baseline performance report cycle for Stage 4 Operational Validation. " +
      "Active agent registry for this cycle: the-bridge, mec, crucible, locus, foundry, signal, vault, gauge (8 agents). " +
      "Formula registry: PACS-OBS-003 v1.0.0. " +
      "Produce a structured A1 emit_performance_report output. " +
      "Include: report_cycle_id (generate a UUID), formula_registry_version, " +
      "active_agent_count (8), agents_represented list, " +
      "coverage_rate (fraction of active agents represented in this cycle), " +
      "anomaly_alerts list (empty if no threshold crossings detected), " +
      "cycle_window_start and cycle_window_end timestamps. " +
      "For each agent, state P1 telemetry coverage status. " +
      "This is a live gateway execution against the real Continuum runtime.",
  });

  // ---------------------------------------------------------------------------
  // WL2 — Crucible Learning Session
  // ---------------------------------------------------------------------------

  const wl2 = await submitAgentTask({
    request,
    ws: ws as unknown as WebSocket,
    sessionKey: SESSION_KEYS.crucible,
    label: "WL2 — Crucible Learning Session (MEMORY_COMMIT_AUTH vs SUMMARY_EMISSION)",
    prompt:
      "You are Crucible, the AI Learning Architect for the Continuum system. " +
      "Bridge-dispatched instructional session assignment. " +
      "Deliver a structured learning session on the architectural distinction between " +
      "MEMORY_COMMIT_AUTH and SUMMARY_EMISSION as protected decision classes. " +
      "Cover: (1) what each class is, (2) governance event triggered, " +
      "(3) why MEC adjudication is required for each, " +
      "(4) the failure mode each class guards against, " +
      "(5) the architectural distinction between them. " +
      "Emit A1 emit_learning_content with the full structured content. " +
      "Then emit A2 emit_reflection_candidate with: " +
      "  - reflection_candidate_id (UUID), " +
      "  - key_insight: the architectural distinction between the two classes, " +
      "  - learner_evidence_references: at least two references to content from this session. " +
      "Then emit A3 MEMORY_COMMIT_AUTH request to The Bridge for the key insight. " +
      "Include session_id, all actuator outputs.",
  });

  // ---------------------------------------------------------------------------
  // WL3 — Signal Retrieval Cycle
  // Note: web_search and web_fetch are TAR-009 governed. Signal is the only
  //       authorized agent. TAR-009 enforcement will fire in before_tool_call.
  // ---------------------------------------------------------------------------

  const wl3 = await submitAgentTask({
    request,
    ws: ws as unknown as WebSocket,
    sessionKey: SESSION_KEYS.signal,
    label: "WL3 — Signal Retrieval Cycle (agentic systems, TAR-009 enforcement)",
    prompt:
      "You are Signal, the Frontier Intelligence Scout for the Continuum system. " +
      "Execute one retrieval cycle. Bridge-governed configuration for this cycle: " +
      "retrieval_scope: agentic systems research — tool use patterns in multi-agent systems, " +
      "memory architectures for AI agents, evaluation frameworks for agentic behavior. " +
      "Time bound: last 90 days. Cycle capacity: up to 5 items. Relevance threshold: 0.7. " +
      "Execute your three-gate pipeline: " +
      "Gate 1 — use web_search to find candidate items in the retrieval scope. " +
      "Gate 2 — apply scope matching, select items above relevance threshold. " +
      "Use web_fetch on at least one URL to retrieve abstract or summary content. " +
      "Emit A1 deposit_discovery_brief to the Exogenous Intelligence Intake Queue: " +
      "  cycle_id (UUID), retrieval_scope, items_retrieved_count, " +
      "  items_passed_gate2, items_filtered_count, " +
      "  brief_entries (title, source_url, relevance_score, abstract_summary). " +
      "Write cycle log entry: cycle_start_timestamp, cycle_end_timestamp, status.",
  });

  // ---------------------------------------------------------------------------
  // WL4 — Foundry Synthesis Task
  // ---------------------------------------------------------------------------

  const wl4 = await submitAgentTask({
    request,
    ws: ws as unknown as WebSocket,
    sessionKey: SESSION_KEYS.foundry,
    label: "WL4 — Foundry Synthesis (TAR native tool extension pattern)",
    prompt:
      "BRIDGE WORK ORDER — Foundry. Work order id: stage4-wl4-tar-extension-pattern. " +
      "Synthesize one architectural artifact section: TAR Native Tool Extension Pattern. " +
      "Grounding sources (Mode 1 Derived Architecture): " +
      "ADR-029: TAR-005 scope extended to include OpenClaw native 'read' tool. " +
      "Operation name normalization: native 'read' normalized to 'read_file' for enforcement matching. " +
      "ADR-036: TAR-009 activated for Signal external retrieval — " +
      "web_search and web_fetch added as Signal-only envelope-allowed operations. " +
      "Artifact must cover: " +
      "(1) Pattern name and architectural intent. " +
      "(2) Trigger conditions for extending TAR scope to include native tools. " +
      "(3) Implementation pattern: operation name normalization, hook wiring. " +
      "(4) Governance constraints: what must be true before a TAR scope extension commits. " +
      "Use A1 emit_artifact. Include source_trace references to ADR-029 and ADR-036. " +
      "If any new architectural commitment is identified not in DECISIONS.md, " +
      "emit A5 candidate Decision Log entry. " +
      "Surface any conflicts via A4 — do not resolve them. " +
      "Output the full artifact text.",
  });

  close();

  const today = new Date().toISOString().slice(0, 10);
  console.log("\n" + "=".repeat(70));
  console.log("Stage 4 WL1–WL4 Rerun Summary");
  console.log("=".repeat(70));
  console.log(`WL1 Gauge baseline:    ${wl1.ok ? "ok" : "FAILED"} (status=${wl1.status})`);
  console.log(`WL2 Crucible learning: ${wl2.ok ? "ok" : "FAILED"} (status=${wl2.status})`);
  console.log(`WL3 Signal retrieval:  ${wl3.ok ? "ok" : "FAILED"} (status=${wl3.status})`);
  console.log(`WL4 Foundry synthesis: ${wl4.ok ? "ok" : "FAILED"} (status=${wl4.status})`);
  console.log(`\nTAR enforcement logs:`);
  console.log(
    `  tail -n 400 /tmp/openclaw/openclaw-${today}.log | grep -E 'TAR|tar-web|tar-read|continuum'`,
  );
}

await main();
