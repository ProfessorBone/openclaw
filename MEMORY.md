# MEMORY.md — Continuum Durable Architectural Memory

# Version: 1.0.0 | 2026-03-13

#

# DEPLOYMENT: Copy this file to the root of your Continuum repo.

# This file holds stable truths that must not be forgotten across sessions.

# Only add entries that represent settled, durable decisions.

# Do not add working notes or in-progress thoughts here.

---

## Stable Architectural Memory

### 2026-03-13 — Phase 1 Complete

Continuum Phase 1 (Blueprint & Documentation) is fully complete. All
architecture artifacts are locked in the Obsidian vault. Phase 2 is
implementation only — no new architectural decisions are made without
a formal ADR entry in DECISIONS.md.

### 2026-03-13 — The Bridge Is the Control Plane

The Bridge is the governance and orchestration authority for all agents.
It is not a workflow automation layer. It is a policy enforcement layer.
Every agent action that carries governance weight passes through The Bridge
before executing.

### 2026-03-13 — Two Execution Classes for All Tools

Every tool in Continuum is either Direct (fires immediately) or Candidate
formation (produces a candidate record submitted for MEC adjudication before
any downstream effect). Class 2 tools NEVER execute their downstream effect
without MEC approval. This is non-negotiable.

### 2026-03-13 — MEC Is Constitutional Enforcement, Not a Feature

The Meta-Evaluation Checkpoint is positioned above The Bridge. It governs
the three protected decision classes: SUMMARY_EMISSION, MEMORY_COMMIT_AUTH,
and ESCALATION_DECISION. If the MEC is unavailable, all three protected
decision classes fail closed. There is no fallback execution pathway.

### 2026-03-13 — Vault Deny List Is Absolute

The Vault deny list (margin trading, autonomous capital deployment, direct
brokerage execution, credential storage, external financial system writes,
execution instructions in any form) cannot be unlocked by any authorization
pathway. Not by Faheem. Not by The Bridge. Not by the MEC. These are
architectural identity constraints, not configurable parameters.

### 2026-03-13 — Profit Is Not a Vault Success Metric

Vault's performance is measured by thesis calibration accuracy — whether
analytical claims correctly identify the conditions they claim to identify.
Profit is not a metric. This distinction must be preserved in all Vault
performance evaluations.

### 2026-03-13 — OpenClaw Is the Channel Gateway, Not the Orchestrator

OpenClaw connects messaging platforms (WhatsApp, Telegram, Discord, iMessage)
to agents. It is the channel gateway layer only. The Bridge is the
orchestration layer. Do not conflate them.

### 2026-03-13 — Graph-Schema.md Is a Locus Prerequisite

Locus cannot be implemented without Graph-Schema.md. This document defines
entity types, relationship types, domain tags, and provenance record structure.
It must be written before Locus scaffolding begins in Stage 2.

### 2026-03-13 — Self-Governance Prohibition Is System-Wide

No component evaluates its own governance compliance or operational performance.
The Bridge is evaluated by Gauge. The MEC is evaluated by the Observability Layer.
Gauge is evaluated by The Bridge. Vault is evaluated by Gauge. This chain is
intentional and must be preserved in all implementations.

### 2026-03-13 — State Primacy Principle

Information not represented in agent state is not available for agent reasoning.
The state schema defines the agent's cognitive horizon for the current task.
Working state does not survive task or cycle closure. Carryover holds status
markers only — not analytical content from prior cycles.

### 2026-03-13 — Zero Must Be Earned

A metric that cannot be computed is reported as UNCOMPUTABLE, not as zero or
as a prior cycle's value. An inoperative detection mechanism cannot assert a
clean bill of health. This principle applies to all metrics, all agents, all
phases.

### 2026-03-13 — The Four Containment Layers

Layer 1: Learning Integrity (Crucible)
Layer 2: Knowledge Integrity (Foundry, Locus, Signal)
Layer 3: Governance Integrity (Bridge, Gauge)
Layer 4: Constitutional Integrity (MEC, Audit Log, Reconciliation)
A failure at Layer 1 does not automatically become a Layer 4 failure.
Each layer has its own detection surface. Failures are caught at the
layer where they originate.

---

_Continuum — Faheem's PAC System | Professor Bone Lab_
