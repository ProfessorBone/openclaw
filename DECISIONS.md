# DECISIONS.md — Continuum Architectural Decision Log

# Version: 1.0.0 | 2026-03-13

#

# DEPLOYMENT: Copy this file to the root of your Continuum repo.

# Every change to a governance-tier file must produce an entry here.

# Format: ADR-NNN (Architectural Decision Record)

# "No silent evolution" — System Charter Section 8.

---

## How to Add an Entry

When you make a decision that affects architecture, add an ADR in this format:

```
---
## ADR-NNN
**Title:** Brief description
**Date:** YYYY-MM-DD
**Status:** DECIDED | PENDING | SUPERSEDED
**Decision:** What was decided
**Context:** Why this decision was needed
**Alternatives considered:** What else was evaluated
**Tradeoffs:** What was gained and what was accepted as a cost
**Follow-on:** Any downstream decisions this creates
```

---

## ADR-001 — OpenClaw CLAUDE.md Overwritten by Continuum Builder Doctrine

Date: 2026-03-14
Status: Accepted

Decision: The existing CLAUDE.md at repo root (OpenClaw upstream full project
guidelines — hundreds of lines of OpenClaw maintainer instructions) was
overwritten by the Continuum Builder Doctrine (PACS-IMPL-MEMORY-CLAUDE, v1.0.0).

Rationale: This fork is exclusively for Continuum development. The OpenClaw
CLAUDE.md contained OpenClaw project maintainer instructions not applicable
to Continuum work. Option A (overwrite) was selected over Option B (rename)
and Option C (.claude/ placement) because overwriting produces the cleanest
governance posture with Continuum doctrine at maximum Claude Code precedence.

Note: The existing file was the full OpenClaw project CLAUDE.md (hundreds of
lines), not a two-line stub as initially described. The overwrite decision
stands — the content was OpenClaw upstream instructions, not Continuum doctrine.

Authority: Faheem, 2026-03-14.

---

## ADR-002

**Title:** Claude Code as primary build tool for Phase 2
**Date:** 2026-03-13
**Status:** DECIDED
**Decision:** Claude Code with hooks and CLAUDE.md is the primary builder for
implementing Continuum. MCP servers are added as the capability layer after
the core repo and governance scaffolding are stable.
**Context:** Phase 1 architecture is complete. Phase 2 needs a build environment
that enforces governance discipline deterministically, not through model memory.
**Alternatives considered:** VS Code + MCP first; custom orchestrator framework
**Tradeoffs:** Claude Code provides deterministic hook enforcement and CLAUDE.md
doctrine. MCP-first would provide broader capability access but less build
discipline at this stage. Build discipline is more important than capability
breadth during initial scaffolding.
**Follow-on:** MCP servers added in Phase 2 Stage 1 as external capability layer.

---

## ADR-003

**Title:** Hook-based governance enforcement for Continuum build environment
**Date:** 2026-03-13
**Status:** DECIDED
**Decision:** Seven hooks govern the Claude Code build environment:
protected-files (constitutional doc protection), bash-safety-gate (deny list
enforcement), pre-edit-governance (architecture file authorization), session-start
(doctrine injection), state-update (STATE.md maintenance), decision-log
(DECISIONS.md maintenance), subagent-containment (boundary verification).
**Context:** CLAUDE.md is a suggestion. Hooks are deterministic. The Continuum
architecture requires deterministic enforcement of governance rules.
**Alternatives considered:** Prompt-only enforcement; manual review gates
**Tradeoffs:** Hooks add friction to protected file edits. That friction is
intentional — constitutional documents should be hard to modify casually.
**Follow-on:** Hook set should be reviewed after Stage 2 and extended as needed.

---

## ADR-004

**Title:** Five-stage build sequence with exit gates
**Date:** 2026-03-13
**Status:** DECIDED
**Decision:** Phase 2 proceeds through five stages in strict order: Infrastructure
Foundation → Agent Scaffolding → Failure Injection Execution → Operational
Validation → Production Onboarding. Each stage has a defined exit gate that
must pass before the next stage begins.
**Context:** Injecting failures before agents are scaffolded is impossible.
Running production workloads before failure injection is validated is unsafe.
The order is not arbitrary — it is the correct engineering sequence.
**Alternatives considered:** Parallel stage execution; informal staging
**Tradeoffs:** Sequential staging is slower than parallel. The safety guarantee
it provides is worth the timeline cost.
**Follow-on:** Exit gates are defined in PACS-VALIDATION-001. Mandatory Phase 2
entry gates must all pass before any real workload runs.

---

## ADR-005

**Title:** Graph-Schema.md as Stage 1 prerequisite
**Date:** 2026-03-13
**Status:** DECIDED
**Decision:** Graph-Schema.md must be written in Stage 1, before any Locus
scaffolding begins in Stage 2. It defines entity types, relationship types,
domain tags, and provenance record structure that Locus operates against.
**Context:** Locus PEAS Section 5 explicitly flags Graph-Schema.md as a Phase 2
prerequisite. Locus cannot be implemented without it.
**Alternatives considered:** Write Graph-Schema.md alongside Locus scaffolding
**Tradeoffs:** None — this is a hard prerequisite, not a design choice.
**Follow-on:** Graph-Schema.md is a Phase 2 architecture artifact, not a code file.
It belongs in architecture/ in the repo.

---

_Continuum — Faheem's PAC System | Professor Bone Lab_

---

## ADR-006 — state-update.sh flock replaced with mkdir-based lock

Date: 2026-03-14
Status: Accepted

Problem: flock is a Linux utility not available on macOS by default.
Hook 2 (state-update.sh) exited at the flock line before writing to
STATE.md, causing Stage 3 behavioral Test 1 to fail.

Impact: Hook 2 was non-functional on Mac Studio M3 Ultra. Stage 3
behavioral verification could not complete.

Decision: Replace flock-based locking with a portable mkdir-based
non-blocking lock. mkdir is atomic on both macOS and Linux, requires
no additional packages, and provides equivalent protection against
concurrent write races.

Rationale: Continuum's hook stack must rely on default OS capabilities
only. Adding a Homebrew dependency for a locking primitive would make
the governance layer environment-dependent and break reproducibility
on fresh Mac setups. Async behavior is preserved.

Consequence: Hook 2 is now self-contained and portable across default
macOS and Linux environments. No external install required.

Authority: Faheem, 2026-03-14.

---

## ADR-007 — .claude/mcp-settings.json created, obsidian-vault server registered

Date: 2026-03-14
Status: Accepted

Decision: Created .claude/mcp-settings.json at repo root with obsidian-vault
as the sole registered MCP server at MCP Capability Phase 1. Configuration
matches the vault specification at 10-Claude-Code-Implementation/mcp-servers/
mcp-settings.json.md exactly.

Rationale: MCP Capability Phase 1 permits only the obsidian-vault server.
Registering additional servers before their capability phase is a governance
violation per the active-server governance rule in mcp-settings.json.md.
The obsidian-vault server is required for Stage 5 vault bridge verification
and for all implementation traceability reads during the build sequence.

Note: The Stage 4 active-server policy check command was corrected from a
grep-based pattern to jq -r '.mcpServers | keys[]' after Claude Code
identified that the grep pattern also matched field names inside server
entries. The vault spec (Install-Sequence.md) was updated to reflect the
correct command.

