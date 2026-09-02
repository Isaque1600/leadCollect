# Drizzle ORM over Prisma

Database access uses Drizzle with the `postgres.js` driver against Neon's pooled
connection string (`drizzle-kit` migrations run against the direct connection).

Prisma has the smoother DX and is the default choice with Neon, but the
maintainer wants to learn Drizzle, its SQL-first model keeps queries close to the
Postgres they run as, and it avoids Prisma's separate engine binary. Lock-in is
low either way — the schema is small and both are swappable — so this is a
preference decision recorded so a reader does not assume Prisma was evaluated and
rejected on technical grounds.
