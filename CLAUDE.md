# webScraping

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, unchanged (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded on a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Git workflow

- **Never push to `main`.** `main` only advances through merged pull requests.
- `dev` is the integration branch. Small config/doc changes may be committed straight to `dev`.
- **Complex/implementation tasks** (a ticket, a feature) go on a `feature/NN-<slug>` branch cut from `dev`, and land via a PR into `dev` — not `main`. The `feature-builder` subagent does this automatically; delegate ticket work to it.
- The human opens the `dev → main` PR when a batch on `dev` is ready.
- CI runs on PRs and on `main`.
