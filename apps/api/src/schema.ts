import * as identity from "./modules/identity/infra/identity.schema";

/**
 * The composition root's view of the database: every module's own schema file,
 * merged into the one object the Drizzle handle is built with (ADR-0008). This
 * is the only place allowed to know about every module; `drizzle-kit` finds the
 * same files by glob, so a new module needs no change to `drizzle.config.ts`.
 */
export const schema = {
  ...identity,
};

export type Schema = typeof schema;
