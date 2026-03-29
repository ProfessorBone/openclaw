/**
 * continuum/agents/locus/intake-poller.ts
 *
 * Locus Intake Poller -- the physical substrate for S1 (Designated Artifact Intake).
 *
 * Reads the Bridge artifact designation log, detects new records where
 * ingestion_target === "locus", enforces designation-level idempotency via a
 * durable checkpoint ledger, and writes observable intake evidence to the
 * Locus workspace.
 *
 * Phase A (this implementation): intake-loop activation only.
 * Phase B (future): wire gateway dispatch to trigger Locus extraction session.
 *
 * Run: bun continuum/agents/locus/intake-poller.ts
 *
 * Governed by: Locus SOUL.md S1 (Designated Artifact Intake), ADR-024, ADR-041
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const DESIGNATION_LOG_PATH = join(
  homedir(),
  ".openclaw",
  "agents",
  "the-bridge",
  "artifact-designation-log.jsonl",
);
export const INTAKE_LEDGER_PATH = join(
  homedir(),
  ".openclaw",
  "agents",
  "locus",
  "intake-ledger.jsonl",
);
export const INTAKE_LOG_PATH = join(homedir(), ".openclaw", "agents", "locus", "intake-log.jsonl");
export const HEARTBEAT_PATH = join(homedir(), ".openclaw", "agents", "locus", "HEARTBEAT.md");

export type ArtifactDesignatedEvent = {
  event_type: "ARTIFACT_DESIGNATED";
  event_class: "GOVERNANCE";
  designation_id: string;
  artifact_id: string;
  artifact_type: string;
  source_agent: string;
  designation_timestamp: string;
  designated_by: string;
  ingestion_target: string;
  designation_rationale: string;
  source_record: Record<string, unknown>;
  designation_sequence: number;
};

export type IntakeLedgerEntry = {
  designation_id: string;
  artifact_id: string;
  processed_at: string;
  status: "processed";
};

export type IntakeLogRecord = {
  event_type: "ARTIFACT_INTAKE_RECORDED";
  event_class: "LIFECYCLE";
  designation_id: string;
  artifact_id: string;
  artifact_type: string;
  source_agent: string;
  designation_timestamp: string;
  ingestion_target: "locus";
  processing_timestamp: string;
  intake_status: "received";
  designation_sequence: number;
};

export function loadDesignationLog(
  logPath: string = DESIGNATION_LOG_PATH,
): ArtifactDesignatedEvent[] {
  if (!existsSync(logPath)) {
    console.log(`[locus-intake-poller] Designation log not found at: ${logPath}`);
    return [];
  }
  const raw = readFileSync(logPath, "utf8");
  const events: ArtifactDesignatedEvent[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) {
      continue;
    }
    try {
      const evt = JSON.parse(t) as ArtifactDesignatedEvent;
      if (evt.event_type === "ARTIFACT_DESIGNATED" && evt.ingestion_target === "locus") {
        events.push(evt);
      }
    } catch {
      // skip malformed lines
    }
  }
  return events;
}

export function loadIntakeLedger(ledgerPath: string = INTAKE_LEDGER_PATH): IntakeLedgerEntry[] {
  if (!existsSync(ledgerPath)) {
    return [];
  }
  const raw = readFileSync(ledgerPath, "utf8");
  const entries: IntakeLedgerEntry[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) {
      continue;
    }
    try {
      entries.push(JSON.parse(t) as IntakeLedgerEntry);
    } catch {
      // skip malformed lines
    }
  }
  return entries;
}

export function hasBeenProcessed(designationId: string, ledger: IntakeLedgerEntry[]): boolean {
  return ledger.some((e) => e.designation_id === designationId);
}

export function appendLedgerEntry(
  entry: IntakeLedgerEntry,
  ledgerPath: string = INTAKE_LEDGER_PATH,
): void {
  const dir = dirname(ledgerPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  appendFileSync(ledgerPath, JSON.stringify(entry) + "\n", "utf8");
}

export function appendIntakeRecord(
  record: IntakeLogRecord,
  logPath: string = INTAKE_LOG_PATH,
): void {
  const dir = dirname(logPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  appendFileSync(logPath, JSON.stringify(record) + "\n", "utf8");
}

export function writeHeartbeat(
  lastIntake: { artifact_id: string; processing_timestamp: string; designation_sequence: number },
  heartbeatPath: string = HEARTBEAT_PATH,
): void {
  const dir = dirname(heartbeatPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const content =
    [
      "# HEARTBEAT.md -- Locus",
      "## Designated Artifact Intake Status",
      `**Agent:** Locus -- Knowledge Graph Engineer`,
      `**System:** Continuum -- Faheem's PAC System`,
      `**Updated:** ${lastIntake.processing_timestamp}`,
      "",
      "## Last S1 Intake",
      "",
      `**Artifact ID:** ${lastIntake.artifact_id}`,
      `**Designation Sequence:** ${lastIntake.designation_sequence}`,
      `**Processed At:** ${lastIntake.processing_timestamp}`,
      "",
      "## Phase A Intake Status",
      "",
      "Intake-loop is operational. Artifact received and logged for graph extraction.",
      "Phase B (gateway dispatch) pending.",
      "",
      "See intake-log.jsonl and intake-ledger.jsonl in this workspace.",
      "",
      "_Governed by: Locus SOUL.md S1, ADR-024, ADR-041_",
    ].join("\n") + "\n";
  writeFileSync(heartbeatPath, content, "utf8");
}

export type PollerResult = {
  processed: number;
  skipped: number;
  records: IntakeLogRecord[];
};

export function runPoller(params?: {
  designationLogPath?: string;
  intakeLedgerPath?: string;
  intakeLogPath?: string;
  heartbeatPath?: string;
  now?: Date;
}): PollerResult {
  const designationLogPath = params?.designationLogPath ?? DESIGNATION_LOG_PATH;
  const intakeLedgerPath = params?.intakeLedgerPath ?? INTAKE_LEDGER_PATH;
  const intakeLogPath = params?.intakeLogPath ?? INTAKE_LOG_PATH;
  const heartbeatPath = params?.heartbeatPath ?? HEARTBEAT_PATH;
  const now = params?.now ?? new Date();

  const designations = loadDesignationLog(designationLogPath);
  console.log(`[locus-intake-poller] Found ${designations.length} locus-targeted designation(s).`);
  const ledger = loadIntakeLedger(intakeLedgerPath);
  console.log(`[locus-intake-poller] Ledger has ${ledger.length} processed record(s).`);

  let processed = 0;
  let skipped = 0;
  const records: IntakeLogRecord[] = [];

  for (const evt of designations) {
    if (hasBeenProcessed(evt.designation_id, ledger)) {
      console.log(`[locus-intake-poller] Already processed: ${evt.designation_id}. Skipping.`);
      skipped++;
      continue;
    }
    const processingTimestamp = now.toISOString();
    const intakeRecord: IntakeLogRecord = {
      event_type: "ARTIFACT_INTAKE_RECORDED",
      event_class: "LIFECYCLE",
      designation_id: evt.designation_id,
      artifact_id: evt.artifact_id,
      artifact_type: evt.artifact_type,
      source_agent: evt.source_agent,
      designation_timestamp: evt.designation_timestamp,
      ingestion_target: "locus",
      processing_timestamp: processingTimestamp,
      intake_status: "received",
      designation_sequence: evt.designation_sequence,
    };
    appendIntakeRecord(intakeRecord, intakeLogPath);
    const ledgerEntry: IntakeLedgerEntry = {
      designation_id: evt.designation_id,
      artifact_id: evt.artifact_id,
      processed_at: processingTimestamp,
      status: "processed",
    };
    appendLedgerEntry(ledgerEntry, intakeLedgerPath);
    ledger.push(ledgerEntry);
    records.push(intakeRecord);
    processed++;
    console.log(`[locus-intake-poller] Processed: artifact_id=${evt.artifact_id}`);
  }

  if (records.length > 0) {
    const last = records[records.length - 1];
    writeHeartbeat(
      {
        artifact_id: last.artifact_id,
        processing_timestamp: last.processing_timestamp,
        designation_sequence: last.designation_sequence,
      },
      heartbeatPath,
    );
    console.log(`[locus-intake-poller] HEARTBEAT.md updated.`);
  } else if (!existsSync(heartbeatPath)) {
    const dir = dirname(heartbeatPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(
      heartbeatPath,
      `# HEARTBEAT.md -- Locus\n**Updated:** ${now.toISOString()}\n\nNo pending designations.\n`,
      "utf8",
    );
  }

  console.log(`[locus-intake-poller] Complete. Processed: ${processed}, Skipped: ${skipped}.`);
  return { processed, skipped, records };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runPoller();
  if (result.processed > 0) {
    console.log("\n--- Intake summary ---");
    for (const r of result.records) {
      console.log(`  [${r.processing_timestamp}] ${r.artifact_id} (seq ${r.designation_sequence})`);
      console.log(`    designation_id: ${r.designation_id}`);
      console.log(`    source_agent:   ${r.source_agent}`);
      console.log(`    intake_status:  ${r.intake_status}`);
    }
    console.log("--- End of summary ---");
    console.log("[locus-intake-poller] Phase A complete. Graph extraction (Phase B) pending.");
  } else {
    console.log("[locus-intake-poller] No new designations to process.");
  }
}
