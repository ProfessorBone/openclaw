/**
 * vitest.continuum.config.ts
 *
 * Vitest configuration for Continuum governance modules.
 * Run: pnpm vitest run --config vitest.continuum.config.ts
 *
 * Scope: continuum/**\/*.test.ts
 * These tests cover pure-logic governance modules that have no OpenClaw
 * runtime dependencies and no external I/O.
 */
import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.config.ts";

const base = baseConfig as unknown as Record<string, unknown>;
const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...base,
  test: {
    ...baseTest,
    include: ["continuum/**/*.test.ts"],
    exclude: [],
  },
});