Authority: Faheem, 2026-03-14.

---

## ADR-008 — MCP config location corrected from .claude/mcp-settings.json to .mcp.json

Date: 2026-03-14
Status: Accepted

Problem: The original MCP server configuration was written to
.claude/mcp-settings.json. Claude Code in VS Code does not read that path.
The obsidian-vault MCP tool was therefore never available in any Claude Code
session despite the config existing.

Decision: Migrate MCP server configuration to .mcp.json at repo root, which
is the correct project-scoped config location for Claude Code in VS Code.
The .claude/mcp-settings.json file remains in place as a historical artifact
but is not the active config.

Scope: Project-scoped (.mcp.json at repo root) is correct for Continuum.
This is a single-user repo. The file is committed to git and available to
every Claude Code session opened in this directory.

Consequence: obsidian-vault MCP tools will be available from the next
session start after VS Code reloads the project config.

Authority: Faheem, 2026-03-14.

---

## ADR-009 — obsidian-vault MCP server scope changed from project to user

Date: 2026-03-14
Status: Accepted

Problem: .mcp.json at repo root was not being read by claude mcp list despite
the file being valid and correctly formatted. The project-scoped server was
not surfacing in Claude Code sessions.

Decision: Register obsidian-vault at user scope via claude mcp add -s user.
This writes to ~/.claude.json and is available across all projects on this
machine. The .mcp.json at repo root now has an empty mcpServers object.

Rationale: For a single-user machine, user scope is functionally identical
to project scope. The server confirmed Connected and all three Stage 5 vault
bridge verification tests passed.

Authority: Faheem, 2026-03-14.

---

## ADR-010 — CLAUDE.md updated: Execution Discipline section added

Date: 2026-03-14
Status: Accepted

Decision: Added an Execution Discipline section to CLAUDE.md establishing
that Claude Code executes exactly what Faheem instructs and nothing more.
The section explicitly prohibits self-remediation, reinterpretation of
diagnostic tasks as remediation tasks, and unauthorized modifications to
configuration or system state.

Rationale: During Stage 5 vault bridge verification, Claude Code reinterpreted
a diagnostic prompt (run three read tests) as authorization to modify the MCP
configuration. This was a governance failure. The Execution Discipline section
closes this behavioral gap at the doctrine level so future sessions are
constrained from the start.

Authority: Faheem, 2026-03-14.

---

## ADR-011 — Architectural Reconnaissance Pass (Stage 6) — OpenClaw control surface mapped

Date: 2026-03-14
Status: Accepted

Decision: Executed a full architectural reconnaissance pass on the OpenClaw
codebase before writing any implementation code. Four artifacts produced:

- continuum/recon/openclaw-host-map.md — canonical file paths confirmed
- continuum/recon/control-surface-matrix.md — 8-row Continuum→OpenClaw mapping
- continuum/recon/governance-insertion-points.md — 16 architectural questions answered
- continuum/recon/integration-risk-register.md — three lowest-risk starting points

Key findings:

1. Routing interception requires a Core change — no pre-resolve hook exists in
   resolveAgentRoute() (src/routing/resolve-route.ts). Call site is actually
   src/plugin-sdk/inbound-envelope.ts:77, not server-chat.ts as initially inferred.
2. Memory writes have no governance gate — direct sync() with no approval pathway.
3. Bootstrap hooks (src/agents/bootstrap-hooks.ts) are the primary Config surface
   for injecting Continuum governance content into agent context.
4. src/gateway/hooks.ts is the HTTP webhook API (external). The internal hook
   system is src/hooks/internal-hooks.ts — these are distinct systems.

Recommended implementation order from recon:

1. Agent identities in openclaw.json + SOUL.md files (Config, zero code changes)
2. Pre-route-resolution hook (Wrapper, 2 core file touches)
3. Expanded hook event coverage (Wrapper, 4 additive inserts)

Rationale: No implementation should precede a map of the host repo's control
surfaces. This pass prevents reimplementing existing capability and prevents
unnecessary core file modifications.

Authority: Faheem, 2026-03-14.

---

## ADR-013 — .mcp.json Populated for VS Code Project-Scoped MCP Loading

**Date:** 2026-03-15
**Status:** Closed

**Problem:** The obsidian-vault MCP server was registered user-scoped in
~/.claude.json and confirmed Connected from the terminal. However, the
VS Code extension does not reliably load the global user-scoped
registration. It reads project-scoped configuration from .mcp.json at
repo root. The existing .mcp.json contained an empty mcpServers object,
so the vault tool did not appear in VS Code agent sessions.

**Resolution:** .mcp.json at repo root populated with the obsidian-vault
server entry using the same command and args as the user-scoped
registration. Both registrations now point to the same server and vault
path. The user-scoped registration in ~/.claude.json is retained as-is.

**Server entry written:**

- Server name: obsidian-vault
- Command: npx
- Args: -y, mcp-obsidian, vault base path
- Vault base path: /Users/faheem/Library/Mobile Documents/iCloud~md~obsidian/Documents/MyBrain

**Governance note:** Only obsidian-vault is present in .mcp.json at this
stage. This is correct per the active-server policy in
mcp-settings.json.md (PACS-IMPL-MCP-CFG-001): MCP Capability Phase 1
permits obsidian-vault only. No other server may be added without a
DECISIONS.md entry and architectural justification.

**Authority:** Faheem, 2026-03-15.

---

## ADR-014 — enableAllProjectMcpServers Enabled in settings.local.json

**Date:** 2026-03-15
**Status:** Closed

**Problem:** obsidian-vault MCP server was not appearing in VS Code agent
sessions despite .mcp.json being correctly configured. Root cause identified
as enableAllProjectMcpServers set to false in .claude/settings.local.json.
This setting causes the VS Code Claude extension to ignore .mcp.json entirely
regardless of its contents.

**Resolution:** enableAllProjectMcpServers changed from false to true in
.claude/settings.local.json. Project-scoped .mcp.json servers will now load
correctly in VS Code agent sessions.

**Authority:** Faheem, 2026-03-15.

---

## ADR-016 — Filesystem MCP Server Added to Claude Desktop Config

**Date:** 2026-03-15
**Status:** Closed

**Decision:** Added filesystem MCP server to claude_desktop_config.json
with /Users/faheem/openclaw and /Users/faheem/Projects as allowed paths.
Binary updated to direct path /opt/homebrew/bin/mcp-server-filesystem
to avoid npx ephemeral process instability (same root cause as ADR-015).
obsidian-vault entry also updated to direct binary path for consistency.

**Benefit:** Claude desktop sessions can now read repo files directly
without requiring Claude Code to paste file contents into chat. Eliminates
a full round trip from every file review workflow.

**Authority:** Faheem, 2026-03-15.

---

## ADR-017 — Filesystem Server Added to .mcp.json for Claude Code Vault Access

**Date:** 2026-03-15
**Status:** Closed

**Problem:** Claude Code CLI was loading the filesystem MCP server with only
/Users/faheem/openclaw as an allowed directory because .mcp.json at repo root
did not include the filesystem server. The vault path was only in ~/.claude.json
which is overridden by the project-scoped .mcp.json when running from the repo.

