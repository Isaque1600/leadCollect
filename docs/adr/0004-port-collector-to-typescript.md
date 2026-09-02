# Port the Python collector to TypeScript rather than run it as a service

The original `collector_maps.py` (Places API calls, `robots.txt` check, regex
Enrichment, xlsx writing) is reimplemented in TypeScript inside `apps/api`. The
Python code is kept only as reference and will be removed once the port is
verified.

The alternative — keeping the Python script as a separate worker the NestJS API
shells out to or calls over HTTP — was rejected: it means a second language, a
second Render service with its own cold start, and an extra network hop, for
logic that is just REST calls, `fetch` + regex, and `exceljs`. A reader seeing
the Python files still present should not resurrect that path.
