# Getting started

A **bundle** is a ready-made slice of a project's `.claude/` directory: skills, rules, hooks, settings, and a `CLAUDE.md` snippet. Installing one takes three steps.

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

Doc-fetcher skills write a `cache/` folder next to their `SKILL.md`. Add this to your project's `.gitignore`:

```gitignore
.claude/skills/*/cache/
```

## Updating

Bundles have no versions. Re-download and overwrite when you want the latest; the **Source** button opens the exact GitHub tree so you can diff before you do.
