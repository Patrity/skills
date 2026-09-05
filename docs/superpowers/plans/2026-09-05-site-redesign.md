# Site Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give skills.patrity.com the TechHive Labs DNA (tokens, type, hive motif) under its own name, replace the dashboard shell with a top nav, rebuild the home and editorial surfaces by hand, restyle the tool pages, rewrite every line of copy in Tony's voice, add the blog/social backlinks and OG images — reviewed in Claude Design first, then shipped to production.

**Architecture:** Phase A produces self-contained HTML previews (foundations, components, page mockups) committed under `docs/design/previews/` and pushed to a Claude Design project; the user approves there. Phase B implements the approved previews: `@theme` tokens + `@nuxt/fonts` + a ported `HiveBackground`; a hand-built shell, home and docs; Nuxt UI kept only for tree, select, checkbox, tabs, toast and slide-over and restyled through `app.config.ts`; copy rewritten against `docs/voice.md`; `@nuxtjs/seo` for OG images and JSON-LD. Phase C pushes `main`, verifies the deploy and measures Lighthouse against the recorded baseline.

**Tech Stack:** Nuxt 4.5, Nuxt UI 4.11 (restyled), Tailwind 4 `@theme`, `@nuxt/fonts` (Teko, JetBrains Mono from Google), `@nuxtjs/seo` (nuxt-og-image / satori), Canvas 2D (`HiveBackground`), vitest 4.1, `playwright-cli`, Lighthouse CLI, Claude Design via the `DesignSync` tool.

**Spec:** `docs/superpowers/specs/2026-09-05-site-redesign-design.md` (§1 audit, §3 system + Claude Design, §4 shell/home, §5 tool pages, §6 copy/backlinks/SEO, §7 constraints, §8 testing, §9 rollout). Voice: `docs/voice.md`. Brand source: `docs/design/techhive-brand-inventory.md`.

## Global Constraints

- pnpm only; conventional commits; no `Co-Authored-By`/`Claude-Session`/model references (check `git log -1 --format=%B`). Do not push; the controller pushes in Task 13.
- Tokens, exact: green ramp `50 #f0fae8, 100 #dff4cf, 200 #c4e9a7, 300 #96d76c, 400 #46c211, 500 #39a10e, 600 #2e850b, 700 #256a09, 800 #1d520a, 900 #174209, 950 #0c2604`; Nuxt UI `primary: 'green'`, `neutral: 'neutral'`; display font Teko 500/600/700 (`--font-teko`), body = system sans stack, mono JetBrains Mono 400/500 (`--font-mono`); glow `shadow-[0_0_30px_rgba(70,194,17,0.12)]` on hover only; section rhythm `py-20`, content `max-w-5xl`, hero `max-w-7xl`, page padding `px-6 sm:px-10 lg:px-8`; radii `rounded-lg`/`rounded-xl`; borders `border-(--ui-border)`.
- Name stays **Skills**; mark = one outlined hexagon with a green `/` inside; wordmark Teko; "by TechHive Labs" in the micro-label style (`text-xs uppercase tracking-widest text-(--ui-text-dimmed)`).
- Colour mode follows the system with a toggle; both modes fully designed and checked.
- Shell: top nav on every page, no `UDashboard*` anywhere; exactly one `<h1>` per page from our own markup.
- Nuxt UI allowed only for: `UTree`, `USelect`, `UInput`, `UCheckbox`, `UTabs`, `UToast`/`useToast`, `USlideover`, `UTooltip`, `UColorModeButton`, `USwitch`, `URadioGroup`; everything else is Tailwind markup on the tokens. Existing rules stay: never `<MDC :value>`; `mdc.highlight.langs` unchanged; `UTree` `v-model` = item object, `v-model:expanded` = key strings, `get-key`.
- Links, exact: Blog `https://www.techhivelabs.net/blog`, Lab Notes home `https://www.techhivelabs.net`, X `https://x.com/Patrity`, GitHub `https://github.com/Patrity`, Bluesky `https://bsky.app/profile/patrity.com`, LinkedIn `https://www.linkedin.com/in/tonycos/`, Blog RSS `https://www.techhivelabs.net/rss.xml`, npm `https://www.npmjs.com/package/@patrity/skills`. Personal profiles carry `rel="me"`; socials open in a new tab (`target="_blank" rel="me noopener"`), the blog in the same tab.
- Copy: every new or rewritten sentence follows `docs/voice.md` (first person, `..` as the pause mark, exact numbers, no marketing words, headings that promise or joke), goes through the `humanizer` skill (`~/.claude/skills/humanizer/SKILL.md`), and is fact-checked against code before commit; the user reads the home and Start-here copy before release (Task 10 gate).
- `HiveBackground` mounts client-side only, reserves its box (no layout shift), draws one static frame under `prefers-reduced-motion`.
- Blog RSS is fetched server-side with a 5 s timeout and a committed static fallback; never on the client; a failed fetch logs and falls back.
- New dependencies limited to `@nuxt/fonts` and `@nuxtjs/seo`.
- ISR route rules, warm list and `/build` hash state unchanged; `/api/lab-feed` (new) gets `isr: 3600` and the `skills` tag.
- Lighthouse performance and accessibility on `/`, `/skills`, `/skill/nuxt` must not fall below the baseline recorded in Task 1.
- Port 3000 is taken: dev server `PORT=3210 pnpm dev`; prod-like `PORT=3100`. Browser checks with `playwright-cli` only.
- Gate before every commit: `pnpm lint && pnpm typecheck && pnpm test:unit`; `pnpm test` and `pnpm build` at the end of any task touching routes, `nuxt.config.ts`, layouts, pages or `content/docs/`.

---

## File structure

```
docs/design/previews/foundations/{colors,type,spacing,motifs}.html      Phase A cards (@dsCard group="Foundations")
docs/design/previews/components/*.html                                   buttons, chips, install-box, code-block, glass-card, bundle-row, tree-row, form-controls, author-card, header, footer, callout
docs/design/previews/pages/{home,skills,skill,build,docs}[-mobile].html  page mockups (@dsCard group="Pages")
docs/design/previews/_shared/tokens.css, mark.svg, hive-texture.svg      shared by every preview (inlined at build by scripts/design-inline.ts)
scripts/design-inline.ts                                                 inlines _shared into each preview → dist/design/** (self-contained files for DesignSync)
scripts/lighthouse.sh                                                    baseline / after measurement → docs/design/lighthouse-<date>.json + table
app/assets/css/main.css                                                  @theme tokens, utilities (.glass-card, .micro, .hive-texture), CodeMirror theme vars
app/app.config.ts                                                        ui: colors + component slot overrides
app/components/brand/BrandMark.vue, BrandWordmark.vue                    the mark and the wordmark (inline SVG + Teko)
app/components/brand/HiveBackground.vue                                  ported from portfolio-v2 (canvas)
app/components/site/SiteHeader.vue, SiteFooter.vue, SiteNavDrawer.vue    the shell
app/components/site/AuthorCard.vue, MicroLabel.vue, GlassCard.vue, InstallBox.vue (replaces skill/InstallCommand.vue)
app/components/home/{HeroTerminal,WhatYouGet,Opinions,BundleList,LabFeed,Closing}.vue
app/assets/transcripts/init.json                                          the typed terminal transcript
server/lib/site/lab-feed.ts + server/api/lab-feed.get.ts + content/lab-feed.fallback.json
app/components/OgImage/Skills.vue                                        satori template (static hive lattice + mark + Teko title)
public/favicon.svg, public/favicon.ico
app/layouts/default.vue, app/app.vue, app/pages/{index,skills,build}.vue, app/pages/skill/[...segments].vue, app/pages/docs/[[slug]].vue
app/components/skill/{SkillCard→SkillRow,SkillMetaCard→SkillHeader,SkillTree,FileActions}.vue, app/components/build/*.vue (restyled)
content/docs/*.md, README.md, cli/src/commands/*.ts (help copy), cli/README.md
test/unit/{lab-feed,og-title,brand-mark}.test.ts, test/e2e/api.test.ts (+ site.test.ts)
```