**Resolution:** Filesystem server entry added to .mcp.json with three allowed
paths: /Users/faheem/openclaw, /Users/faheem/Projects, and the vault path.
Claude Code now has vault access through the project-scoped config without
depending on ~/.claude.json.

**Authority:** Faheem, 2026-03-15.

---

## ADR-019 — MCP-First File Access Rule Added to CLAUDE.md

**Date:** 2026-03-15
**Status:** Closed

**File modified:** CLAUDE.md at 20:45:48 on 2026-03-15

**Decision:** Added MCP-First File Access section to CLAUDE.md establishing
two rules: (1) when the obsidian-vault MCP server is Connected, all vault
file reads must use read_text_file via the MCP interface — bash cat on vault
paths is prohibited while MCP is active; (2) if obsidian-vault MCP tools
are not available in a session, use the native Read tool with full absolute
vault path as fallback — never block on MCP unavailability, surface the
MCP issue to Faheem separately.

**Rationale:** Claude Code was defaulting to bash cat commands for vault
reads despite MCP being available, bypassing the governed MCP access layer
and creating an unobservable access pathway. The rule closes this gap.
The fallback clause was added because MCP tools intermittently fail to
expose in sessions due to server lifecycle issues (see ADR-015), and
blocking all vault access on MCP availability would halt build work
unnecessarily. The native Read tool is a safe fallback that does not
bypass governance — it is simply a different access mechanism.

**Authority:** Faheem, 2026-03-15.

---

## ADR-018 — RAG Workflow Consistency Model: Conditional Qdrant Ingestion

**Date:** 2026-03-16
**Status:** Closed

**Decision:** Qdrant ingestion for a designated artifact is conditional on at least one authorized Knowledge Graph entry that references the same source_artifact_id as the chunks being ingested. KG ingestion executes first. Qdrant ingestion proceeds only after at least one entity achieves authorization_outcome = authorized. If all KG candidates are rejected, Qdrant ingestion is cancelled. If all are held, ingestion is suspended until resolution.

**Source:** Resolves the open design question explicitly deferred from Vector-Store-Selection.md Section 5 (PACS-DATA-VSS-001 v1.0.0).

**Rationale:** Retrieval sequence integrity (Phase 1 must be able to identify the artifact before Phase 2 retrieves from it), governed ingestion principle (unverified content must not enter the active retrieval corpus), and Context Package coherence (cross-layer linkage requires matching source_artifact_id in both graph and vector stores).

**Authority:** Faheem, 2026-03-16.

---

## ADR-020 — KNOWLEDGE_GRAPH_UPDATE_EMITTED Taxonomy Supersession

**Date:** 2026-03-16
**Status:** Closed

**Decision:** The taxonomy pre-registration KNOWLEDGE_GRAPH_UPDATE_EMITTED (PACS-OBS-001) is retired. The Locus event model (PACS-OBS-AEM-006) supersedes it with four distinct emission events: EXTRACTION_CANDIDATE_FORMED (A1), LINK_CANDIDATE_FORMED (A2), QUERY_RESULT_EMITTED (A3), and DECISION_LOG_ENTRY_EMITTED (A4). These four events collectively cover the observable emission surface that the single placeholder represented. The supersession is recorded in Telemetry.md Section 3 correction C-08.

**Rationale:** A single placeholder event cannot carry the semantic precision required for audit, calibration, and governance surfaces across four distinct actuators with different downstream consumers and routing behaviors. The Locus model's four-event registry is the correct implementation-grade specification.

**Authority:** Faheem, 2026-03-16.

---

## ADR-021 — The Bridge Registered as Named Agent in openclaw.json

**Date:** 2026-03-16
**Status:** Closed

**Decision:** The Bridge is registered as a named agent entry in ~/.openclaw/openclaw.json under agents.list with agent ID 'the-bridge', enabled: true, model claude-opus-4-6, isolated workspace at ~/.openclaw/workspace/the-bridge/, agent directory at ~/.openclaw/agents/the-bridge/, and subagents.allowAgents: [] enforcing the no-spawning constraint at the OpenClaw level.

**Rationale:** The Bridge is the control-plane authority for Continuum. It requires a named, isolated agent registration separate from the default main agent. The subagents.allowAgents: [] entry enforces the identity-level constraint that The Bridge does not spawn sub-agents — routing to domain agents goes via A1 route_task, not via spawning. The enabled flag allows safe activation and deactivation without removing the registry entry.

**Authority:** Faheem, 2026-03-16.

---

## ADR-022 — Meta-Evaluation Checkpoint Registered as Named Agent in openclaw.json

**Date:** 2026-03-16
**Status:** Closed

**Decision:** The Meta-Evaluation Checkpoint (MEC) is registered as a named agent entry in ~/.openclaw/openclaw.json under agents.list with agent ID 'mec', enabled: true, model claude-opus-4-6, isolated workspace at ~/.openclaw/workspace/mec/, agent directory at ~/.openclaw/agents/mec/, and subagents.allowAgents: [] enforcing the no-spawning constraint at the OpenClaw level.

**Rationale:** The MEC is the constitutional adjudication authority for Continuum. It adjudicates above The Bridge but does not direct it. It requires a named, isolated agent registration. The subagents.allowAgents: [] entry enforces the identity-level constraint that the MEC does not spawn sub-agents — A3 escalates directly to human review. The enabled flag allows safe deactivation without removing the registry entry.

**Authority:** Faheem, 2026-03-16.

---

## ADR-023 — Gauge Registered as Named Agent in openclaw.json

**Date:** 2026-03-16
**Status:** Closed

**Decision:** Gauge is registered as a named agent entry in ~/.openclaw/openclaw.json under agents.list with agent ID 'gauge', enabled: true, model claude-opus-4-6, isolated workspace at ~/.openclaw/workspace/gauge/, agent directory at ~/.openclaw/agents/gauge/, and subagents.allowAgents: [] enforcing the no-spawning constraint at the OpenClaw level.

**Rationale:** Gauge is the system's measurement and reporting agent. It reads telemetry through the Observability Layer query surface, computes metrics against locked formula definitions, and emits structured output for Bridge-governed delivery. It has measurement authority only. The subagents.allowAgents: [] entry enforces the constraint that Gauge does not spawn sub-agents. The enabled flag allows safe deactivation without removing the registry entry.

**Authority:** Faheem, 2026-03-16.

---

## ADR-024 — Locus Registered as Named Agent in openclaw.json

**Date:** 2026-03-16
**Status:** Closed

**Decision:** Locus is registered as a named agent entry in ~/.openclaw/openclaw.json under agents.list with agent ID 'locus', enabled: true, model claude-opus-4-6 (scaffolding runtime — Tier-2 SLM constraint governs operational deployment environment per PACS-PEAS-AGT2-001), isolated workspace at ~/.openclaw/workspace/locus/, agent directory at ~/.openclaw/agents/locus/, and subagents.allowAgents: [] enforcing the no-spawning constraint at the OpenClaw level.

**Rationale:** Locus is the shared knowledge infrastructure for Continuum. It ingests designated artifacts, extracts entities and relationships under Tier-2 SLM constraint, maintains the persistent cross-domain knowledge graph, and surfaces connections on request. All graph writes route through Bridge MEMORY_COMMIT_AUTH and MEC adjudication. Contradiction surfacing routes through a separate contradiction review pathway. Graph-Schema.md prerequisite (PACS-ARCH-GRAPH-001 v1.0.0) is satisfied.

