import { defineConfig } from "vitest/config";
import { sharedTestConfig } from "./vitest.shared";

/**
 * Integration tests: these need a real Postgres, so they run under their own
 * script (`pnpm --filter @olc/api test:integration`) and stay out of CI until
 * the local Docker Compose environment (ticket 15) exists. There are none yet;
 * `passWithNoTests` keeps the script green in the meantime.
 */
export default defineConfig({
  ...sharedTestConfig,
  test: {
    ...sharedTestConfig.test,
    include: ["test/integration/**/*.spec.ts"],
    passWithNoTests: true,
  },
});
