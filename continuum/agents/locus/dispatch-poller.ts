/**
 * continuum/agents/locus/dispatch-poller.ts
 *
 * Locus Dispatch Poller -- Phase B idempotent extraction dispatcher.
 *
 * Reads the Locus intake ledger to find designations that have been received
 * but not yet dispatched for extraction. Enforces designation-level idempotency
 * via a durable dispatch ledger. Each designation is dispatched exactly once.
 *
 * Run: bun continuum/agents/locus/dispatch-poller.ts
 *
 * Phase B architecture:
 *   intake-poller.ts  -- writes intake-ledger.jsonl (S1 receipt)
 *   dispatch-poller.ts -- reads intake-ledger.jsonl, writes dispatch-ledger.jsonl,
 *                         dispatches gateway session, updates dispatch status
 *
 * Governed by: ADR-043, ADR-041, Locus SOUL.md A1, PACS-ARCH-GRAPH-001
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
import { loadIntakeLedger } from "./intake-poller.ts";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const CROSS_SESSION_MEMORY_PATH = join(
  homedir(),
  ".openclaw",
  "agents",
  "crucible",
  "memory",
  "cross-session-memory.jsonl",
);

export const DISPATCH_LEDGER_PATH = join(
  homedir(),
  ".openclaw",
  "agents",
  "locus",
  "dispatch-ledger.jsonl",
);

export const EXTRACTION_RESULTS_PATH = join(
  homedir(),
  ".openclaw",
  "agents",
  "locus",
  "extraction-results.jsonl",
);

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL ?? "ws://127.0.0.1:18789";
const TOKEN =
  process.env.OPENCLAW_GATEWAY_TOKEN ?? "24d4cf55b103cee9aca7a7115f9089f71902881cb3f1714a";
const TIMEOUT_MS = 300_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DispatchLedgerEntry = {
  designation_id: string;
  artifact_id: string;
  dispatch_timestamp: string;
  dispatch_status: "dispatched" | "completed" | "failed";
  session_id?: string;
  extraction_result_ref?: string;
};

type CrossSessionMemoryRecord = {
  memory_commit_id: string;
  reflection_candidate_id: string;
  session_id: string;
  commit_timestamp: string;
  adjudication_outcome: "approved";
  adjudication_rationale: string;
  key_insight: string;
  learner_evidence_references: Array<{
    source: string;
    anchor: string;
    excerpt: string;
  }>;
  source_agent: string;
  commit_status: string;
};

// ---------------------------------------------------------------------------
// Dispatch ledger helpers
// ---------------------------------------------------------------------------

export function loadDispatchLedger(
  ledgerPath: string = DISPATCH_LEDGER_PATH,
): DispatchLedgerEntry[] {
  if (!existsSync(ledgerPath)) {
    return [];
  }
  const raw = readFileSync(ledgerPath, "utf8");
  const entries: DispatchLedgerEntry[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) {
      continue;
    }
    try {
      entries.push(JSON.parse(t) as DispatchLedgerEntry);
    } catch {
      // skip malformed lines
    }
  }
  return entries;
}

export function hasBeenDispatched(designationId: string, ledger: DispatchLedgerEntry[]): boolean {
  return ledger.some(
    (e) =>
      e.designation_id === designationId &&
      (e.dispatch_status === "dispatched" || e.dispatch_status === "completed"),
  );
}

export function appendDispatchEntry(
  entry: DispatchLedgerEntry,
  ledgerPath: string = DISPATCH_LEDGER_PATH,
): void {
  const dir = dirname(ledgerPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  appendFileSync(ledgerPath, JSON.stringify(entry) + "\n", "utf8");
}

// ---------------------------------------------------------------------------
// Artifact payload loader
// ---------------------------------------------------------------------------

function loadArtifactPayload(artifactId: string): CrossSessionMemoryRecord | null {
  if (!existsSync(CROSS_SESSION_MEMORY_PATH)) {
    return null;
  }
  const raw = readFileSync(CROSS_SESSION_MEMORY_PATH, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) {
      continue;
    }
    try {
      const record = JSON.parse(t) as CrossSessionMemoryRecord;
      if (record.memory_commit_id === artifactId) {
        return record;
      }
    } catch {
      // skip malformed lines
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Build extraction prompt
// ---------------------------------------------------------------------------

function buildExtractionPrompt(
  designationId: string,
  designationSequence: number,
  artifactId: string,
  payload: CrossSessionMemoryRecord,
): string {
  return `You are Locus executing A1 (extract_and_index) on a Bridge-designated artifact.

DESIGNATION CONTEXT:
- designation_id: ${designationId}
- artifact_id: ${artifactId}
- source_agent: ${payload.source_agent}
- designation_sequence: ${designationSequence}
- ingestion_target: locus

ARTIFACT PAYLOAD:
${JSON.stringify(payload, null, 2)}

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
  "artifact_id": "${artifactId}",
  "designation_id": "${designationId}",
  "extraction_timestamp": "<ISO timestamp>",
  "tier_note": "Tier 1 provisional -- ADR-043",
  "entity_candidates": [ ... ],
  "relationship_candidates": [ ... ],
  "provenance_records": [ ... ],
  "contradiction_flags": [],
  "extraction_summary": "<one paragraph describing what was extracted and why>"
}

Begin extraction now. Output the JSON result and nothing else.`;
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

async function dispatchToGateway(
  designationId: string,
  designationSequence: number,
  artifactId: string,
  payload: CrossSessionMemoryRecord,
  resultsPath: string,
): Promise<{ sessionId: string; success: boolean }> {
  const sessionId = randomUUID();

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
      displayName: "Locus Dispatch Poller",
      version: "dev",
      platform: CLIENT_PLATFORM,
      mode: CLIENT_MODE,
      instanceId: `locus-dispatch-${designationId.slice(0, 8)}`,
    },
    locale: "en-US",
    userAgent: "locus-dispatch-poller",
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
  const message = buildExtractionPrompt(designationId, designationSequence, artifactId, payload);

  const completionPromise = waitForRunCompletion(
    ws as unknown as WebSocket,
    idempotencyKey,
    TIMEOUT_MS,
  );

  const acceptedRes = await request(
    "agent",
    { sessionKey: "agent:locus:main", idempotencyKey, message },
    15_000,
  );

  if (!acceptedRes.ok) {
    close();
    throw new Error(`agent request rejected: ${JSON.stringify(acceptedRes.error)}`);
  }

  const c = await completionPromise;
  close();

  // Write extraction result
  if (c.result) {
    const resultText = typeof c.result === "string" ? c.result : JSON.stringify(c.result, null, 2);

    // Try to parse as JSON to count candidates
    let entityCount = 0;
    let relationshipCount = 0;
    let provenanceCount = 0;
    try {
      const parsed = JSON.parse(resultText) as {
        entity_candidates?: unknown[];
        relationship_candidates?: unknown[];
        provenance_records?: unknown[];
      };
      entityCount = parsed.entity_candidates?.length ?? 0;
      relationshipCount = parsed.relationship_candidates?.length ?? 0;
      provenanceCount = parsed.provenance_records?.length ?? 0;
    } catch {
      // result was not clean JSON -- write raw
    }

    const resultRecord = {
      session_id: sessionId,
      artifact_id: artifactId,
      designation_id: designationId,
      extraction_timestamp: new Date().toISOString(),
      tier_note: "Tier 1 provisional -- ADR-043",
      entity_count: entityCount,
      relationship_count: relationshipCount,
      provenance_record_count: provenanceCount,
      contradiction_flags: [],
      extraction_status: "candidates_produced",
      next_step: "MEMORY_COMMIT_AUTH -- Bridge adjudication required before any graph write",
    };

    const dir = dirname(resultsPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    appendFileSync(resultsPath, JSON.stringify(resultRecord) + "\n", "utf8");
  }

  if (c.error) {
    console.error("[locus-dispatch-poller] Locus run error:", c.error);
    return { sessionId, success: false };
  }

  return { sessionId, success: true };
}

// ---------------------------------------------------------------------------
// Main poller logic
// ---------------------------------------------------------------------------

export type DispatchPollerResult = {
  dispatched: number;
  skipped: number;
  failed: number;
};

export async function runDispatchPoller(params?: {
  intakeLedgerPath?: string;
  dispatchLedgerPath?: string;
  resultsPath?: string;
  now?: Date;
}): Promise<DispatchPollerResult> {
  const intakeLedgerPath = params?.intakeLedgerPath;
  const dispatchLedgerPath = params?.dispatchLedgerPath ?? DISPATCH_LEDGER_PATH;
  const resultsPath = params?.resultsPath ?? EXTRACTION_RESULTS_PATH;
  const now = params?.now ?? new Date();

  const intakeLedger = loadIntakeLedger(intakeLedgerPath);
  console.log(
    `[locus-dispatch-poller] Intake ledger has ${intakeLedger.length} received designation(s).`,
  );

  const dispatchLedger = loadDispatchLedger(dispatchLedgerPath);
  console.log(
    `[locus-dispatch-poller] Dispatch ledger has ${dispatchLedger.length} dispatch record(s).`,
  );

  let dispatched = 0;
  let skipped = 0;
  let failed = 0;

  for (const intakeEntry of intakeLedger) {
    if (hasBeenDispatched(intakeEntry.designation_id, dispatchLedger)) {
      console.log(
        `[locus-dispatch-poller] designation_id=${intakeEntry.designation_id} already dispatched. Skipping.`,
      );
      skipped++;
      continue;
    }

    console.log(
      `[locus-dispatch-poller] Dispatching extraction for artifact_id=${intakeEntry.artifact_id}`,
    );

    const payload = loadArtifactPayload(intakeEntry.artifact_id);
    if (!payload) {
      console.error(
        `[locus-dispatch-poller] Cannot load artifact payload for ${intakeEntry.artifact_id}. Skipping.`,
      );
      failed++;
      continue;
    }

    // Write "dispatched" entry before sending
    const dispatchTimestamp = now.toISOString();
    const pendingEntry: DispatchLedgerEntry = {
      designation_id: intakeEntry.designation_id,
      artifact_id: intakeEntry.artifact_id,
      dispatch_timestamp: dispatchTimestamp,
      dispatch_status: "dispatched",
    };
    appendDispatchEntry(pendingEntry, dispatchLedgerPath);
    dispatchLedger.push(pendingEntry);

    try {
      const result = await dispatchToGateway(
        intakeEntry.designation_id,
        1, // designation_sequence from intake log -- simplified for Phase B
        intakeEntry.artifact_id,
        payload,
        resultsPath,
      );

      // Write "completed" entry
      const completedEntry: DispatchLedgerEntry = {
        designation_id: intakeEntry.designation_id,
        artifact_id: intakeEntry.artifact_id,
        dispatch_timestamp: dispatchTimestamp,
        dispatch_status: result.success ? "completed" : "failed",
        session_id: result.sessionId,
        extraction_result_ref: resultsPath,
      };
      appendDispatchEntry(completedEntry, dispatchLedgerPath);

      if (result.success) {
        dispatched++;
        console.log(
          `[locus-dispatch-poller] Completed: artifact_id=${intakeEntry.artifact_id} session_id=${result.sessionId}`,
        );
      } else {
        failed++;
        console.error(`[locus-dispatch-poller] Failed: artifact_id=${intakeEntry.artifact_id}`);
      }
    } catch (err) {
      console.error(`[locus-dispatch-poller] Dispatch error:`, err);
      const failedEntry: DispatchLedgerEntry = {
        designation_id: intakeEntry.designation_id,
        artifact_id: intakeEntry.artifact_id,
        dispatch_timestamp: dispatchTimestamp,
        dispatch_status: "failed",
      };
      appendDispatchEntry(failedEntry, dispatchLedgerPath);
      failed++;
    }
  }

  console.log(
    `[locus-dispatch-poller] Complete. Dispatched: ${dispatched}, Skipped: ${skipped}, Failed: ${failed}.`,
  );
  return { dispatched, skipped, failed };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runDispatchPoller();
  if (result.skipped > 0 && result.dispatched === 0 && result.failed === 0) {
    console.log("[locus-dispatch-poller] All designations already dispatched. Loop is idempotent.");
  }
}