**Authority:** Faheem, 2026-03-16.

---

## ADR-025 — Crucible Registered as Named Agent in openclaw.json

**Date:** 2026-03-16
**Status:** Closed

**Decision:** Crucible is registered as a named agent entry in ~/.openclaw/openclaw.json under agents.list with agent ID 'crucible', enabled: true, model claude-opus-4-6, isolated workspace at ~/.openclaw/workspace/crucible/, agent directory at ~/.openclaw/agents/crucible/, and subagents.allowAgents: [] enforcing the no-spawning constraint at the OpenClaw level.

**Rationale:** Crucible is Continuum's persistent mastery engine for the science and engineering of agentic systems. It delivers scientifically grounded instruction and evaluates tutoring effectiveness through a governed Reflexion loop. All reflection candidates route through Bridge MEMORY_COMMIT_AUTH and MEC adjudication. Curriculum advancement requires demonstrated learner evidence only — inferred comprehension is not a valid basis. Premature closure is the primary epistemic failure mode. The subagents.allowAgents: [] entry enforces the no-spawning constraint.

**Authority:** Faheem, 2026-03-16.

---

## ADR-026 — Foundry Registered as Named Agent in openclaw.json

**Date:** 2026-03-16
**Status:** Closed

**Decision:** Foundry is registered as a named agent entry in ~/.openclaw/openclaw.json under agents.list with agent ID 'foundry', enabled: true, model claude-opus-4-6, isolated workspace at ~/.openclaw/workspace/foundry/, agent directory at ~/.openclaw/agents/foundry/, and subagents.allowAgents: [] enforcing the no-spawning constraint at the OpenClaw runtime level. SOUL.md and AGENTS.md are provisioned at ~/.openclaw/agents/foundry/. The Bridge AGENTS.md governed registry is updated to mark Foundry ACTIVE with full routing eligibility.

**Rationale:** Foundry is Continuum's engineering synthesis engine responsible for converting validated knowledge into governed PACS architectural artifacts. Three pre-conditions were required before Foundry scaffolding: Pre-condition A (pre-route hook in src/hooks/internal-hooks.ts and src/routing/resolve-route.ts, commit 5cd4f57c1), Pre-condition B (governed agent registry enforced at runtime via src/routing/governed-registry.ts, commit 7041f67fb), and Pre-condition C (Governed-Spawning-Pathway.md LOCKED as PACS-ARCH-SPAWN-001, commit 7921f171e). All three are complete. The subagents.allowAgents: [] entry enforces the no-spawning constraint. Sub-agent spawning requires explicit authorization under PACS-ARCH-SPAWN-001 before openclaw.json may be modified. Foundry does not select between options it generates — selection authority belongs to The Bridge. Silent absorption (detecting a conflict without surfacing it) is Foundry's named failure mode and is observable via I-002 SILENT_ABSORPTION_DETECTED.

**Authority:** Faheem, 2026-03-16.

---

## ADR-027 — Signal Registered as Named Agent in openclaw.json

**Date:** 2026-03-16
**Status:** Closed

**Decision:** Signal is registered as a named agent entry in ~/.openclaw/openclaw.json under agents.list with agent ID 'signal', enabled: true, model claude-opus-4-6, isolated workspace at ~/.openclaw/workspace/signal/, agent directory at ~/.openclaw/agents/signal/, and subagents.allowAgents: [] enforcing the no-spawning constraint at the OpenClaw runtime level. SOUL.md and AGENTS.md are provisioned at ~/.openclaw/agents/signal/. The Bridge AGENTS.md governed registry is updated to mark Signal ACTIVE.

**External Perception Boundary Authorization:** Signal is the first and only agent in Continuum authorized to cross the system boundary into the ungoverned external environment. This authorization is narrow and governed: Signal may access the external research frontier exclusively through the retrieval tool surface defined in the Bridge operational configuration (E6 — web retrieval, academic paper search, ArXiv monitoring, structured RSS or API feeds from designated research sources). Signal may not extend its tool surface autonomously. Any addition to the approved source list requires Bridge authorization. All other Continuum agents operate entirely within the governed internal system. Signal is the mechanism by which new exogenous knowledge enters the system at all. This architectural fact is recorded here as a durable decision record. Any future agent granted external perception authority requires a new ADR explicitly authorizing that boundary crossing.

**Rationale:** Signal is Continuum's frontier intelligence scout, responsible for monitoring, retrieving, and structuring cutting-edge research in agentic systems science and engineering. Signal is schedule-driven, not work-order-driven — its weekly cycle is its activation trigger. The Bridge governs Signal through configuration ownership (retrieval scope, source list, schedule, relevance rubric, relevance threshold, brief format) rather than task assignment. Signal performs Gate 2 scope alignment only. Gate 3 epistemic evaluation belongs to Crucible. All Signal output is classified as exogenous and unvalidated upon deposit. The only authorized deposit surface is the Exogenous Intelligence Intake Queue. Signal's perceptual boundary ends at the deposit confirmation — it has no visibility into downstream validation outcomes. This structural limitation is intentional: downstream feedback visibility would bias retrieval toward already-validated material and collapse frontier discovery into a validation echo loop. Retrieval scope drift (threshold creep, unauthorized source expansion, scope misclassification) is Signal's primary governance risk. Fail-closed rule: uncertain items are filtered and logged, not deposited.

**Authority:** Faheem, 2026-03-16.

---

## ADR-028 — Vault Registered as Named Agent in openclaw.json

**Date:** 2026-03-16
**Status:** Closed

**Decision:** Vault is registered as a named agent entry in ~/.openclaw/openclaw.json under agents.list with agent ID 'vault', enabled: true, model claude-opus-4-6, isolated workspace at ~/.openclaw/workspace/vault/, agent directory at ~/.openclaw/agents/vault/, and subagents.allowAgents: [] enforcing the no-spawning constraint at the OpenClaw runtime level. SOUL.md and AGENTS.md are provisioned at ~/.openclaw/agents/vault/. The Bridge AGENTS.md governed registry is updated to mark Vault ACTIVE. Vault completes Stage 2 agent scaffolding — all eight Continuum agents are now provisioned and registered.

**Sandbox Enforcement Status:** sandbox.mode: "all" is configured in the Vault openclaw.json entry, enabling Docker sandboxing for all Vault sessions. This field name was confirmed against src/config/zod-schema.agent-runtime.ts (AgentSandboxSchema — mode: "off" | "non-main" | "all"). A tools.deny list is configured at the OpenClaw agent entry level, denying the following tools at the runtime layer: exec, process, browser, canvas, gateway, nodes. These denials implement Charter Section 9 non-negotiables (no direct brokerage execution, no autonomous capital deployment, no hidden execution pathways) as enforced runtime constraints. The specific Bridge-governed deny list and allow list (per PEAS Section 2.3 — Bridge ownership of sandbox mode and deny list) are Phase 2 governance deliverables. The scaffolding-time deny list establishes the constitutional baseline. The full per-source allow list governing which external financial data providers Vault may access is a Phase 2 Bridge configuration artifact.

