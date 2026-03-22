/**
 * continuum/test/stage5-crucible-session1.ts
 *
 * Stage 5 — Crucible Production Session 1
 * Learner: Faheem | Curriculum: AI Agent Build Guide
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
const TIMEOUT_MS = 300_000;

const PROMPT = `You are now in a live production session. Faheem is your learner. This session has two phases.

**Phase 1 — Baseline knowledge-state assessment**

Conduct a structured but efficient assessment of Faheem's current knowledge state across the Build Guide curriculum. The goal is placement, not examination. Keep it bounded — five to eight targeted questions is sufficient. Design the questions to distinguish between:

- Demonstrated understanding (can explain, can apply, can identify failure modes)
- Asserted understanding (claims familiarity but cannot reproduce the reasoning)
- Genuine gaps (unknown territory)

Cover these section families in the assessment:

- BG-A: Agent Foundations — PEAS, environment types, actuator/sensor contracts
- BG-B: State and Memory — memory architecture, state scope, lifecycle, persistence
- BG-C: Observability — event taxonomy, telemetry, metrics traceability
- BG-D: Multi-Agent Coordination — orchestrator/worker patterns, handoff validation, state contracts
- BG-E: Governance and Safety — epistemic capture, drift, boundary discipline, constitutional constraints
- BG-F: Evaluation — calibration, reflection loops, evidence-based assessment

After each response from Faheem, classify the evidence quality as demonstrated or asserted before moving to the next question.

**Phase 2 — Curriculum placement and first session**

After the assessment, tell Faheem:
- Your strongest area and why
- Your weakest area and why
- The first topic you will teach in this session and why it is the highest-value entry point

Then begin one bounded learning session on that topic. Deliver structured content. At the end, form one reflection candidate. If the reflection candidate meets the evidence threshold, submit a MEMORY_COMMIT_AUTH request to The Bridge.

Begin the assessment now.`;

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

async function main() {
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
      displayName: "Stage5 Crucible Session 1",
      version: "dev",
      platform: CLIENT_PLATFORM,
      mode: CLIENT_MODE,
      instanceId: "stage5-crucible-s1",
    },
    locale: "en-US",
    userAgent: "stage5-crucible-s1",
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

  const idempotencyKey = randomUUID();
  const completionPromise = waitForRunCompletion(
    ws as unknown as WebSocket,
    idempotencyKey,
    TIMEOUT_MS,
  );

  const acceptedRes = await request(
    "agent",
    { sessionKey: "agent:crucible:main", idempotencyKey, message: PROMPT },
    15_000,
  );

  if (!acceptedRes.ok) {
    console.error("rejected:", acceptedRes.error);
    close();
    process.exit(1);
  }

  const c = await completionPromise;

  if (c.result) {
    const t = typeof c.result === "string" ? c.result : JSON.stringify(c.result, null, 2);
    console.log(t);
  }
  if (c.error) {
    console.error("error:", c.error);
  }

  close();
}

await main();
