#!/bin/sh
# Render's start command (render.yaml): apply migrations, then become the server.
# Render's free plan has no Pre-Deploy Command, so migrating lives here instead.
#
# - A failed migration exits non-zero before the server starts, so Render marks
#   the deploy failed and keeps the previous version serving.
# - The server is `exec`ed: it replaces this shell, so Render's SIGTERM reaches
#   Node directly and the app's shutdown hooks run.
#
# Runs from the package root (apps/api), where `drizzle/` and `dist/` live.
#
# MIGRATE_CMD and START_CMD exist only so test/unit/scripts/start.spec.ts can
# swap in stand-ins. Leave them unset in every real environment. START_CMD's
# default is `pnpm start`'s own command, without pnpm in between the signal
# and Node.
migrate=${MIGRATE_CMD:-pnpm run db:migrate}
start=${START_CMD:-node dist/main.js}

$migrate || {
  status=$?
  echo "start.sh: migration failed (exit $status), not starting the server" >&2
  exit "$status"
}

exec $start
