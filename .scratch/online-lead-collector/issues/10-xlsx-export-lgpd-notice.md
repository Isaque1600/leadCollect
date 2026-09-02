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
