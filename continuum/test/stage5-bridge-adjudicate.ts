/**
 * continuum/test/stage5-bridge-adjudicate.ts
 *
 * Stage 5 — Submit MEMORY_COMMIT_AUTH adjudication requests to The Bridge
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

const MESSAGE = `Two MEMORY_COMMIT_AUTH requests are pending from Crucible session live-production-session-2026-03-21-faheem. Please adjudicate both.

Request 1:
- reflection_candidate_id: 68f5655f-61d0-4d75-a112-331c35b0d6d7
- key_insight: Observability in agent systems is the capacity to reconstruct the causal chain from observation to decision to action to outcome. Logs alone are insufficient without event taxonomy, traceable identifiers, and diagnostic structure.
- learner_evidence_references: 3 anchors from BG-C foundations session (Sections 2, 5, 9)
- evidence_threshold_assessment: meets_threshold = true

Request 2:
- reflection_candidate_id: cd1cc2cf-8c96-47df-bc95-f1d1654a1cc5
- key_insight: The taxonomy-fields-metrics-traceability framework makes observability operational: taxonomy defines the meaningful moments, fields make those moments diagnostically useful, metrics reveal systemic patterns, and traceability localizes failure within a causal chain.
- learner_evidence_references: 3 anchors from BG-C worked diagnostic session (Sections 4, 5, 9)
- evidence_threshold_assessment: meets_threshold = true

For each request, adjudicate and return: reflection_candidate_id, outcome (approved/rejected/quarantined/escalated), rationale.`;

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
      displayName: "Stage5 Bridge Adjudicate",
      version: "dev",
      platform: CLIENT_PLATFORM,
      mode: CLIENT_MODE,
      instanceId: "stage5-bridge-adjudicate",
    },
    locale: "en-US",
    userAgent: "stage5-bridge-adjudicate",
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
    { sessionKey: "agent:the-bridge:main", idempotencyKey, message: MESSAGE },
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
