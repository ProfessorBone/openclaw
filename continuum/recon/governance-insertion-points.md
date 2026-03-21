# Governance Insertion Points — 16 Questions

**Artifact ID:** PACS-IMPL-RECON-001-S2
**Version:** 1.0.0 | 2026-03-14
**Source:** Architectural Reconnaissance Pass — Stage 6, Step 2

---

## Domain 1: Routing and Agent Selection

### Q1. How does OpenClaw decide which agent handles an incoming message?

`resolveAgentRoute()` in `src/routing/resolve-route.ts` (line 614). Operates as a tiered matching system that evaluates the `bindings[]` array from `openclaw.json` in priority order across eight tiers. First match wins.

**Exact mechanism:** Tiered binding resolution
**File:** `src/routing/resolve-route.ts`
**Configuration surface:** `openclaw.json` → `bindings` array (type `AgentBinding[]`)

Each binding specifies:

- `agentId` — target agent
- `match` — channel, accountId, peer, guildId, teamId, roles
- `type` — optional; `"route"` or `"acp"`

---

### Q2. What is a "binding" and where is it configured? What priority order governs binding resolution?

A binding is a declarative rule mapping a (channel, account, peer, guild, team, roles) tuple to a specific `agentId`. Defined in `src/config/types.agents.ts` as `AgentBinding = AgentRouteBinding | AgentAcpBinding`. Configured in `openclaw.json` root `bindings[]`.

**Priority order** (lines 723–781 of resolve-route.ts, highest to lowest):

1. `binding.peer` — exact channel/group ID match
2. `binding.peer.parent` — thread parent channel match
3. `binding.guild+roles` — guild ID + member role intersection
4. `binding.guild` — guild ID only
5. `binding.team` — Teams org ID
6. `binding.account` — account pattern, non-wildcard
7. `binding.channel` — account pattern wildcard
8. `default` — agent from `config.agents.defaults`

Within each tier, bindings are evaluated in config definition order (first match wins).

---

### Q3. Can routing decisions be intercepted or wrapped without modifying core?

**No direct routing interception point exists today.**

The hook system fires **after** route resolution, not before. Options:

- **Config approach:** Adjust `bindings[]` array — controls which agent is selected, but not the resolution algorithm
- **Wrapper approach:** Intercept at the call site of `resolveAgentRoute()` in `src/gateway/server-chat.ts` or `src/gateway/call.ts` — these are core files, not published extension surfaces

**No clean wrapper interception exists today.** The lowest-friction path is adding a `pre-resolve` hook trigger inside `resolve-route.ts` using the existing `triggerInternalHook()` pattern from `src/hooks/internal-hooks.ts`.

---

## Domain 2: Execution Approval

### Q4. What is exec-approval-manager.ts responsible for?

`ExecApprovalManager` in `src/gateway/exec-approval-manager.ts` manages the lifecycle of human authorization requests for dangerous node commands.

**What it approves/blocks:** Tool invocations requiring human authorization — specifically `system.run` commands that reach the dangerous command threshold.

**Approval trigger:** Invoked by `src/gateway/node-invoke-system-run-approval.ts` when a `system.run` command is attempted on a node.

**Key methods:**

- `create()` — creates approval record (sync)
- `register()` — registers record and returns decision promise (async)
- `resolve(recordId, decision)` — approves or denies
- `expire()` — timeout handler
- `awaitDecision()` — retrieve decision promise
- `lookupPendingId()` — find by ID or prefix match

**Approval decision types:** `"allow-once"` or implicit deny (timeout / no response).

---

### Q5. Is there an existing hook or callback that fires before tool/command execution?

**No dedicated pre-execution hook for tools.**

The approval gate is **inline logic** in `src/gateway/node-invoke-system-run-approval.ts`, not a published hook event. The internal hook system (`src/hooks/internal-hooks.ts`) exposes `message:received` and `message:sent` but no `tool:before-execute` or equivalent.

To add a pre-execution hook, the `InternalHookEventType` union in `src/hooks/internal-hooks.ts` must be extended, and a trigger must be inserted in the execution path.

---

### Q6. How does node-command-policy.ts relate to exec approval?

Two distinct sequential gates:

**Gate 1 — node-command-policy.ts (allowlist check)**

- First gate; if command is not in the per-platform allowlist, it is hard-denied with no approval option
- Configuration surface: `cfg.gateway.nodes.allowCommands` (additions) and `cfg.gateway.nodes.denyCommands` (overrides)
- Platform defaults hardcoded in `PLATFORM_DEFAULTS` constant (lines 74–116)

**Gate 2 — exec-approval-manager.ts (approval opportunity)**

- Only reached if command passes Gate 1
- Dangerous commands (defined in `DEFAULT_DANGEROUS_NODE_COMMANDS`, lines 65–72) require explicit human approval
- Non-dangerous allowed commands proceed without approval

**Not a plugin surface.** Both layers are hardcoded logic with config overrides only for Gate 1.

---

## Domain 3: Prompt Assembly

### Q7. What does agent-prompt.ts do?

