# In-process job runner with DB-backed status and polling, not a message queue

A Job runs asynchronously inside the NestJS API process. Its status and progress
live on the `jobs` row; the frontend polls `GET /jobs/:id`. A reaper marks Jobs
that have been running longer than 15 minutes as failed, covering the case where
the Render instance restarts mid-Job. One running Job per user.

We chose this over BullMQ + Redis because expected load is a handful of users
running one Job at a time, and adding a queue means another service, another free
tier to manage, and a separate worker process. The trade-off: no retries, no
durable job history beyond the row, and an orphaned-Job window bounded by the
reaper timeout.

If concurrent heavy Jobs ever become normal, move the runner behind BullMQ +
Upstash Redis — the `jobs` table and polling API stay, the execution moves.