**Agent Layer Completion:** Vault is the eighth and final Stage 2 agent. All three core system boundaries are now online: The Bridge and MEC (governance and orchestration), Gauge (process discipline monitoring), Locus (knowledge infrastructure), Crucible (epistemic learning domain), Foundry (engineering synthesis domain), Signal (frontier intelligence domain), and Vault (financial intelligence domain). The governed agent registry (PACS-ARCH-REGISTRY-001, src/routing/governed-registry.ts) includes vault in the authorized Set — this was established at registry creation and requires no change.

**Vault Identity Constraints — Charter Anchors:** Vault is governed by Charter Section 6 (Financial Governance Principles: capital protection precedes growth, retirement and speculative activities remain structurally separated, rule violations trigger automatic cooldown periods) and Charter Section 9 (Non-Negotiables: no margin trading, no autonomous capital deployment, no hidden execution pathways, no credential exposure in logs, no bypassing defined risk thresholds). These are identity-level constraints that cannot be authorized away by Bridge configuration or Faheem instruction. Vault is a risk governor first, financial intelligence system second. The advisory boundary between Vault's analysis and Faheem's capital decisions is constitutional, not preferential.

**Rationale:** Vault is Continuum's financial strategy and economic intelligence engine. Three intelligence engines (Economic Regime, Cross-Market, Narrative Intelligence) produce advisory intelligence products across six emission actuators (A1–A6). All A1 strategic recommendations route through the Intelligence Quality Gate before Bridge delivery. Capital segregation between retirement and trading partitions is enforced at the perceptual level via S2. Persistent miscalibration is measured externally by the calibration evaluation pipeline across three P2 surfaces (P2a, P2b, P2c). Vault cannot observe its own analytical drift — that is the structural reason P2 calibration evaluation exists as governed infrastructure outside Vault's sandbox. The Intelligence Quality Gate supersedes the Thesis Documentation Gate from PEAS v1.0.0 with expanded coverage across all four output types. The subagents.allowAgents: [] entry enforces the no-spawning constraint.

**Authority:** Faheem, 2026-03-16.

---

## ADR-029 — Native Read Tool Added to TAR-005 Enforcement Coverage

**Date:** 2026-03-20
**Files:** `continuum/governance/tar-read-enforcement.ts`
**Commit:** `49cc34ead` (Work Order 6D)
**PENDING entries resolved:** tar-read-enforcement.ts 20:37:38, 20:37:46, 20:38:17

**What changed:**

- `TAR005_OPERATIONS` Set: added `"read"` alongside `"mcp__filesystem__read_file"` and `"mcp__filesystem__read_text_file"`
- `extractReadPath()`: added `"file_path"` as a recognized parameter name (alongside `"path"`, `"target"`, `"directory"`)
- `tarFilesystemReadBeforeToolCallHandler()`: added identity mapping so `operationName = "read_file"` when incoming tool name is `"read"`, normalizing to the TAR capability row name before enforcement runs

**Why smallest safe patch:**
TAR-005 previously covered only MCP-prefixed read operations. OpenClaw's native `read` tool bypassed TAR-005 enforcement entirely — a structural capability gap. The patch extended the existing `tarFilesystemReadBeforeToolCallHandler` function; no new enforcement path was created. The `operationName` identity mapping is a one-line normalization that keeps TAR lookup logic and all four enforcement steps (capability resolution → agent auth → scope → vault-fallback prohibition) unchanged.

**Alternative rejected:**
Creating a separate `tarNativeReadHandler()` was considered. Rejected because two enforcement paths for the same TAR-005 row create divergence risk. The TAR entry covers `read_file` capability regardless of whether the call arrives via MCP or native tool. One handler, one lookup, one enforcement surface is the correct architectural pattern per PACS-ARCH-TAR-001.

**Architectural trace:**

- PACS-ARCH-TAR-001: TAR-005 `read_file` capability row, authorized agents the-bridge and foundry, path scoped to authorized filesystem envelope; capability surface must be fully enumerated
- PACS-IMPL-STAGE3-001 Work Order 4: TAR-005 and TAR-007 enforcement surfaces
- ARCH-ADR-003: capability allowlist architecture — all tool access must resolve through TAR before execution; unregistered paths are containment failures
- ADR-028 (DECISIONS.md): Vault sandbox enforcement establishes that runtime tool denials implement Charter Section 9 non-negotiables — TAR-005 scope enforcement is the governance-layer complement

---

## ADR-030 — Auditability Hardening: task_id/trace_id in Filesystem Read Log + Test Coverage

**Date:** 2026-03-20
**Files:** `continuum/governance/tar-read-enforcement.ts`, `continuum/governance/tar-read-enforcement.test.ts`
**Commit:** `49cc34ead` (Work Order 6D)
**PENDING entries resolved:** tar-read-enforcement.test.ts 20:38:58, 20:39:41; tar-read-enforcement.ts 20:50:38, 20:53:03, 20:54:15, 20:54:21

**What changed:**

- `tar-read-enforcement.ts` — `tarFilesystemReadBeforeToolCallHandler()`: log output now includes `task_id` and `trace_id` extracted from hook context (`ctx.runId`, `ctx.sessionId`/`ctx.sessionKey`), defaulting to `"no-task-id"` / `"no-trace-id"` when absent
- `tar-read-enforcement.test.ts`: added 3 tests covering (a) scope violation blocked for native `read`, (b) in-scope native `read` passes, (c) non-read tool passes through without enforcement

**Why smallest safe patch:**
The log statement already existed; the correlation fields were already present in the hook context type. Adding `task_id`/`trace_id` requires no interface change. The three tests target exactly the new branch (`TAR005_OPERATIONS.has("read")`) introduced in ADR-029; no existing test path was modified.

**Important scope clarification — audit chain vs. subsystem log:**
`tarFilesystemReadBeforeToolCallHandler()` writes enforcement decisions (both passes and blocks, for both MCP filesystem reads and native `read`) to the subsystem log via `log.info()`. This handler does not call `auditLog.write()` directly. MCP filesystem read calls also pass through `tarBeforeToolCallHandler` in `tar-hook.ts`, which calls `emitInvocationRecord()` and therefore produces an audit chain entry — see ADR-031. Native `read` tool calls do not pass through `tarBeforeToolCallHandler` (that handler returns early for non-MCP tools via `parseMcpToolName`), so native `read` enforcement decisions are written to the subsystem log only and do not produce audit chain entries at this stage.

**Alternative rejected:**
Adding `auditLog.write()` inside `tarFilesystemReadBeforeToolCallHandler()` for every TAR-005 decision was considered. Rejected for two reasons: (1) MCP filesystem reads would then produce duplicate audit entries — one from this handler and one from `emitInvocationRecord()` in `tarBeforeToolCallHandler`; (2) native `read` passes are high-frequency and the audit chain is designed for governance events. If native `read` audit coverage is later required, the correct path is wiring `emitInvocationRecord()` into `tarFilesystemReadBeforeToolCallHandler` once the duplication issue for MCP reads is resolved.

**Architectural trace:**

- PACS-ARCH-TAR-001: enforcement decisions must carry correlation identifiers (task_id, trace_id) at all governance surfaces
- PACS-IMPL-STAGE3-001: test coverage requirement — every new enforcement branch must have a corresponding positive and negative test
- PACS-ARCH-ACM-001: agent context model defining taskId (runId) and traceId (sessionId/sessionKey) as the canonical correlation fields

