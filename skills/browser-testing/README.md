---
name: Browser Testing
description: Prove UI changes in a real browser with playwright-cli — install-if-missing, snapshot→ref→act workflow, test-account convention and evidence discipline.
tags: [testing, e2e, playwright, browser]
author: Patrity
authorUrl: https://github.com/Patrity
requires: [node, npm]
---

# Browser Testing

A skill, a path-scoped rule and the permissions to run them. Together they stop Claude Code
declaring UI work finished on the strength of a green typecheck.

## What's inside

| Path | Purpose |
| --- | --- |
| `skills/browser-testing/` | The workflow: install-if-missing, dev-server readiness, snapshot → ref → act → assert, mobile pass, evidence discipline, cleanup. |
| `rules/browser-testing.md` | Fires on `**/*.vue`, `*.tsx`, `*.jsx`, `*.svelte` and anything under `pages/`, `components/`, `layouts/` — after a UI edit, verify in the browser. |
| `settings.local.json` | Pre-approves `playwright-cli`, the global install and `npx playwright` so verification doesn't stall on a permission prompt. |
| `CLAUDE.md` | A pointer block to paste into your project's `CLAUDE.md`. |

## Install

```bash
unzip browser-testing.zip
mkdir -p .claude
cp -R browser-testing/skills browser-testing/rules .claude/
cat browser-testing/CLAUDE.md >> CLAUDE.md
```

`settings.local.json` must be **merged**, not copied — you almost certainly have one already.
Append the three entries to the existing `permissions.allow` array in `.claude/settings.local.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(playwright-cli:*)",
      "Bash(npm install -g @playwright/cli*)",
      "Bash(npx playwright:*)"
    ]
  }
}
```

If you have no `.claude/settings.local.json` yet, copy the bundle's file straight over:
`cp browser-testing/settings.local.json .claude/`.

## How the rule fires

Path-scoped rules load automatically when Claude touches a matching file. Edit a `.vue` component
or anything under `pages/`, and `rules/browser-testing.md` enters the context with a single
instruction: prove it in the browser, via the `browser-testing` skill, before saying it's done.
The skill then carries the whole procedure — including installing `playwright-cli` from npm if it
isn't on PATH, so "the tool wasn't there" never becomes a reason to skip verification.

## Why

Typecheck, lint and unit tests all pass on a component that never mounted, a Tailwind class that
resolved to nothing, a click handler bound to the wrong element, and a page that throws on
hydration. Only a real browser catches those. The skill's evidence rules are the point: exact
commands, their outputs, a screenshot you actually looked at, and a console check — not "verified,
looks good".

## Requirements

- `node` and `npm` on PATH. The skill installs `@playwright/cli` globally if missing.
- Playwright browsers are a separate download (`npx playwright install`); the skill covers the
  prompt you'll see.

## Test accounts

Credentials never live in this bundle. For an auth-gated app, register a test account in the **dev**
environment and keep its email, password, login steps and dev URL in a project-local skill
(`.claude/skills/<project>-browser-testing/SKILL.md`). That file is also the right place for the
project's dev command, port, and the routes worth covering after a change.

## Companion bundles

- **[`nuxt`](/skill/nuxt)** and **[`nuxt-ui`](/skill/nuxt-ui)** — their rules point back here for UI validation.
