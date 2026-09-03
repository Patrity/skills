# Skills

Reusable Claude Code setups, published as downloadable bundles. Each bundle under [`skills/`](skills/) mirrors a project's `.claude/` directory (skills, rules, hooks, settings, a `CLAUDE.md` pointer) and ships a README whose frontmatter is the registry metadata.

The site renders those bundles straight from this repository at request time, so publishing a bundle never rebuilds the app.

## Using a bundle

1. Browse the site and pick a bundle.
2. **Download** the zip and copy its contents into your project's `.claude/`.
3. Paste the bundle's `CLAUDE.md` snippet (if any) into your own `CLAUDE.md`.

Full instructions live on the site under **Docs**.

## Adding a bundle

Create `skills/<slug>/README.md` with frontmatter (`name`, `description`, `tags`, `author`, optional `authorUrl`/`requires`) and add the `.claude` content beside it. Run `pnpm validate:skills`, open a PR. See `content/docs/contributing.md`.

## Development

```bash
pnpm install
pnpm dev            # http://localhost:3000, reads ./skills from disk
pnpm test:unit      # fast unit tests
pnpm test           # + route tests (builds the app once)
pnpm typecheck && pnpm lint && pnpm build
```

`SKILLS_SOURCE=github pnpm dev` exercises the production path (GitHub zip archive → parsed snapshot). `SKILLS_SOURCE` is read at build/dev time by `nuxt.config.ts`; the **built** server reads `NUXT_SKILLS_SOURCE` instead (same values), so set that one on a deployed instance. Copy `.env.example` to `.env` for the knobs.

## How it works

- `server/lib/skills/` parses bundles from disk (`fs`) or from the repo zip archive (`github`), caches per-bundle blobs in the Vercel Runtime Cache under tag `skills`, and serves them through `/api/skills/**`.
- Pages and API routes are ISR-cached (5 min floor) and tagged; `POST /api/revalidate` purges the tag. After a purge a warm instance re-reads the Runtime Cache within ~5s (its in-process memo TTL); the 5-minute ISR floor is only the backstop.
- A failing upstream never becomes a cached 404 or empty page: the store keeps serving its last good snapshot and routes answer 503, which Vercel serves stale rather than caching.
- On a push that touches `skills/**`, Vercel skips the build (`vercel.json` `ignoreCommand`) and the `revalidate` workflow purges the cache instead.

## Deploy

Vercel, Git integration on `main`. Environment variables: `NUXT_REVALIDATE_SECRET`, `NUXT_PUBLIC_SITE_URL`, `NUXT_GITHUB_TOKEN`; production-only `NUXT_PUBLIC_UMAMI_ID` and `UMAMI_DOMAINS` (build-time). GitHub Actions needs the `SITE_URL` variable and `REVALIDATE_SECRET` secret.

`NUXT_GITHUB_TOKEN` is strongly recommended in production: serverless functions share egress IPs, so the unauthenticated GitHub limit (60 requests/hour/IP) is easily exhausted by neighbours. A fine-grained read-only token raises it to 5,000/hour.
