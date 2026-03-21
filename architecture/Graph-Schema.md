# Graph-Schema.md — Locus Knowledge Graph Schema

**Artifact ID:** PACS-ARCH-GRAPH-001
**Owner:** Faheem
**Version:** 1.0.0
**Status:** LOCKED
**Last Updated:** 2026-03-15
**Governed by:** System-Charter.md + PACS-Phase1-Session-Prompt.md
**Upstream Dependencies:** Locus-Knowledge-Graph-Engineer-PEAS.md (PACS-PEAS-AGT2-001), State-Schema.md (PACS-ARCH-STATE-001)
**Downstream Dependents:** 04-Agent-Layer/Memory-Architecture.md, Phase 2 Locus implementation

---

## Section 1 — Entity Types

Seven entity types are defined for the Locus knowledge graph. Every entity extracted by Locus must be classified as exactly one of these types. No entity type may be introduced by Locus during extraction. Schema changes require a DECISIONS.md entry and Bridge authorization (see Section 6).

| Type       | Source Agent(s) | Description                                                                                                                           |
| ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `Concept`  | Crucible        | Knowledge concepts from learning artifacts and reflection records                                                                     |
| `Pattern`  | Foundry         | Architectural and design patterns from synthesis artifacts                                                                            |
| `Decision` | The Bridge      | Locked architectural decisions from the decision log                                                                                  |
| `Signal`   | Signal          | Frontier intelligence signals deposited to the intake queue                                                                           |
| `Metric`   | Gauge           | Performance metric definitions and reported values                                                                                    |
| `Thesis`   | Vault           | Financial intelligence theses from the intelligence documentation store                                                               |
| `Artifact` | All agents      | Document-level references — anchors all provenance chains. Every entity in the graph must reference an Artifact entity as its source. |

**Entity field schema (all types):**

| Field                  | Type          | Required | Description                                       |
| ---------------------- | ------------- | -------- | ------------------------------------------------- |
| `entity_id`            | string (UUID) | Yes      | Unique identifier for this entity                 |
| `entity_type`          | enum          | Yes      | One of the seven types defined above              |
| `label`                | string        | Yes      | Human-readable name or title for the entity       |
| `domain_tag`           | enum          | Yes      | Domain classification (see Section 3)             |
| `source_artifact_id`   | string        | Yes      | ID of the Artifact entity this was extracted from |
| `extraction_timestamp` | ISO 8601      | Yes      | When Locus extracted this entity                  |

---

## Section 2 — Relationship Types

Ten typed relationships are defined for the Locus knowledge graph. Every relationship must be classified as exactly one of these types. Relationship types may not be introduced by Locus during extraction. All relationship entries carry the fields defined in the field schema below.

