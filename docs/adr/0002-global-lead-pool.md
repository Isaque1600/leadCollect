# Single global Lead Pool instead of per-tenant data isolation

Leads are stored once in a global, deduplicated Lead Pool shared by every user. A
`user_leads` link table records which Leads each user has collected; a user only
ever sees their Collected Leads. A search checks the pool first and spends
Billable Calls only on the shortfall.

The obvious multi-tenant design isolates each tenant's data. We deliberately did
not, because the dominant cost of this product is paid API calls (Google Places,
Brave), and most users searching the same city and business type want the same
companies. Sharing the pool turns the second user's search into a near-free
database read.

Consequences: a Lead's enrichment freshness is shared (mitigated by the 30-day
Stale Lead re-enrichment rule); the pool is not partitioned, so a future need for
true per-tenant deletion or private leads would require schema change. Acceptable
for a prospecting tool over public business data.
