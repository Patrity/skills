## Deploy
- Vercel via the Git integration on the production branch. Module scope in a serverless function is shared across requests: never keep per-request or per-tenant state there.
- ISR caches 200/404 and keeps stale on 5xx: surface upstream failures as 5xx, never as an empty 200 or a synthetic 404. Each distinct query string is a separate cache entry.
- Env changes need a redeploy; a redeploy of the same commit must not be skipped by an ignored-build step.