`src/gateway/agent-prompt.ts` — function `buildAgentMessageFromConversationEntries()` (line 21).

**Inputs:** `ConversationEntry[]` — array of `{role, entry}` tuples where role is `"user" | "assistant" | "tool"` and entry is `HistoryEntry`.

**Output:** Formatted string representing the current message in context.

**What it is not:** This is **message content assembly** for a single turn, not the system prompt assembler. The full system prompt (constitutional block, skills, memory, tooling, etc.) lives in `src/agents/system-prompt.ts`.

---

### Q8. Where does SOUL.md get injected? What is the exact assembly order?

SOUL.md is defined as a special workspace file: `DEFAULT_SOUL_FILENAME = "SOUL.md"` in `src/agents/workspace.ts` (line 26). Injection and assembly occur in `src/agents/system-prompt.ts`.

**System prompt assembly order:**

1. Identity line (owner IDs if configured)
2. Skills section (SKILL.md descriptions, if agent has skills)
3. Memory Recall section (if `memory_search` tool is available)
4. User Identity section (authorized senders)
5. Time section (timezone if configured)
6. **→ SOUL.md content injected here** (identity/constitutional block)
7. Sandbox info (if sandbox enabled for this agent)
8. Tooling section (tool catalog)
9. Workspace section (AGENTS.md, TOOLS.md references)
10. Runtime section (model, reasoning, sandbox directives)

---

### Q9. Is prompt assembly a config surface or a core function?

**Hybrid — content is Config, structure is Core.**

**Config (no code changes required):**

- Workspace files: SOUL.md, AGENTS.md, TOOLS.md, MEMORY.md — read as-is and injected
- `openclaw.json` → `agents[i].model.systemPrompt` — prepended override
- Channel-specific system prompt overrides (Discord, Slack, etc.)

**Core change (code changes required):**

- Section order and assembly structure — fixed in `src/agents/system-prompt.ts`
- Conditional inclusion logic (e.g., "when to include memory section")
- Prompt block boundaries and formatting

**Implication for Continuum B1–B6 blocks:** Content of each block is Config. The block structure itself (ordering, separation, labeling) requires a Core change to `system-prompt.ts`.

---

## Domain 4: Memory

### Q10. How does OpenClaw's memory system work at the architectural level?

`MemoryIndexManager` in `src/memory/manager.ts`.

**Storage:** SQLite (vector chunks, FTS index, embedding cache).

**Embedding providers:** OpenAI, Gemini, Voyage, Mistral, Ollama, local embeddings.

**Write triggers:**

- **Implicit:** File watcher (`FSWatcher`, line 112) on workspace files — changes are auto-detected
- **Explicit:** `sync()` method called with optional `sessionFiles` parameter

**What controls what gets written:**

1. `cfg.agents[i].memorySearch.include` / `exclude` path patterns
2. Workspace root boundary (enforced in `src/agents/workspace.ts`)
3. Embedding provider config (batch settings, model)
4. Sync trigger (applications call `memoryManager.sync()` to commit pending files)

---

### Q11. Is there a governed pathway for memory writes?

**No. Memory writes are direct — no approval gate, no validation hook, no authorization pathway.**

- Tool execution — gated by `exec-approval-manager.ts` ✓
- Node commands — gated by `node-command-policy.ts` ✓
- Memory writes — **no governance gate** ✗

The only boundary enforcement is the workspace-root path constraint in `src/agents/workspace.ts`. A `memory:pre-sync` hook does not exist.

**To add a governance pathway:**

1. Add `"memory"` event type to `InternalHookEventType` in `src/hooks/internal-hooks.ts`
2. Add `memory:pre-sync` hook trigger in `MemoryIndexManager.sync()` in `src/memory/manager.ts`
3. Optionally extend `ExecApprovalManager` for memory approval type

This requires Core changes to two files.

---

## Domain 5: Hooks and Extension Points

### Q12. What events does hooks.ts expose?

**Note on disambiguation:** `src/gateway/hooks.ts` is the **HTTP webhook API** (external callbacks to third-party systems). The internal extension system is `src/hooks/internal-hooks.ts`.

**Internal hook events** (`src/hooks/internal-hooks.ts`):

| Event Type | Action                   | Lifecycle Position                           | Context Available                              |
| ---------- | ------------------------ | -------------------------------------------- | ---------------------------------------------- |
| `agent`    | `bootstrap`              | After workspace init, before agent execution | WorkspaceBootstrapFile[], cfg, sessionKey      |
| `gateway`  | `startup`                | Server startup                               | cfg, workspaceDir                              |
| `message`  | `received`               | Message arrives, before routing              | from, content, channelId, accountId, timestamp |
| `message`  | `sent`                   | Post-execution, message sent                 | to, content, success, error, channelId         |
| `command`  | (undocumented structure) | Command execution lifecycle                  | —                                              |
| `session`  | (undocumented structure) | Session lifecycle                            | —                                              |

---

### Q13. What is bootstrap-hooks.ts? When does it fire relative to agent startup?

`src/agents/bootstrap-hooks.ts` — function `applyBootstrapHookOverrides()`.

