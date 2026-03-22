# Vault Governance Checklist v1

**Artifact ID:** PACS-VAULT-GOV-001-CHECKLIST
**Version:** 1.0
**Status:** Locked
**Package:** PACS-VAULT-GOV-001
**Scope:** capital_domain: trading | mode: paper
**Capital authorized:** None
**Created:** 2026-03-21

---

## Cross-References

| Artifact                                  | Relationship                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `vault-paper-thesis-template-v1.md`       | Defines the record structure this checklist validates                   |
| `vault-thesis-operating-procedure-v1.md`  | Defines the state transitions this checklist enforces                   |
| `vault-paper-thesis-worked-example-v1.md` | Demonstrates this checklist applied to a calibration specimen           |
| `calibration-tracker.ts`                  | Implements the 9-flag integrity model defined in Section 2              |
| `thesis-store.ts`                         | Implements the append-only store validated by Section 1 gates           |
| `vault-config-reader.ts`                  | Implements the fail-closed config reader referenced in taint conditions |
| `PACS-VAULT-CAL-001`                      | Calibration policy governing eligibility thresholds                     |

---

## Purpose

This checklist is the canonical reference for gate enforcement, integrity evaluation, and Bridge review triggers during Vault paper-mode operation. It is designed to be walkable line-by-line by both human reviewers and automated validation systems.

---

## Section 1. Gate Failure Conditions

Each transition gate is expressed as a blocking checklist. If any item fails, the transition is blocked and the failure must be recorded explicitly in the append-only record stream.

### Gate 1: draft → validated

This transition is **blocked** if any of the following are true:

- [ ] Any required identity field is missing, null, or empty (thesis_id, capital_domain, mode, analyst_engine, bridge_policy_version)
- [ ] Any required thesis-core field is missing, null, or empty (thesis_statement, invalidation_condition, uncertainty_statement)
- [ ] directional_view is empty, null, or defaulted rather than explicitly declared
- [ ] confidence_level is null, non-numeric, less than 0.1, or greater than 1.0
- [ ] asset_symbol is missing or empty
- [ ] asset_type is missing or empty
- [ ] time_horizon is missing or empty
- [ ] source_list is empty (no sources provided)
- [ ] Any source_list entry is missing a required field (source_id, source_type, source_name, accessed_at, url_or_reference)
- [ ] Duplicate source_id values exist in source_list
- [ ] supporting_evidence is empty (no supporting evidence provided)
- [ ] Any evidence item (supporting or counter) is missing a required field (statement, source_ref, evidence_type, added_at)
- [ ] Any evidence item references a source_ref that does not match an existing source_list.source_id
- [ ] Any evidence_type value is not one of: quantitative, qualitative, structural
- [ ] capital_domain is not "trading"
- [ ] mode is not "paper"

**On failure:** status remains draft; p1_gate_status set to fail; p1_missing_fields populated with specific failures; failure recorded in append-only stream.

**On success:** p1_gate_status set to pass; p1_missing_fields set to []; status transitions to validated.

---

### Gate 2: validated → approved

This transition is **blocked** if any of the following are true:

- [ ] asset_symbol is not a member of any configured allowed-universe category in Bridge config (categories include but are not limited to: core_equities, broad_market_etfs, market_context_instruments)
- [ ] asset class is excluded by Bridge config
- [ ] Segregation check fails (thesis crosses capital-domain boundaries)
- [ ] Simulated position size exceeds max_notional_per_position from Bridge config
- [ ] Any configured opening limit is violated

**On failure:** status remains validated; approval_status set to blocked (not left as pending); specific failing checks recorded; sizing_violations populated if sizing-related.

**On success:** asset_allowed_status, asset_class_exclusion_status, segregation_check_status, sizing_compliance_status all set to pass; sizing_violations set to []; approval_status set to approved; status transitions to approved.

---

### Gate 3: approved → active

This transition is **blocked** if any of the following are true:

- [ ] paper_entry_date is null or missing
- [ ] paper_entry_price is null or missing
- [ ] simulated_position_size is zero, null, or missing
- [ ] max_allowed_notional is zero, null, or missing
- [ ] target_condition is empty or missing
- [ ] stop_or_exit_condition is empty or missing
- [ ] planned_review_interval is empty or missing

