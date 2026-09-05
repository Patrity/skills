# Site redesign — design

Date: 2026-09-05. Status: approved in brainstorm, frozen here. Applies to skills.patrity.com (Nuxt 4 + Nuxt UI 4 + Tailwind 4). Companion documents: `docs/voice.md` (Tony's writing voice, distilled from techhivelabs.net) and `docs/design/techhive-brand-inventory.md` (the portfolio's tokens, motifs, components and assets).

## 1. Audit of the live site (2026-09-05)

Captured at 1440×900 and 375×812 for `/`, `/skills`, `/skill/nuxt`, `/build`, `/docs/start-here`, alongside techhivelabs.net.

Findings, in order of impact:

1. **No identity.** Nuxt UI defaults throughout: Inter, emerald primary, zinc neutral, no custom CSS beyond the two Tailwind imports. Nothing connects the site to TechHive Labs, whose home has a strong system (Teko condensed headlines with one green word, canvas honeycomb background, glass cards, uppercase tracked micro-labels, the `~/` mono line, hex mark).
2. **Wrong shell for a marketing page.** Every page, including the home, sits inside a `UDashboardPanel` with a persistent sidebar (Home, Skills, Build, Docs, GitHub). The home reads as an admin panel; the hero floats in empty space; the byline is a footnote.
3. **Generic tool pages.** `/skills` is a grid of boxed cards with four rows of chips and buttons each; `/skill/<slug>` pins a `UPageCard` meta block above the README with duplicated titles; `/build` is functional but visually undifferentiated from any form; `/docs` is a stock two-column docs shell.
4. **Copy explains instead of reporting.** The hero says "Tony's opinionated Claude Code setup." then a 40-word explanatory sentence; section titles are labels ("How it works", "Two ways in, one result"); the docs read as documentation, not as the author.
5. **No backlinks.** "by Patrity" links to GitHub; there is no link to the blog, X, Bluesky or LinkedIn anywhere; no author card; no RSS.
6. **Mobile is fine but flat**: the sidebar becomes a hamburger, the hero stacks, nothing is broken; nothing is memorable either.
7. **Sharing**: no OG image, generic titles.

Baseline metrics (2026-09-05, Lighthouse mobile):

| page | performance | accessibility |
| --- | --- | --- |
| / | 82 | 100 |
| /skills | 78 | 96 |
| /skill/nuxt | 74 | 96 |

## 2. Decisions

| Decision | Choice |
| --- | --- |
| Review venue | Claude Design: a design-system project holding HTML previews and page mockups; implementation starts only after approval there |
| Brand relationship | Own name ("Skills"), shared DNA with TechHive Labs: tokens, type, hive motif, glass, micro-labels; own mark; byline and footer carry the backlinks |
| Shell | Slim top nav on every page; no global sidebar; in-page columns where a page needs them |
| Colour mode | Follows the system; toggle available; both modes fully designed |
| Engineering approach | Hybrid: hand-built Tailwind for the shell, home and editorial surfaces; Nuxt UI kept only for tree, select, checkbox, tabs, toast and slide-over, restyled through tokens and `app.config.ts` slots |
| Copy | Rewritten to `docs/voice.md`; humanizer pass; fact check; the user reads home and Start-here before ship |

## 3. Design system

### 3.1 Tokens (`app/assets/css/main.css`, `@theme`)
- Green ramp copied from the portfolio (50–950; `--color-green-400: #46c211` accent, `--color-green-500: #39a10e` as Nuxt UI `primary`); `neutral` as the neutral; dark `--ui-bg` a warm near-black, light a paper-white; text/border/muted through Nuxt UI vars so restyled components inherit.
- Fonts via `@nuxt/fonts`: Teko 500/600/700 (`--font-teko`) for display type, numerals and the wordmark; body = system sans stack (as the portfolio); JetBrains Mono 400/500 (`--font-mono`) for commands, paths, the `~/` line, code.
- Radii `rounded-lg`/`rounded-xl`; borders `border-(--ui-border)`; glow `shadow-[0_0_30px_rgba(70,194,17,0.12)]` on hover only; section rhythm `py-20`, content `max-w-5xl`, hero `max-w-7xl`, page padding `px-6 sm:px-10 lg:px-8`.

