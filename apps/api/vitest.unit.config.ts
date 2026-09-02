import { defineConfig } from "vitest/config";
import { sharedTestConfig } from "./vitest.shared";

/**
 * Unit tests: no infrastructure, no database, no network. These are the ones CI
 * runs on every push (`pnpm test`).
 */
export default defineConfig({
  ...sharedTestConfig,
  test: {
    ...sharedTestConfig.test,
    include: ["test/unit/**/*.spec.ts"],
  },
});
