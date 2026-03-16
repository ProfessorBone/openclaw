# TASKS.md — Continuum Active Work Queue
# Version: 1.0.0 | 2026-03-13
#
# DEPLOYMENT: Copy this file to the root of your Continuum repo.
# Update at the start and end of every build session.
# Keep this focused on what is authorized for the CURRENT stage.

---

## Current Stage

Stage 1 — Infrastructure Foundation

---

## Active Tasks (Stage 1)

### Immediate Priority
- [x] Write Graph-Schema.md — entity types, relationship types, domain tags, provenance record structure
  - **Why now:** Locus cannot be scaffolded without it. Blocking dependency.
  - **Source:** Locus PEAS Section 5 cross-reference note
  - **Output location:** architecture/Graph-Schema.md
- [x] Write Knowledge-Base-Design.md — all durable knowledge stores, access patterns, write governance
  - **Output location:** vault 03-Data-Layer/Knowledge-Base-Design.md — PACS-DATA-KBD-001 v1.0.0 LOCKED
- [x] Write Vector-Store-Selection.md — Qdrant selection, embedding model, collection design, governance constraints
  - **Output location:** vault 03-Data-Layer/Vector-Store-Selection.md — PACS-DATA-VSS-001 v1.0.0 LOCKED
- [ ] Write Chunking-Strategy.md — chunk size, overlap, segmentation rules for continuum_artifacts collection
  - **Output location:** vault 03-Data-Layer/Chunking-Strategy.md
- [ ] Write RAG-Workflow.md — operational retrieval sequence, graph + vector coordination, consistency model resolution
  - **Output location:** vault 03-Data-Layer/RAG-Workflow.md

### OpenClaw Setup
- [ ] Install OpenClaw on Mac Studio M3 Ultra
- [ ] Configure Gateway as The Bridge's home in OpenClaw
- [ ] Verify per-agent workspace isolation (each agent: SOUL.md, AGENTS.md, USER.md, MEMORY.md)
- [ ] Test heartbeat configuration (30 min default per OpenClaw docs)

### Telemetry Pipeline
- [ ] Design telemetry event collection architecture
- [ ] Add CONTRADICTION_DETECTED event to Locus-Event-Model.md (GAP-001)
- [ ] Add CONFLICT_DETECTED event to Foundry-Event-Model.md (GAP-002)
- [ ] Add ITEM_FILTERED event to Signal-Event-Model.md (GAP-003)
- [ ] Confirm cross-agent stream access architecture (GAP-004/005)
- [ ] Write Telemetry.md infrastructure spec (PACS-OBS-005 — currently PENDING)

### Tamper-Evident Audit Log
- [ ] Design audit log storage (append-only, cryptographically verifiable)
- [ ] Implement TC-BRIDGE-005 (emit_decision_log) as first actuator
  - Source: Tool Contracts PACS-ARCH-TOOL-001, TC-BRIDGE-005
  - Timeout behavior: if write not confirmed within timeout window → Level 1 failure
- [ ] Verify write-only access for The Bridge (cannot read, modify, or delete entries)

### Stage 1 Exit Gate
- [ ] Run INJ-005: Audit chain integrity test
- [ ] Run INJ-021: MEC fail-closed verification
- [ ] Both pass → proceed to Stage 2

---

## Do Not Work On Yet

- Agent SOUL.md files (Stage 2)
- Agent tool wiring (Stage 2)
- Event emission hooks per agent (Stage 2)
- Failure injection execution (Stage 3)
- Any production or live-data workloads (Stage 4+)
- Vault real capital analysis (requires Stage 4 validation + Faheem re-authorization)
- Voice interface / ElevenLabs (Stage 5 addition)
- Advanced MCP integrations beyond core infrastructure (after Stage 2)

---

## Definition of Done for Stage 1

- Graph-Schema.md written and reviewed
- OpenClaw installed and Gateway configured
- Telemetry pipeline operational and receiving events
- All five GAPs from PACS-OBS-004 resolved
- Tamper-Evident Audit Log operational and audit chain verifiable
- INJ-005 and INJ-021 both pass

---

## Stage 2 Preview (after Stage 1 complete)

Agent scaffolding in order:
1. The Bridge — SOUL.md, AGENTS.md, tool wiring (A1–A5), event hooks
2. MEC — constitutional enforcement layer
3. Gauge — performance measurement layer
4. Locus — knowledge graph infrastructure (requires Graph-Schema.md)
5. Crucible — learning agent
6. Foundry — engineering synthesis agent
7. Signal — frontier retrieval agent
8. Vault — financial intelligence agent (sandboxed, deny list enforced)

---

*Continuum — Faheem's PAC System | Professor Bone Lab*