Task order: 1 baseline → 2 foundations + component previews → 3 page mockups → 4 Claude Design push + approval gate → 5 app foundations → 6 shell → 7 home → 8 skills + skill → 9 build + docs → 10 copy (user gate) → 11 SEO/backlinks/author card → 12 verification → 13 release.

---

## Phase A — design

### Task 1: Baseline measurements and the audit record

**Files:**
- Create: `scripts/lighthouse.sh`, `docs/design/lighthouse-2026-09-05-before.json`
- Modify: `docs/superpowers/specs/2026-09-05-site-redesign-design.md` (§1 baseline table), `package.json` (`"lighthouse": "bash scripts/lighthouse.sh"`)

**Interfaces:**
- Produces: `bash scripts/lighthouse.sh <base-url> <out.json>` → runs Lighthouse (performance + accessibility, mobile preset) on `/`, `/skills`, `/skill/nuxt`, writes `{ "<path>": { "performance": 0.xx, "accessibility": 0.xx } }` and prints a markdown table. Task 12 reuses it.

- [ ] **Step 1: Script**

`scripts/lighthouse.sh`:
```bash
#!/usr/bin/env bash
# Lighthouse (mobile preset) on the three pages the redesign must not regress.
# Usage: bash scripts/lighthouse.sh https://skills.patrity.com docs/design/lighthouse-YYYY-MM-DD-before.json
set -euo pipefail
base="${1:?base url}"; out="${2:?output json}"
tmp="$(mktemp -d)"
echo '{}' > "$out"
for path in / /skills /skill/nuxt; do
  pnpm dlx lighthouse@12 "${base}${path}" --only-categories=performance,accessibility --preset=perf --form-factor=mobile \
    --screenEmulation.mobile --quiet --chrome-flags='--headless=new' --output=json --output-path="$tmp/report.json" >/dev/null
  node -e '
    const [outPath, path, reportPath] = process.argv.slice(1)
    const fs = require("fs")
    const r = JSON.parse(fs.readFileSync(reportPath, "utf8"))
    const o = JSON.parse(fs.readFileSync(outPath, "utf8"))
    o[path] = { performance: r.categories.performance.score, accessibility: r.categories.accessibility.score }
    fs.writeFileSync(outPath, JSON.stringify(o, null, 2) + "\n")
  ' "$out" "$path" "$tmp/report.json"
done
node -e '
  const o = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))
  console.log("| page | performance | accessibility |\n| --- | --- | --- |")
  for (const [p, s] of Object.entries(o)) console.log(`| ${p} | ${Math.round(s.performance * 100)} | ${Math.round(s.accessibility * 100)} |`)
' "$out"
```
(If `--preset=perf` conflicts with `--only-categories` on the installed version, drop the preset; keep mobile emulation.)

- [ ] **Step 2: Run against production** → `bash scripts/lighthouse.sh https://skills.patrity.com docs/design/lighthouse-2026-09-05-before.json`. Paste the printed table into spec §1 under "Baseline metrics", replacing the parenthetical sentence.

- [ ] **Step 3: Commit** — `git add scripts/lighthouse.sh docs/design/lighthouse-2026-09-05-before.json docs/superpowers/specs/2026-09-05-site-redesign-design.md package.json && git commit -m "chore(design): lighthouse baseline for the redesign"`.

---

### Task 2: Foundations and component previews

**Files:**
- Create: `docs/design/previews/_shared/tokens.css`, `docs/design/previews/_shared/mark.svg`, `docs/design/previews/_shared/hive-texture.svg`, `docs/design/previews/foundations/{colors,type,spacing,motifs}.html`, `docs/design/previews/components/{buttons,chips,install-box,code-block,glass-card,bundle-row,tree-row,form-controls,author-card,header,footer,callout}.html`, `scripts/design-inline.ts`
- Test: `test/unit/design-inline.test.ts`

**Interfaces:**
- Produces: every preview is a standalone HTML file that (after `pnpm tsx scripts/design-inline.ts`) contains its CSS inline and references only `https://fonts.googleapis.com` for Teko and JetBrains Mono; first line `<!-- @dsCard group="Foundations|Components" -->`; each renders both colour modes side by side (a `.light` and a `.dark` wrapper) unless the card is mode-neutral. `dist/design/**` mirrors `docs/design/previews/**` with `_shared` inlined; Task 4 uploads `dist/design`.
- The token file is the single source for Phase A and is copied verbatim into `app/assets/css/main.css` in Task 5.

- [ ] **Step 1: Tokens**

`docs/design/previews/_shared/tokens.css`:
```css
:root {
  --font-teko: "Teko", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --color-green-50: #f0fae8; --color-green-100: #dff4cf; --color-green-200: #c4e9a7; --color-green-300: #96d76c;
  --color-green-400: #46c211; --color-green-500: #39a10e; --color-green-600: #2e850b; --color-green-700: #256a09;
  --color-green-800: #1d520a; --color-green-900: #174209; --color-green-950: #0c2604;
  --ui-bg: #fafaf9; --ui-bg-elevated: #ffffff; --ui-border: rgba(0,0,0,.08); --ui-text: #171717; --ui-text-muted: #525252; --ui-text-dimmed: #737373;
}
.dark {
  --ui-bg: #0c0c0b; --ui-bg-elevated: #161615; --ui-border: rgba(255,255,255,.08); --ui-text: #fafafa; --ui-text-muted: #a3a3a3; --ui-text-dimmed: #737373;
}
body { margin: 0; font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--ui-text); background: var(--ui-bg); }
.teko { font-family: var(--font-teko); font-weight: 600; line-height: .9; letter-spacing: -.01em; }
.mono { font-family: var(--font-mono); font-size: .875rem; }
.micro { font-size: .75rem; text-transform: uppercase; letter-spacing: .2em; color: var(--ui-text-dimmed); }
.accent { color: var(--color-green-400); }
.glass-card { background: rgba(255,255,255,.03); backdrop-filter: blur(12px); border: 1px solid var(--ui-border); border-radius: .75rem; }
.light .glass-card { background: rgba(0,0,0,.02); }
.glow:hover { box-shadow: 0 0 30px rgba(70,194,17,.12); }
.btn { display: inline-flex; align-items: center; gap: .5rem; padding: .625rem 1rem; border-radius: .5rem; font-weight: 600; text-decoration: none; }
.btn-solid { background: var(--color-green-500); color: #fff; } .btn-solid:hover { background: var(--color-green-600); }
.btn-outline { border: 1px solid var(--ui-border); color: var(--ui-text); } .btn-outline-green { border: 1px solid var(--color-green-500); color: var(--color-green-400); }
.btn-ghost { color: var(--ui-text-muted); }
.chip { font-family: var(--font-mono); font-size: .6875rem; padding: .125rem .5rem; border-radius: 9999px; border: 1px solid var(--ui-border); color: var(--ui-text-muted); }
.chip-active { border-color: var(--color-green-500); color: var(--color-green-400); background: color-mix(in srgb, var(--color-green-500) 12%, transparent); }
.install { font-family: var(--font-mono); font-size: .875rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .625rem .875rem; border: 1px solid var(--ui-border); border-radius: .5rem; background: var(--ui-bg-elevated); }
.hive-texture { background-image: url("hive-texture.svg"); background-size: 120px 208px; opacity: .04; }
```

