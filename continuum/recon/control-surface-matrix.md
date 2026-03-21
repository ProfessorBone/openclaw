# Control Surface Matrix — Continuum → OpenClaw Mapping

**Artifact ID:** PACS-IMPL-RECON-001-S3
**Version:** 1.0.0 | 2026-03-14
**Source:** Architectural Reconnaissance Pass — Stage 6, Step 3

---

## Control Surface Map

| Continuum Concept              | OpenClaw Equivalent                                                              | File                                                                    | Extension Type                                                          |
| ------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| The Bridge routing authority   | `resolveAgentRoute()` tiered binding system                                      | `src/routing/resolve-route.ts`                                          | **Core change** (no extension point exists today)                       |
| Execution gate (exec approval) | `ExecApprovalManager` — dangerous node commands                                  | `src/gateway/exec-approval-manager.ts`                                  | **Wrapper** (hook at call site in `node-invoke-system-run-approval.ts`) |
| Agent prompt assembly (B1–B6)  | `buildSystemPrompt()` + SOUL.md workspace injection                              | `src/agents/system-prompt.ts` + workspace files                         | **Config** (content) / **Core change** (structure and block ordering)   |
| Memory commit governance       | Direct `sync()` — no approval gate                                               | `src/memory/manager.ts`                                                 | **Core change** (no gate exists; must add)                              |
| Hook lifecycle events          | Internal hooks: agent:bootstrap, gateway:startup, message:received, message:sent | `src/hooks/internal-hooks.ts`                                           | **Wrapper** (plugins register handlers via hook-runner)                 |
| Agent identity constraints     | Agent config array, role-based routing, allowlists                               | `src/config/types.agents.ts`, `src/agents/agent-scope.ts`               | **Config** (`openclaw.json` agents[] array)                             |
| Deny list enforcement          | Node command allowlist/denylist; dangerous-tools audit                           | `src/gateway/node-command-policy.ts`, `src/security/dangerous-tools.ts` | **Config** (node denyCommands) / **Core** (dangerous tools hardcoded)   |
| Multi-agent routing            | Tiered binding system with 8 priority levels                                     | `src/routing/resolve-route.ts`                                          | **Config** (bindings[] array) / **Core** (tier logic is fixed)          |

---

## Extension Type Key

| Type            | Definition                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| **Config**      | Can be expressed through `openclaw.json` or workspace files (SOUL.md, AGENTS.md, etc.) without any code changes |
| **Wrapper**     | Can be layered on top of existing interfaces without modifying core source files                                |
| **Core change** | Requires modification to existing TypeScript source files                                                       |

---

## Summary Findings

**Config-expressible (zero code changes):**

- Agent identity constraints — fully in `openclaw.json` agents[] + workspace files
- Multi-agent routing bindings — fully in `openclaw.json` bindings[]
- Node command deny list — partially in `openclaw.json` gateway.nodes.denyCommands
- Agent prompt content — fully in workspace files (SOUL.md, AGENTS.md, TOOLS.md)

**Wrapper-expressible (no core changes):**

- Execution gate — can wrap call site in `node-invoke-system-run-approval.ts`
- Hook lifecycle events — plugin handler registration is the established pattern

**Requires Core change:**

- Bridge routing authority — no pre-resolve hook exists; must add trigger in `resolve-route.ts`
- Memory commit governance — no approval gate exists; must add at `sync()` in `manager.ts`
- Prompt block structure (B1–B6 ordering) — assembly order is fixed in `system-prompt.ts`
- Dangerous tools deny list — hardcoded in `dangerous-tools.ts`

---

_Continuum — Faheem's PAC System | Professor Bone Lab_
_Reconnaissance Pass — Stage 6 | 2026-03-14_
