/**
 * continuum/governance/fdr-003-silent-absorption.ts
 *
 * PACS-VALIDATION-001 INJ-014 detection surface.
 * FDR-003 — Silent Absorption Not Detected.
 *
 * Two detection paths:
 *
 *   Path A — Meaning shift detected but SILENT_ABSORPTION_DETECTED not emitted:
 *     Detects ARTIFACT_SYNTHESIS_COMPLETED events where meaning_shift_detected
 *     is true but no SILENT_ABSORPTION_DETECTED event was emitted for the
 *     matching synthesis_id. Semantic divergence from source content must be
 *     surfaced; silent continuation is an integrity failure.
 *
 *   Path B — Semantic drift score exceeds threshold without a flag:
 *     Detects ARTIFACT_SYNTHESIS_COMPLETED events where semantic_drift_score
 *     exceeds SEMANTIC_DRIFT_THRESHOLD (0.15) but no SILENT_ABSORPTION_DETECTED
 *     event was emitted for the matching synthesis_id. Drift above threshold
 *     constitutes a meaning shift regardless of the meaning_shift_detected flag.
 *
 * On detection (both paths):
 *   - INTEGRITY_VIOLATION_DETECTED with bridge_notified: true
 *   - silent_absorption_rate increments above zero
 *
 * Level 3 — Analytical Performance Degradation.
 *
 * Governed by: PACS-VALIDATION-001 INJ-014
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SEMANTIC_DRIFT_THRESHOLD = 0.15;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ArtifactSynthesisCompletedEvent = {
  event_id: string;
  synthesis_id: string;
  agent_id: string;
  meaning_shift_detected: boolean;
  semantic_drift_score: number;
  timestamp: string;
};

export type SilentAbsorptionDetectedEvent = {
  event_id: string;
  synthesis_id: string;
  timestamp: string;
};

export type Fdr003AlertEvent = {
  event_class: "INTEGRITY";
  event_type: "INTEGRITY_VIOLATION_DETECTED";
  alert_id: string;
  rule_id: "FDR-003";
  producer: "Foundry";
  timestamp: string;
  synthesis_id: string;
  agent_id: string;
  violation_detail: string;
  bridge_notified: true;
  detection_path: "meaning_shift_not_flagged" | "drift_score_exceeded";
};

export type Fdr003CheckResult =
  | { compliant: true }
  | {
      compliant: false;
      alert: Fdr003AlertEvent;
      silent_absorption_rate: number;
    };

// ---------------------------------------------------------------------------
// Fdr003SilentAbsorptionDetector
// ---------------------------------------------------------------------------

export class Fdr003SilentAbsorptionDetector {
  private readonly detectedSynthesisIds = new Set<string>();
  private totalSynthesisCount = 0;
  private undetectedShiftCount = 0;
  private readonly alerts: Fdr003AlertEvent[] = [];

  /**
   * Records a SILENT_ABSORPTION_DETECTED event.
   * Registers the synthesis_id so a subsequent ARTIFACT_SYNTHESIS_COMPLETED
   * with meaning_shift_detected or elevated drift_score will pass the check.
   */
  registerSilentAbsorptionDetected(event: SilentAbsorptionDetectedEvent): void {
    this.detectedSynthesisIds.add(event.synthesis_id);
  }

  /**
   * Checks an ARTIFACT_SYNTHESIS_COMPLETED event against both detection paths.
   *
   * Path A: meaning_shift_detected is true AND no SILENT_ABSORPTION_DETECTED
   *         was registered for this synthesis_id → integrity violation.
   * Path B: semantic_drift_score exceeds SEMANTIC_DRIFT_THRESHOLD AND no
   *         SILENT_ABSORPTION_DETECTED was registered → integrity violation.
   *
   * Returns compliant: true when no shift is present, or when a shift is
   * present and SILENT_ABSORPTION_DETECTED was already registered.
   */
  checkArtifactSynthesisCompleted(event: ArtifactSynthesisCompletedEvent): Fdr003CheckResult {
    this.totalSynthesisCount++;

    const hasMeaningShift = event.meaning_shift_detected;
    const driftExceedsThreshold = event.semantic_drift_score > SEMANTIC_DRIFT_THRESHOLD;
    const requiresFlag = hasMeaningShift || driftExceedsThreshold;

    if (!requiresFlag) {
      return { compliant: true };
    }

    if (this.detectedSynthesisIds.has(event.synthesis_id)) {
      return { compliant: true };
    }

    // Violation: shift present but SILENT_ABSORPTION_DETECTED was not emitted
    this.undetectedShiftCount++;
    const rate = this.getSilentAbsorptionRate();

    // Path A takes precedence when both conditions are true
    const detectionPath: "meaning_shift_not_flagged" | "drift_score_exceeded" = hasMeaningShift
      ? "meaning_shift_not_flagged"
      : "drift_score_exceeded";

    const violationDetail =
      detectionPath === "meaning_shift_not_flagged"
        ? `ARTIFACT_SYNTHESIS_COMPLETED (synthesis_id="${event.synthesis_id}") ` +
          `by agent "${event.agent_id}" has meaning_shift_detected=true but no paired ` +
          `SILENT_ABSORPTION_DETECTED event was emitted for this synthesis_id. ` +
          `Semantic divergence from source content must be surfaced. ` +
          `Level 3 — Analytical Performance Degradation.`
        : `ARTIFACT_SYNTHESIS_COMPLETED (synthesis_id="${event.synthesis_id}") ` +
          `by agent "${event.agent_id}" has semantic_drift_score=${event.semantic_drift_score} ` +
          `which exceeds the threshold of ${SEMANTIC_DRIFT_THRESHOLD}, but no paired ` +
          `SILENT_ABSORPTION_DETECTED event was emitted for this synthesis_id. ` +
          `Drift above threshold constitutes a meaning shift requiring surfacing. ` +
          `Level 3 — Analytical Performance Degradation.`;

    const alert: Fdr003AlertEvent = {
      event_class: "INTEGRITY",
      event_type: "INTEGRITY_VIOLATION_DETECTED",
      alert_id: randomUUID(),
      rule_id: "FDR-003",
      producer: "Foundry",
      timestamp: event.timestamp,
      synthesis_id: event.synthesis_id,
      agent_id: event.agent_id,
      violation_detail: violationDetail,
      bridge_notified: true,
      detection_path: detectionPath,
    };

    this.alerts.push(alert);
    return { compliant: false, alert, silent_absorption_rate: rate };
  }

  /**
   * silent_absorption_rate: undetected shifts / total synthesis events.
   * Zero when no shifts have occurred or all shifts were properly flagged.
   */
  getSilentAbsorptionRate(): number {
    return this.totalSynthesisCount > 0 ? this.undetectedShiftCount / this.totalSynthesisCount : 0;
  }

  getUndetectedShiftCount(): number {
    return this.undetectedShiftCount;
  }

  getAlerts(): readonly Fdr003AlertEvent[] {
    return this.alerts;
  }

  alertCount(): number {
    return this.alerts.length;
  }

  /** Resets detector state. For testing only. */
  _resetForTesting(): void {
    this.detectedSynthesisIds.clear();
    this.totalSynthesisCount = 0;
    this.undetectedShiftCount = 0;
    this.alerts.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const fdr003SilentAbsorptionDetector = new Fdr003SilentAbsorptionDetector();