| Type               | Directionality | Description                                                                                                                                                                          |
| ------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DERIVED_FROM`     | A → B          | A was extracted from or grounded in B. Cannot point to a weaker provenance class than its source — a `direct_extraction` entry cannot be derived from an `implied_extraction` entry. |
| `CONTRADICTS`      | A ↔ B          | A and B present conflicting content. Detection triggers contradiction surfacing to The Bridge via the A1 contradiction pathway.                                                      |
| `SUPPORTS`         | A → B          | A provides evidence for or reinforces B.                                                                                                                                             |
| `GOVERNS`          | A → B          | A is a policy, charter, or Decision entity that constrains B.                                                                                                                        |
| `INFORMS`          | A → B          | A (Signal or Concept entity) contributes to the formation of B (Decision or Thesis entity).                                                                                          |
| `MEASURED_BY`      | A → B          | A (Artifact, Pattern, Decision, Thesis, or Signal entity) is measured by B (Metric entity). Applies only to declared schema entity types.                                            |
| `CROSS_REFERENCES` | A → B          | A explicitly references B without a stronger relationship type being applicable.                                                                                                     |
| `AUTHORED_BY`      | A → B          | Artifact entity A was produced by agent B. B is an agent identifier from the governed agent registry. Agent is not a graph entity type.                                              |
| `EVALUATES`        | A → B          | A (Artifact representing a harness, metric report, or evaluation record) evaluates B.                                                                                                |
| `SUPERSEDES`       | A → B          | A replaces B (version transitions, decision updates). Cannot form cycles — no chain of SUPERSEDES relationships may return to its origin.                                            |

**Relationship field schema (all types):**

| Field                          | Type          | Required | Description                                                      |
| ------------------------------ | ------------- | -------- | ---------------------------------------------------------------- |
| `relationship_id`              | string (UUID) | Yes      | Unique identifier for this relationship                          |
| `relationship_type`            | enum          | Yes      | One of the ten types defined above                               |
| `source_entity_id`             | string        | Yes      | ID of the source entity                                          |
| `target_entity_id`             | string        | Yes      | ID of the target entity                                          |
| `domain_boundary_crossed`      | boolean       | Yes      | `true` if source and target entities carry different domain tags |
| `primary_provenance_record_id` | string        | Yes      | ID of the primary provenance record for this relationship        |

---

## Section 3 — Domain Tags

Eight domain tags are defined. Every entity and relationship in the graph carries exactly one domain tag. Domain tags are assigned based on the originating agent or architectural function of the extracted content.

| Tag               | Owning Agent     | Covers                                                                                                  |
| ----------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| `GOVERNANCE`      | The Bridge / MEC | Routing decisions, policy violations, escalation records, audit log entries, constitutional constraints |
| `LEARNING`        | Crucible         | Knowledge concepts, reflexion records, curriculum artifacts                                             |
| `KNOWLEDGE_GRAPH` | Locus            | Graph schema references, extraction candidates, contradiction flags                                     |
| `ENGINEERING`     | Foundry          | Architectural patterns, synthesis artifacts, option sets                                                |
| `INTELLIGENCE`    | Signal           | Frontier intelligence briefs, retrieval cycle outputs                                                   |
| `PERFORMANCE`     | Gauge            | Metrics, forecast records, anomaly alerts                                                               |
| `FINANCIAL`       | Vault            | Theses, regime assessments, calibration records                                                         |
| `SYSTEM`          | Cross-cutting    | Architecture documents, PEAS artifacts, event models, cross-agent infrastructure                        |

**Cross-domain boundary rule:** A cross-domain link is defined as any relationship whose source entity and target entity carry different domain tags. `domain_boundary_crossed` must be set to `true` for all such relationships. Cross-domain link candidates must be submitted through A2 and routed through MEMORY_COMMIT_AUTH before any cross-domain link is written to the graph.

**Classification constraint:** Domain tags are classification and boundary-control labels. They do not by themselves authorize cross-domain link creation.

---

## Section 4 — Provenance Record Structure

Every entity and relationship in the graph has at least one provenance record. One primary provenance record is required for every graph entry. Additional supplementary provenance records are permitted where the extraction is grounded in more than one source: cross-domain relationships depending on multiple source artifacts and SUPERSEDES relationships carrying both original and replacement provenance are the primary cases. No graph entry exists without a primary provenance record.

### 4.1 Primary Provenance Record — Required Fields

Applies to every entity and relationship in the graph.

| Field                     | Type          | Required | Description                                                               |
| ------------------------- | ------------- | -------- | ------------------------------------------------------------------------- |
| `provenance_id`           | string (UUID) | Yes      | Unique identifier for this provenance record                              |
| `is_primary`              | boolean       | Yes      | `true` for the primary record; `false` for supplementary records          |
| `source_artifact_id`      | string        | Yes      | Identifier of the Artifact entity this entry was extracted from           |
| `source_agent_id`         | string        | Yes      | Agent that produced the source artifact                                   |
| `extraction_task_id`      | string        | Yes      | Locus task identifier for the A1 or A2 execution that produced this entry |
| `extraction_timestamp`    | ISO 8601      | Yes      | When extraction occurred                                                  |
| `extraction_method`       | enum          | Yes      | `direct_extraction` or `implied_extraction` (see constraint below)        |
| `authorization_outcome`   | enum          | Yes      | `authorized` / `rejected` / `held_for_review`                             |
| `authorization_timestamp` | ISO 8601      | Yes      | When Bridge adjudication completed                                        |

### 4.2 Supplementary Provenance Records — Optional Fields

Permitted for cross-domain links and SUPERSEDES relationships. May not substitute for the primary provenance record.

| Field                    | Type     | Description                                                                     |
| ------------------------ | -------- | ------------------------------------------------------------------------------- |
| `secondary_artifact_ids` | string[] | Additional artifacts providing supporting evidence                              |
| `domain_boundary`        | string   | `{source_domain} → {target_domain}` (cross-domain links only)                   |
| `link_evidence_summary`  | string   | Plain-text description of the explicit artifact content that justifies the link |

### 4.3 `implied_extraction` Constraint

`implied_extraction` is limited to single-artifact semantic unpacking where the artifact contains sufficient explicit textual support for the extracted entry without dependency on any second artifact, memory recall, or graph traversal. No cross-artifact reasoning may be classified as `implied_extraction`. Any extraction requiring a second artifact, memory recall, or graph traversal must be submitted as a link candidate through A2 and MEMORY_COMMIT_AUTH, not classified as `implied_extraction` in A1.

---

## Section 5 — Validation Rules

These invariants apply to every graph write candidate before submission through MEMORY_COMMIT_AUTH. Locus must verify all invariants during A1 and A2 execution. Any candidate that fails a validation rule is rejected locally, logged via A4, and not submitted as a write candidate.

| Rule  | Invariant                                                                                                                                                                                     |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V-001 | Every entity must reference an existing Artifact entity via `source_artifact_id`                                                                                                              |
| V-002 | Every relationship must reference existing, authorized source and target entities                                                                                                             |
| V-003 | `domain_boundary_crossed = true` requires `authorization_outcome ≠ pending`                                                                                                                   |
| V-004 | `SUPERSEDES` cannot form cycles — no chain of SUPERSEDES relationships may return to its origin                                                                                               |
| V-005 | `DERIVED_FROM` cannot point to a weaker provenance class than its source — a `direct_extraction` entry cannot be derived from an `implied_extraction` entry                                   |
| V-006 | `implied_extraction` cannot be used for cross-artifact or cross-domain synthesis — any entry requiring more than one artifact or graph traversal must be submitted as a link candidate via A2 |

Validation rule failures are observable through A4 decision log entries and surface to The Bridge as `VALIDATION_REJECTED` events. Failures do not block the current ingestion cycle unless the Bridge governance configuration specifies otherwise.

---

## Section 6 — Schema Governance

Schema changes are a governance decision, not an extraction decision (Locus PEAS §2.3: "Locus does not introduce new structural patterns unilaterally. Schema changes to the graph are a governance decision, not an extraction decision.").

The following changes require a DECISIONS.md entry and Bridge authorization before taking effect:

- Addition, removal, or redefinition of an entity type
- Addition, removal, or redefinition of a relationship type
- Addition, removal, or redefinition of a domain tag
- Addition, removal, or modification of a validation rule
- Any change to the primary provenance record required fields

Locus must not introduce new structural patterns during extraction. If a candidate does not fit any defined entity type, relationship type, or domain tag, Locus surfaces the gap to The Bridge rather than creating an ad hoc classification. The Bridge owns schema change authorization.

---

_Continuum — Faheem's PAC System_
_Professor Bone Lab_
_Phase 2 — Implementation, Stage 1: Infrastructure Foundation_
_All architectural decisions logged in DECISIONS.md_
