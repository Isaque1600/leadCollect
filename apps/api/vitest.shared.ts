import swc from "unplugin-swc";
import type { UserConfig } from "vitest/config";

/**
 * What the unit and integration configs share: SWC so Nest's decorators and
 * `emitDecoratorMetadata` work, and `globals` so specs read like the rest of
 * the repo. Tests live outside `src/` (ADR-0008).
 */
export const sharedTestConfig: UserConfig = {
  test: {
    globals: true,
    root: "./",
  },
  plugins: [swc.vite()],
};
