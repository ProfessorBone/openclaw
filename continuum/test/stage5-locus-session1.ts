/**
 * continuum/test/stage5-locus-session1.ts
 *
 * Stage 5 -- Locus Phase B Validation Session 1
 *
 * Dispatches a gateway session to Locus for A1 extraction of the first
 * Bridge-designated artifact: mec-adj-cd1cc2cf (Crucible four-layer
 * observability framework commit).
 *
 * This is a Tier 1 validation run per ADR-043. Extraction output is
 * provisional -- no graph writes are authorized from this session.
 * All extraction candidates require Bridge MEMORY_COMMIT_AUTH before persistence.
 *
 * Governed by: ADR-043, ADR-041, Locus SOUL.md A1, PACS-ARCH-GRAPH-001
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

const ARTIFACT_PAYLOAD = {
  memory_commit_id: "mec-adj-cd1cc2cf",
  reflection_candidate_id: "cd1cc2cf-8c96-47df-bc95-f1d1654a1cc5",
  session_id: "live-production-session-2026-03-21-faheem",
  commit_timestamp: "2026-03-21T17:05:00.000Z",
  adjudication_outcome: "approved",
  key_insight:
    "The taxonomy-fields-metrics-traceability framework makes observability operational: taxonomy defines the meaningful moments, fields make those moments diagnostically useful, metrics reveal systemic patterns, and traceability localizes failure within a causal chain.",
  learner_evidence_references: [
    {
      source: "BG-C_worked_example",
      anchor: "Section 4",
      excerpt:
        "Because the chain is linked by trace_id and decision_id, we can localize the problem: detection was correct, candidate selection was correct, decision was correct, execution targeted the wrong job.",
    },
    {
      source: "BG-C_worked_example",
      anchor: "Section 5",
      excerpt: "Each layer contributed something non-substitutable to finding the bug.",
    },
    {
      source: "BG-C_worked_example",
      anchor: "Section 9",
      excerpt:
        "Taxonomy gives the map, fields give the details, metrics show the pattern, traceability reveals the cause.",
    },
  ],
  source_agent: "Crucible",
};

const PROMPT = `You are Locus executing A1 (extract_and_index) on a Bridge-designated artifact.

DESIGNATION CONTEXT:
- designation_id: 2b1d94f5-088d-48cc-9f8b-98490d058d7d
- artifact_id: mec-adj-cd1cc2cf
- source_agent: Crucible
- designation_sequence: 1
- ingestion_target: locus

ARTIFACT PAYLOAD:
${JSON.stringify(ARTIFACT_PAYLOAD, null, 2)}

GRAPH SCHEMA CONSTRAINTS (PACS-ARCH-GRAPH-001 v1.0.0):

Entity types allowed: Concept, Pattern, Decision, Signal, Metric, Thesis, Artifact
Relationship types allowed: DERIVED_FROM, CONTRADICTS, SUPPORTS, GOVERNS, INFORMS,
  MEASURED_BY, CROSS_REFERENCES, AUTHORED_BY, EVALUATES, SUPERSEDES
Domain tags: GOVERNANCE, LEARNING, KNOWLEDGE_GRAPH, ENGINEERING, INTELLIGENCE,
  PERFORMANCE, FINANCIAL, CROSS_DOMAIN

Required fields per entity candidate:
  entity_id (UUID), entity_type, label, domain_tag, source_artifact_id, extraction_timestamp

Required fields per relationship candidate:
  relationship_id (UUID), relationship_type, source_entity_id, target_entity_id,
  domain_boundary_crossed (boolean), primary_provenance_record_id

Required fields per provenance record:
  provenance_record_id (UUID), source_artifact_id, extraction_basis (quote or
  direct reference to artifact content that justifies the extraction),
  extraction_class (direct_extraction | implied_extraction)

INSTRUCTIONS:

1. Read the artifact payload above.
2. Extract every entity explicitly present in the key_insight and learner_evidence_references.
   Do not infer. Do not synthesize. Extract only what is explicitly stated.
3. Form typed relationships between extracted entities where the artifact content explicitly
   supports a relationship of one of the defined types.
4. For each entity and each relationship, produce a complete provenance record citing the
   exact excerpt or field from the artifact that justifies the extraction.
5. Do not resolve contradictions. Do not form unsupported cross-domain links.
   Do not write to any graph. These are candidates only.

OUTPUT FORMAT:

Produce a structured JSON extraction result with:
{
  "session_id": "<UUID>",
  "artifact_id": "mec-adj-cd1cc2cf",
  "designation_id": "2b1d94f5-088d-48cc-9f8b-98490d058d7d",
  "extraction_timestamp": "<ISO timestamp>",
  "tier_note": "Tier 1 provisional -- ADR-043",
  "entity_candidates": [ ... ],
  "relationship_candidates": [ ... ],
  "provenance_records": [ ... ],
  "contradiction_flags": [],
  "extraction_summary": "<one paragraph describing what was extracted and why>"
}

Begin extraction now. Output the JSON result and nothing else.`;

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
      displayName: "Stage5 Locus Session 1",
      version: "dev",
      platform: CLIENT_PLATFORM,
      mode: CLIENT_MODE,
      instanceId: "stage5-locus-s1",
    },
    locale: "en-US",
    userAgent: "stage5-locus-s1",
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
    { sessionKey: "agent:locus:main", idempotencyKey, message: PROMPT },
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
