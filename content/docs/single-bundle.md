# Single bundle

When you only want one piece — the browser-testing workflow, say, or the fail-closed hooks — take the bundle and leave the rest of the setup alone. A bundle is a slice of a `.claude/` directory: skills, rules, hooks, settings and a `CLAUDE.md` snippet, published on its own page with a download button. No `CLAUDE.md` gets assembled, no lockfile is written, and nothing you already have is merged. It is three steps and some copying.

Taking the whole setup instead is [Start here](/docs/start-here). Adding a bundle to a project that already has the setup is `pnpx @patrity/skills add <slug>`.

## 1. Pick a bundle

Browse the [skills index](/skills). Each card shows what the bundle contains (Skills, Rules, Hooks, Settings, CLAUDE.md), its tags, and anything it requires on your machine (for example `python3` for the doc-fetcher skills).

## 2. Download and unzip

Click **Download**. The zip unpacks to a single folder named after the bundle:

```text
nuxt/
├── README.md
├── skills/…
├── rules/…
└── CLAUDE.md
```

Move the folder's *contents* into your project's `.claude/` directory:

```bash
unzip nuxt.zip
mkdir -p .claude
cp -R nuxt/skills nuxt/rules .claude/
```

Skip the README unless you want it, and skip `CLAUDE.md` for now.

## 3. Wire up CLAUDE.md

If the bundle ships a `CLAUDE.md`, it is a **pointer snippet**, not a replacement. Paste its contents into your project's `CLAUDE.md` so Claude Code knows the skills and rules exist and when to reach for them.

## Keeping bundles out of git noise

A bundle that writes a cache declares the path in its frontmatter, and the bundle page lists it under **Gitignore**. Doc-fetcher skills, for instance, cache what they download beside their own `SKILL.md`. Installing by hand, copy those paths into your project's `.gitignore` yourself:

```text
.claude/skills/nuxt-docs/cache/
```

A bundle that reads configuration lists it under **Environment** instead: create `.claude/.env` and set the variables it names. Skills read that file, never the repo root `.env`, and it belongs in `.gitignore` too. The CLI does all of this for you; by hand it is on you.

## Updating

Bundles have no versions. Re-download and overwrite when you want the latest; the **Source** button opens the exact GitHub tree so you can diff before you do.