**Purpose:** Allows modification of agent workspace bootstrap files before agent execution begins. Takes the bootstrap file array (SOUL.md, AGENTS.md, USER.md, etc.) and allows plugins to modify it in-place.

**Lifecycle position — fires between workspace init and agent execution:**

1. Workspace discovered/created
2. **→ `applyBootstrapHookOverrides()` fires here**
3. Modified bootstrap files applied to workspace
4. Agent initialization proceeds

**Mechanism:** Creates `AgentBootstrapHookEvent` (type: `"agent"`, action: `"bootstrap"`), calls `triggerInternalHook()`, allows plugins to mutate the `bootstrapFiles` array. Returns modified files.

**Governance relevance:** This is the primary hook for injecting Continuum governance content (Bridge policy overlays, constraint declarations) into agent context before execution.

---

### Q14. Are there plugin or extension interfaces for adding behavior without modifying core?

**Yes — multiple extension points exist:**

| Surface              | File                                                  | Extension Type | Scope                                                           |
| -------------------- | ----------------------------------------------------- | -------------- | --------------------------------------------------------------- |
| Internal hook system | `src/hooks/internal-hooks.ts`, `src/plugins/hooks.ts` | Wrapper        | agent:bootstrap, gateway:startup, message:received/sent         |
| Plugin SDK           | `src/plugin-sdk/`                                     | Wrapper        | Webhook targets, guards, path filters                           |
| Channel plugins      | `src/channels/plugins/`                               | Wrapper        | Custom channel integrations (implement ChannelPlugin interface) |
| Skills               | SKILL.md files in workspace                           | Config         | Agent capability declarations                                   |
| Workspace files      | SOUL.md, AGENTS.md, TOOLS.md, MEMORY.md               | Config         | Agent identity and context                                      |
| Config surface       | `openclaw.json`                                       | Config         | Bindings, allowlists, model overrides                           |

**Missing from the extension surface (gaps):**

- Routing interception (pre-resolve hook does not exist)
- Memory write authorization (no gate exists)
- Pre-tool-execution hook (no `tool:before-execute` event)

---

## Domain 6: Security and Sandboxing

### Q15. What does src/security/ govern?

31-file module. Governance areas:

| Component        | File                                  | Mechanism                                                   |
| ---------------- | ------------------------------------- | ----------------------------------------------------------- |
| Audit logging    | `audit.ts` (46KB)                     | Comprehensive audit of agent actions, tool use, file access |
| External content | `external-content.ts`                 | Sanitizes/validates external input (web scraping, etc.)     |
| Tool audit       | `audit-tool-policy.ts`                | Tool invocation audit                                       |
| DM policy        | `dm-policy-shared.ts`                 | Direct message restrictions by channel                      |
| Dangerous tools  | `dangerous-tools.ts`                  | Flagged dangerous tool list                                 |
| Dangerous config | `dangerous-config-flags.ts`           | Unsafe config detection                                     |
| Regex safety     | `safe-regex.ts`                       | Prevents ReDoS                                              |
| Skill scanner    | `skill-scanner.ts`                    | Scans skills for security issues                            |
| FS safety        | `scan-paths.ts`, `temp-path-guard.ts` | Path boundary enforcement                                   |
| Windows ACL      | `windows-acl.ts`                      | Windows permission enforcement                              |

**Deny list mechanisms:**

| Type          | File                     | Config Surface                                      |
| ------------- | ------------------------ | --------------------------------------------------- |
| Node commands | `node-command-policy.ts` | `cfg.gateway.nodes.denyCommands` — **configurable** |
| Tools         | `dangerous-tools.ts`     | Hardcoded list — **not configurable**               |
| Channel/DM    | `dm-policy-shared.ts`    | Hardcoded per-channel rules                         |
| Skills        | `skill-scanner.ts`       | Scanner output, no config override                  |

**Security model is primarily audit-after, not pre-authorize.** Only node commands have a configurable deny list. All others are hardcoded or post-hoc audit.

---

### Q16. How is the sandbox (src/agents/sandbox/) structured?

`src/agents/sandbox/` — 14 files. Activated per-agent via `agents[i].sandbox.enabled`.

**What is sandboxed:**

- Browser execution environment (isolated from host)
- File system path bindings — explicit `src → dst` mappings via `bind-spec.ts`
- Network isolation (configurable)
- Device access (camera, microphone) — gated

**What escapes the sandbox:**

- Node command execution — governed by `exec-approval-manager`, not sandbox
- Memory / workspace file reads — direct, not bounded by sandbox
- Tool invocation — separate gate, not sandbox-enforced
- Host file system outside explicitly bound paths

**Enforcement:** `src/agents/pi-embedded-runner/` agent execution harness respects sandbox boundaries.

**Configuration:** `src/agents/sandbox/config.ts` — sandbox configuration schema. `src/agents/sandbox/config-hash.ts` — deterministic config hashing for identity.

---

_Continuum — Faheem's PAC System | Professor Bone Lab_
_Reconnaissance Pass — Stage 6 | 2026-03-14_
