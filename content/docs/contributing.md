# Contributing

This is primarily a personal registry, but pull requests for genuinely reusable bundles are welcome.

## Add a bundle

1. Fork the repository and create `skills/<slug>/` (see [Bundle structure](/docs/bundle-structure)).
2. Write `README.md` with valid [frontmatter](/docs/frontmatter) and a body that explains what the bundle does and how to install it.
3. Run the validator locally:

   ```bash
   pnpm install
   pnpm validate:skills
   ```

4. Run the site against your working tree and check the page:

   ```bash
   pnpm dev
   # open http://localhost:3000/skill/<slug>
   ```

5. Open a pull request. CI runs the same validator plus the app's lint, typecheck, tests and build.

## What happens on merge

Bundle content is read from GitHub **at runtime**. Merging to `main`:

- skips the Vercel build when only `skills/**` changed (the Ignored Build Step in `vercel.json`);
- runs the `revalidate` workflow, which purges the cache tag and asserts the site now serves your commit.

Your bundle is live within seconds of the merge.

## Ground rules

- No secrets, credentials, internal hostnames or IPs. Bundles are public.
- No generated caches. `cache/` directories are ignored anyway, but do not commit them.
- Keep bundles generic. Project-specific paths, theme mappings or account names belong in the user's own `CLAUDE.md`, not here.
- Lowercase tags, one concern per bundle.
