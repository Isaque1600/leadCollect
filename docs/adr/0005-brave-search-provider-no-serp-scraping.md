# Web Search via Brave behind a SearchProvider interface; no SERP scraping; Sheets output dropped

The Web Search Source calls the Brave Search API, accessed through a
`SearchProvider` interface so it can be swapped for Serper.dev (or similar) when
query volume outgrows Brave's free tier without touching Job logic.

Scraping Google's results page directly was rejected: it breaks on every layout
change, gets the server IP blocked, and violates Google's terms. Paying for a
SERP API is the stable path.

The original Google Sheets output mode is dropped. It required a service-account
JSON credential, which does not fit a multi-user app where each user
authenticates with their own Google account for identity only (`openid email
profile`, no Drive/Sheets scopes, so no Google verification review). Output is
xlsx download only.