`docs/design/previews/_shared/mark.svg` (the Skills mark: outlined hexagon, green slash; `currentColor` outline so it follows the text colour):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="40" height="40" aria-hidden="true">
  <polygon points="50,4 90,27 90,73 50,96 10,73 10,27" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>
  <line x1="62" y1="30" x2="38" y2="70" stroke="#46c211" stroke-width="9" stroke-linecap="round"/>
</svg>
```
`hive-texture.svg`: a 120×208 tile with two pointy-top hexagons (circumradius 60, stroke `#39a10e` 1px, no fill), the second offset by 60×104, so it tiles as a honeycomb (same lattice as the portfolio's canvas: stride 120×78 rows, odd rows offset 60 — reproduce that geometry; the exact path coordinates are `M60,2 L112,32 L112,92 L60,122 L8,92 L8,32 Z` for the first hexagon of a 120-wide cell, repeat for the second with the offset). Verify visually.

- [ ] **Step 2: Inliner + test**

`test/unit/design-inline.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { inlinePreview } from '../../scripts/design-inline'

describe('inlinePreview', () => {
  it('replaces the shared stylesheet link with inline CSS and the mark include with the SVG', () => {
    const html = '<!-- @dsCard group="Components" -->\n<link rel="stylesheet" href="../_shared/tokens.css">\n<i data-include="mark.svg"></i>'
    const out = inlinePreview(html, { 'tokens.css': ':root{--x:1}', 'mark.svg': '<svg id="m"></svg>' })
    expect(out.startsWith('<!-- @dsCard group="Components" -->')).toBe(true)
    expect(out).toContain('<style>:root{--x:1}</style>')
    expect(out).toContain('<svg id="m"></svg>')
    expect(out).not.toContain('_shared/')
  })
})
```
`scripts/design-inline.ts` exports `inlinePreview(html: string, shared: Record<string, string>): string` (regex-replace `<link rel="stylesheet" href="…/_shared/<name>">` → `<style>…</style>` and `<i data-include="<name>"></i>` → file content; `hive-texture.svg` referenced from CSS `url("hive-texture.svg")` becomes a `data:image/svg+xml;utf8,` URI) and, when run as a script, walks `docs/design/previews/**/*.html` (excluding `_shared`) into `dist/design/**` preserving paths. Root `package.json` script `"design:build": "tsx scripts/design-inline.ts"`; `dist/` is already gitignored.

- [ ] **Step 3: The cards**

Each card: `<!-- @dsCard group="Foundations" -->` (or `Components`), `<meta charset>`, `<link>` to Google Fonts `family=Teko:wght@500;600;700&family=JetBrains+Mono:wght@400;500`, the shared stylesheet link, then a two-column body: `<section class="light">` and `<section class="dark">` each `padding:32px`, rendering the same content. Content per card (keep each under ~150 lines):
- `foundations/colors.html`: the 11 green swatches with hex labels (Teko numerals), the bg/elevated/border/text swatches for each mode.
- `foundations/type.html`: Teko display scale (96/72/56/40/28 px, three-line sample with one `.accent` word), body paragraph at 16/1.6, `.micro` label, `.mono` line `~/ claude code · one setup · take what you want`.
- `foundations/spacing.html`: rulers for `py-20`, `max-w-5xl`/`7xl`, card paddings 16/20/24, radii 8/12.
- `foundations/motifs.html`: the hive texture block at 4% and 40%, the glass card on the texture, micro-label + Teko heading pair, the mark at 24/40/64 px in both modes, the wordmark "Skills" + "by TechHive Labs".
- `components/buttons.html`: solid, outline, outline-green, ghost icon (GitHub, X glyphs as inline SVG), sizes sm/md/lg, hover state (a second copy with `.glow`).
- `components/chips.html`: tag chips default/active, content badge icons (skills, rules, hooks, settings, CLAUDE.md) with labels.
- `components/install-box.html`: `pnpx @patrity/skills init` with a copy glyph; a bundle variant `pnpx @patrity/skills add nuxt`.
- `components/code-block.html`: a 12-line CLAUDE.md excerpt with the CodeMirror-matched palette (comments dimmed, headings bold, markers green).
- `components/glass-card.html`: the three "What you get" cards with six-line mono excerpts.
- `components/bundle-row.html`: two rows (Nuxt, Quality hooks): mark, Teko name, one line, chips, badge icons, action cluster.
- `components/tree-row.html`: the file tree column (folders with green chevrons, README pinned, mono names, active row).
- `components/form-controls.html`: select, input, checkbox (checked/locked with padlock), preset tile (idle/active), segmented control, switch — the target look Nuxt UI is restyled to.
- `components/author-card.html`: mark, "Tony Costanzo · TechHive Labs", one sentence, Blog and X links.
- `components/header.html` and `components/footer.html`: the shell exactly as spec §4.1 at 1440 and 375 (two stacked frames).
- `components/callout.html`: a docs callout on glass.

- [ ] **Step 4: Verify** — `pnpm tsx scripts/design-inline.ts` writes `dist/design/**`; open three cards with `playwright-cli` (file URLs) and screenshot; check fonts loaded (`document.fonts.check('600 32px Teko')`), no console errors, both modes visible. `pnpm vitest run test/unit/design-inline.test.ts` PASS. Root gate.

- [ ] **Step 5: Commit** — `git add docs/design/previews scripts/design-inline.ts test/unit/design-inline.test.ts package.json && git commit -m "design: foundations and component previews for the Skills design system"`.

---

### Task 3: Page mockups

**Files:**
- Create: `docs/design/previews/pages/{home,skills,skill,build,docs}.html` (1440) and `{home,skills,skill,build,docs}-mobile.html` (375); `home-dark.html` and `home-mobile-dark.html` (the other pages show both modes inside one file only when it stays legible; otherwise the light version, with a dark hero strip)