**Additional prohibition:** A thesis may not reach active from any state other than approved. draft → active and validated → active are prohibited.

**On failure:** status remains approved; missing activation fields recorded in append-only stream.

**On success:** status transitions to active.

---

### Gate 4: active → closed

This transition is **blocked** if any of the following are true:

- [ ] closure_state is not one of: closed-confirmed, closed-contradicted, closed-inconclusive
- [ ] closure_date is null or missing
- [ ] closure_reason is null, empty, or missing

**On failure:** status remains active; closure deficiency recorded in append-only stream.

**On success:** status transitions to closed.

---

### Gate 5: closed → calibration-recorded

This is an operating event, not a thesis state transition.

This event is **blocked** if any of the following are true:

- [ ] outcome_summary is null, empty, or placeholder
- [ ] thesis_quality_assessment is null, empty, or placeholder
- [ ] evidence_quality_assessment is null, empty, or placeholder
- [ ] contradiction_handling_assessment is null, empty, or placeholder
- [ ] discipline_assessment is null, empty, or placeholder
- [ ] calibration_result is null or missing
- [ ] evaluator_notes is null, empty, or placeholder

**Evaluation quality rule:** Evaluation fields must contain substantive assessment, not placeholder or perfunctory values. The evaluator is responsible for good-faith completion sufficient to support calibration review. This is the one gate condition that requires human judgment and cannot be fully mechanized.

**On failure:** Calibration record is not created; evaluation deficiency recorded.

**On success:** Calibration record created; cycle marked clean or tainted per Section 2.

---

## Section 2. Taint Conditions

Each calibration integrity flag is defined below using canonical field names from the calibration tracker implementation. A cycle is **clean** only if all nine flags pass. A cycle is **tainted** if any flag fails. Taint reasons must be explicitly recorded.

**Eligibility thresholds:**

- Retirement paper eligibility requires at least 1 clean cycle
- Real capital eligibility requires at least 4 clean cycles

---

### p1_compliance

**Tainted if any of the following occurred during the thesis lifecycle:**

- Any required IQG field was missing at thesis creation
- A thesis entered active tracking without p1_gate_status: pass
- directional_view was undeclared at validation time
- confidence_level was null or outside the allowed range (0.1 to 1.0) at validation time
- Any evidence item lacked a valid source_ref at validation time
- Duplicate source_id values existed in source_list at validation time

---

### p2_evaluation_completed

**Tainted if any of the following occurred:**

- Any required post-closure evaluation field is null, empty, or placeholder
- Calibration was recorded before evaluation completion
- Evaluator notes are perfunctory rather than substantive

**Implementation note:** This is the one integrity flag that cannot be fully mechanically verified. The "substantive versus perfunctory" determination requires human review. Any automated integrity check must flag this flag as requiring manual confirmation rather than auto-passing it.

**Placeholder examples (non-exhaustive):** Values such as "TBD", "N/A", "fine", "ok", "done", "see above", or single-word assessments should be treated as perfunctory and should not pass evaluation review.

---

### p3_segregation_intact

**Tainted if any of the following occurred during the thesis lifecycle:**

- Thesis record is not tagged capital_domain: trading
- Retirement-domain logic, sizing, or records were mixed into the thesis lifecycle
- A thesis crossed capital-domain boundaries without Bridge authorization

---

### p4_violations_zero

**Tainted if any of the following occurred during the thesis lifecycle:**

- Any policy or operating-rule violation occurred
- Any prohibited action listed in the operating procedure occurred
- Any gate was bypassed and later corrected rather than blocked in real time

**Interpretation note:** Retroactive correction does not remove taint. A gate that should have blocked a transition but did not has already compromised the integrity of the cycle, regardless of whether the error was later identified and addressed.

---

### a6_alerts_clear

**Tainted if any of the following occurred during the thesis lifecycle:**

- An A6 alert was active during the cycle and unresolved at closure
- An A6 alert was suppressed, ignored, or undocumented
- Alert state was not reviewable at evaluation time

---

### record_complete_and_auditable

**Tainted if any of the following are true at evaluation time:**

