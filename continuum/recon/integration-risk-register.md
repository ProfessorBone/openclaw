# Integration Risk Register — Three Lowest-Risk Starting Points

**Artifact ID:** PACS-IMPL-RECON-001-S4
**Version:** 1.0.0 | 2026-03-14
**Source:** Architectural Reconnaissance Pass — Stage 6, Step 4

---

## Selection Criteria

Each starting point was selected to satisfy all three criteria simultaneously:

1. Delivers the highest governance value to Continuum
2. Requires the fewest core source file modifications
3. Is most consistent with the repo's existing design language

---

## Starting Point 1 — Pre-Route-Resolution Hook

**Governance value: HIGH | Implementation risk: LOW**

### What it achieves

Gives the Bridge the ability to intercept and override agent routing decisions before they are committed. Enables:

- Policy-based routing re-assignment (Bridge can redirect a message to a different agent)
- Audit of all routing decisions before execution
- Bridge-enforced escalation (e.g., route to Vault if message triggers a risk condition)
- Observability of routing resolution for Gauge/Signal agents

Without this, routing is a black box from the Bridge's perspective — decisions are made and committed before any hook fires.

### Files touched

| File                           | Change type            | Change description                                                                              |
| ------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------- |
| `src/hooks/internal-hooks.ts`  | Core change (additive) | Add `"routing"` to `InternalHookEventType` union; add `RoutingPreResolveHookEvent` context type |
| `src/routing/resolve-route.ts` | Core change (additive) | Insert `triggerInternalHook()` call at line 614, before tiered matching begins                  |
| `src/plugins/hooks.ts`         | Additive               | Ensure plugin hook-runner recognizes and dispatches new `routing` event type                    |

**Total core files modified: 2** (`internal-hooks.ts`, `resolve-route.ts`)

### Extension type

**Wrapper** — no core routing logic changed. The hook is purely additive. Existing behavior is unchanged if no handlers are registered. Follows the established `triggerInternalHook()` pattern already used for `agent:bootstrap` and `message:received`.

### Upstream fork risk

**LOW**

- Internal hook system is an established OpenClaw pattern — this is a conforming extension
- No changes to config surface (`openclaw.json`)
- No changes to public API surfaces or external-facing behavior
- Purely additive (no removals, no logic changes)
- No impact on existing hook subscribers
- Conflict scenario: upstream adds its own pre-resolve hook — merge conflict is a single function call, trivially resolvable

---

## Starting Point 2 — Expanded Hook Event Coverage

**Governance value: MEDIUM | Implementation risk: LOW**

### What it achieves

Adds hook triggers for events currently unobservable by plugins:

- `tool:pre-execute` — fires before any tool invocation
- `memory:pre-sync` — fires before memory write commits
- `prompt:pre-assemble` — fires before system prompt is assembled

Creates a comprehensive agent behavior observability surface. Directly enables:

- Signal agent to observe all agent activity without polling
- Gauge agent to capture timing and event data for all lifecycle phases
- Bridge to receive notifications of tool invocations in real time
- Future: any hook handler can also block execution (veto) if return value is respected

Does not change any logic — only adds notification points. Existing behavior is unchanged if no handlers are registered.

### Files touched

| File                                             | Change type            | Change description                                                                            |
| ------------------------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------- |
| `src/hooks/internal-hooks.ts`                    | Core change (additive) | Expand `InternalHookEventType` union; add context types for `tool`, `memory`, `prompt` events |
| `src/gateway/node-invoke-system-run-approval.ts` | Core change (additive) | Insert `tool:pre-execute` hook trigger ~line 30, before approval gate                         |
| `src/agents/system-prompt.ts`                    | Core change (additive) | Insert `prompt:pre-assemble` hook trigger ~line 50, before assembly begins                    |
| `src/memory/manager.ts`                          | Core change (additive) | Insert `memory:pre-sync` hook trigger ~line 72, before `sync()` commits                       |

**Total core files modified: 4** (all additive inserts only)

### Extension type

**Wrapper** — purely additive. No logic changes. No existing behavior affected. All four modifications are single-line `triggerInternalHook()` calls following the established pattern.

### Upstream fork risk

**LOW**

- No removals, no algorithm changes, no config surface impact
- Hook pattern is already established and maintained by upstream
- Four insertion points are isolated (no surrounding logic changed)
- Conflict scenario: upstream adds its own hooks at the same locations — merge conflict is a line-order disagreement, trivially resolvable

---

## Starting Point 3 — Continuum Agent Identities via Config + Workspace Files

**Governance value: HIGH | Implementation risk: NONE**

### What it achieves

Registers all seven Continuum agents in `openclaw.json` and provisions their workspace identity files before any code is written. Establishes:

- Agent IDs and model assignments for Bridge, Crucible, Locus, Foundry, Signal, Gauge, Vault
- Routing bindings for each agent (which channels/accounts route to which agent)
- Constitutional identity (SOUL.md) for each agent
- Capability declarations (AGENTS.md) for each agent

This is a prerequisite for all subsequent Continuum work. No other implementation step can proceed meaningfully until agent identities are registered. It is also the only starting point with zero code changes.

### Files touched

| File                      | Change type | Change description                                                   |
| ------------------------- | ----------- | -------------------------------------------------------------------- |
| `openclaw.json`           | Config      | Add seven agent entries with IDs, model config, and routing bindings |
| `agents/bridge/SOUL.md`   | New file    | Bridge constitutional identity and governance authority declaration  |
| `agents/crucible/SOUL.md` | New file    | Crucible identity (execution agent)                                  |
| `agents/locus/SOUL.md`    | New file    | Locus identity (research agent)                                      |
| `agents/foundry/SOUL.md`  | New file    | Foundry identity (builder agent — this session)                      |
| `agents/signal/SOUL.md`   | New file    | Signal identity (communication agent)                                |
| `agents/gauge/SOUL.md`    | New file    | Gauge identity (observability agent)                                 |
| `agents/vault/SOUL.md`    | New file    | Vault identity (memory/state agent)                                  |
| `agents/[name]/AGENTS.md` | New files   | Per-agent capability declarations (7 files)                          |

**Total core files modified: 0**

### Extension type

**Config** — zero code changes. All changes are new workspace files or `openclaw.json` additions. Fully additive.

### Upstream fork risk

**NONE**

- All changes are new files in the workspace directory
- No modifications to any existing OpenClaw source files
- `openclaw.json` additions are additive (new keys, new array entries)
- No impact on any existing agent behavior or routing
- No conflict scenario possible with upstream — these files are not tracked by OpenClaw upstream

---

## Recommended Execution Order

| Order  | Starting Point                 | Rationale                                                                                 |
| ------ | ------------------------------ | ----------------------------------------------------------------------------------------- |
| First  | #3 — Agent identities (Config) | Zero risk; prerequisite for everything else; can be done now                              |
| Second | #1 — Pre-route hook (Wrapper)  | Highest governance value; only 2 core file touches                                        |
| Third  | #2 — Expanded hooks (Wrapper)  | Broadest observability gain; 4 additive inserts; builds on hook pattern established by #1 |

Execute #3 before any code work begins. Execute #1 and #2 after agent identities are stable.

---

_Continuum — Faheem's PAC System | Professor Bone Lab_
_Reconnaissance Pass — Stage 6 | 2026-03-14_