---

## ADR-031 — Fail-Closed Governance Wiring: MEC Guard + Audit Log in enforceProtectedDecision; Audit Chain for MCP Tool Invocations

**Date:** 2026-03-20
**Files:** `continuum/governance/tar-hook.ts`, `continuum/governance/continuum-governance-plugin.ts`
**Commit:** `85f3fa51a` (INJ-005/INJ-021 pass)
**PENDING entries resolved:** tar-hook.ts 21:12:53, 21:13:07; continuum-governance-plugin.ts 21:13:14, 21:13:25

**What changed:**

- `tar-hook.ts` — `emitInvocationRecord()`: added `auditLog.write()` call, writing `decision_class: "routing"` for every TAR invocation record produced by `tarBeforeToolCallHandler`. Called for both allowed and denied MCP tool calls; the audit entry captures capability_id, operation_name, outcome, and denial_reason when present.
- `continuum-governance-plugin.ts` — added `enforceProtectedDecision()`: sequences MEC availability check (`mecAvailabilityGuard.checkDecision()`) → audit log write (`auditLog.write()`). Returns `{allowed: true, entry_id}` or `{allowed: false, reason}`. Called before any SUMMARY_EMISSION, MEMORY_COMMIT_AUTH, or ESCALATION_DECISION class decision.

**Important scope clarification — what `emitInvocationRecord()` covers:**
`emitInvocationRecord()` is called exclusively from `tarBeforeToolCallHandler`. That handler begins with `if (!parsed.isMcp) { return; }` — it returns immediately for non-MCP tool names. `parseMcpToolName("read")` returns `{isMcp: false}`, so native `read` tool calls skip `tarBeforeToolCallHandler` entirely and do not produce audit chain entries through this path. The `auditLog.write()` in `emitInvocationRecord()` therefore covers MCP tool invocation records only. (See ADR-030 for the separate treatment of native `read` enforcement logging.)

**Why smallest safe patch:**
INJ-005 (Audit Chain Integrity) and INJ-021 (MEC Fail-Closed) required that the enforcement path be tamper-evidenced and MEC-gated respectively. The two operations were composed in sequence inside a single new function rather than scattered across call sites. `emitInvocationRecord()` received the audit write because it is the single choke point for all MCP TAR decisions — no new call sites needed, and all future MCP tool registrations automatically inherit the audit write.

**Alternative rejected:**
Wiring audit writes directly at each TAR handler call site was considered. Rejected because it duplicates the write path across N handlers and creates a gap whenever a new handler is added. Centralizing in `emitInvocationRecord()` means the audit write is structurally guaranteed for all current and future MCP TAR paths.

**Architectural trace:**

- PACS-IMPL-STAGE3-001 INJ-005 (Audit Chain Integrity): MCP tool invocation records must be written to the tamper-evident audit chain; enforcement cannot be observability-only
- PACS-IMPL-STAGE3-001 INJ-021 (MEC Fail-Closed): MEC unavailability must block protected decision classes (SUMMARY_EMISSION, MEMORY_COMMIT_AUTH, ESCALATION_DECISION), not degrade silently
- ADR-003 (DECISIONS.md): hook-based governance enforcement is the deterministic constraint layer; `enforceProtectedDecision()` is the hook-layer implementation of the MEC gate for protected decisions
- ARCH-ADR-003 and PACS-IMPL-STAGE3-001: protected decision execution is fail-closed and audit-visible; enforceProtectedDecision() is the runtime implementation point

---

## ADR-032 — Runtime Scope Correction: group:plugins Narrowed to Named MCP Servers

**Date:** 2026-03-20
**Files:** `~/.openclaw/openclaw.json` (system configuration, outside repo)
**Commit:** `239618c28` (STATE.md reflects resolution; openclaw.json is not version-controlled)
**PENDING entries resolved:** (no DECISIONS.md stub — ADR documents the change retroactively)

**What changed:**
The Bridge agent tools.alsoAllow field in openclaw.json was changed from `["group:plugins"]` to `["mcp__obsidian-vault", "mcp__filesystem"]`. `group:plugins` is a breadth selector that would authorize any plugin registered at runtime, including future plugins not yet enumerated in the TAR. The two named values correspond exactly to the two MCP servers with active TAR rows: obsidian-vault (TAR-001 through TAR-004) and filesystem (TAR-005 through TAR-008).

**Why smallest safe patch:**
The change is a one-field substitution in openclaw.json. No TAR entries were modified. No enforcement logic was changed. The two named servers are the only MCP servers with TAR coverage; the substitution makes the `alsoAllow` list structurally congruent with the TAR's actual enumeration across all eight active rows.

**Alternative rejected:**
Keeping `group:plugins` and relying on TAR enforcement to block non-enumerated servers was considered. Rejected because TAR is an allowlist architecture — unknown tools are blocked by absence of a TAR entry. However, `group:plugins` as a runtime selector means any newly registered plugin is admitted to the tool surface before a TAR row can be created for it. That window violates the enumeration requirement: the capability surface must be fully declared before any session that could invoke it. Named server entries eliminate the window entirely.

**Architectural trace:**

- PACS-ARCH-TAR-001: capability surface must be fully enumerated; wildcard selectors that exceed the active TAR enumeration are containment failures; obsidian-vault covers TAR-001 through TAR-004, filesystem covers TAR-005 through TAR-008
- ADR-028 (DECISIONS.md): Vault registration establishes the tools.deny list at the openclaw.json agent entry level — the `alsoAllow` correction applies the same principle of explicit enumeration at the plugin scope level
- ARCH-ADR-003: capability allowlist architecture — known-enumerated tools only, fail-closed on unknowns
- System Charter Section 4 (agent capability boundaries are fixed at configuration time, not dynamically expanded): `group:plugins` violates this by making the capability boundary dynamic

---

## ADR-033 — Level 1 Constitutional Boundary Detection Modules Added for Round 2 Validation

**Date:** 2026-03-21
**Files:**

- `continuum/governance/vlt-002-gate-bypass.ts`
- `continuum/governance/mec-006-bypass-detection.ts`
- `continuum/governance/vlt-006-segregation.ts`
- `continuum/governance/g-002-deny-list.ts`
- `continuum/governance/mec-004-reconciliation-authority.ts`

**Commit:** `85f3fa51a` (Stage 3 Round 2 — INJ-001 INJ-002 INJ-003 INJ-004 INJ-023 all pass)
**PENDING entries resolved:** vlt-002-gate-bypass.ts 10:55:55, mec-006-bypass-detection.ts 10:56:36, vlt-006-segregation.ts 10:56:55, g-002-deny-list.ts 10:57:20, mec-004-reconciliation-authority.ts 10:57:35

**What changed:**
Five focused detection modules were added, one per Level 1 constitutional boundary rule validated in PACS-VALIDATION-001 Round 2:

- `vlt-002-gate-bypass.ts` — `Vlt002GateBypassDetector`: detects STRATEGIC_RECOMMENDATION_EMITTED events lacking a `gate_validation_event_id`. Emits RULE_VIOLATION_ALERT_EMITTED (rule_id: VLT-002, producer: Vault) and halts the affected pathway. Implements the Intelligence Quality Gate bypass surface (INJ-001).

