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

## PENDING RATIONALE — 2026-03-20

**File modified:** continuum/governance/tar-read-enforcement.ts
**Modified at:** 2026-03-20 20:37:38
**Governance tier:** Architecture / Constitutional
**Rationale:** REQUIRED — document the architectural decision that justifies
this change before this session closes. Uncommitted pending rationale entries
constitute a System Charter violation (no silent evolution rule).
**Review required by:** Faheem

---

## PENDING RATIONALE — 2026-03-20

**File modified:** continuum/governance/tar-read-enforcement.ts
**Modified at:** 2026-03-20 20:37:46
**Governance tier:** Architecture / Constitutional
**Rationale:** REQUIRED — document the architectural decision that justifies
this change before this session closes. Uncommitted pending rationale entries
constitute a System Charter violation (no silent evolution rule).
**Review required by:** Faheem

---

## PENDING RATIONALE — 2026-03-20

**File modified:** continuum/governance/tar-read-enforcement.ts
**Modified at:** 2026-03-20 20:38:17
**Governance tier:** Architecture / Constitutional
**Rationale:** REQUIRED — document the architectural decision that justifies
this change before this session closes. Uncommitted pending rationale entries
constitute a System Charter violation (no silent evolution rule).
**Review required by:** Faheem

---

## PENDING RATIONALE — 2026-03-20

**File modified:** continuum/governance/tar-read-enforcement.test.ts
**Modified at:** 2026-03-20 20:38:58
**Governance tier:** Architecture / Constitutional
**Rationale:** REQUIRED — document the architectural decision that justifies
this change before this session closes. Uncommitted pending rationale entries
constitute a System Charter violation (no silent evolution rule).
**Review required by:** Faheem

---

## PENDING RATIONALE — 2026-03-20

**File modified:** continuum/governance/tar-read-enforcement.test.ts
**Modified at:** 2026-03-20 20:39:41
**Governance tier:** Architecture / Constitutional
**Rationale:** REQUIRED — document the architectural decision that justifies
this change before this session closes. Uncommitted pending rationale entries
constitute a System Charter violation (no silent evolution rule).
**Review required by:** Faheem

---

## PENDING RATIONALE — 2026-03-20

**File modified:** continuum/governance/tar-read-enforcement.ts
**Modified at:** 2026-03-20 20:50:38
**Governance tier:** Architecture / Constitutional
**Rationale:** REQUIRED — document the architectural decision that justifies
this change before this session closes. Uncommitted pending rationale entries
constitute a System Charter violation (no silent evolution rule).
**Review required by:** Faheem

---

## PENDING RATIONALE — 2026-03-20

**File modified:** continuum/governance/tar-read-enforcement.ts
**Modified at:** 2026-03-20 20:53:03
**Governance tier:** Architecture / Constitutional
**Rationale:** REQUIRED — document the architectural decision that justifies
this change before this session closes. Uncommitted pending rationale entries
constitute a System Charter violation (no silent evolution rule).
**Review required by:** Faheem

---

## PENDING RATIONALE — 2026-03-20

**File modified:** continuum/governance/tar-read-enforcement.ts
**Modified at:** 2026-03-20 20:54:15
**Governance tier:** Architecture / Constitutional
**Rationale:** REQUIRED — document the architectural decision that justifies
this change before this session closes. Uncommitted pending rationale entries
constitute a System Charter violation (no silent evolution rule).
**Review required by:** Faheem

---

## PENDING RATIONALE — 2026-03-20

**File modified:** continuum/governance/tar-read-enforcement.ts
**Modified at:** 2026-03-20 20:54:21
**Governance tier:** Architecture / Constitutional
**Rationale:** REQUIRED — document the architectural decision that justifies
this change before this session closes. Uncommitted pending rationale entries
constitute a System Charter violation (no silent evolution rule).
**Review required by:** Faheem

---

## PENDING RATIONALE — 2026-03-20

**File modified:** continuum/governance/tar-hook.ts
**Modified at:** 2026-03-20 21:12:53
**Governance tier:** Architecture / Constitutional
**Rationale:** REQUIRED — document the architectural decision that justifies
this change before this session closes. Uncommitted pending rationale entries
constitute a System Charter violation (no silent evolution rule).
**Review required by:** Faheem

---

## PENDING RATIONALE — 2026-03-20

**File modified:** continuum/governance/tar-hook.ts
**Modified at:** 2026-03-20 21:13:07
**Governance tier:** Architecture / Constitutional
**Rationale:** REQUIRED — document the architectural decision that justifies
this change before this session closes. Uncommitted pending rationale entries
constitute a System Charter violation (no silent evolution rule).
**Review required by:** Faheem

---

## PENDING RATIONALE — 2026-03-20

**File modified:** continuum/governance/continuum-governance-plugin.ts
**Modified at:** 2026-03-20 21:13:14
**Governance tier:** Architecture / Constitutional
**Rationale:** REQUIRED — document the architectural decision that justifies
this change before this session closes. Uncommitted pending rationale entries
constitute a System Charter violation (no silent evolution rule).
**Review required by:** Faheem

---

## PENDING RATIONALE — 2026-03-20

**File modified:** continuum/governance/continuum-governance-plugin.ts
**Modified at:** 2026-03-20 21:13:25
**Governance tier:** Architecture / Constitutional
**Rationale:** REQUIRED — document the architectural decision that justifies
this change before this session closes. Uncommitted pending rationale entries
constitute a System Charter violation (no silent evolution rule).
**Review required by:** Faheem