**Interfaces:**
- Consumes: Task 2 tokens and card markup (copy the component markup verbatim; do not restyle).
- Produces: the visual contract Tasks 6–9 implement. Each mockup is static HTML with realistic content: the nine real bundle names/descriptions from `skills/*/README.md`, the real axis questions from `base/questions.yaml`, a real CLAUDE.md excerpt, the three real docs titles.

- [ ] **Step 1: Home (spec §4.2)** — six sections in order; hero uses the hive texture at 40% as a static stand-in for the canvas; the terminal card shows a frozen frame of the transcript (`$ pnpx @patrity/skills init --yes --profile nuxt-app` → the JSON `written` list truncated → `Setup written.`); bundle rows; "From the lab" with two real post titles from techhivelabs.net (dates, read times); close + byline. Hero headline copy is a draft in the voice: `Claude Code, set up / the way I actually / run it.` with "actually" as the accent word — Task 10 may replace it.
- [ ] **Step 2: Skills index (spec §5)**, **Skill page** (`/skill/nuxt` with tree + header + README excerpt), **Build** (form + preview with the segmented control and pinned download), **Docs** (`start-here` with the grouped nav and author card).
- [ ] **Step 3: Mobile variants** — 375 wide; header collapsed to hamburger; skill page tree as a closed "Files" disclosure; build preview as a bottom-sheet bar.
- [ ] **Step 4: Verify** — inline, screenshot each at its width with `playwright-cli` (`resize 1440 900` / `375 812`), no horizontal scroll at 375 (`document.documentElement.scrollWidth <= 375`), fonts loaded. Save screenshots to `docs/design/screenshots/` (committed; these are the review record).
- [ ] **Step 5: Commit** — `git add docs/design && git commit -m "design: page mockups for home, skills, skill, build and docs"`.

---

### Task 4: Claude Design project and the approval gate (controller + user)

- [ ] **Step 1 (controller):** `pnpm design:build`; `DesignSync create_project` name `Skills (TechHive)`; `DesignSync finalize_plan` with `localDir: dist/design`, `writes: ["foundations/*.html", "components/*.html", "pages/*.html"]`; `DesignSync write_files` with `localPath` for every file (≤ 256 per call); confirm with `list_files`.
- [ ] **Step 2 (user):** review in claude.ai/design; comment.
- [ ] **Step 3 (controller loop):** for each round of comments: edit the preview files, `pnpm design:build`, `finalize_plan` for the changed paths only, `write_files`; commit `design: revise <what> after review`. Stop when the user says the system and pages are approved. **Phase B does not start before that message.**

---

## Phase B — implementation

### Task 5: Foundations in the app

**Files:**
- Modify: `package.json` (+ `@nuxt/fonts`, `@nuxtjs/seo`), `nuxt.config.ts` (modules, `fonts`, `site`, `ogImage`), `app/assets/css/main.css`, `app/app.config.ts`, `app/app.vue` (favicon links; title template stays for now)
- Create: `app/components/brand/BrandMark.vue`, `app/components/brand/BrandWordmark.vue`, `app/components/brand/HiveBackground.vue` (ported), `app/components/site/MicroLabel.vue`, `app/components/site/GlassCard.vue`, `app/components/site/InstallBox.vue`, `app/components/OgImage/Skills.vue`, `public/favicon.svg`, `public/favicon.ico`
- Test: `test/unit/brand-mark.test.ts`, `test/e2e/api.test.ts` (favicon + OG route), `test/unit/og-title.test.ts`

**Interfaces:**
- Produces: `<BrandMark :size="24|40|64" />` (inline SVG, `currentColor` outline, green slash), `<BrandWordmark />` (mark + "Skills" in Teko + optional "by TechHive Labs" micro-label via prop `byline`), `<MicroLabel>text</MicroLabel>`, `<GlassCard class="…">`, `<InstallBox :command :slug @copied />` (replaces `SkillInstallCommand`; same analytics event `skill-install-copy`), `<HiveBackground :energy="'full'|'low'" />`, `defineOgImageComponent('Skills', { title })` usable from any page, `fitOgTitle(title: string, max = 42): string` in `shared/utils/og.ts`.
- CSS utilities available everywhere: `.glass-card`, `.micro`, `.hive-texture`, `.font-teko` (via `--font-teko`), `.font-mono` (JetBrains Mono).

- [ ] **Step 1: Dependencies and config**

`pnpm add @nuxt/fonts @nuxtjs/seo`. `nuxt.config.ts`: `modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxtjs/mdc', 'nuxt-umami', '@nuxt/fonts', '@nuxtjs/seo']`; add
```ts
  fonts: { families: [
    { name: 'Teko', provider: 'google', weights: [500, 600, 700] },
    { name: 'JetBrains Mono', provider: 'google', weights: [400, 500] }
  ] },
  site: { url: process.env.NUXT_PUBLIC_SITE_URL || 'https://skills.patrity.com', name: 'Skills', description: 'The Claude Code setup I actually run, as bundles you can take one at a time.', defaultLocale: 'en' },
  ogImage: { defaults: { component: 'Skills', renderer: 'satori', width: 1200, height: 630 }, fonts: ['Teko:600', 'JetBrains+Mono:400'] },
  sitemap: { enabled: false }, robots: { enabled: false }, schemaOrg: { enabled: true }, linkChecker: { enabled: false }
```
(`@nuxtjs/seo` bundles its own sitemap/robots; ours exist as routes — disable the module's so nothing double-serves. Check the installed module's option names in `node_modules/@nuxtjs/seo` before relying on them.)

- [ ] **Step 2: Tokens and utilities**

`app/assets/css/main.css`: keep the two imports, then a `@theme static { … }` block with `--font-teko`, `--font-mono`, and the eleven `--color-green-*` values from the Global Constraints; then the utilities from Task 2's `tokens.css` translated to Tailwind 4 (`.glass-card`, `.light .glass-card`, `.micro`, `.hive-texture` with the SVG as a data URI, `.glow`), plus CodeMirror theme variables (`--cm-bg: var(--ui-bg-elevated); --cm-gutter: transparent; --cm-accent: var(--color-green-400)`) consumed in Task 8. `app/app.config.ts`:
```ts
export default defineAppConfig({
  ui: {
    colors: { primary: 'green', neutral: 'neutral' },
    button: { slots: { base: 'font-semibold' } },
    input: { slots: { base: 'font-mono text-sm' } },
    select: { slots: { base: 'font-mono text-sm' } },
    tabs: { slots: { list: 'bg-(--ui-bg-elevated) border border-(--ui-border) rounded-lg p-1', trigger: 'font-medium' } },
    tree: { slots: { link: 'font-mono text-sm', linkTrailingIcon: 'text-green-500' } },
    checkbox: { slots: { label: 'text-sm' } }
  }
})
```
(Verify each slot name against the installed `@nuxt/ui` theme files under `node_modules/@nuxt/ui/dist/runtime/theme/*.ts`; adjust names, not intent.)

- [ ] **Step 3: Brand components**

