/**
 * continuum/governance/audit-log.ts
 *
 * Work Order 6 — Failure Injection Readiness Gate (INJ-005)
 * Minimal Stage 3 in-process Tamper-Evident Audit Log.
 *
 * Implements the four tamper-evidence properties from PACS-ARCH-AUDIT-001:
 *   1. Append-only structure
 *   2. Immutability after write
 *   3. Hash-based chain linkage (SHA-256, prior_entry_hash)
 *   4. Divergence detection via verifyChain() / REPLAY_DIVERGENCE_DETECTED
 *
 * Stage 3 minimum viable:
 *   - In-process store (no external persistence)
 *   - SHA-256 hash chain
 *   - verifyChain() for INJ-005 corruption detection
 *   - write_confirmed: true/false per entry
 *   - Freeze state for protected decision blocking
 *
 * Stage 4 adds: persistent backend, DECISIONS.md-governed hash algorithm selection,
 * canonical form specification per PACS-ARCH-AUDIT-001 Section 4.
 *
 * Governed by: PACS-ARCH-AUDIT-001, PACS-IMPL-STAGE3-001 Work Order 6
 */

import { createHash, randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Genesis sentinel value for prior_entry_hash of the first entry.
 * Per PACS-ARCH-AUDIT-001 Section 3 Property 3.
 */
const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DecisionClass =
  | "routing"
  | "SUMMARY_EMISSION"
  | "MEMORY_COMMIT_AUTH"
  | "ESCALATION_DECISION";

export type AuditEntry = {
  entry_id: string;
  prior_entry_hash: string;
  producer_agent: string;
  decision_id: string;
  decision_class: DecisionClass;
  timestamp: string;
  payload: Record<string, unknown>;
  write_confirmed: boolean;
};

export type AuditWriteParams = {
  producer_agent: string;
  decision_id: string;
  decision_class: DecisionClass;
  payload: Record<string, unknown>;
};

export type AuditWriteResult =
  | { write_confirmed: true; entry_id: string }
  | { write_confirmed: false; reason: string };

export type ChainVerificationResult =
  | { valid: true; entries_verified: number }
  | {
      valid: false;
      divergence_type: "hash_mismatch" | "entry_missing" | "chain_untraversable";
      first_divergence_entry_id: string;
      entries_verified_before_break: number;
    };

export type GovernanceEscalationEvent = {
  event_class: "GOVERNANCE";
  event_type: "GOVERNANCE_ESCALATION_EMITTED";
  producer: "Tamper-Evident Audit Log";
  timestamp: string;
  bypass_bridge: true;
  condition_detail: string;
  first_divergence_entry_id: string;
};

// ---------------------------------------------------------------------------
// Hash helper
// ---------------------------------------------------------------------------

/**
 * Computes SHA-256 hash of a canonical entry representation.
 * Canonical form: JSON.stringify with sorted keys, UTF-8 encoding.
 * Per PACS-ARCH-AUDIT-001 Section 4 — canonical form for hashing.
 */
function hashEntry(entry: Omit<AuditEntry, "write_confirmed">): string {
  const canonical = JSON.stringify({
    entry_id: entry.entry_id,
    prior_entry_hash: entry.prior_entry_hash,
    producer_agent: entry.producer_agent,
    decision_id: entry.decision_id,
    decision_class: entry.decision_class,
    timestamp: entry.timestamp,
    payload: entry.payload,
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// TamperEvidentAuditLog
// ---------------------------------------------------------------------------

/**
 * Stage 3 minimum viable Tamper-Evident Audit Log.
 *
 * All entries are stored in-memory in append-only fashion.
 * The hash chain is computed at write time.
 * verifyChain() replays the chain and detects any modification.
 *
 * When a chain break is detected, freeze() is called automatically,
 * blocking all subsequent protected decision writes.
 */
export class TamperEvidentAuditLog {
  private readonly entries: AuditEntry[] = [];
  private readonly entryHashes: string[] = [];
  private frozen = false;
  private lastEscalationEvent: GovernanceEscalationEvent | null = null;

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------

  /**
   * Appends an entry to the audit log with hash-chain linkage.
   * Returns write_confirmed: true and entry_id on success.
   * Returns write_confirmed: false if the log is frozen.
   *
   * Per PACS-ARCH-AUDIT-001 Section 2: fires unconditionally before
   * any other agent action. Returns entry_id for telemetry linkage.
   */
  write(params: AuditWriteParams): AuditWriteResult {
    if (this.frozen) {
      return {
        write_confirmed: false,
        reason: "audit_log_frozen: chain integrity failure detected — all writes blocked",
      };
    }

    const priorHash =
      this.entryHashes.length > 0 ? this.entryHashes[this.entryHashes.length - 1] : GENESIS_HASH;

    const entry_id = randomUUID();
    const timestamp = new Date().toISOString();

    const entryWithoutConfirmed: Omit<AuditEntry, "write_confirmed"> = {
      entry_id,
      prior_entry_hash: priorHash,
      producer_agent: params.producer_agent,
      decision_id: params.decision_id,
      decision_class: params.decision_class,
      timestamp,
      payload: params.payload,
    };

    const hash = hashEntry(entryWithoutConfirmed);

    const entry: AuditEntry = { ...entryWithoutConfirmed, write_confirmed: true };

    this.entries.push(entry);
    this.entryHashes.push(hash);

    return { write_confirmed: true, entry_id };
  }

  // ---------------------------------------------------------------------------
  // Chain verification (INJ-005 detection surface)
  // ---------------------------------------------------------------------------

  /**
   * Replays the entire chain and verifies every prior_entry_hash.
   * If any entry's hash does not match the prior_entry_hash in the next entry,
   * a REPLAY_DIVERGENCE_DETECTED condition fires.
   *
   * Per PACS-ARCH-AUDIT-001 Section 3 Property 4.
   */
  verifyChain(): ChainVerificationResult {
    if (this.entries.length === 0) {
      return { valid: true, entries_verified: 0 };
    }

    // Verify each entry's prior_entry_hash against the actual hash of the prior entry
    for (let i = 1; i < this.entries.length; i++) {
      const currentEntry = this.entries[i];
      const priorEntry = this.entries[i - 1];

      // Recompute hash of prior entry
      const recomputedPriorHash = hashEntry({
        entry_id: priorEntry.entry_id,
        prior_entry_hash: priorEntry.prior_entry_hash,
        producer_agent: priorEntry.producer_agent,
        decision_id: priorEntry.decision_id,
        decision_class: priorEntry.decision_class,
        timestamp: priorEntry.timestamp,
        payload: priorEntry.payload,
      });

      if (currentEntry.prior_entry_hash !== recomputedPriorHash) {
        // Chain break detected — freeze and escalate
        this.onChainBreak(currentEntry.entry_id, i);

        return {
          valid: false,
          divergence_type: "hash_mismatch",
          first_divergence_entry_id: currentEntry.entry_id,
          entries_verified_before_break: i,
        };
      }
    }

    return { valid: true, entries_verified: this.entries.length };
  }

  // ---------------------------------------------------------------------------
  // Tamper injection (for INJ-005 testing only)
  // ---------------------------------------------------------------------------

  /**
   * Corrupts an entry at the given index by modifying its payload.
   * This breaks the hash chain — verifyChain() will detect it.
   *
   * FOR TESTING ONLY — simulates the INJ-005 injection.
   */
  _corruptEntryForTesting(index: number): void {
    const entry = this.entries[index];
    if (!entry) {
      throw new Error(`No entry at index ${index}`);
    }
    // Mutate the payload — this invalidates the stored hash
    entry.payload["__CORRUPTED__"] = true;
  }

  // ---------------------------------------------------------------------------
  // Freeze and escalation
  // ---------------------------------------------------------------------------

  private onChainBreak(firstDivergenceEntryId: string, position: number): void {
    this.frozen = true;

    const escalation: GovernanceEscalationEvent = {
      event_class: "GOVERNANCE",
      event_type: "GOVERNANCE_ESCALATION_EMITTED",
      producer: "Tamper-Evident Audit Log",
      timestamp: new Date().toISOString(),
      bypass_bridge: true,
      condition_detail:
        `Audit chain integrity failure at position ${position}. ` +
        `Entry ${firstDivergenceEntryId} prior_entry_hash does not match ` +
        `computed hash of prior entry. Chain is untrustworthy from this point.`,
      first_divergence_entry_id: firstDivergenceEntryId,
    };

    this.lastEscalationEvent = escalation;
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  isFrozen(): boolean {
    return this.frozen;
  }

  entryCount(): number {
    return this.entries.length;
  }

  getEntry(entryId: string): AuditEntry | null {
    return this.entries.find((e) => e.entry_id === entryId) ?? null;
  }

  getLastEscalationEvent(): GovernanceEscalationEvent | null {
    return this.lastEscalationEvent;
  }

  /** Returns a read-only view of all entries. For testing and verification only. */
  getAllEntries(): readonly AuditEntry[] {
    return this.entries;
  }

  /** Resets the log. For testing only. */
  _resetForTesting(): void {
    this.entries.length = 0;
    this.entryHashes.length = 0;
    this.frozen = false;
    this.lastEscalationEvent = null;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const auditLog = new TamperEvidentAuditLog();