### 3.2 Motifs
- `HiveBackground.vue` copied from the portfolio (canvas honeycomb, energy on hover, breathing idle, static frame under `prefers-reduced-motion`, mounted client-side); full energy behind the home hero, low energy (`opacity-40`) behind page headers, hairline 4% texture under the footer.
- `.glass-card`, uppercase `tracking-widest` micro-labels, accent word in green inside Teko headlines, the `~/` mono tagline, tiny mono tag chips.
- Mark: a single outlined hexagon with a green `/` inside (the `~/` motif); wordmark "Skills" in Teko; "by TechHive Labs" in the micro-label style beside it in the header and footer. Inline SVG; `favicon.svg` and the OG template derive from it.

### 3.3 Claude Design deliverable
Project "Skills (TechHive)" (type design system). Self-contained HTML previews, each with a first-line `<!-- @dsCard group="…" -->` marker, no external requests except Google Fonts (Teko, JetBrains Mono). Groups and cards:
- **Foundations**: colour (both modes, side by side), type scale (Teko display sizes, body, mono), spacing and radii, motifs (hive texture, glass, micro-label, `~/` line).
- **Components**: buttons (green solid, neutral outline, green outline, ghost icon), tag chips and content badges, install-command box, code block (CodeMirror-matched theme), glass card, bundle row, tree row, form controls (select, input, checkbox, preset tile, segmented control), author card, header, footer, callout.
- **Pages**: home, skills index, skill page, builder, docs — each at 1440 and 375, both modes for home.
Review loop: comments in Claude Design; revisions pushed to the same project one component at a time; implementation starts on explicit approval.

## 4. Shell and home

### 4.1 Shell
Sticky top bar, glass on scroll: mark + "Skills" left (with "by TechHive Labs" micro-label on `md+`); centre nav Skills · Build · Docs · Blog ↗ (`https://www.techhivelabs.net/blog`); right: colour-mode toggle, GitHub, X icon buttons. Mobile: hamburger → `USlideover` with the same items plus all socials. Footer, three columns: **Skills** (mark, one sentence), **Elsewhere** (Blog · Lab Notes, X @Patrity, GitHub Patrity, Bluesky, LinkedIn, Blog RSS), **Registry** (npm `@patrity/skills`, MIT, Source on GitHub). Hive hairline texture under the footer. Every page renders exactly one `<h1>` from its own markup.

### 4.2 Home (`app/pages/index.vue`, Tailwind only)
1. **Hero**: `HiveBackground`; status pill `● <n> bundles · <m> questions` (live from `/api/skills` and `/api/base`); Teko headline, three lines, accent word green; `~/` mono line; actions: green solid "Build it on the web" → `/build`, mono install box `pnpx @patrity/skills init` with copy. Desktop right column: a terminal card that types a real `init --yes` transcript from a committed fixture (`app/assets/transcripts/init.json`), loops slowly, static under reduced motion.
2. **What you get**: three glass cards (CLAUDE.md, `.claude/`, lockfile), each with a real six-line mono excerpt.
3. **The opinions**: five numbered short paragraphs in the voice, each linking the bundle that implements it.
4. **Bundles**: all nine as compact rows in install order; "browse all" → `/skills`.
5. **From the lab**: two latest posts from the blog RSS (build-time fetch, 5 s timeout, committed static fallback of two posts); "Read the lab notes ↗".
6. **Close**: one line in the voice, the install box again, byline "Tony Costanzo · TechHive Labs · @Patrity" with links.