`BrandMark.vue`: the SVG from Task 2 with `:width/:height="size"`, `class="text-(--ui-text)"`, `aria-hidden="true"`. `BrandWordmark.vue`: `<NuxtLink to="/" class="flex items-center gap-2"><BrandMark :size="28" /><span class="font-teko text-3xl leading-none font-semibold">Skills</span><span v-if="byline" class="micro hidden md:inline">by TechHive Labs</span></NuxtLink>`. `MicroLabel.vue`: `<span class="micro"><slot /></span>`. `GlassCard.vue`: `<div class="glass-card p-6"><slot /></div>`. `InstallBox.vue`: move `SkillInstallCommand.vue`'s logic (clipboard + toast + `trackInstallCopy`) into the new look (`.install` from the tokens); keep the `slug` prop and event; update the three call sites; delete `InstallCommand.vue`.

`HiveBackground.vue`: copy `/Users/tony/Documents/GitHub/portfolio-v2/app/components/HiveBackground.vue` verbatim (same author, same licence), then: add prop `energy: 'full' | 'low'` that scales the idle breathing amplitude and the hot colour blend (low = 40% of full), keep the `prefers-reduced-motion` static frame, keep the `onMounted`/`onBeforeUnmount` lifecycle, wrap the canvas in `<div class="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">`. Unit test `brand-mark.test.ts`: render `BrandMark` with `@vue/test-utils` (already available through `@nuxt/test-utils`) and assert the two SVG children and the `#46c211` stroke.

- [ ] **Step 4: Favicons and OG**

`public/favicon.svg` = the mark on a transparent background with the outline in `#fafafa` and a `<style>@media (prefers-color-scheme: light){polygon{stroke:#171717}}</style>`; regenerate `public/favicon.ico` from it (`pnpm dlx png-to-ico` after rasterising with `pnpm dlx sharp-cli`, or keep the existing ICO if regeneration is fiddly and say so). `app/components/OgImage/Skills.vue`: start from `/Users/tony/Documents/GitHub/portfolio-v2/app/components/OgImage/TechHive.vue` (static-SVG hive lattice, satori-safe), replace the TechHive lockup with the Skills mark + wordmark, render `props.title` in Teko 600 at 72 px (wrapped to two lines by `fitOgTitle`), a micro-label `skills.patrity.com · by TechHive Labs`. `shared/utils/og.ts` `fitOgTitle` truncates on a word boundary to `max` chars with an ellipsis; unit test with a 20-char and an 80-char title. `app.vue`: `useHead` links for `/favicon.svg` (`image/svg+xml`) and `/favicon.ico`; call `defineOgImageComponent('Skills', { title: 'Skills' })` in `app.vue` as the default.

- [ ] **Step 5: Verify** — root gate; `pnpm build`; `pnpm test` with new e2e cases: `GET /favicon.svg` 200 `image/svg+xml`; `GET /__og-image__/image/og.png` (or the route the module logs at startup — read it from the dev server output and assert that) returns 200 `image/png` for `/` and `/skill/nuxt`. Dev server on :3210: fonts load (`document.fonts.check('600 32px Teko')` true), the hive renders on a scratch page.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(design): brand tokens, fonts, mark, hive background, OG template"`.

---

### Task 6: The shell

**Files:**
- Create: `app/components/site/SiteHeader.vue`, `app/components/site/SiteFooter.vue`, `app/components/site/SiteNavDrawer.vue`, `app/components/site/SocialLinks.vue`, `shared/utils/links.ts`
- Modify: `app/layouts/default.vue` (rewrite), `app/pages/{index,skills,build}.vue`, `app/pages/skill/[...segments].vue`, `app/pages/docs/[[slug]].vue` (remove `UDashboardPanel`/`UDashboardNavbar` wrappers; each page owns its `<h1>` — placeholders until Tasks 7–9 restyle), `app/app.vue` (title template `${title} · Skills` / `Skills — the Claude Code setup I actually run`)
- Test: `test/e2e/site.test.ts`

**Interfaces:**
- Produces: `shared/utils/links.ts`:
  ```ts
  export const LINKS = {
    blog: 'https://www.techhivelabs.net/blog', lab: 'https://www.techhivelabs.net', rss: 'https://www.techhivelabs.net/rss.xml',
    x: 'https://x.com/Patrity', github: 'https://github.com/Patrity', bluesky: 'https://bsky.app/profile/patrity.com', linkedin: 'https://www.linkedin.com/in/tonycos/',
    repo: 'https://github.com/Patrity/skills', npm: 'https://www.npmjs.com/package/@patrity/skills'
  } as const
  export const SOCIALS = [
    { label: 'GitHub', href: LINKS.github, icon: 'i-simple-icons-github' }, { label: 'X', href: LINKS.x, icon: 'i-simple-icons-x' },
    { label: 'Bluesky', href: LINKS.bluesky, icon: 'i-simple-icons-bluesky' }, { label: 'LinkedIn', href: LINKS.linkedin, icon: 'i-simple-icons-linkedin' }
  ] as const
  export const NAV = [{ label: 'Skills', to: '/skills' }, { label: 'Build', to: '/build' }, { label: 'Docs', to: '/docs' }, { label: 'Blog', to: LINKS.blog, external: true }] as const
  ```
- `<SiteHeader />`: sticky `top-0 z-40`, `backdrop-blur` + `bg-(--ui-bg)/80` once scrolled (a `useScroll` threshold class), `BrandWordmark byline` left, `NAV` centre (`NuxtLink` with `aria-current`), right `UColorModeButton` + `SocialLinks :only="['GitHub','X']"`, hamburger `< md` opening `SiteNavDrawer` (`USlideover` with NAV + all SOCIALS). `<SiteFooter />`: three columns per spec §4.1 on `.hive-texture`, copyright line `© {year} Tony Costanzo`. `<SocialLinks>` renders `<a :href target="_blank" rel="me noopener" :aria-label>` icon buttons.

- [ ] **Step 1: E2E first** (`test/e2e/site.test.ts`, same `setup` as `api.test.ts`): for each of `/`, `/skills`, `/skill/demo`, `/build`, `/docs/start-here`: fetch HTML, assert exactly one `<h1`, a `<header` containing `href="https://www.techhivelabs.net/blog"`, and a `<footer` containing `href="https://x.com/Patrity"` with `rel="me noopener"` and `href="https://www.techhivelabs.net/rss.xml"`. Run → FAIL.
- [ ] **Step 2: Implement** the four components and the layout: `<div class="min-h-dvh flex flex-col"><SiteHeader /><main class="flex-1"><slot /></main><SiteFooter /></div>`. Strip every `UDashboard*` element from the five pages, replacing each `#header` navbar with a page-owned `<header>` block holding the `<h1>` (Tasks 7–9 restyle these). `UDashboardSidebarCollapse` disappears with the sidebar.
- [ ] **Step 3: Verify** — e2e green; root gate; `pnpm build`; browser: header sticky/glass on scroll, drawer opens and closes with keyboard (Escape), focus returns to the hamburger, both colour modes, 375 px no horizontal scroll.
- [ ] **Step 4: Commit** — `git commit -m "feat(site): top-nav shell with footer backlinks; dashboard sidebar removed"`.

