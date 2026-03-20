/**
 * continuum/governance/action-authorization-gateway.ts
 *
 * Work Order 4 (Part A) — PACS-IMPL-STAGE3-001
 * ActionAuthorizationGateway: minimal in-process grant store and
 * grant lifecycle management for governed write-surface enforcement.
 *
 * This is the Stage 3 minimum viable implementation.
 * A distributed grant store is Stage 4/5 work.
 *
 * Governed by: ARCH-ADR-003, PACS-IMPL-STAGE3-001 Section 3
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionClass = "read-only" | "side-effecting";
export type GrantMode = "single-use" | "bounded-repeatable" | "envelope";

export type Grant = {
  grant_id: string;
  task_id: string;
  trace_id: string;
  authorized_action: string;
  action_class: ActionClass;
  allowed_target: string;
  scope: string;
  expiry_timestamp: number; // Unix ms
  policy_hash: string;
  grant_mode: GrantMode;
  revoked: boolean;
  human_approval_record_id?: string;
  issued_at: number; // Unix ms
};

export type IssueGrantParams = {
  task_id: string;
  trace_id: string;
  authorized_action: string;
  action_class: ActionClass;
  allowed_target: string;
  scope: string;
  /** TTL in milliseconds from now. */
  ttl_ms: number;
  policy_hash: string;
  grant_mode: GrantMode;
  human_approval_record_id?: string;
};

export type VerifyGrantResult =
  | { valid: true; grant: Grant }
  | { valid: false; reason: GrantDenialReason };

export type GrantDenialReason =
  | "grant_not_found"
  | "grant_expired"
  | "grant_revoked"
  | "action_mismatch"
  | "target_mismatch";

// ---------------------------------------------------------------------------
// In-process grant store
// ---------------------------------------------------------------------------

/**
 * Minimal in-process grant store for Stage 3.
 * All grants live in memory. Restarting the gateway clears all grants.
 * Production hardening (persistence, distributed store) is Stage 4/5.
 *
 * Per PACS-IMPL-STAGE3-001 Section 3:
 * "A minimal implementation may be simple, but it may not omit expiry checks,
 * revocation checks, target binding, or invocation-record correlation."
 */
export class ActionAuthorizationGateway {
  private readonly grants = new Map<string, Grant>();

  // ---------------------------------------------------------------------------
  // issueGrant
  // ---------------------------------------------------------------------------

  /**
   * Issues a new signed execution grant.
   * Returns the full Grant object including the generated grant_id.
   */
  issueGrant(params: IssueGrantParams): Grant {
    const now = Date.now();
    const grant: Grant = {
      grant_id: randomUUID(),
      task_id: params.task_id,
      trace_id: params.trace_id,
      authorized_action: params.authorized_action,
      action_class: params.action_class,
      allowed_target: params.allowed_target,
      scope: params.scope,
      expiry_timestamp: now + params.ttl_ms,
      policy_hash: params.policy_hash,
      grant_mode: params.grant_mode,
      revoked: false,
      issued_at: now,
      ...(params.human_approval_record_id
        ? { human_approval_record_id: params.human_approval_record_id }
        : {}),
    };
    this.grants.set(grant.grant_id, grant);
    return grant;
  }

  // ---------------------------------------------------------------------------
  // verifyGrant
  // ---------------------------------------------------------------------------

  /**
   * Verifies a grant for a specific requested action and target.
   * Checks in order per ARCH-ADR-003:
   *   1. grant exists
   *   2. not revoked (revocation supersedes expiry)
   *   3. not expired
   *   4. action matches
   *   5. target matches
   *
   * Grant traceability: verification is always tied to grant_id, which
   * carries task_id and trace_id as context per PACS-IMPL-STAGE3-001 Section 3.
   */
  verifyGrant(
    grantId: string,
    requestedAction: string,
    requestedTarget: string,
  ): VerifyGrantResult {
    const grant = this.grants.get(grantId);

    // 1. Existence
    if (!grant) {
      return { valid: false, reason: "grant_not_found" };
    }

    // 2. Revocation — supersedes expiry per ARCH-ADR-003
    if (grant.revoked) {
      return { valid: false, reason: "grant_revoked" };
    }

    // 3. Expiry
    if (Date.now() > grant.expiry_timestamp) {
      return { valid: false, reason: "grant_expired" };
    }

    // 4. Action binding
    if (grant.authorized_action !== requestedAction) {
      return { valid: false, reason: "action_mismatch" };
    }

    // 5. Target binding
    if (grant.allowed_target !== requestedTarget) {
      return { valid: false, reason: "target_mismatch" };
    }

    return { valid: true, grant };
  }

  // ---------------------------------------------------------------------------
  // revokeGrant
  // ---------------------------------------------------------------------------

  /**
   * Revokes a grant. Revocation is permanent and supersedes expiry.
   * Returns true if the grant was found and revoked, false if not found.
   */
  revokeGrant(grantId: string): boolean {
    const grant = this.grants.get(grantId);
    if (!grant) {
      return false;
    }
    this.grants.set(grantId, { ...grant, revoked: true });
    return true;
  }

  // ---------------------------------------------------------------------------
  // getGrant
  // ---------------------------------------------------------------------------

  /**
   * Looks up a grant by ID. Returns null if not found.
   * Does not check expiry or revocation — use verifyGrant for enforcement.
   */
  getGrant(grantId: string): Grant | null {
    return this.grants.get(grantId) ?? null;
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  /**
   * Returns the number of grants in the store (for testing and diagnostics).
   */
  grantCount(): number {
    return this.grants.size;
  }

  /**
   * Clears all grants. For testing only.
   */
  clearAll(): void {
    this.grants.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton gateway instance
// ---------------------------------------------------------------------------

/**
 * The singleton ActionAuthorizationGateway for Continuum.
 * Initialized once at module load. Shared across the governance plugin.
 */
export const actionAuthorizationGateway = new ActionAuthorizationGateway();
