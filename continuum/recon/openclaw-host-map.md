# OpenClaw Host Map — Step 1 File Listing

**Artifact ID:** PACS-IMPL-RECON-001-S1
**Version:** 1.0.0 | 2026-03-14
**Source:** Architectural Reconnaissance Pass — Stage 6

---

## Files Read (in order)

| #   | Requested Path                       | Canonical Path (as read)                    | Notes                                                            |
| --- | ------------------------------------ | ------------------------------------------- | ---------------------------------------------------------------- |
| 1   | src/routing/bindings.ts              | src/routing/bindings.ts                     | Path confirmed                                                   |
| 2   | src/routing/resolve-route.ts         | src/routing/resolve-route.ts                | Path confirmed                                                   |
| 3   | src/gateway/agent-prompt.ts          | src/gateway/agent-prompt.ts                 | **Scope correction — see note below**                            |
| 4   | src/gateway/exec-approval-manager.ts | src/gateway/exec-approval-manager.ts        | Path confirmed                                                   |
| 5   | src/gateway/hooks.ts                 | src/gateway/hooks.ts                        | **Scope correction — see note below**                            |
| 6   | src/gateway/node-command-policy.ts   | src/gateway/node-command-policy.ts          | Path confirmed                                                   |
| 7   | src/agents/agent-scope.ts            | src/agents/agent-scope.ts                   | Path confirmed                                                   |
| 8   | src/agents/bootstrap-hooks.ts        | src/agents/bootstrap-hooks.ts               | Path confirmed                                                   |
| 9   | src/agents/skills/                   | src/agents/skills/ (directory + types file) | Directory listing + index/types file read                        |
| 10  | src/memory/                          | src/memory/ (directory + manager.ts)        | Directory listing + src/memory/manager.ts read as primary module |

---

## Path Corrections

### agent-prompt.ts vs system-prompt.ts

**Requested:** `src/gateway/agent-prompt.ts`
**Actual role:** Assembles **message content** from conversation history (`ConversationEntry[]`) for the current turn. Produces a formatted string for the current message. This is **not** the system prompt assembler.

**Canonical system prompt file:** `src/agents/system-prompt.ts`
This file contains `buildSystemPrompt()` — the full system prompt assembly function including SOUL.md injection, skills block, memory block, user identity, sandbox info, tooling section, and runtime directives.

**Both files are relevant.** agent-prompt.ts handles per-turn message assembly; system-prompt.ts handles the constitutional/system block.

---

### hooks.ts vs internal-hooks.ts

**Requested:** `src/gateway/hooks.ts`
**Actual role:** HTTP **webhook API** — handles external callback URLs, outbound webhook delivery to third-party systems. This is an external integration surface, not the internal hook system.

**Canonical internal hook file:** `src/hooks/internal-hooks.ts`
This file defines `InternalHookEventType`, `triggerInternalHook()`, and the event/context types for the agent lifecycle hook system (agent:bootstrap, gateway:startup, message:received, message:sent, command, session).

**Both files exist and are distinct systems.** For Continuum governance purposes, `src/hooks/internal-hooks.ts` is the authoritative extension surface.

---

## Supporting Files Also Read

- src/routing/ — full directory listing
- src/gateway/ — full directory listing
- src/agents/ — full directory listing
- src/memory/ — full directory listing
- src/security/ — full directory listing (31 files)
- src/agents/sandbox/ — full directory listing (14 files)
- src/config/types.agents.ts — AgentBinding type definitions
- src/plugins/hooks.ts — plugin hook-runner
- src/agents/workspace.ts — DEFAULT_SOUL_FILENAME constant

---

_Continuum — Faheem's PAC System | Professor Bone Lab_
_Reconnaissance Pass — Stage 6 | 2026-03-14_
