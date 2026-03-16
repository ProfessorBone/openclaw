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
## PENDING RATIONALE — 2026-03-15
**File modified:** CLAUDE.md
**Modified at:** 2026-03-15 20:45:48
**Governance tier:** Architecture / Constitutional
**Rationale:** REQUIRED — document the architectural decision that justifies
this change before this session closes. Uncommitted pending rationale entries
constitute a System Charter violation (no silent evolution rule).
**Review required by:** Faheem
