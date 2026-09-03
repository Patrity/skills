---
name: browser-testing
description: Use when validating UI or end-to-end behaviour of the Skills site with playwright-cli (tree navigation, markdown/code rendering, downloads, filters, dark mode). Use it to PROVE a change works in the real browser — green typecheck/test/build never catch rendering or wiring bugs.
---

# Browser testing (playwright-cli)

Validate UI with **`playwright-cli`** (terminal CLI), never the Playwright MCP. The site is public: no login, no test account.

## Dev server
- Real bundles: `pnpm dev` → http://localhost:3000
- Test bundles (demo / broken / no-readme): `NUXT_SKILLS_DIR=test/fixtures/skills pnpm dev`
- Ready check: `until curl -sf http://localhost:3000 >/dev/null; do sleep 1; done`

## Core workflow: snapshot → ref → act
```bash
playwright-cli open http://localhost:3000/skills     # or: goto <url>
playwright-cli snapshot                              # YAML tree with [ref=eNN] ids
playwright-cli click e31
playwright-cli fill e20 "nuxt"
playwright-cli eval "() => ({ path: location.pathname, text: document.body.innerText.slice(0, 200) })"
playwright-cli screenshot --filename=/tmp/x.png      # then Read the PNG
```
Refs change after navigation — re-snapshot before clicking.

## Useful assertions
```bash
# CodeMirror mounted (client-only component)
playwright-cli eval "() => !!document.querySelector('.cm-editor')"
# Rendered markdown heading present
playwright-cli eval "() => document.querySelector('h1')?.textContent"
# Download headers (no browser needed)
curl -sI http://localhost:3000/api/skills/nuxt/download | grep -i content-disposition
# Umami must be absent on localhost
playwright-cli eval "() => !!document.querySelector('script[data-website-id]')"   # → false
```

## reka-ui components need a real click
`UTree` rows, `USlideover`, `UCollapsible`, `UFieldGroup` buttons: use `playwright-cli click <ref>`, not `el.click()` inside `eval`.

## Routes to cover after UI changes
`/`, `/skills` (search + tag chip), `/skill/nuxt`, `/skill/nuxt/skills/nuxt-docs/fetch.py`, `/skill/nuxt/rules/web-nuxt.md` (Rendered ↔ Source), `/docs`, `/docs/frontmatter`, a 404 (`/skill/nope`). Toggle dark mode via the sidebar button and screenshot a code file.