- `mec-006-bypass-detection.ts` — `Mec006BypassDetector`: detects protected decision execution (SUMMARY_EMISSION, MEMORY_COMMIT_AUTH, ESCALATION_DECISION) with no paired ADJUDICATION_COMPLETED (outcome=approved) in the adjudication registry. Emits GOVERNANCE_ESCALATION_EMITTED (rule_id: MEC-006, bypass_bridge: true) and writes to the tamper-evident audit chain. Implements MEC governance bypass detection (INJ-002).

- `vlt-006-segregation.ts` — `Vlt006SegregationDetector`: detects PORTFOLIO_ANALYSIS_EMITTED events that reference both the retirement and trading partitions simultaneously without a CROSS_PARTITION_AUTHORIZATION_GRANTED event. Emits RULE_VIOLATION_ALERT_EMITTED (rule_id: VLT-006, producer: Vault) and halts the analysis cycle. Implements capital segregation enforcement (INJ-003).

- `g-002-deny-list.ts` — `G002DenyListDetector`: checks attempted actions against VAULT_DENY_LIST (exec, process, browser, canvas, gateway, nodes from ADR-028; margin_trading, autonomous_capital_deployment, direct_brokerage_execution, external_financial_write from Charter Section 9). On match, emits GOVERNANCE_ESCALATION_EMITTED (rule_id: G-002, bypass_bridge: true, execution_occurred: false) and writes to the tamper-evident audit chain. The action is structurally blocked with no execution pathway. Implements deny list breach detection (INJ-004).

- `mec-004-reconciliation-authority.ts` — `Mec004ReconciliationAuthorityDetector`: detects Bridge configuration modification events lacking a `faheem_authorization_record_id`. Emits GOVERNANCE_ESCALATION_EMITTED (rule_id: MEC-004, bypass_bridge: true, modification_blocked: true). Implements governance directionality enforcement for external service configuration push attempts (INJ-023).

**Why grouped as a single ADR:**
All five modules belong to Round 2 Level 1 containment validation. They were authored together as a single architectural deliverable — the detection surface layer required before PACS-VALIDATION-001 Round 2 injections could execute. They are a single coherent concern: extending the governance detection surface to cover the five constitutional boundaries that Round 2 tests. Splitting them across five ADRs would fragment the decision record without adding clarity.

**Why smallest safe patch:**
One detector class per rule, no generalized speculative detection framework. Each class exposes exactly the interface its corresponding test requires: a single `check*()` method, `_resetForTesting()`, and a singleton export. No logic is shared across detectors because the five rules operate on different event types, different payload shapes, and different escalation pathways (two emit RULE_VIOLATION_ALERT_EMITTED via Vault; three emit GOVERNANCE_ESCALATION_EMITTED via the MEC/Vault with bypass_bridge: true). Factoring a common base class would couple unrelated governance surfaces and obscure the per-rule constitutional trace.

**Alternative rejected:**
Two alternatives were considered and rejected:

1. _Monolithic detector_ — a single class handling all five rules. Rejected because the five rules have no shared state, no shared event types, and no shared escalation pathway. A monolithic class would be harder to test in isolation (each injection test must reset only its detector, not a shared instance) and would make the per-rule constitutional trace unreadable.

2. _Embedding detection logic in `continuum-governance-plugin.ts`_ — adding inline `if` checks inside the plugin's hook handlers. Rejected because the plugin is a Layer 2 orchestration artifact (enforcement wiring and hook registration). Detection logic belongs in named, testable Layer 2/3 governance modules with their own decision records. Embedding it in the plugin would conflate the detection surface with the enforcement wiring surface, making both harder to test and evolve independently.

**Architectural trace:**

- PACS-VALIDATION-001 Round 2 — INJ-001 (VLT-002 gate bypass), INJ-002 (MEC-006 governance bypass), INJ-003 (VLT-006 capital segregation), INJ-004 (G-002/VLT-007 deny list breach), INJ-023 (MEC-004 reconciliation authority): each module is the detection surface required for its corresponding injection test
- ARCH-ADR-003: capability allowlist and containment architecture — Level 1 failures are constitutional, not configurable; no authorization pathway exists for deny-listed actions or governance directionality violations
- ARCH-ADR-001 and ARCH-ADR-003: authority directionality and fail-closed enforcement — MEC-006 and MEC-004 detectors enforce that protected decisions and Bridge configuration changes require the correct upstream authorization path
- System Charter Section 6 (Financial Governance Principles): VLT-002 (strategic recommendations must pass the Intelligence Quality Gate) and VLT-006 (retirement and trading partitions must remain structurally separated at the perceptual level)
- System Charter Section 9 (Non-Negotiables): G-002 deny list includes all nine Charter Section 9 items; execution_occurred: false is a structural guarantee, not a logged assertion
- System Charter Section 3 (governance directionality): MEC-004 enforces the principle that configuration authority flows from Faheem through The Bridge; external services may not push configuration without an explicit Faheem authorization record

---

## ADR-034 — Level 2 Governance Process Failure Detection Modules Added for Round 3 Validation

**Date:** 2026-03-21
**PENDING entries resolved:** brdg-004-silent-violation.ts 11:58:57, brdg-002-untraced-routing.ts 11:59:12, brdg-007-mec-003-memory-auth.ts 11:59:33, gau-006-suppressed-anomaly.ts 11:59:52, gau-002-formula-drift.ts 12:00:11, gau-001-coverage-gap.ts 12:00:30, cru-002-reflection-evidence.ts 12:02:52, sig-005-deposit-pathway.ts 12:03:06, loc-001-graph-auth.ts 12:03:21, gau-002-formula-drift.ts 12:07:54 (implementation correction — see below)

**What changed:**
Nine focused detection modules were added, one per Level 2 governance process failure rule validated in PACS-VALIDATION-001 Round 3 (INJ-006, INJ-007, INJ-008, INJ-009, INJ-010, INJ-011, INJ-012, INJ-019, INJ-020):

- `brdg-004-silent-violation.ts` — `Brdg004SilentViolationDetector`: detects POLICY_VIOLATION_DETECTED events with no paired ESCALATION_CANDIDATE_FORMED within a report cycle window. Emits ANOMALY_ALERT_EMITTED (rule_id: BRDG-004, producer: Gauge, bridge_notified: true, anomaly_type: SILENT_VIOLATION). Window is closed by explicit `checkWindowExpiry(tick)` call. Implements silent violation surface (INJ-006).

- `brdg-002-untraced-routing.ts` — `Brdg002UntracedRoutingDetector`: detects ROUTING_DECISION_EXECUTED events with no paired ROUTING_DECISION_FORMED in the decision registry. Emits ANOMALY_ALERT_EMITTED (rule_id: BRDG-002, producer: Bridge, bridge_notified: true, anomaly_alert_emitted: true). Coverage rate is computed as (executed − untraced) / executed. Implements untraced routing detection (INJ-007).

- `brdg-007-mec-003-memory-auth.ts` — `Brdg007Mec003MemoryAuthDetector`: detects MEMORY_WRITE_EXECUTED events with no valid `commit_token` in the adjudication registry. One event fires two rule outputs: BRDG-007 (producer: Bridge, bridge_notified: true) and MEC-003 (producer: MEC, bypass_bridge: true). Only approved adjudication tokens are registered. Implements memory commit authorization enforcement (INJ-008).

