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
- [x] Write Chunking-Strategy.md — chunk size, overlap, segmentation rules for continuum_artifacts collection
  - **Output location:** vault 03-Data-Layer/Chunking-Strategy.md
- [x] Write RAG-Workflow.md — operational retrieval sequence, graph + vector coordination, consistency model resolution
  - **Output location:** vault 03-Data-Layer/RAG-Workflow.md

### OpenClaw Setup

- [x] Install OpenClaw on Mac Studio M3 Ultra
  - pnpm install: 1287 packages, 57.1s — COMPLETE
  - pnpm build: 613 files in dist/, clean — COMPLETE
  - pnpm openclaw onboard: Gateway configured, LaunchAgent installed — COMPLETE
- [x] Configure Gateway as The Bridge's home in OpenClaw
  - Gateway running at ws://127.0.0.1:18789, bound to loopback, port 18789
  - LaunchAgent installed at ~/Library/LaunchAgents/ai.openclaw.gateway.plist
  - Default model: claude-opus-4-6 (200k ctx), Anthropic API key configured
  - openclaw.json at ~/.openclaw/openclaw.json
- [x] Verify per-agent workspace isolation (each agent: SOUL.md, AGENTS.md, USER.md, MEMORY.md)
  - Workspace confirmed at ~/.openclaw/workspace
  - Agent main registered at ~/.openclaw/agents/main/
  - Per-agent SOUL.md, AGENTS.md, USER.md population is Stage 2 work
- [x] Test heartbeat configuration (30 min default per OpenClaw docs)
  - Heartbeat: 30m (main) — confirmed in status output

### Telemetry Pipeline

- [ ] Design telemetry event collection architecture
- [x] GAP-001 RESOLVED — Locus-Event-Model.md already contains G-003 CONTRADICTION_FLAGGED
      (fully specified). TASKS.md label was stale. No edit to the locked document needed.
- [x] GAP-002 RESOLVED — Foundry-Event-Model.md already contains G-001 SOURCE_CONFLICT_REPORTED
      and I-002 SILENT_ABSORPTION_DETECTED (fully specified). TASKS.md label was stale.
- [x] GAP-003 RESOLVED — Signal-Event-Model.md already contains E-003 FILTERED_MATERIAL_LOGGED
      (fully specified). TASKS.md label was stale. No edit to the locked document needed.
- [x] GAP-004/005 RESOLVED — Cross-agent stream access mediated by Observability Layer. Five stream
      visibility classes defined. No direct agent-to-agent stream reads. Resolved in Telemetry.md Section 4.
- [x] Write Telemetry.md infrastructure spec — COMPLETE. PACS-OBS-005 v1.0.0 LOCKED.
      15 taxonomy corrections (C-01 through C-15), GAP-003 resolved, all five GAPs resolved.

### Tamper-Evident Audit Log

- [x] Design audit log storage (append-only, cryptographically verifiable) — COMPLETE. PACS-ARCH-AUDIT-001 v1.0.0 LOCKED.
- [x] Implement TC-BRIDGE-005 (emit_decision_log) as first actuator — design complete. Hash-based chain, seven decision surfaces defined.
  - Source: Tool Contracts PACS-ARCH-TOOL-001, TC-BRIDGE-005
  - Timeout behavior: if write not confirmed within timeout window → Level 1 failure
- [x] Verify write-only access for The Bridge — write-only model specified in PACS-ARCH-AUDIT-001 Section 2.

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
6. Foundry — engineering synthesis agent (see pre-condition below)
7. Signal — frontier retrieval agent
8. Vault — financial intelligence agent (sandboxed, deny list enforced)

### Pre-Condition Before Foundry Scaffolding (Item 6)

Foundry explicitly uses OpenClaw sub-agent spawning for bounded research and parallel
investigation tasks. Sub-agent spawning without governance allows agents to spin up
unregistered workers that execute outside Bridge awareness — a hidden execution pathway.

