# webScraping

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, unchanged (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded on a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## API architecture

`apps/api` follows `docs/adr/0008-api-modular-monolith.md`. Read it before adding files there.

**Check NestJS before building API plumbing.** Look at the installed `@nestjs/*` packages first, then the docs. Guards, pipes, interceptors, exception filters, custom param decorators, lifecycle hooks, and first-party packages (`@nestjs/config`, `terminus`, `schedule`, `throttler`, `jwt`, `passport`, …) already exist — don't hand-roll them. **If you don't know whether Nest solves it, ask** rather than guessing either way; adopting a first-party package sets a convention, and the user wants to see the choice.

## Git workflow

- **Never push to `main`.** `main` only advances through merged pull requests.
- `dev` is the integration branch. Small config/doc changes may be committed straight to `dev`.
- **Complex/implementation tasks** (a ticket, a feature) go on a `feature/NN-<slug>` branch cut from `dev`, and land via a PR into `dev` — not `main`. The `feature-builder` subagent does this automatically; delegate ticket work to it.
- The human opens the `dev → main` PR when a batch on `dev` is ready.
- CI runs on PRs and on `main`.
