/**
 * continuum/test/inj-013-014.test.ts
 *
 * PACS-VALIDATION-001 — Level 3 Injection Tests.
 * Analytical Performance Degradation.
 *
 *   INJ-013  LOC-002  — Contradiction Not Flagged
 *     Target: Locus knowledge extraction pipeline
 *     Failure: contradiction detected but CONTRADICTION_FLAGGED not emitted
 *
 *   INJ-014  FDR-003  — Silent Absorption Not Detected
 *     Target: Foundry artifact synthesis pipeline
 *     Failure: meaning shift detected but SILENT_ABSORPTION_DETECTED not emitted
 *
 * Pattern per test:
 *   1. Snapshot pre-injection state
 *   2. Inject the failure condition
 *   3. Assert each criterion
 *   4. Restore and confirm clean state
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  fdr003SilentAbsorptionDetector,
  SEMANTIC_DRIFT_THRESHOLD,
  type ArtifactSynthesisCompletedEvent,
  type SilentAbsorptionDetectedEvent,
} from "../governance/fdr-003-silent-absorption.js";
import {
  loc002ContradictionDetector,
  type KnowledgeExtractionCompletedEvent,
  type ContradictionFlaggedEvent,
} from "../governance/loc-002-contradiction-detection.js";

// ---------------------------------------------------------------------------
// Global reset — both detectors reset before and after each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  loc002ContradictionDetector._resetForTesting();
  fdr003SilentAbsorptionDetector._resetForTesting();
});

afterEach(() => {
  loc002ContradictionDetector._resetForTesting();
  fdr003SilentAbsorptionDetector._resetForTesting();
});

// ---------------------------------------------------------------------------
// INJ-013 — LOC-002 — Contradiction Not Flagged
// ---------------------------------------------------------------------------

describe("INJ-013 — LOC-002 — Contradiction Not Flagged", () => {
  it("LOC-002 fires when KNOWLEDGE_EXTRACTION_COMPLETED has contradiction_detected=true with no CONTRADICTION_FLAGGED emitted", () => {
    // --- Snapshot ---
    console.log("[INJ-013] Snapshot: coverage_rate=1.0, alertCount=0");
    expect(loc002ContradictionDetector.getContradictionCheckCoverageRate()).toBe(1.0);
    expect(loc002ContradictionDetector.alertCount()).toBe(0);

    // --- Inject ---
    // contradiction_check_performed=true (check ran), contradiction_detected=true,
    // but CONTRADICTION_FLAGGED is NOT registered for this extraction_id.
    const extraction: KnowledgeExtractionCompletedEvent = {
      event_id: "inj013-extraction-001",
      extraction_id: "extraction-unflagged-001",
      agent_id: "locus",
      contradiction_check_performed: true,
      contradiction_detected: true,
      timestamp: "2026-03-29T12:00:00.000Z",
    };
    console.log(
      "[INJ-013] Injecting KNOWLEDGE_EXTRACTION_COMPLETED with contradiction_detected=true — " +
        "suppressing CONTRADICTION_FLAGGED",
    );
    const result = loc002ContradictionDetector.checkKnowledgeExtractionCompleted(extraction);
    console.log(
      "[INJ-013] checkKnowledgeExtractionCompleted returned:",
      JSON.stringify(result, null, 2),
    );

    // --- Criterion 1: LOC-002 fires — INTEGRITY_VIOLATION_DETECTED, rule_id LOC-002 ---
    console.log("[INJ-013] Criterion 1: LOC-002 fires");
    expect(result.compliant).toBe(false);
    if (!result.compliant) {
      expect(result.alert.event_type).toBe("INTEGRITY_VIOLATION_DETECTED");
      expect(result.alert.rule_id).toBe("LOC-002");
      expect(result.alert.extraction_id).toBe("extraction-unflagged-001");
      expect(result.alert.detection_path).toBe("flag_not_emitted");
    }

    // --- Criterion 2: contradiction_check_coverage_rate drops below 1.0 ---
    console.log("[INJ-013] Criterion 2: contradiction_check_coverage_rate < 1.0");
    if (!result.compliant) {
      expect(result.contradiction_check_coverage_rate).toBeLessThan(1.0);
    }
    expect(loc002ContradictionDetector.getContradictionCheckCoverageRate()).toBeLessThan(1.0);

    // --- Criterion 3: bridge_notified: true ---
    console.log("[INJ-013] Criterion 3: bridge_notified");
    if (!result.compliant) {
      expect(result.alert.bridge_notified).toBe(true);
    }

    expect(loc002ContradictionDetector.alertCount()).toBe(1);

    // --- Restore ---
    loc002ContradictionDetector._resetForTesting();
    console.log(
      "[INJ-013] Restore: coverage_rate=",
      loc002ContradictionDetector.getContradictionCheckCoverageRate(),
    );
    expect(loc002ContradictionDetector.getContradictionCheckCoverageRate()).toBe(1.0);
    expect(loc002ContradictionDetector.alertCount()).toBe(0);
    console.log("[INJ-013] PASS — clean state confirmed");
  });

  it("control: LOC-002 does not fire when CONTRADICTION_FLAGGED is properly emitted", () => {
    // Register CONTRADICTION_FLAGGED before checking extraction
    const flag: ContradictionFlaggedEvent = {
      event_id: "inj013-ctrl-flag-001",
      extraction_id: "extraction-flagged-ctrl-001",
      timestamp: "2026-03-29T12:00:00.000Z",
    };
    loc002ContradictionDetector.registerContradictionFlagged(flag);

    const extraction: KnowledgeExtractionCompletedEvent = {
      event_id: "inj013-ctrl-extraction-001",
      extraction_id: "extraction-flagged-ctrl-001",
      agent_id: "locus",
      contradiction_check_performed: true,
      contradiction_detected: true,
      timestamp: "2026-03-29T12:01:00.000Z",
    };
    const result = loc002ContradictionDetector.checkKnowledgeExtractionCompleted(extraction);

    expect(result.compliant).toBe(true);
    expect(loc002ContradictionDetector.alertCount()).toBe(0);
    expect(loc002ContradictionDetector.getContradictionCheckCoverageRate()).toBe(1.0);
  });

  it("Path A: LOC-002 fires when contradiction_check_performed is false", () => {
    const extraction: KnowledgeExtractionCompletedEvent = {
      event_id: "inj013-patha-extraction-001",
      extraction_id: "extraction-skipped-001",
      agent_id: "locus",
      contradiction_check_performed: false,
      contradiction_detected: false,
      timestamp: "2026-03-29T12:00:00.000Z",
    };
    const result = loc002ContradictionDetector.checkKnowledgeExtractionCompleted(extraction);

    expect(result.compliant).toBe(false);
    if (!result.compliant) {
      expect(result.alert.rule_id).toBe("LOC-002");
      expect(result.alert.detection_path).toBe("check_skipped");
      expect(result.alert.bridge_notified).toBe(true);
      expect(result.contradiction_check_coverage_rate).toBeLessThan(1.0);
    }
    expect(loc002ContradictionDetector.alertCount()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// INJ-014 — FDR-003 — Silent Absorption Not Detected
// ---------------------------------------------------------------------------

describe("INJ-014 — FDR-003 — Silent Absorption Not Detected", () => {
  it("FDR-003 fires when ARTIFACT_SYNTHESIS_COMPLETED has meaning_shift_detected=true with no SILENT_ABSORPTION_DETECTED emitted", () => {
    // --- Snapshot ---
    console.log(
      "[INJ-014] Snapshot: silent_absorption_rate=0, alertCount=0, threshold=",
      SEMANTIC_DRIFT_THRESHOLD,
    );
    expect(fdr003SilentAbsorptionDetector.getSilentAbsorptionRate()).toBe(0);
    expect(fdr003SilentAbsorptionDetector.alertCount()).toBe(0);

    // --- Inject ---
    // meaning_shift_detected=true AND semantic_drift_score above threshold,
    // but SILENT_ABSORPTION_DETECTED is NOT registered for this synthesis_id.
    const synthesis: ArtifactSynthesisCompletedEvent = {
      event_id: "inj014-synthesis-001",
      synthesis_id: "synthesis-absorbed-001",
      agent_id: "foundry",
      meaning_shift_detected: true,
      semantic_drift_score: 0.22,
      timestamp: "2026-03-29T12:00:00.000Z",
    };
    console.log(
      "[INJ-014] Injecting ARTIFACT_SYNTHESIS_COMPLETED with meaning_shift_detected=true, " +
        "semantic_drift_score=0.22 — suppressing SILENT_ABSORPTION_DETECTED",
    );
    const result = fdr003SilentAbsorptionDetector.checkArtifactSynthesisCompleted(synthesis);
    console.log(
      "[INJ-014] checkArtifactSynthesisCompleted returned:",
      JSON.stringify(result, null, 2),
    );

    // --- Criterion 1: FDR-003 fires — INTEGRITY_VIOLATION_DETECTED, rule_id FDR-003 ---
    console.log("[INJ-014] Criterion 1: FDR-003 fires");
    expect(result.compliant).toBe(false);
    if (!result.compliant) {
      expect(result.alert.event_type).toBe("INTEGRITY_VIOLATION_DETECTED");
      expect(result.alert.rule_id).toBe("FDR-003");
      expect(result.alert.synthesis_id).toBe("synthesis-absorbed-001");
      expect(result.alert.detection_path).toBe("meaning_shift_not_flagged");
    }

    // --- Criterion 2: silent_absorption_rate increments above zero ---
    console.log("[INJ-014] Criterion 2: silent_absorption_rate > 0");
    if (!result.compliant) {
      expect(result.silent_absorption_rate).toBeGreaterThan(0);
    }
    expect(fdr003SilentAbsorptionDetector.getSilentAbsorptionRate()).toBeGreaterThan(0);
    expect(fdr003SilentAbsorptionDetector.getUndetectedShiftCount()).toBe(1);

    // --- Criterion 3: bridge_notified: true ---
    console.log("[INJ-014] Criterion 3: bridge_notified");
    if (!result.compliant) {
      expect(result.alert.bridge_notified).toBe(true);
    }

    expect(fdr003SilentAbsorptionDetector.alertCount()).toBe(1);

    // --- Restore ---
    fdr003SilentAbsorptionDetector._resetForTesting();
    console.log(
      "[INJ-014] Restore: silent_absorption_rate=",
      fdr003SilentAbsorptionDetector.getSilentAbsorptionRate(),
    );
    expect(fdr003SilentAbsorptionDetector.getSilentAbsorptionRate()).toBe(0);
    expect(fdr003SilentAbsorptionDetector.alertCount()).toBe(0);
    console.log("[INJ-014] PASS — clean state confirmed");
  });

  it("control: FDR-003 does not fire when SILENT_ABSORPTION_DETECTED is properly emitted", () => {
    // Register SILENT_ABSORPTION_DETECTED before checking synthesis
    const detection: SilentAbsorptionDetectedEvent = {
      event_id: "inj014-ctrl-detection-001",
      synthesis_id: "synthesis-ctrl-001",
      timestamp: "2026-03-29T12:00:00.000Z",
    };
    fdr003SilentAbsorptionDetector.registerSilentAbsorptionDetected(detection);

    const synthesis: ArtifactSynthesisCompletedEvent = {
      event_id: "inj014-ctrl-synthesis-001",
      synthesis_id: "synthesis-ctrl-001",
      agent_id: "foundry",
      meaning_shift_detected: true,
      semantic_drift_score: 0.25,
      timestamp: "2026-03-29T12:01:00.000Z",
    };
    const result = fdr003SilentAbsorptionDetector.checkArtifactSynthesisCompleted(synthesis);

    expect(result.compliant).toBe(true);
    expect(fdr003SilentAbsorptionDetector.alertCount()).toBe(0);
    expect(fdr003SilentAbsorptionDetector.getSilentAbsorptionRate()).toBe(0);
  });

  it("Path B: FDR-003 fires when drift_score exceeds threshold even if meaning_shift_detected is false", () => {
    const synthesis: ArtifactSynthesisCompletedEvent = {
      event_id: "inj014-pathb-synthesis-001",
      synthesis_id: "synthesis-drift-001",
      agent_id: "foundry",
      meaning_shift_detected: false,
      semantic_drift_score: 0.18,
      timestamp: "2026-03-29T12:00:00.000Z",
    };
    const result = fdr003SilentAbsorptionDetector.checkArtifactSynthesisCompleted(synthesis);

    expect(result.compliant).toBe(false);
    if (!result.compliant) {
      expect(result.alert.rule_id).toBe("FDR-003");
      expect(result.alert.detection_path).toBe("drift_score_exceeded");
      expect(result.alert.bridge_notified).toBe(true);
      expect(result.silent_absorption_rate).toBeGreaterThan(0);
    }
    expect(fdr003SilentAbsorptionDetector.alertCount()).toBe(1);
  });

  it("FDR-003 does not fire when drift_score is at or below threshold and meaning_shift is false", () => {
    const synthesis: ArtifactSynthesisCompletedEvent = {
      event_id: "inj014-clean-synthesis-001",
      synthesis_id: "synthesis-clean-001",
      agent_id: "foundry",
      meaning_shift_detected: false,
      semantic_drift_score: 0.15, // at threshold, not above
      timestamp: "2026-03-29T12:00:00.000Z",
    };
    const result = fdr003SilentAbsorptionDetector.checkArtifactSynthesisCompleted(synthesis);

    expect(result.compliant).toBe(true);
    expect(fdr003SilentAbsorptionDetector.alertCount()).toBe(0);
    expect(fdr003SilentAbsorptionDetector.getSilentAbsorptionRate()).toBe(0);
  });
});