Three items must be in place before Foundry is scaffolded:

**Pre-condition A — Pre-route hook implemented:**
Core change to src/hooks/internal-hooks.ts (add routing event type) and
src/routing/resolve-route.ts (insert triggerInternalHook() at line 614 before
tiered matching begins). This gives The Bridge visibility into routing decisions
before they commit, including decisions for spawned sub-agents.
Source: Integration Risk Register Starting Point 1 (PACS-IMPL-RECON-001-S4).

**Pre-condition B — Governed agent registry enforced at runtime:**
The Bridge route adjudication logic must check every routing decision — including
spawned sub-agents — against the Governed-Agent-Registry.md. Any agent ID not in
the registry must be denied or remapped. Without this check, the registry is
documentation but not governance.
Source: 02-Architecture/Governed-Agent-Registry.md.

**Pre-condition C — Governed spawning pathway documented:** [x] COMPLETE
Governed-Spawning-Pathway.md — PACS-ARCH-SPAWN-001 v1.0.0 LOCKED at 02-Architecture/Governed-Spawning-Pathway.md
A named process must exist for adding new agent types. Required steps: Foundry
designs the new agent, The Bridge authorizes the registry addition, Faheem approves
a DECISIONS.md entry, agent is added to openclaw.json. Only then can the new agent
receive spawned sessions. This process must be written before Foundry goes live so
it exists before the first time it is needed.
Source: System Charter non-negotiable — no hidden execution pathways.

---

## Stage 3 Planned Capability — Injection Signal Classifier

**What it is:** A fine-tuned Tier 2 SLM classifier deployed as MEC sensor S7. Trained on
labeled prompt injection datasets to detect five attack classes: Instruction Override,
Authority Spoofing, Prompt Exfiltration, Tool Misuse, and Data Exfiltration. Returns a
confidence-weighted classification per input. High-confidence injection detection on a
protected decision candidate triggers automatic quarantine before MEC adjudication proceeds.

**Why it belongs here:** Prompt injection is the primary external attack surface for all
Continuum agents. The classifier is not self-policing — it is an independent sensor that
produces a signal. The MEC adjudicates what to do with that signal. Governance separation
is preserved.

**Architecture:**

- Primary deployment: MEC sensor S7 (scores protected decision candidates)
- Secondary deployment: lightweight version at Bridge inbound envelope intercept point
  (first-pass filter before routing — obvious attacks caught before reaching the routing layer)
- Source: Boundary-Inventory.md Prompt Injection Threat Model section

**Prerequisites:** MEC fully scaffolded and operational. Cannot implement before Stage 2
MEC scaffolding is complete.

**Implementation path (all local, zero cloud cost):**

- Base model: Mistral 7B or Llama 3 8B via Ollama or Hugging Face
- Fine-tuning framework: MLX (Apple's ML framework, native Apple Silicon)
- Method: LoRA fine-tuning (20–30GB memory during training — well within Mac Studio M3 Ultra
  512GB unified memory)
- Training dataset: ProtectAI prompt injection dataset (Hugging Face, free) + Deepset
  dataset + 200–500 Continuum-specific examples written by Faheem
- Training time: 2–6 hours unattended on Mac Studio M3 Ultra
- Total out-of-pocket cost: zero
- Total active effort: approximately 2 days spread across one week

**Evaluation criteria before deployment:**

- Precision and recall on held-out injection examples above defined threshold
- False positive rate on clean Continuum traffic below defined threshold
- Latency per classification acceptable for MEC real-time adjudication
- All five attack classes represented in evaluation set

**Governance:** Classifier configuration (model version, confidence threshold, quarantine
policy) is Bridge-governed. Changes require DECISIONS.md entry. Classifier itself is
read-only from the MEC's perspective — it produces scores, it does not execute actions.

---

_Continuum — Faheem's PAC System | Professor Bone Lab_
