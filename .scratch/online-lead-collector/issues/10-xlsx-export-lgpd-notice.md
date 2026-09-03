# 10: xlsx export + LGPD notice

**What to build:** From a finished Job's view, the user can download that Job's
Collected Leads as an Excel file. The file is generated on demand with `exceljs`
from the database (no file is stored server-side) and streamed as a download. It
has the eight existing columns (`nome`, `telefone_whatsapp`, `email`,
`tipo_negocio`, `possui_site`, `site`, `link_origem`, `fonte`) plus `data_coleta`
(when this user collected the Lead), with a bold, frozen header row. The LGPD
notice from `CONTEXTO.md` is shown in the UI near the results and the download
button.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] `GET /jobs/:id/export` streams an `.xlsx` of that user's Collected Leads for that Job
- [ ] Columns: the existing eight plus `data_coleta`; header row bold and frozen; sensible column widths
- [ ] No xlsx file is written to disk; the workbook is built in memory
- [ ] A user can only export their own Job
- [ ] Download button on the finished-Job view
- [ ] LGPD notice text shown near the results / download
- [ ] Unit test: workbook builder produces the right columns and header formatting from sample rows

## `job_leads` — Job→Lead link (resolves the open question from PR #5)

"This Job's Collected Leads" means Leads **newly** linked by this Job, not
every Lead its search touched — a re-found Lead the User already had keeps its
original `collected_at`, so counting it under this Job would misreport
`data_coleta`.

- [ ] New table `job_leads(job_id, lead_id)`, owned by the `jobs` module (not
      `leads` — keeps the dependency one-directional, `jobs → leads` only, per
      ADR/ticket 03). Unique on `(job_id, lead_id)`; both FKs `ON DELETE
      CASCADE`. No columns beyond the two ids — the export joins to
      `user_leads.collected_at` for `data_coleta`, which is correct precisely
      because a `job_leads` row only ever exists for a genuinely new collect.
- [ ] **Breaking change to ticket 03's `LeadPool.collect()` port** (in
      `modules/leads/domain/lead-pool.port.ts` and its Drizzle adapter):
      return type changes to surface whether it inserted a new row or found an
      existing one (e.g. `{ collectedLead: CollectedLead; wasNew: boolean }`),
      instead of discarding that distinction. `JobRunner` writes `job_leads`
      only when `wasNew` is true. Chosen over a separate existence-check call
      to avoid a second query and the race between two concurrent Jobs.
- [ ] `GET /jobs/:id/export` (and the `GET /jobs/:id` progress view, if it also
      lists Leads) reads via `job_leads`, not `user_leads` directly.
