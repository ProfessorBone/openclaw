# Vault Paper Thesis Template v1

**Artifact ID:** PACS-VAULT-GOV-001-TEMPLATE
**Version:** 1.0
**Status:** Locked
**Package:** PACS-VAULT-GOV-001
**Scope:** capital_domain: trading | mode: paper
**Capital authorized:** None
**Created:** 2026-03-21

---

## Cross-References

| Artifact                                  | Relationship                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `vault-thesis-operating-procedure-v1.md`  | Defines lawful state transitions for records created from this template                |
| `vault-governance-checklist-v1.md`        | Defines gate enforcement and taint logic applied to records created from this template |
| `vault-paper-thesis-worked-example-v1.md` | Demonstrates a complete record using this template                                     |
| `SOUL.md` (Vault section)                 | Upstream authority for field requirements and governance constraints                   |
| `DECISIONS.md` — ADR-039                  | Activates the infrastructure that stores records created from this template            |
| `thesis-store.ts`                         | Implementation of the append-only store that persists these records                    |

---

## Purpose

This template defines the required structure of a Vault paper thesis record. Every thesis created in Vault paper mode must conform to this template. Fields are grouped by purpose to support both human review and mechanical validation.

---

## Template Record

### Section A. Identity and Governance

```yaml
thesis_id: ""
record_version: 1
created_at: ""
updated_at: null

capital_domain: "trading"
mode: "paper"

analyst_engine: "narrative"
upstream_engines: []

bridge_policy_version: ""
```

**Field rules:**

- `thesis_id` must be unique across all Vault records
- `record_version` starts at 1 and increments on every lifecycle update
- `capital_domain` must be "trading" (retirement is not activated)
- `mode` must be "paper" (real capital is not authorized)
- `bridge_policy_version` must reference the active Bridge config version at creation time

---

### Section B. Asset and Strategy

```yaml
asset_symbol: ""
asset_type: ""
strategy_bucket: ""
directional_view: ""
time_horizon: ""
```

**Field rules:**

- `asset_symbol` must be present and must pass the Bridge-allowed asset check
- `asset_type` must correspond to a recognized allowed-universe category (e.g., core_equities, broad_market_etfs, market_context_instruments)
- `directional_view` must be explicitly declared; no default value is permitted
- `time_horizon` must be present and must express a specific duration

---

### Section C. Thesis Core

```yaml
thesis_statement: ""
supporting_evidence: []
counterevidence: []
invalidation_condition: ""
confidence_level: null
uncertainty_statement: ""
```

**Field rules:**

- `thesis_statement` must be present and substantive
- `supporting_evidence` must contain at least one structured evidence item
- `counterevidence` may be empty if the analyst explicitly documents why no counterevidence was identified, but an empty array without explanation should be flagged during evaluation
- `invalidation_condition` must be present and must describe conditions that are specific enough to be mechanically or observationally evaluable
- `confidence_level` defaults to null; must be numeric and within the range 0.1 to 1.0 for validation to pass; null fails validation
- `uncertainty_statement` must be present and must describe what the analyst does not know or cannot predict

---

### Section D. Source Provenance

```yaml
source_list: []
primary_source_summary: ""
market_context_notes: ""
```

**Field rules:**

- `source_list` must contain at least one structured source entry
- `primary_source_summary` should summarize how sources relate to the thesis
- `market_context_notes` should capture ambient market conditions relevant to thesis timing

---

### Section E. Pre-Entry Governance Checks

```yaml
p1_gate_status: "pending"
p1_missing_fields: []
asset_allowed_status: "pending"
asset_class_exclusion_status: "pending"
segregation_check_status: "pending"
sizing_compliance_status: "pending"
sizing_violations: []
approval_status: "pending"
```

**Field rules:**

- All gate status fields begin as "pending"
- Gate status values: pending | pass | fail
- Approval status values: pending | approved | rejected | blocked
- `pending` means not yet checked; `blocked` means checked and not authorized
- `p1_missing_fields` and `sizing_violations` must be populated on failure

---

### Section F. Simulated Position Plan

```yaml
paper_entry_date: null
paper_entry_price: null
simulated_position_size: 0
max_allowed_notional: 0
target_condition: ""
stop_or_exit_condition: ""
planned_review_interval: ""
```

**Field rules:**

- These fields are populated only when the thesis transitions from approved to active
- `simulated_position_size` must not exceed `max_allowed_notional`
- `target_condition` and `stop_or_exit_condition` must be specific enough to be evaluable
- `planned_review_interval` must be declared before activation

---

### Section G. Lifecycle Tracking

```yaml
status: "draft"
last_review_at: null
policy_divergence_noted: false
closure_date: null
closure_state: null
closure_reason: null
```

**Field rules:**

- `status` values: draft | validated | approved | active | closed
- `policy_divergence_noted` is set to true if Bridge policy changes while the thesis is active; the thesis is not auto-closed in paper mode but the divergence must be recorded
- `closure_state` must be one of: closed-confirmed | closed-contradicted | closed-inconclusive
- `closure_reason` must be substantive, not placeholder

---

### Section H. Post-Closure Evaluation

```yaml
outcome_summary: null
thesis_quality_assessment: null
evidence_quality_assessment: null
contradiction_handling_assessment: null
discipline_assessment: null
calibration_result: null
evaluator_notes: null
```

**Field rules:**

- All evaluation fields must be completed before a calibration record may be created
- Evaluation fields must contain substantive assessment, not placeholder or perfunctory values
- The evaluator is responsible for good-faith completion sufficient to support calibration review
- `calibration_result` must be either "clean" or "tainted"

---

## Sub-Object Shapes

### source_list[] entry

```json
{
  "source_id": "",
  "source_type": "",
  "source_name": "",
  "accessed_at": "",
  "url_or_reference": ""
}
```

**Constraints:**

- `source_id` must be unique within the thesis record
- No duplicate `source_id` values are permitted
- All five fields are required

---

### supporting_evidence[] and counterevidence[] entry

```json
{
  "statement": "",
  "source_ref": "",
  "evidence_type": "",
  "added_at": "",
  "notes": ""
}
```

**Constraints:**

- `source_ref` must reference a valid `source_id` from `source_list`; no orphan evidence is permitted
- `evidence_type` must be one of: quantitative | qualitative | structural
- `statement` and `added_at` are required
- `notes` may be empty but the field must be present

---

## Document version

- **Template version:** 1.0
- **Applicable mode:** paper only
- **Capital authorization:** none