## 5. Tool pages
- **`/skills`**: Teko title + micro-label count + mono search; tag chips as one wrapping row of ghost pills with counts (active green); bundles as `glass-card` rows (mark, Teko name, one line, mono tags, badge icons with tooltips, action cluster: install copy, Source ↗, Download); two columns desktop, one mobile; row is a link, actions stop propagation.
- **`/skill/<slug>`**: in-page two columns: sticky left file tree (`UTree` restyled: mono names, green chevrons, README pinned first) and right content with a compact header (name, description, tags, badges, install box, mono meta list), then README/file view; Rendered/Source as a segmented control; CodeMirror theme matched to tokens. Mobile: tree in a "Files" disclosure above the content.
- **`/build`**: two panes without panel chrome; left form column (Teko section labels, mono helper text, restyled `USelect`/`UInput`/`UCheckbox`, preset glass tiles with green ring), right sticky preview (segmented CLAUDE.md/Files, Rendered switch, download pinned to the preview footer); bundle rows with mono tags, padlock glyph + tooltip on locked rows; mobile preview as a bottom sheet.
- **`/docs`**: editorial: sticky left nav grouped "Start" / "Reference" / "Contribute"; `max-w-3xl` reading column; Teko H1; generous leading; mono paths; glass callouts; footer with "Edit on GitHub ↗" and next page; author card.
- Shared: `ULink`, badges, inputs restyled once in `app.config.ts`; Nuxt UI only for tree, select, checkbox, tabs, toast, slide-over.

## 6. Copy, backlinks, SEO
- **Copy** per `docs/voice.md` on: home, nav/footer labels, `/skills` header, skill-page chrome, builder labels/helper text, every docs page, README, the CLI `--help` descriptions (bundle READMEs get a light pass only). Gate: draft → humanizer skill → voice checklist → fact check against code → the user reads home and Start-here.
- **Backlinks** (`rel="me"` on personal profiles): header Blog ↗; footer Elsewhere column; home "From the lab"; author card at the bottom of every docs page and skill README ("Tony Costanzo · TechHive Labs", mark, one sentence, blog + X links); home close byline. Socials open in a new tab; the blog in the same tab.
- **SEO/sharing**: `useSeoMeta` per page in the voice; JSON-LD `Person` (home; `sameAs` blog, X, GitHub, Bluesky, LinkedIn) and `SoftwareSourceCode` (skill pages); `@nuxtjs/seo` + `nuxt-og-image` with one satori template (static-SVG hive lattice as in the portfolio's OG component, the mark, Teko title), per page; `favicon.svg` + ICO; sitemap unchanged (already lists `/build`); analytics event names unchanged.

## 7. Constraints
- One `<h1>` per page from our markup; ISR route rules, warm list and `/build` hash state unchanged; never `<MDC :value>`; `mdc.highlight.langs` stays short.
- Nuxt UI only where listed; everything else Tailwind on the tokens.
- `HiveBackground` mounts client-side; static frame under reduced motion; no layout shift (reserved size).
- Blog RSS fetched at build/SSR with a 5 s timeout, never on the client; static fallback committed; a failed fetch is a log line, never an error page.
- New dependencies limited to `@nuxt/fonts` and `@nuxtjs/seo` (for `nuxt-og-image`); JetBrains Mono and Teko via Google Fonts through `@nuxt/fonts`.
- No regression in Lighthouse accessibility or performance against the recorded baseline on `/`, `/skills`, `/skill/nuxt`.

## 8. Testing
- Unit: RSS parser + fallback; OG title fitting; the mark SVG renders in both modes (snapshot); tag-chip sorting.
- E2E: every existing route assertion kept; per page one `<h1>`; header and footer links present with exact `href`s and `rel="me"` on profiles; `/__og-image__/…` (or the module's route) returns 200 for home and a skill page; `/favicon.svg` 200; reduced-motion hero renders the static class.
- Browser (`playwright-cli`): every page at 1440 and 375 in both colour modes; keyboard traversal of header and builder form; screenshots kept as the review record.
- Lighthouse before and after on three pages; copy gate as in §6.

## 9. Rollout
- **Phase A (design)**: build the Claude Design project from local previews and mockups; iterate on comments; approval gates Phase B.
- **Phase B (implement)**: one plan, subagent-driven, on `main`, pushed once at the end; Vercel deploys; warm runs.
- **Phase C**: post-deploy Lighthouse and Web Vitals; `CLAUDE.md` (tokens, where Nuxt UI is allowed, RSS fallback, OG template); MyMind handover. CLI release `cli-v0.2.1` only if `--help` copy changes.
