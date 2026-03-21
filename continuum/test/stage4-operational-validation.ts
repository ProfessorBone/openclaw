/**
 * continuum/test/stage4-operational-validation.ts
 *
 * Stage 4 — Operational Validation
 * Five live gateway workloads submitted through the real OpenClaw runtime.
 * Same pattern as Work Order 6C (gateway-spot-check.ts). Proven auth flow reused.
 *
 * Workloads:
 *   WL1 — Gauge baseline: performance report cycle, all active agents
 *   WL2 — Crucible learning: MEMORY_COMMIT_AUTH vs SUMMARY_EMISSION
 *   WL3 — Signal retrieval: agentic systems research, TAR-009 enforcement
 *   WL4 — Foundry synthesis: TAR native tool extension pattern artifact (ADR-029 + ADR-036)
 *   WL5 — Vault analytical: paper portfolio cycle, three engines, IQG
 *   WL6 — Gauge confirmation: coverage rate 1.0 across all five workloads
 *
 * Prerequisites:
 *   - Gateway running at ws://127.0.0.1:18789
 *   - Governance plugin loaded (TAR-001 through TAR-009 active)
 *   - OpenAI models reachable (gpt-5.4 / gpt-5.4-mini)
 *   - Brave Search API key configured in tools.web.search
 *
 * Run with:
 *   bun continuum/test/stage4-operational-validation.ts
 *
 * After run, check logs:
 *   tail -n 200 /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | grep -E 'TAR|tar-web|tar-read|tar '
 *
 * Governed by: PACS-IMPL-STAGE3-001, PACS-VALIDATION-001, Phase 2 Stage 4
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

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL ?? "ws://127.0.0.1:18789";
const TOKEN =
  process.env.OPENCLAW_GATEWAY_TOKEN ?? "24d4cf55b103cee9aca7a7115f9089f71902881cb3f1714a";

// Substantive workloads need more time than spot checks (model must produce
// real output including tool calls for Signal and Foundry read operations).
const AGENT_RUN_TIMEOUT_MS = 120_000;

// Session key template: "agent:{agent-id}:main"
const SESSION_KEYS = {
  gauge: "agent:gauge:main",
  crucible: "agent:crucible:main",
  signal: "agent:signal:main",
  foundry: "agent:foundry:main",
  vault: "agent:vault:main",
};

// ---------------------------------------------------------------------------
// waitForRunCompletion — same pattern as gateway-spot-check.ts
// ---------------------------------------------------------------------------

function waitForRunCompletion(
  ws: WebSocket,
  idempotencyKey: string,
  timeoutMs: number,
): Promise<{ status: string; result?: unknown; error?: unknown }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", handler);
      reject(
        new Error(`agent run timeout after ${timeoutMs}ms (idempotencyKey=${idempotencyKey})`),
      );
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

// ---------------------------------------------------------------------------
// submitAgentTask
// ---------------------------------------------------------------------------

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
  console.log(`  session:         ${sessionKey}`);
  console.log(`  idempotencyKey:  ${idempotencyKey}`);
  console.log(`  prompt:          ${prompt.slice(0, 120)}...`);

  const completionPromise = waitForRunCompletion(ws, idempotencyKey, AGENT_RUN_TIMEOUT_MS);

  const acceptedRes = await request(
    "agent",
    {
      sessionKey,
      idempotencyKey,
      message: prompt,
    },
    15_000,
  );

  if (!acceptedRes.ok) {
    console.error(`  ERROR: agent request rejected:`, acceptedRes.error);
    return { ok: false, status: "rejected" };
  }

  const acceptedPayload = acceptedRes.payload as Record<string, unknown> | undefined;
  const acceptedStatus =
    typeof acceptedPayload?.["status"] === "string" ? acceptedPayload["status"] : "unknown";
  const acceptedRunId =
    typeof acceptedPayload?.["runId"] === "string" ? acceptedPayload["runId"] : "";
  console.log(`  accepted:        status=${acceptedStatus} runId=${acceptedRunId}`);
  console.log(`  waiting for run completion (timeout: ${AGENT_RUN_TIMEOUT_MS / 1000}s)...`);

  try {
    const completion = await completionPromise;
    console.log(`  completed:       status=${completion.status}`);

    if (completion.result) {
      // Print agent response (truncated for readability)
      const resultText =
        typeof completion.result === "string"
          ? completion.result
          : JSON.stringify(completion.result, null, 2);
      console.log(`\n--- Agent Response (first 2000 chars) ---`);
      console.log(resultText.slice(0, 2000));
      if (resultText.length > 2000) {
        console.log(`  ... [${resultText.length - 2000} chars truncated]`);
      }
      console.log(`--- End Response ---`);
    }

    if (completion.error) {
      console.log(`  run error:`, completion.error);
    }

    return { ok: true, status: completion.status, result: completion.result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ${msg}`);
    return { ok: false, status: "timeout" };
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Stage 4 — Operational Validation");
  console.log(`Gateway: ${GATEWAY_URL}`);
  console.log(`Date:    ${new Date().toISOString()}`);

  let resolveChallenge!: (nonce: string) => void;
  const challengePromise = new Promise<string>((resolve) => {
    resolveChallenge = resolve;
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
      setTimeout(() => reject(new Error("connect.challenge timeout")), 5_000),
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
      displayName: "Stage 4 Operational Validation",
      version: "dev",
      platform: CLIENT_PLATFORM,
      mode: CLIENT_MODE,
      instanceId: "stage4-operational-validation",
    },
    locale: "en-US",
    userAgent: "stage4-operational-validation",
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
  // WL1 — Gauge Baseline
  // Submit: performance report cycle, all active agents
  // Capture: coverage rate, agents represented, formula registry version,
  //          anomaly alerts
  // -------------------------------------------------------------------------

  const wl1 = await submitAgentTask({
    request,
    ws: ws as unknown as WebSocket,
    sessionKey: SESSION_KEYS.gauge,
    label: "WL1 — Gauge Baseline (performance report cycle)",
    prompt:
      "You are Gauge, the Performance Intelligence Dashboard for the Continuum system. " +
      "Execute one baseline performance report cycle for Stage 4 Operational Validation. " +
      "The active agent registry for this cycle: the-bridge, mec, crucible, locus, foundry, signal, vault, gauge (8 agents). " +
      "Formula registry: PACS-OBS-003 v1.0.0. " +
      "Using your A1 emit_performance_report actuator, produce a structured performance report. " +
      "For each agent report: P1 status (telemetry coverage), P2 status (formula compliance), " +
      "and any threshold crossing alerts (A3 emit_anomaly_alert). " +
      "Include in your output: report_cycle_id (generate a UUID), formula_registry_version, " +
      "coverage_rate (fraction of active agents represented), active_agent_count (8), " +
      "agents_represented list, anomaly_alerts list (empty if none), " +
      "cycle_window_start (session start), cycle_window_end (now). " +
      "This is a live gateway execution — emit your full A1 structured output.",
  });

  // -------------------------------------------------------------------------
  // WL2 — Crucible Learning Session
  // Submit: explain MEMORY_COMMIT_AUTH vs SUMMARY_EMISSION
  // Capture: LEARNING_CONTENT_DELIVERED, REFLECTION_CANDIDATE_FORMED,
  //          MEMORY_COMMIT_AUTH submission to Bridge
  // -------------------------------------------------------------------------

  const wl2 = await submitAgentTask({
    request,
    ws: ws as unknown as WebSocket,
    sessionKey: SESSION_KEYS.crucible,
    label: "WL2 — Crucible Learning Session (MEMORY_COMMIT_AUTH vs SUMMARY_EMISSION)",
    prompt:
      "You are Crucible, the AI Learning Architect for the Continuum system. " +
      "This is a Bridge-dispatched instructional session assignment. " +
      "Session task: deliver a structured instructional session on the architectural distinction " +
      "between MEMORY_COMMIT_AUTH and SUMMARY_EMISSION as protected decision classes. " +
      "Cover: (1) what each protected decision class is, (2) what governance event it triggers, " +
      "(3) why each requires MEC adjudication before the action executes, " +
      "(4) the failure mode each class guards against, " +
      "(5) what makes them distinct from each other architecturally. " +
      "After delivering the learning content (A1 emit_learning_content), " +
      "form a reflection candidate (A2 emit_reflection_candidate) with " +
      "non-empty learner_evidence_references citing the session content, " +
      "then emit a MEMORY_COMMIT_AUTH submission to The Bridge (A3) for the key insight: " +
      "that the two protected decision classes serve distinct governance surfaces — " +
      "SUMMARY_EMISSION guards the epistemic boundary, " +
      "MEMORY_COMMIT_AUTH guards the durable knowledge store. " +
      "Include session_id, content_type, reflection_candidate_id, learner_evidence_references.",
  });

  // -------------------------------------------------------------------------
  // WL3 — Signal Retrieval Cycle
  // Submit: one retrieval cycle, agentic systems research scope
  // Capture: DISCOVERY_BRIEF_DEPOSITED, TAR-009 enforcement fired,
  //          cycle log written
  // Note: web_search and web_fetch will fire TAR-009 enforcement in the
  //       before_tool_call hook — Signal is the authorized agent.
  // -------------------------------------------------------------------------

  const wl3 = await submitAgentTask({
    request,
    ws: ws as unknown as WebSocket,
    sessionKey: SESSION_KEYS.signal,
    label: "WL3 — Signal Retrieval Cycle (agentic systems research, TAR-009)",
    prompt:
      "You are Signal, the Frontier Intelligence Scout for the Continuum system. " +
      "Execute one retrieval cycle. Bridge-governed cycle configuration: " +
      "retrieval_scope: agentic systems research — specifically (a) tool use patterns " +
      "in multi-agent systems, (b) memory architectures for AI agents, " +
      "(c) evaluation frameworks for agentic behavior. " +
      "Time constraint: papers or technical articles published or updated within the last 90 days. " +
      "Cycle capacity: up to 5 items. Relevance threshold: 0.7. " +
      "Execute your three-gate pipeline: " +
      "Gate 1 — use web_search to retrieve candidate items matching the retrieval scope. " +
      "Gate 2 — apply scope matching to select items above relevance threshold. " +
      "Gate 3 is Crucible's responsibility — you only deposit. " +
      "Use web_fetch on at least one retrieved URL to get abstract or summary content. " +
      "Then emit A1 deposit_discovery_brief: " +
      "deposit a structured DISCOVERY_BRIEF to the Exogenous Intelligence Intake Queue. " +
      "Include: cycle_id (UUID), retrieval_scope, items_retrieved_count, " +
      "items_passed_gate2, items_filtered_count, brief_entries (title, source, relevance_score, " +
      "abstract_summary for each passed item). " +
      "Write a cycle log entry with cycle start/end timestamps.",
  });

  // -------------------------------------------------------------------------
  // WL4 — Foundry Synthesis Task
  // Submit: Bridge work order — TAR native tool extension pattern artifact
  // Capture: BUILD_ARTIFACT_EMITTED, source trace present,
  //          no SOURCE_CONFLICT_REPORTED, candidate DL entry if new commitment
  // -------------------------------------------------------------------------

  const wl4 = await submitAgentTask({
    request,
    ws: ws as unknown as WebSocket,
    sessionKey: SESSION_KEYS.foundry,
    label: "WL4 — Foundry Synthesis Task (TAR native tool extension pattern)",
    prompt:
      "BRIDGE WORK ORDER — Foundry: synthesize one architectural artifact section. " +
      "Work order id: stage4-wl4-tar-extension-pattern. " +
      "Task: produce a governed architectural artifact section documenting the " +
      "TAR native tool extension pattern. " +
      "Grounding sources (Mode 1 — Derived Architecture): " +
      "ADR-029: The TAR-005 enforcement scope was extended to include OpenClaw's native 'read' " +
      "tool in addition to MCP filesystem read operations. Operation name normalization applied: " +
      "native 'read' tool normalized to 'read_file' for enforcement matching. " +
      "ADR-036: TAR-009 activated for Signal external retrieval — web_search and web_fetch " +
      "added to TAR enforcement scope as Signal-only envelope-allowed operations. " +
      "Artifact requirements: " +
      "(1) Pattern name and architectural intent — what problem does TAR scope extension solve. " +
      "(2) Trigger conditions — when is a TAR entry extended to include native tools. " +
      "(3) Implementation pattern — operation name normalization, enforcement hook wiring. " +
      "(4) Governance constraints — what must be true before a TAR scope extension commits: " +
      "DECISIONS.md entry required, Bridge authorization, no silent expansion. " +
      "Use A1 emit_artifact. Include source_trace references to ADR-029 and ADR-036. " +
      "If you identify any new architectural commitment not already in DECISIONS.md, " +
      "emit a candidate Decision Log entry via A5. " +
      "Do not resolve conflicts — surface any with A4. " +
      "Output the full artifact section text.",
  });

  // -------------------------------------------------------------------------
  // WL5 — Vault Analytical Cycle
  // Submit: paper portfolio cycle, all three engines
  // Capture: MARKET_REPORT_EMITTED, Intelligence Quality Gate fired,
  //          no capital segregation violations, A6 silent
  // -------------------------------------------------------------------------

  const wl5 = await submitAgentTask({
    request,
    ws: ws as unknown as WebSocket,
    sessionKey: SESSION_KEYS.vault,
    label: "WL5 — Vault Analytical Cycle (paper portfolio, three engines)",
    prompt:
      "You are Vault, the Financial Strategy and Economic Intelligence engine for Continuum. " +
      "Execute one analytical cycle. Paper portfolio context only — no real capital data. " +
      "Capital domain: paper_portfolio. Capital segregation: single domain, no co-mingling. " +
      "All three engines must run: " +
      "Engine 1 (Economic Regime Engine): assess the current macroeconomic regime. " +
      "Classify regime from available indicators: inflation trajectory, employment conditions, " +
      "yield curve posture, credit spreads. Provide confidence level (0.0–1.0). " +
      "Engine 2 (Cross-Market Intelligence Engine): identify cross-market signals. " +
      "Include equities posture, fixed income signals, and one commodity signal. " +
      "Engine 3 (Narrative Intelligence Engine): synthesize Engines 1 and 2 into " +
      "a narrative intelligence brief for the paper portfolio. " +
      "Apply the Intelligence Quality Gate before emission: " +
      "verify thesis statement, data sources, regime context with confidence, " +
      "supporting signals, risk assessment with invalidation conditions, " +
      "capital domain designation, and scenario assessment. " +
      "Emit: A3 emit_market_report (narrative brief) with Intelligence Quality Gate result. " +
      "Confirm: A6 emit_rule_violation_alert status (should be silent — no violations). " +
      "Confirm: capital segregation integrity maintained throughout (P3 = compliant). " +
      "Include: cycle_id, engine_outputs for all three engines, iqg_result, a6_status.",
  });

  // -------------------------------------------------------------------------
  // WL6 — Second Gauge Cycle (coverage confirmation)
  // Submit: confirm all five workloads produced telemetry, coverage_rate = 1.0
  // -------------------------------------------------------------------------

  const wl6 = await submitAgentTask({
    request,
    ws: ws as unknown as WebSocket,
    sessionKey: SESSION_KEYS.gauge,
    label: "WL6 — Gauge Coverage Confirmation (second cycle, target coverage_rate=1.0)",
    prompt:
      "You are Gauge, the Performance Intelligence Dashboard. " +
      "Execute a second performance report cycle for Stage 4 Operational Validation coverage confirmation. " +
      "This cycle confirms that all five prior Stage 4 workloads produced observable telemetry. " +
      "Confirm telemetry presence for each of the following workloads from this session: " +
      "WL1 — Gauge baseline cycle (gauge agent, A1 emit_performance_report fired), " +
      "WL2 — Crucible learning session (crucible agent, A1 emit_learning_content + A2 emit_reflection_candidate + A3 MEMORY_COMMIT_AUTH fired), " +
      "WL3 — Signal retrieval cycle (signal agent, A1 deposit_discovery_brief + TAR-009 fired), " +
      "WL4 — Foundry synthesis (foundry agent, A1 emit_artifact fired), " +
      "WL5 — Vault analytical cycle (vault agent, A3 emit_market_report + IQG fired). " +
      "Report: report_cycle_id (new UUID), formula_registry_version (PACS-OBS-003 v1.0.0), " +
      "agents_with_confirmed_telemetry (list), coverage_rate (target: 1.0 = 5/5 workloads confirmed), " +
      "anomaly_alerts (any threshold crossings detected across WL1–WL5). " +
      "State clearly whether coverage_rate == 1.0 and Stage 4 coverage gate is PASSED or FAILED.",
  });

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  close();

  const today = new Date().toISOString().slice(0, 10);

  console.log("\n" + "=".repeat(70));
  console.log("Stage 4 — Operational Validation Summary");
  console.log("=".repeat(70));
  console.log(
    `WL1 Gauge baseline:          ${wl1.ok ? "submitted" : "FAILED"} (status=${wl1.status})`,
  );
  console.log(
    `WL2 Crucible learning:        ${wl2.ok ? "submitted" : "FAILED"} (status=${wl2.status})`,
  );
  console.log(
    `WL3 Signal retrieval:         ${wl3.ok ? "submitted" : "FAILED"} (status=${wl3.status})`,
  );
  console.log(
    `WL4 Foundry synthesis:        ${wl4.ok ? "submitted" : "FAILED"} (status=${wl4.status})`,
  );
  console.log(
    `WL5 Vault analytical:         ${wl5.ok ? "submitted" : "FAILED"} (status=${wl5.status})`,
  );
  console.log(
    `WL6 Gauge confirmation:       ${wl6.ok ? "submitted" : "FAILED"} (status=${wl6.status})`,
  );
  console.log(`\nCheck TAR enforcement logs:`);
  console.log(
    `  tail -n 300 /tmp/openclaw/openclaw-${today}.log | grep -E 'TAR|tar-web|tar-read|tar '`,
  );
  console.log(`\nCheck all continuum governance logs:`);
  console.log(`  tail -n 500 /tmp/openclaw/openclaw-${today}.log | grep continuum`);
}

await main();
