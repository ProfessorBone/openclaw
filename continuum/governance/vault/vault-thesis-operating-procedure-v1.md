# Vault Thesis Operating Procedure v1

**Artifact ID:** PACS-VAULT-GOV-001-PROCEDURE
**Version:** 1.0
**Status:** Locked
**Package:** PACS-VAULT-GOV-001
**Scope:** capital_domain: trading | mode: paper
**Capital authorized:** None
**Created:** 2026-03-21

---

## Cross-References

| Artifact                                  | Relationship                                                         |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `vault-paper-thesis-template-v1.md`       | Defines the record structure this procedure governs                  |
| `vault-governance-checklist-v1.md`        | Provides the mechanical enforcement checklist for gates defined here |
| `vault-paper-thesis-worked-example-v1.md` | Demonstrates this procedure applied to a calibration specimen        |
| `SOUL.md` (Vault section)                 | Upstream authority for governance principles                         |
| `System-Charter.md`                       | Establishes Vault as a governed capital domain within PACS           |
| `DECISIONS.md` — ADR-039                  | Activates the infrastructure this procedure operates on              |
| `PACS-VAULT-CAL-001`                      | Calibration policy governing eligibility thresholds                  |

---

## 1. Purpose

This procedure governs the lifecycle of a Vault paper thesis from draft through closure and calibration. It exists to ensure that every thesis is:

- documented before action
- validated before approval
- approved before simulated entry
- tracked through closure
- evaluated before calibration credit is granted

This procedure applies only to:

- capital_domain: trading
- mode: paper

It does not authorize real capital.

---

## 2. State Model

### Primary thesis states

- draft
- validated
- approved
- active
- closed

### Terminal closure states

- closed-confirmed
- closed-contradicted
- closed-inconclusive

### Approval states

- pending
- approved
- rejected
- blocked

### Gate states

- pending
- pass
- fail

---

## 3. Core Governance Principle

A thesis may be:

- well-formed but not authorized
- authorized but not yet active
- active but not yet closed
- closed but not yet evaluated
- evaluated but not clean

These distinctions must remain explicit in the record.

---

## 4. Required Record Foundations

A thesis record must begin with:

- unique thesis_id
- record_version: 1
- capital_domain: trading
- mode: paper
- analyst_engine: narrative
- upstream_engines populated as applicable
- bridge_policy_version recorded
- structured source_list
- structured supporting_evidence
- structured counterevidence

### Source provenance rule

Each source entry must include: source_id, source_type, source_name, accessed_at, url_or_reference.

### Evidence provenance rule

Each evidence item must include: statement, source_ref, evidence_type, added_at, notes.

Each source_ref must match an existing source_list.source_id.

Allowed evidence_type values: quantitative, qualitative, structural.

No orphan evidence is allowed. No duplicate source_id values are permitted.

---

## 5. Stage 1: Draft Creation

A thesis begins in:

- status: draft
- approval_status: pending
- p1_gate_status: pending

At draft stage, the thesis must contain the intended analytical structure, but it has not yet passed validation.

### Minimum draft expectations

The draft should contain: asset identity, strategy bucket, directional view, thesis statement, supporting evidence, counterevidence, invalidation condition, confidence level, uncertainty statement, source provenance.

### Directional view rule

directional_view must be explicitly declared. No default value is allowed.

### Confidence rule

confidence_level defaults to null. For validation, it must be numeric, greater than or equal to 0.1, and less than or equal to 1.0. Null fails validation.

---

## 6. Stage 2: Validation

A thesis may transition from draft to validated only if P1 passes.

### Validation checks

P1 validation must confirm:

- all required fields are present
- all required fields are non-null and non-empty
- directional_view is explicitly declared
- confidence_level is numeric and within allowed range
- source provenance is complete
- every evidence item references a valid source
- no duplicate source_id values exist
- capital_domain is trading
- mode is paper

### Success outcome

If validation passes:

- p1_gate_status: pass
- p1_missing_fields: []
- thesis transitions to status: validated

### Failure outcome

If validation fails:

- thesis remains status: draft
- p1_gate_status: fail
- p1_missing_fields must be populated
- failure must be recorded in the append-only record stream

A failed validation attempt is not silent.

---

## 7. Stage 3: Approval Review

A thesis may transition from validated to approved only if Bridge-governed authorization checks pass.

### Approval checks

Approval review must confirm:

- asset symbol is allowed by Bridge config (membership in configured allowed-universe categories, not just a flat symbol check)
- asset class is not excluded by Bridge config
- segregation check passes
- sizing compliance passes
- no configured opening limit is violated

### Success outcome

If approval passes:

- asset_allowed_status: pass
- asset_class_exclusion_status: pass
- segregation_check_status: pass
- sizing_compliance_status: pass
- sizing_violations: []
- approval_status: approved
- thesis transitions to status: approved

### Failure outcome

If any approval check fails:

- thesis remains status: validated
- approval_status: blocked (not left as pending)
- the failing checks must be explicitly recorded
- sizing_violations or equivalent failure detail must be populated

approval_status: pending means not yet checked. approval_status: blocked means checked and not authorized.

---

## 8. Stage 4: Simulated Entry Activation

A thesis may transition from approved to active only when simulated entry is formally recorded.

### Required activation fields

Before activation, the record must contain:

- paper_entry_date
- paper_entry_price
- simulated_position_size
- max_allowed_notional
- target_condition
- stop_or_exit_condition
- planned_review_interval

### Activation outcome

If all activation requirements are present: thesis transitions to status: active.

### Prohibited behavior