- Append-only history is broken (records overwritten rather than appended)
- record_version sequence is incomplete or inconsistent for the thesis_id
- updated_at is missing on any post-creation version record
- Required lifecycle events are missing from the record stream (creation, validation, approval, activation, reviews, closure)
- Provenance chain cannot be reconstructed from source to evidence to thesis

---

### no_unauthorized_asset_breach

**Tainted if any of the following occurred during the thesis lifecycle:**

- The thesis used a symbol not allowed by Bridge config at approval time
- The asset class was excluded by Bridge config at approval time
- The thesis was approved under one asset identity and tracked under another without an explicit record update and re-approval

---

### no_undocumented_thesis_modification

**Tainted if any of the following occurred during the thesis lifecycle:**

- Any material change occurred without a new append-only record version
- Closure rationale changed without a new record version
- Evidence, invalidation condition, or directional view changed without a new record version
- Any field that affects thesis meaning was altered silently

---

### no_output_bypassed_bridge

**Tainted if any of the following occurred during the thesis lifecycle:**

- Any thesis moved from validated to active without passing through approved
- Any thesis moved from draft to active directly
- Any output relied on inferred, defaulted, or fallback configuration rather than Bridge-owned config read from the canonical config path
- The config reader did not read from the canonical Bridge-owned path (defaults, environment variables, or hardcoded fallbacks constitute a bypass)
- Any approval-time control was bypassed by manual intervention outside the record stream

---

## Section 3. Bridge Review Triggers

These conditions do not block transitions or taint cycles by themselves, but they require explicit Bridge-level review before the system proceeds or before a cycle is counted. Bridge review must be recorded in the audit trail.

### Milestone Triggers

- [ ] First-ever thesis activation in Vault
- [ ] First-ever clean calibration cycle
- [ ] Any request to activate retirement paper mode
- [ ] Any request to initiate real capital eligibility review

### Anomaly Triggers

- [ ] Any policy divergence during active monitoring (bridge_policy_version changed after approval)
- [ ] Any thesis blocked at approval after having passed validation
- [ ] Any sizing decision within 10% of max_notional_per_position
- [ ] Any tainted cycle (regardless of taint reason)
- [ ] Any repeated taint pattern across two or more consecutive cycles
- [ ] Any unresolved ambiguity in closure state classification

### Governance Integrity Triggers

- [ ] Any integrity flag that required human judgment to assess (currently: p2_evaluation_completed)
- [ ] Any dispute about whether a modification was "material" for purposes of the append-only rule
- [ ] Any situation where the operating procedure does not clearly prescribe the correct action

---

## Appendix A: Flag-to-Code Alignment Reference

| Procedure Flag Name                 | Implementation Field                | Mechanical Check Possible              |
| ----------------------------------- | ----------------------------------- | -------------------------------------- |
| p1_compliance                       | p1_compliance                       | Yes                                    |
| p2_evaluation_completed             | p2_evaluation_completed             | Partial (completeness yes, quality no) |
| p3_segregation_intact               | p3_segregation_intact               | Yes                                    |
| p4_violations_zero                  | p4_violations_zero                  | Yes                                    |
| a6_alerts_clear                     | a6_alerts_clear                     | Yes                                    |
| record_complete_and_auditable       | record_complete_and_auditable       | Yes                                    |
| no_unauthorized_asset_breach        | no_unauthorized_asset_breach        | Yes                                    |
| no_undocumented_thesis_modification | no_undocumented_thesis_modification | Yes                                    |
| no_output_bypassed_bridge           | no_output_bypassed_bridge           | Yes                                    |

**Mechanical check coverage:** 8 of 9 flags are fully mechanically verifiable. 1 flag (p2_evaluation_completed) requires human review for quality assessment.

---

## Appendix B: Placeholder Value Examples

The following values are considered placeholder or perfunctory and should not pass evaluation review for any assessment field:

- "TBD"
- "N/A"
- "fine"
- "ok"
- "done"
- "see above"
- "completed"
- "no issues"
- Any single-word assessment
- Any response that does not address the specific dimension being evaluated

This list is non-exhaustive. The governing principle is that evaluation fields must contain substantive assessment sufficient to support calibration review.

---

## Document version

- **Checklist version:** 1.0
- **Applicable mode:** paper only
- **Capital authorization:** none
