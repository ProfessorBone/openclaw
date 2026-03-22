# Vault Paper-Mode Governance Package

**Package ID:** PACS-VAULT-GOV-001
**Status:** Locked
**Effective mode:** paper only
**Capital authorized:** None
**Created:** 2026-03-21
**Authority chain:** System-Charter.md → SOUL.md (Vault) → This package

---

## Purpose

This package contains the four governing artifacts for Vault paper-mode thesis operations. Together they define what a thesis must contain, how it moves through its lifecycle, how compliance is enforced, and what a compliant cycle looks like in practice.

No artifact in this package authorizes real capital. Real capital authorization requires a separate governance artifact approved under the eligibility rules defined in the Vault Thesis Operating Procedure.

---

## Artifact Index

| Order | Artifact                             | Filename                                  | Purpose                                                                       |
| ----- | ------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------- |
| 1     | Vault Paper Thesis Template v1       | `vault-paper-thesis-template-v1.md`       | Defines required thesis record structure and field constraints                |
| 2     | Vault Thesis Operating Procedure v1  | `vault-thesis-operating-procedure-v1.md`  | Defines the thesis lifecycle state machine and transition rules               |
| 3     | Vault Governance Checklist v1        | `vault-governance-checklist-v1.md`        | Defines gate failure conditions, taint conditions, and Bridge review triggers |
| 4     | Vault Paper Thesis Worked Example v1 | `vault-paper-thesis-worked-example-v1.md` | Demonstrates a complete thesis lifecycle as a calibration specimen            |

**Reading order:** Sequential. Each artifact assumes familiarity with the one before it.

---

## Cross-Reference Map

| Upstream Artifact         | Relationship                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| `System-Charter.md`       | Establishes Vault as a governed capital domain within PACS                                        |
| `SOUL.md` (Vault section) | Defines Vault's operating principles, segregation rules, and integrity requirements               |
| `DECISIONS.md` — ADR-039  | Activates Vault paper portfolio infrastructure (thesis store, calibration tracker, config reader) |
| `PACS-VAULT-CAL-001`      | Calibration policy governing clean/tainted cycle determination and eligibility thresholds         |

| Downstream Dependency    | Relationship                                                                    |
| ------------------------ | ------------------------------------------------------------------------------- |
| `calibration-tracker.ts` | Implements the 9-flag integrity model defined in the Governance Checklist       |
| `thesis-store.ts`        | Implements the append-only JSONL store referenced by the Template and Procedure |
| `vault-config-reader.ts` | Implements the fail-closed Bridge config reader referenced by the Checklist     |

---

## Amendment Rules

- No artifact in this package may be amended without a new version number
- Amendments must be recorded in DECISIONS.md as a new ADR
- The worked example must be re-validated against any amended checklist or procedure
- Template field additions require corresponding updates to the Procedure and Checklist

---

## Package Integrity

All four artifacts were developed through a four-pass process:

- **Pass 1:** Template field design and sub-object shape locking
- **Pass 2:** Lifecycle procedure definition as a strict state machine
- **Pass 3:** Governance checklist with gate failures, taint conditions, and Bridge review triggers
- **Pass 4:** Worked example thesis with full gate walk-through and 9-flag integrity sweep

The worked example passed all gates and produced a clean (eligibility-capable, pending Bridge review) cycle.
