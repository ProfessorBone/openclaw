/**
 * Continuum Governed Agent Registry
 * PACS-ARCH-REGISTRY-001
 *
 * Defines the complete set of agent IDs authorized to receive
 * execution authority through Bridge route adjudication.
 *
 * Authority to add or remove entries requires an architectural
 * decision record. This is not a config value.
 */
export const CONTINUUM_GOVERNED_REGISTRY = new Set<string>([
  "the-bridge",
  "crucible",
  "locus",
  "foundry",
  "signal",
  "gauge",
  "vault",
]);

export function isGovernedAgentId(id: string): boolean {
  return CONTINUUM_GOVERNED_REGISTRY.has(id);
}