---

### Task 7: Home page

**Files:**
- Create: `app/components/home/{HeroTerminal,WhatYouGet,Opinions,BundleList,LabFeed,Closing}.vue`, `app/assets/transcripts/init.json`, `server/lib/site/lab-feed.ts`, `server/api/lab-feed.get.ts`, `content/lab-feed.fallback.json`, `shared/types/site.ts`
- Modify: `app/pages/index.vue` (rewrite), `nuxt.config.ts` (`'/api/lab-feed': { isr: 3600, headers: { 'Vercel-Cache-Tag': 'skills' } }`), `server/lib/skills/warm-urls.ts` (+ `/api/lab-feed`)
- Test: `test/unit/lab-feed.test.ts`, `test/e2e/api.test.ts` (`/api/lab-feed` shape), `test/unit/warm-cache.test.ts`

**Interfaces:**
- Produces: `shared/types/site.ts` `LabPost { title: string, url: string, date: string /* ISO */, readMinutes?: number }`; `server/lib/site/lab-feed.ts` `parseRss(xml: string): LabPost[]` (pure; `<item>` → `title`, `link`, `pubDate`→ISO, `readMinutes` from a `<description>` word count / 220 when present) and `latestLabPosts(fetchImpl: typeof fetch, opts: { url: string, timeoutMs: number, fallback: LabPost[] }): Promise<LabPost[]>` (two newest; on any failure logs `[lab-feed] falling back: <reason>` and returns `fallback`); `GET /api/lab-feed` → `{ posts: LabPost[], source: 'live' | 'fallback' }`.
- `init.json`: `{ "lines": [{ "type": "cmd" | "out" | "ok", "text": "…", "delay": 40 }] }` — a real transcript captured from `pnpm dlx @patrity/skills init --yes --profile nuxt-app --json` in a scratch dir (the `written` list shortened to 8 entries + `… 24 more`), ending `Setup written.`.

- [ ] **Step 1: Failing tests**

`test/unit/lab-feed.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { latestLabPosts, parseRss } from '../../server/lib/site/lab-feed'

const xml = `<?xml version="1.0"?><rss><channel>
<item><title>Older post</title><link>https://www.techhivelabs.net/blog/older</link><pubDate>Mon, 01 Jun 2026 10:00:00 GMT</pubDate><description>${'word '.repeat(440)}</description></item>
<item><title>Newest &amp; best</title><link>https://www.techhivelabs.net/blog/newest</link><pubDate>Wed, 19 Aug 2026 10:00:00 GMT</pubDate></item>
</channel></rss>`

describe('lab feed', () => {
  it('parses items, decodes entities, sorts newest first, estimates read time', () => {
    const posts = parseRss(xml)
    expect(posts.map(p => p.title)).toEqual(['Newest & best', 'Older post'])
    expect(posts[1]).toMatchObject({ url: 'https://www.techhivelabs.net/blog/older', date: '2026-06-01T10:00:00.000Z', readMinutes: 2 })
  })
  it('falls back on network failure and on timeout', async () => {
    const fallback = [{ title: 'f', url: 'https://www.techhivelabs.net/blog/f', date: '2026-01-01T00:00:00.000Z' }]
    const failing = (async () => { throw new Error('boom') }) as unknown as typeof fetch
    expect(await latestLabPosts(failing, { url: 'x', timeoutMs: 5000, fallback })).toEqual(fallback)
    const slow = ((_: string, init?: RequestInit) => new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('aborted'))))) as unknown as typeof fetch
    expect(await latestLabPosts(slow, { url: 'x', timeoutMs: 10, fallback })).toEqual(fallback)
  })
})
```
E2E: `GET /api/lab-feed` returns `{ posts: [2 items], source }` and `cache-control` absent of `no-store` (ISR); warm-cache test lists `/api/lab-feed`.

- [ ] **Step 2: Implement** `lab-feed.ts` (regex-based item extraction: `/<item>([\s\S]*?)<\/item>/g`, field pick with `/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/`, entity decode for `&amp; &lt; &gt; &quot; &#39;`; `AbortController` + `setTimeout` for the timeout; `fetchImpl` injected for tests), the route (`useRuntimeConfig` not needed; URL from `LINKS.rss`; fallback from `content/lab-feed.fallback.json` imported as JSON with two real current posts copied from the live feed), the route rule and warm entry.

- [ ] **Step 3: The page** — implement the six sections from the approved `pages/home.html` mockup, one component each; `HeroTerminal` types `init.json` line by line with `requestAnimationFrame` timing (`delay` ms per char for `cmd`, per line for `out`), loops after a 6 s pause, renders the final frame immediately under `prefers-reduced-motion` or when `IntersectionObserver` says off-screen; `BundleList` uses `useSkillsList()`; the status pill uses `/api/base` + the bundles list (existing pattern from the current home); `LabFeed` uses `useFetch('/api/lab-feed')` and renders "Read the lab notes ↗" → `LINKS.lab`; `Closing` renders the byline links (`rel="me"`). Copy in every section is a voice-checked draft (Task 10 finalises). `useSeoMeta` title/description; `defineOgImageComponent('Skills', { title: 'The Claude Code setup I actually run' })`.