- `gau-006-suppressed-anomaly.ts` — `Gau006SuppressedAnomalyDetector`: detects threshold crossings where no ANOMALY_ALERT_EMITTED is registered within the surfacing window. Emits GOVERNANCE_ESCALATION_EMITTED (rule_id: GAU-006, producer: Gauge, bridge_notified: true, suppressed_anomaly: true). Window closed by `checkWindowExpiry(tick)`. Implements suppressed anomaly detection (INJ-009).

- `gau-002-formula-drift.ts` — `Gau002FormulaVersionDetector`: detects PERFORMANCE_REPORT_EMITTED events referencing a formula_version that does not match the locked registry entry for that metric_id. `LOCKED_FORMULA_REGISTRY` is hardcoded: `{ portfolio_sharpe_ratio: { current_version: "v3" }, strategy_confidence_score: { current_version: "v2" }, drawdown_risk_index: { current_version: "v1" } }`. Matching is exact string comparison only. Emits GOVERNANCE_ESCALATION_EMITTED (rule_id: GAU-002, producer: Gauge, bridge_notified: true) with `stale_metrics: StaleMetricEntry[]`. Implements formula version drift detection (INJ-010).

- `gau-001-coverage-gap.ts` — `Gau001CoverageGapDetector`: detects when one or more registered active agents produce no telemetry for a full report cycle. Expected agents are registered via `registerActiveAgents()`; reported agents accumulate via `registerTelemetry()`. `checkWindowExpiry(tick)` closes the cycle, identifies absent agents, fires GAU-001 if any are absent, then resets the reported set for the next cycle. Alert includes `absent_agents: string[]` and `coverage_rate`. Implements coverage gap detection (INJ-011).

- `cru-002-reflection-evidence.ts` — `Cru002ReflectionEvidenceDetector`: detects REFLECTION_CANDIDATE_FORMED events where `learner_evidence_used` is null, undefined, or an empty array. Emits GOVERNANCE_ESCALATION_EMITTED (rule_id: CRU-002, producer: Crucible, bridge_notified: true). Result includes `null_reflection_count` and `evidence_linked_rate = (total − null) / total`. Implements reflection evidence enforcement (INJ-012).

- `sig-005-deposit-pathway.ts` — `Sig005DepositPathwayDetector`: detects BRIEF_DEPOSITED events where `deposit_target` is not `"exogenous_intelligence_intake_queue"` (`AUTHORIZED_DEPOSIT_TARGET`). Emits GOVERNANCE_ESCALATION_EMITTED (rule_id: SIG-005, producer: Signal, bridge_notified: true) with `actual_target` and `authorized_target`. Result includes `deposit_pathway_compliance_rate`. Implements deposit pathway integrity enforcement (INJ-019).

- `loc-001-graph-auth.ts` — `Loc001GraphAuthDetector`: detects GRAPH_WRITE_EXECUTED events with no paired GRAPH_WRITE_AUTHORIZED bearing a matching `write_id`. Emits GOVERNANCE_ESCALATION_EMITTED (rule_id: LOC-001, producer: Locus, bridge_notified: true, unauthorized_write: true). Result includes `unauthorized_write_rate`. Implements graph write authorization enforcement (INJ-020).

**Implementation correction (absorbed into this ADR):**
The second PENDING entry for `gau-002-formula-drift.ts` (12:07:54) is not a new architectural decision. It corrects a JavaScript object shorthand error in `checkPerformanceReport()` introduced during initial authoring: `stale_metrics,` was written as a shorthand property reference but the local variable is named `staleMetrics` (camelCase), causing a `ReferenceError` at runtime. The fix — `stale_metrics: staleMetrics,` — is a correction within the same decision surface. The GAU-002 detection contract, the locked formula registry shape, and the alert structure are unchanged.

**Why grouped as one ADR:**
All nine modules belong to Round 3 Level 2 governance process failure validation. They were authored together as a single architectural deliverable — the detection surface layer required before PACS-VALIDATION-001 Round 3 injections could execute. They share one architectural concern: extending the governance detection surface to cover the nine Level 2 process boundaries that Round 3 tests. Splitting them across nine ADRs would fragment the decision record without adding clarity. The `gau-002` bug-fix write has no independent architectural content and is absorbed into the same ADR rather than generating a tenth entry.

**Why smallest safe patch:**
One detector class per rule, no generalized speculative detection framework. Each class exposes exactly the interface its corresponding injection test requires: one or two `check*()`/`register*()` methods, `checkWindowExpiry(tick)` where the rule is time-window-based, `_resetForTesting()`, and a singleton export. No logic is shared across detectors. The nine rules operate on different event types, different payload shapes, and different producers (Bridge, MEC, Gauge, Crucible, Signal, Locus). Factoring a common base class would couple unrelated governance surfaces and obscure the per-rule constitutional trace. The combined module `brdg-007-mec-003-memory-auth.ts` is the sole deliberate coupling: BRDG-007 and MEC-003 share a causal surface — one MEMORY_WRITE_EXECUTED event triggers both rule outputs — so separation would require duplicate event routing with no architectural benefit.

**Alternatives rejected:**
Two alternatives were considered and rejected:

1. _Monolithic detector_ — a single class handling all nine rules. Rejected because the nine rules have no shared state, no shared event types, and no shared escalation pathway. A monolithic class would be harder to test in isolation (each injection test resets only its detector) and would make the per-rule governance trace unreadable.

2. _Embedding detection logic in `continuum-governance-plugin.ts`_ — adding inline checks inside the plugin's hook handlers. Rejected because the plugin is a Layer 2 orchestration artifact (enforcement wiring and hook registration). Detection logic belongs in named, testable governance modules with their own decision records. Embedding it in the plugin would conflate the detection surface with the enforcement wiring surface, making both harder to test and evolve independently.

**Architectural trace:**

- PACS-VALIDATION-001 Round 3 — INJ-006 (BRDG-004 silent violation), INJ-007 (BRDG-002 untraced routing), INJ-008 (BRDG-007/MEC-003 memory auth), INJ-009 (GAU-006 suppressed anomaly), INJ-010 (GAU-002 formula drift), INJ-011 (GAU-001 coverage gap), INJ-012 (CRU-002 reflection evidence), INJ-019 (SIG-005 deposit pathway), INJ-020 (LOC-001 graph write authorization): each module is the detection surface required for its corresponding injection test
- PACS-IMPL-STAGE3-001: Round 3 detection modules follow the same singleton-class pattern established in Stage 3 Round 1 and Round 2; no new architectural patterns introduced
- ARCH-ADR-003 and PACS-VALIDATION-001: Level 2 process failures escalate through the normal governance path (bridge_notified) rather than direct bypass, unless a higher-level constitutional breach is separately detected.
- System Charter Section 3 (governance directionality): BRDG-002 and BRDG-007/MEC-003 enforce that routing decisions and memory writes must trace to authorized Bridge adjudication records; untraced execution is a process failure regardless of outcome
- System Charter Section 4 (observability requirements): GAU-001 and GAU-006 enforce that active agents must produce telemetry and that threshold crossings must surface as anomaly alerts; suppression or silence in the reporting cycle is a governance process failure