A thesis may not move directly from draft to active or from validated to active. No state skipping is allowed.

---

## 9. Stage 5: Active Monitoring

An active thesis must be reviewed according to planned_review_interval.

### Review requirements

Each review must:

- append a new record version
- update last_review_at
- preserve prior versions
- note any material change in evidence, risk, or outlook

### Edit rule

No silent edits are permitted. Any material thesis change requires a new append-only version.

### Policy version rule during active monitoring

In paper mode, the thesis remains governed by the bridge_policy_version under which it was approved.

If Bridge policy changes mid-cycle:

- the thesis is not auto-closed
- policy_divergence_noted: true must be recorded
- the divergence must be discussed during post-closure evaluation

This preserves calibration integrity while keeping policy change visible.

---

## 10. Stage 6: Thesis Closure

A thesis may transition from active to closed only through a valid terminal closure state.

### Allowed closure states

- closed-confirmed
- closed-contradicted
- closed-inconclusive

### Required closure fields

Closure requires: closure_date, closure_state, closure_reason.

### Closure outcome

If closure requirements are met: thesis transitions to status: closed.

### Invalid closure handling

If closure state is not one of the three allowed values: closure is rejected and thesis remains status: active.

---

## 11. Stage 7: Post-Closure Evaluation

A closed thesis does not count toward calibration until evaluation is complete.

### Required evaluation fields

The post-closure record must include:

- outcome_summary
- thesis_quality_assessment
- evidence_quality_assessment
- contradiction_handling_assessment
- discipline_assessment
- calibration_result
- evaluator_notes

### Evaluation quality rule

Evaluation fields must contain substantive assessment, not placeholder or perfunctory values. The evaluator is responsible for good-faith completion sufficient to support calibration review.

No calibration cycle may be recorded before all required evaluation fields are completed.

---

## 12. Stage 8: Calibration Recording

After evaluation, a calibration record may be created.

### Clean cycle criteria

A cycle counts as clean only if all nine required integrity checks pass:

| Flag (canonical name)               | Condition for clean |
| ----------------------------------- | ------------------- |
| p1_compliance                       | true                |
| p2_evaluation_completed             | true                |
| p3_segregation_intact               | true                |
| p4_violations_zero                  | true                |
| a6_alerts_clear                     | true                |
| record_complete_and_auditable       | true                |
| no_unauthorized_asset_breach        | true                |
| no_undocumented_thesis_modification | true                |
| no_output_bypassed_bridge           | true                |

See `vault-governance-checklist-v1.md` Section 2 for detailed taint condition definitions.

### Tainted cycle rule

If any required integrity check fails: cycle is tainted, it does not count toward eligibility, and taint reasons must be explicitly recorded.

---

## 13. Eligibility Accounting

### Retirement paper eligibility

Retirement paper activation is eligible only after:

- at least 1 clean cycle exists
- Bridge review is completed
- Faheem authorization is recorded

### Real capital eligibility

Real capital is eligible only after:

- at least 4 clean cycles exist
- Bridge review is completed
- no unresolved governance issues remain
- Faheem explicit authorization is recorded

Infrastructure eligibility alone does not authorize capital.

---

## 14. Blocked Transition Rules

Blocked transitions must be represented explicitly in the record.

### Draft validation failure

If P1 fails: status remains draft, p1_gate_status set to fail, p1_missing_fields populated.

### Approval failure

If Bridge-governed checks fail: status remains validated, approval_status set to blocked, failing checks recorded.

### Activation failure

If simulated entry fields are incomplete: status remains approved, activation does not occur, missing activation fields recorded.

### Closure failure

If closure requirements are incomplete: status remains active, closure does not occur, closure deficiency recorded.

No blocked transition should appear as a silent non-event.

---

## 15. Record Versioning Rules

The thesis store is append-only.

### Versioning requirements

- initial record must be record_version: 1
- each lifecycle update appends a new record
- each new record increments record_version
- prior records are never overwritten
- updated_at must be set on every post-creation version

### Reconstruction rule

The current thesis state is the highest record_version for a given thesis_id.

---

## 16. Prohibited Actions

The following are prohibited:

- creating a thesis without documentation
- activating a thesis without P1 pass
- approving a thesis that fails Bridge checks
- opening a thesis in an excluded asset class
- bypassing sizing rules
- silent record mutation
- invalid closure states
- calibration without evaluation
- counting tainted cycles toward eligibility
- treating paper eligibility as real-capital authorization

---

## 17. Audit Interpretation Rule

For auditing purposes:

| Term      | Meaning                               |
| --------- | ------------------------------------- |
| draft     | under construction                    |
| validated | structurally sound                    |
| approved  | authorized for simulated entry        |
| active    | currently being tracked in paper mode |
| closed    | thesis lifecycle ended                |
| clean     | eligible for counting                 |
| tainted   | not eligible for counting             |

This interpretation is mandatory for review consistency.

---

## 18. Locked Paper-Mode Policy Divergence Rule

For paper mode only:

- active theses are grandfathered under the approval-time bridge_policy_version
- mid-cycle Bridge policy changes do not force closure
- policy_divergence_noted must be recorded when relevant
- divergence context must be included in evaluation

Real-capital-mode divergence handling is deferred to a future policy artifact.

---

## 19. Operational Summary

The thesis lifecycle is:

```
draft → validated → approved → active → closed → evaluated → calibrated
```

A thesis may fail at any gate, but every failure must be visible in the record.

---

## Document version

- **Procedure version:** 1.0
- **Applicable mode:** paper only
- **Capital authorization:** none