- [ ] **Step 4: Verify** — root gate; `pnpm test`; `pnpm build`; browser at 1440/375 both modes: hero canvas animates and stops under reduced motion (emulate via `playwright-cli eval` with `matchMedia` override is not possible — use `--force-prefers-reduced-motion` Chromium flag if `playwright-cli` exposes it; otherwise assert the static class path with a unit test on the component's computed), terminal types and loops, no console errors, no horizontal scroll, Lighthouse on the local prod build (`PORT=3100 node .output/server/index.mjs`) using `scripts/lighthouse.sh http://localhost:3100 docs/design/lighthouse-2026-09-05-home-dev.json` as an early warning (not the gate).

- [ ] **Step 5: Commit** — `git commit -m "feat(home): hand-built home with hive hero, typed transcript, opinions, bundles and the lab feed"`.

---

### Task 8: Skills index and skill page

**Files:**
- Create: `app/components/skill/SkillRow.vue` (replaces `SkillCard.vue`), `app/components/skill/SkillHeader.vue` (replaces `SkillMetaCard.vue`), `app/components/skill/TagChips.vue`, `app/components/site/SegmentedControl.vue`
- Modify: `app/pages/skills.vue`, `app/pages/skill/[...segments].vue`, `app/components/skill/SkillTree.vue` (restyle), `app/components/skill/FileActions.vue` (segmented control + icon buttons), `app/components/CodeView.client.vue` (theme from the `--cm-*` vars), `app/components/skill/SkillBadges.vue` (icon-with-tooltip variant)
- Delete: `app/components/skill/SkillCard.vue`, `SkillMetaCard.vue`
- Test: `test/e2e/api.test.ts` docs/skills route assertions unchanged; `test/e2e/site.test.ts` (+ `/skills` has the search input and ≥ 9 rows; `/skill/demo` renders tree + header + README)

- [ ] **Step 1:** Implement `pages/skills.html` mockup: header (Teko `<h1>Skills</h1>`, `MicroLabel` `9 bundles`, mono `UInput` search), `TagChips` (ghost pills with counts, active green, keyboard toggle), `SkillRow` list (`glass-card glow`, whole row `NuxtLink`, action cluster with `@click.stop`: `InstallBox` compact, Source ↗, Download; keep `trackDownload/trackSource`).
- [ ] **Step 2:** Implement `pages/skill.html`: two columns (`lg:grid-cols-[280px_1fr]`), sticky tree (`SkillTree` restyled: mono names, `text-green-500` chevrons, README first via sort), `SkillHeader` (name, description, `TagChips` read-only, badges with `UTooltip`, `InstallBox`, mono `<dl>` for author/files/size/requires/gitignore/env), then the existing `MarkdownView`/`CodeView` content; `FileActions` becomes `SegmentedControl` (Rendered/Source) + ghost icon buttons; CodeMirror theme reads `--cm-*` (one-dark stays for dark, a light theme built from the tokens for light). Mobile: tree inside a `<details>`-style disclosure ("Files") above the content; keep the existing `USlideover` if simpler, styled to match.
- [ ] **Step 3: Verify** — e2e; root gate; `pnpm build`; browser both modes and widths; keyboard: tab through chips and rows; tree keyboard navigation still works; copy button toast.
- [ ] **Step 4: Commit** — `git commit -m "feat(skills): glass rows, tag chips, in-page tree and header on the skill page"`.

---

### Task 9: Builder and docs

**Files:**
- Modify: `app/pages/build.vue`, `app/components/build/{BuildForm,AxisField,BundlePicker,SetupPreview,FilesTree}.vue`, `app/pages/docs/[[slug]].vue`, `content/docs/nav.ts` (add `group: 'Start' | 'Reference' | 'Contribute'` to each entry), `shared/types/docs.ts` (`DocEntry.group`)
- Create: `app/components/docs/DocsNav.vue`, `app/components/docs/DocsFooter.vue` (Edit on GitHub ↗ + next page), `app/components/build/PreviewSheet.vue` (mobile bottom sheet)
- Test: `test/e2e/site.test.ts` (+ `/docs/start-here` has the three nav groups and an "Edit on GitHub" link pointing at `https://github.com/Patrity/skills/edit/main/content/docs/start-here.md`; `/build` has the segmented control and the download button)

- [ ] **Step 1: Build** — per `pages/build.html`: remove panel chrome; form column with Teko section labels + `MicroLabel` helper text; `URadioGroup variant="card"` tiles styled glass with a green ring when active (`ui` prop); `AxisField` selects/inputs mono; `BundlePicker` rows with mono tags, `i-lucide-lock` glyph + `UTooltip` on locked rows; `SetupPreview` sticky (`lg:sticky lg:top-20`), `SegmentedControl` for CLAUDE.md/Files, `USwitch` Rendered, download `UButton` pinned in a preview footer; `< lg` the preview lives in `PreviewSheet` (fixed bottom bar "Preview" that expands to 80vh). All existing behaviour (hash state, warnings, analytics) unchanged; the existing `build-state` tests stay green.
- [ ] **Step 2: Docs** — per `pages/docs.html`: `DocsNav` sticky left (`MicroLabel` group headings from `nav.ts` groups: Start = start-here, philosophy; Reference = cli, base-and-profiles, single-bundle, bundle-structure, frontmatter, hooks-and-settings; Contribute = contributing), reading column `max-w-3xl` with Teko `<h1>` from the entry title, `prose` tuned (leading, mono paths, glass callouts via a `.callout` class the markdown pipeline already emits for blockquotes → style `blockquote` as glass), `DocsFooter` (Edit on GitHub ↗, next page from nav order), `AuthorCard` placeholder slot (Task 11 fills it).
- [ ] **Step 3: Verify** — e2e; root gate; `pnpm build`; browser both modes and widths; builder keyboard traversal (tab order form → preview → download); docs nav current-page state.
- [ ] **Step 4: Commit** — `git commit -m "feat(build,docs): restyled builder panes and editorial docs layout"`.

---

### Task 10: Copy rewrite (with the user's read)

**Files:**
- Modify: every string in `app/pages/index.vue` and `app/components/home/*.vue`, `app/components/site/{SiteHeader,SiteFooter}.vue`, `app/pages/skills.vue`, `app/components/skill/SkillHeader.vue`, `app/components/build/*.vue` (labels, helper text, toasts), `content/docs/*.md`, `content/docs/nav.ts` (descriptions), `README.md`, `cli/src/commands/*.ts` (`meta.description`, arg descriptions), `cli/src/prompts.ts` (prompt questions and summary lines), `cli/README.md` (intro), `skills/*/README.md` (light pass: intro sentence only)
- Create: `docs/voice-checklist.md` (the 10 do/don't rules from `docs/voice.md` as a checklist the reviewer ticks)

**Interfaces:**
- Consumes: `docs/voice.md`. Rules, exact: first person; `..` as the pause mark (never an em dash); a number where an adjective would be; no words from the humanizer's promotional list; headings promise or joke, never label; each page/section ends on a fact, not a summary; commands and file names in mono.

- [ ] **Step 1:** Draft every surface. Home hero final headline and `~/` line; the six section headings; footer sentence; skills header line; builder helper texts (each one line, in the voice, still accurate); docs pages (keep structure and every factual claim, change the prose); README opening; CLI `--help` descriptions (`init: "Set up this project the way I run mine"` etc. — accurate first, voice second); bundle README first sentences.
- [ ] **Step 2:** Run the `humanizer` skill over every changed sentence; then walk `docs/voice-checklist.md` per surface; then fact-check each claim against code (commands/flags in `cli/src/commands`, counts from `base/questions.yaml` and `skills/`, file names). Record the checklist and fact-check in the task report.
- [ ] **Step 3 (gate):** Post the home copy and `content/docs/start-here.md` text in the report for the user; **the controller stops here and asks the user to read them.** Apply requested edits; repeat Step 2 on the edits.
- [ ] **Step 4:** `pnpm test` (docs e2e reads the pages), CLI gate (`--help` snapshots: update `cli/test/unit/args.test.ts` expectations if descriptions are asserted), root gate. If any `cli/src` string changed, note `cli-v0.2.1` for Task 13.
- [ ] **Step 5: Commit** — `git commit -m "docs: rewrite the site, docs, README and CLI help in the field-report voice"`.

---

### Task 11: Backlinks, author card, SEO

**Files:**
- Create: `app/components/site/AuthorCard.vue`, `app/composables/useSiteSeo.ts`
- Modify: `app/pages/docs/[[slug]].vue` (AuthorCard in `DocsFooter`), `app/pages/skill/[...segments].vue` (AuthorCard under the README view only), every page (`useSiteSeo({ title, description, ogTitle? })`), `app/app.vue` (JSON-LD `Person` via `useSchemaOrg` from `@nuxtjs/seo`), `app/pages/skill/[...segments].vue` (`SoftwareSourceCode` schema with `codeRepository` = `${repo}/tree/main/skills/${slug}`, `programmingLanguage: 'Markdown'`, `author`)
- Test: `test/e2e/site.test.ts` (+ author card present on `/docs/start-here` and `/skill/demo` with both links; `<script type="application/ld+json">` containing `"@type":"Person"` on `/` and `"SoftwareSourceCode"` on `/skill/demo`; `og:image` meta present on `/` and `/skill/demo` and its URL returns 200)

- [ ] **Step 1:** E2E first → FAIL. **Step 2:** `AuthorCard`: mark, "Tony Costanzo · TechHive Labs", one sentence in the voice, links Blog (same tab) and X (`rel="me noopener"`, new tab). `useSiteSeo`: wraps `useSeoMeta` (title, description, `ogTitle`, `ogDescription`, `twitterCard: 'summary_large_image'`) and `defineOgImageComponent('Skills', { title })`. `useSchemaOrg([definePerson({ name: 'Tony Costanzo', url: LINKS.lab, sameAs: [LINKS.x, LINKS.github, LINKS.bluesky, LINKS.linkedin] })])` in `app.vue`; the skill page adds `defineSoftwareSourceCode`-equivalent via `useSchemaOrg([{ '@type': 'SoftwareSourceCode', name, description, codeRepository, programmingLanguage: 'Markdown', author: { '@type': 'Person', name: 'Tony Costanzo' } }])`. **Step 3:** e2e green; root gate; `pnpm build`; validate the JSON-LD with `pnpm dlx structured-data-testing-tool` or by parsing it in the e2e test. **Step 4: Commit** — `git commit -m "feat(seo): author card, JSON-LD and per-page OG images"`.

---

### Task 12: Verification pass

**Files:**
- Create: `docs/design/screenshots/after/*.png` (committed review record), `docs/design/lighthouse-2026-09-05-after-local.json`
- Modify: `CLAUDE.md` (Constraints: tokens live in `main.css` `@theme`; Nuxt UI allowed only for the listed components; `HiveBackground` client-only + reduced motion; lab feed fallback; OG template; one `<h1>` from our markup), `README.md` (screenshot)

- [ ] **Step 1:** Full gate: `pnpm lint && pnpm typecheck && pnpm validate:skills && pnpm test && pnpm build`; CLI gate if `cli/` changed.
- [ ] **Step 2:** Browser matrix with `playwright-cli` against `PORT=3100 node .output/server/index.mjs` (fs source): pages `/`, `/skills`, `/skill/nuxt`, `/skill/nuxt/rules/nuxt4.md`, `/build`, `/docs/start-here`, `/docs/cli` × widths 1440/375 × modes light/dark (toggle via the header button) → screenshots to `docs/design/screenshots/after/`; assert per page: one `<h1>`, `scrollWidth <= viewport`, zero console errors; keyboard: header nav + drawer, skills chips, builder form to download; `/build` download → unzip → `pnpm dlx @patrity/skills diff` clean (behaviour unchanged).
- [ ] **Step 3:** `bash scripts/lighthouse.sh http://localhost:3100 docs/design/lighthouse-2026-09-05-after-local.json`; compare to the baseline table; if performance or accessibility dropped on any page, fix before continuing (typical causes: font loading without `display=swap`, the canvas on mobile, missing labels).
- [ ] **Step 4:** `CLAUDE.md` and `README.md` updates. **Step 5: Commit** — `git commit -m "chore(design): verification record and CLAUDE.md notes for the redesign"`.

---

## Phase C — release

### Task 13: Merge to main, deploy, verify (controller)

- [ ] **Step 1:** Confirm the branch state: all work is on `main` (this repo develops on `main`; there is no `master`); `git status` clean; `git log --format=%B origin/main..HEAD | grep -ciE 'co-authored|claude-session'` = 0.
- [ ] **Step 2:** `git push origin main`. If `cli/src` changed in Task 10: bump `cli/package.json` to `0.2.1`, changelog line "0.2.1 — help text rewritten", commit `chore(cli): 0.2.1`, push, `git tag -a cli-v0.2.1 -m "cli v0.2.1" && git push origin cli-v0.2.1`.
- [ ] **Step 3:** Watch `ci`, `revalidate` (may fail its warm step on new routes — expected), the Vercel deployment (must be Ready, not Canceled: `vercel inspect <url> --scope patritys-projects`) and the deploy-triggered `warm` run (or `gh workflow run warm.yml`). If the manifest parse shape changed (it does not in this plan), purge with `vercel cache invalidate --tag skills --scope patritys-projects`.
- [ ] **Step 4:** Production smoke: `/`, `/skills`, `/skill/nuxt`, `/build`, `/docs/start-here` → 200 and `x-vercel-cache` HIT after warm; header/footer backlinks present (`curl -s https://skills.patrity.com/ | grep -c 'techhivelabs.net'` ≥ 3); `/api/lab-feed` → `source: 'live'`; OG image URL from the home `og:image` meta returns 200 `image/png`; `bash scripts/lighthouse.sh https://skills.patrity.com docs/design/lighthouse-2026-09-05-after.json` ≥ baseline; commit the after-JSON (`chore(design): production lighthouse after the redesign`) and push.
- [ ] **Step 5:** MyMind: handover doc + task; final report to the user with the rulings list.

---

## Self-review notes

- **Spec coverage:** §1 audit → Task 1 (baseline) + the audit text already in the spec; §3.1–3.2 → Tasks 2 (previews) and 5 (app); §3.3 → Tasks 2–4; §4.1 → Task 6; §4.2 → Task 7; §5 → Tasks 8–9; §6 copy → Task 10; §6 backlinks/SEO → Tasks 6 (footer/header), 7 (lab feed, byline), 11 (author card, JSON-LD, OG); §7 constraints → Global Constraints + Tasks 5/7; §8 testing → each task + Task 12; §9 rollout → Tasks 4 (Phase A gate), 13 (Phase C).
- **Type consistency:** `LINKS`/`SOCIALS`/`NAV` (Task 6) are used by Tasks 7 (`LabFeed`, `Closing`), 9 (`DocsFooter` edit link builds on `LINKS.repo`), 11 (`AuthorCard`, schema `sameAs`); `LabPost` (Task 7) is the `/api/lab-feed` shape the `LabFeed` component consumes; `InstallBox` (Task 5) replaces `SkillInstallCommand` everywhere before Task 8 restyles rows; `SegmentedControl` (Task 8) is reused by Task 9's preview; `fitOgTitle` (Task 5) is used by the OG component only.
- **Placeholders:** Task 3's mockups are the markup contract for Tasks 6–9 by design (the plan does not repeat page markup; it points at the approved files). Task 10's copy is authored in-task against `docs/voice.md` with an explicit user gate. Task 5 tells the implementer to verify Nuxt UI slot names and `@nuxtjs/seo` option names against the installed packages rather than trusting the plan text.
- **User gates:** Task 4 (design approval in Claude Design) and Task 10 (copy read) are the only stops besides Task 13's push.
