/**
 * continuum/governance/action-authorization-gateway.test.ts
 *
 * Work Order 4 (Part A) tests — ActionAuthorizationGateway
 *
 * Tests the full grant lifecycle:
 *   issueGrant → verifyGrant → revokeGrant → expired grant behavior
 *
 * Acceptance tests per PACS-IMPL-STAGE3-001 Section 3:
 *   - expiry checks enforced
 *   - revocation checks enforced (supersedes expiry)
 *   - target binding enforced
 *   - action binding enforced
 *   - grant_not_found for unknown IDs
 *
 * Run: pnpm vitest run --config vitest.continuum.config.ts
 */

import { describe, expect, it, beforeEach } from "vitest";
import { ActionAuthorizationGateway } from "./action-authorization-gateway.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_PARAMS = {
  task_id: "task-001",
  trace_id: "trace-abc",
  authorized_action: "edit_file",
  action_class: "side-effecting" as const,
  allowed_target: "/vault/architecture/ADR-001.md",
  scope: "vault-write",
  ttl_ms: 60_000, // 1 minute
  policy_hash: "policy-v1-hash",
  grant_mode: "single-use" as const,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ActionAuthorizationGateway", () => {
  let gateway: ActionAuthorizationGateway;

  beforeEach(() => {
    gateway = new ActionAuthorizationGateway();
  });

  // --- issueGrant ---

  describe("issueGrant", () => {
    it("issues a grant with all required fields", () => {
      const grant = gateway.issueGrant(BASE_PARAMS);

      expect(grant.grant_id).toBeDefined();
      expect(grant.grant_id.length).toBeGreaterThan(0);
      expect(grant.task_id).toBe("task-001");
      expect(grant.trace_id).toBe("trace-abc");
      expect(grant.authorized_action).toBe("edit_file");
      expect(grant.action_class).toBe("side-effecting");
      expect(grant.allowed_target).toBe("/vault/architecture/ADR-001.md");
      expect(grant.scope).toBe("vault-write");
      expect(grant.policy_hash).toBe("policy-v1-hash");
      expect(grant.grant_mode).toBe("single-use");
      expect(grant.revoked).toBe(false);
      expect(grant.expiry_timestamp).toBeGreaterThan(Date.now());
      expect(grant.issued_at).toBeLessThanOrEqual(Date.now());
    });

    it("includes human_approval_record_id when provided", () => {
      const grant = gateway.issueGrant({
        ...BASE_PARAMS,
        human_approval_record_id: "approval-xyz",
      });
      expect(grant.human_approval_record_id).toBe("approval-xyz");
    });

    it("omits human_approval_record_id when not provided", () => {
      const grant = gateway.issueGrant(BASE_PARAMS);
      expect(grant.human_approval_record_id).toBeUndefined();
    });

    it("each grant gets a unique grant_id", () => {
      const g1 = gateway.issueGrant(BASE_PARAMS);
      const g2 = gateway.issueGrant(BASE_PARAMS);
      expect(g1.grant_id).not.toBe(g2.grant_id);
    });

    it("stores the grant retrievable via getGrant", () => {
      const grant = gateway.issueGrant(BASE_PARAMS);
      const retrieved = gateway.getGrant(grant.grant_id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.grant_id).toBe(grant.grant_id);
    });
  });

  // --- verifyGrant: valid path ---

  describe("verifyGrant — valid grant", () => {
    it("returns valid: true for a correct unexpired unrevoked grant", () => {
      const grant = gateway.issueGrant(BASE_PARAMS);
      const result = gateway.verifyGrant(
        grant.grant_id,
        "edit_file",
        "/vault/architecture/ADR-001.md",
      );
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.grant.grant_id).toBe(grant.grant_id);
      }
    });
  });

  // --- verifyGrant: denial paths ---

  describe("verifyGrant — denial paths", () => {
    it("returns grant_not_found for unknown grant_id", () => {
      const result = gateway.verifyGrant("nonexistent-id", "edit_file", "/some/path");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("grant_not_found");
      }
    });

    it("returns grant_expired for an expired grant", async () => {
      const grant = gateway.issueGrant({ ...BASE_PARAMS, ttl_ms: 1 });
      // Wait for expiry
      await new Promise((r) => setTimeout(r, 5));
      const result = gateway.verifyGrant(
        grant.grant_id,
        "edit_file",
        "/vault/architecture/ADR-001.md",
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("grant_expired");
      }
    });

    it("returns grant_revoked for a revoked grant (revocation supersedes expiry)", async () => {
      // Issue with very short TTL, revoke immediately before expiry matters
      const grant = gateway.issueGrant({ ...BASE_PARAMS, ttl_ms: 1 });
      gateway.revokeGrant(grant.grant_id);
      // Even if expired, revocation is checked first
      await new Promise((r) => setTimeout(r, 5));
      const result = gateway.verifyGrant(
        grant.grant_id,
        "edit_file",
        "/vault/architecture/ADR-001.md",
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("grant_revoked");
      }
    });

    it("returns grant_revoked for a valid-time grant that was revoked", () => {
      const grant = gateway.issueGrant(BASE_PARAMS);
      gateway.revokeGrant(grant.grant_id);
      const result = gateway.verifyGrant(
        grant.grant_id,
        "edit_file",
        "/vault/architecture/ADR-001.md",
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("grant_revoked");
      }
    });

    it("returns action_mismatch when requested action differs from authorized action", () => {
      const grant = gateway.issueGrant(BASE_PARAMS);
      const result = gateway.verifyGrant(
        grant.grant_id,
        "delete_file", // wrong action
        "/vault/architecture/ADR-001.md",
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("action_mismatch");
      }
    });

    it("returns target_mismatch when requested target differs from allowed target", () => {
      const grant = gateway.issueGrant(BASE_PARAMS);
      const result = gateway.verifyGrant(
        grant.grant_id,
        "edit_file",
        "/vault/security/different-file.md", // wrong target
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("target_mismatch");
      }
    });
  });

  // --- revokeGrant ---

  describe("revokeGrant", () => {
    it("returns true when a known grant is revoked", () => {
      const grant = gateway.issueGrant(BASE_PARAMS);
      expect(gateway.revokeGrant(grant.grant_id)).toBe(true);
    });

    it("returns false when an unknown grant_id is given", () => {
      expect(gateway.revokeGrant("nonexistent-id")).toBe(false);
    });

    it("marks the grant as revoked in the store", () => {
      const grant = gateway.issueGrant(BASE_PARAMS);
      gateway.revokeGrant(grant.grant_id);
      const retrieved = gateway.getGrant(grant.grant_id);
      expect(retrieved?.revoked).toBe(true);
    });

    it("revocation is permanent — re-verify returns revoked after revokeGrant", () => {
      const grant = gateway.issueGrant(BASE_PARAMS);
      gateway.revokeGrant(grant.grant_id);
      const r1 = gateway.verifyGrant(grant.grant_id, "edit_file", "/vault/architecture/ADR-001.md");
      const r2 = gateway.verifyGrant(grant.grant_id, "edit_file", "/vault/architecture/ADR-001.md");
      expect(r1.valid).toBe(false);
      expect(r2.valid).toBe(false);
      if (!r1.valid) {
        expect(r1.reason).toBe("grant_revoked");
      }
    });
  });

  // --- getGrant ---

  describe("getGrant", () => {
    it("returns null for unknown grant_id", () => {
      expect(gateway.getGrant("not-a-real-id")).toBeNull();
    });

    it("returns the grant without side effects", () => {
      const grant = gateway.issueGrant(BASE_PARAMS);
      const retrieved = gateway.getGrant(grant.grant_id);
      expect(retrieved).toEqual(grant);
    });
  });

  // --- Grant store integrity ---

  describe("grant store integrity", () => {
    it("grantCount reflects issued grants", () => {
      expect(gateway.grantCount()).toBe(0);
      gateway.issueGrant(BASE_PARAMS);
      expect(gateway.grantCount()).toBe(1);
      gateway.issueGrant(BASE_PARAMS);
      expect(gateway.grantCount()).toBe(2);
    });

    it("clearAll empties the store", () => {
      gateway.issueGrant(BASE_PARAMS);
      gateway.issueGrant(BASE_PARAMS);
      gateway.clearAll();
      expect(gateway.grantCount()).toBe(0);
    });
  });

  // --- Acceptance: PACS-IMPL-STAGE3-001 Section 3 enforcement semantics ---

  describe("PACS-IMPL-STAGE3-001 Section 3 acceptance", () => {
    it("enforces expiry checks", async () => {
      const grant = gateway.issueGrant({ ...BASE_PARAMS, ttl_ms: 1 });
      await new Promise((r) => setTimeout(r, 5));
      const result = gateway.verifyGrant(
        grant.grant_id,
        "edit_file",
        "/vault/architecture/ADR-001.md",
      );
      expect(result.valid).toBe(false);
    });

    it("enforces revocation checks", () => {
      const grant = gateway.issueGrant(BASE_PARAMS);
      gateway.revokeGrant(grant.grant_id);
      const result = gateway.verifyGrant(
        grant.grant_id,
        "edit_file",
        "/vault/architecture/ADR-001.md",
      );
      expect(result.valid).toBe(false);
    });

    it("enforces target binding", () => {
      const grant = gateway.issueGrant(BASE_PARAMS);
      const result = gateway.verifyGrant(grant.grant_id, "edit_file", "/wrong/target.md");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("target_mismatch");
      }
    });

    it("enforces invocation-record correlation — grant carries task_id and trace_id", () => {
      const grant = gateway.issueGrant(BASE_PARAMS);
      expect(grant.task_id).toBe("task-001");
      expect(grant.trace_id).toBe("trace-abc");
      // Verification result also carries the grant with its full context
      const result = gateway.verifyGrant(
        grant.grant_id,
        "edit_file",
        "/vault/architecture/ADR-001.md",
      );
      if (result.valid) {
        expect(result.grant.task_id).toBe("task-001");
        expect(result.grant.trace_id).toBe("trace-abc");
      }
    });
  });
});
