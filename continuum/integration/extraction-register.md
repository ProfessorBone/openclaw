# OpenClaw Subsystem Extraction Register

**Created:** 2026-03-14
**Purpose:** Track each OpenClaw subsystem touched during integration.
Classify as: host-only | wrapper-worthy | future-core-candidate

---

## Classification Criteria

A subsystem is a future-core-candidate if all four are true:

1. It has a clear interface
2. It delivers high Continuum value
3. It does not drag hidden dependencies
4. It can be tested outside OpenClaw's full runtime

---

## Registry

| Subsystem            | File                                  | Classification        | Notes                                                                            |
| -------------------- | ------------------------------------- | --------------------- | -------------------------------------------------------------------------------- |
| Routing engine       | src/routing/resolve-route.ts          | host-only             | Eight-tier binding system; deeply coupled to config and session model            |
| Route call site      | src/plugin-sdk/inbound-envelope.ts:77 | wrapper-worthy        | Bridge insertion point; clean boundary between routing and envelope construction |
| Exec approval        | src/gateway/exec-approval-manager.ts  | future-core-candidate | Clean interface, high governance value, natural boundary                         |
| Node command policy  | src/gateway/node-command-policy.ts    | future-core-candidate | Configurable deny list, separable governance primitive                           |
| Internal hook system | src/hooks/internal-hooks.ts           | wrapper-worthy        | Extension surface; too coupled to OpenClaw lifecycle to extract early            |
| Prompt assembly      | src/agents/system-prompt.ts           | host-only             | Tightly coupled to workspace lifecycle and agent bootstrap flow                  |
| Memory manager       | src/memory/manager.ts                 | host-only             | SQLite + embedding providers; high extraction cost                               |
| Security/audit layer | src/security/audit.ts                 | future-core-candidate | Governance service with potential clean boundary                                 |
| Sandbox harness      | src/agents/sandbox/                   | host-only             | Deeply coupled to agent execution model                                          |
| Bootstrap hooks      | src/agents/bootstrap-hooks.ts         | wrapper-worthy        | Primary hook for injecting Continuum governance content                          |

---

## Review Schedule

Reassess classifications after Layer 1 (agent identity config) is complete.
Reassess again after first governed prototype is running.

---

_Continuum — Faheem's PAC System | Professor Bone Lab_
