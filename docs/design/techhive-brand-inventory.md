# TechHive Labs — Brand Inventory

Source: `/Users/tony/Documents/GitHub/portfolio-v2` (Nuxt 4 + Nuxt UI 4.6.0 + Tailwind 4.1.10, `@nuxt/fonts`, `@nuxtjs/seo`, `nuxt-og-image` via `@nuxtjs/seo`).

---

## 1. Tokens

**File:** `app/assets/css/main.css` — `@theme static { ... }` block (lines 1-18).

Custom green scale (the ONLY custom tokens defined; everything else — neutral, backgrounds — comes from Nuxt UI's default `neutral` palette and CSS vars):

```
--color-green-50:  #f0fae8;
--color-green-100: #dff4cf;
--color-green-200: #c4e9a7;
--color-green-300: #96d76c;
--color-green-400: #46c211;   <-- the "brand green", used as the accent everywhere
--color-green-500: #39a10e;   <-- primary color (app.config.ts: ui.colors.primary = 'green')
--color-green-600: #2e850b;
--color-green-700: #256a09;
--color-green-800: #1d520a;
--color-green-900: #174209;
--color-green-950: #0c2604;
```
`app/app.config.ts`: `ui.colors.primary = 'green'`, `ui.colors.neutral = 'neutral'` (Nuxt UI's stock neutral gray scale — nothing custom there). Dark mode is the default/primary experience (og-image forced to `colorMode: 'dark'`; OG dark bg `#171717`, fg `#e5e5e5`, muted `#a3a3a3`); light mode exists (`.light .glass-card` override) but the whole site is designed dark-first.

**Fonts:**
- Display font: **Teko** (Google, via `@nuxt/fonts`), weights loaded: `400, 500, 600, 700` (`nuxt.config.ts` fonts.families). Token: `--font-teko: "Teko", sans-serif"`. Applied via Tailwind class `font-teko`. Used ONLY for headlines/big numbers: site logo wordmark (`text-4xl`), all H1/H2 headings (`font-teko text-5xl sm:text-7xl md:text-8xl ...`), stats numbers (`font-teko text-5xl sm:text-6xl font-bold`), project card titles (`font-teko text-2xl font-semibold`), section titles (`UPageSection :ui="{ title: 'font-teko' }"`), and the Teko:700 weight is baked into the OG image (title, wordmark).
- Body font: no custom sans is declared — it's whatever Nuxt UI/Tailwind's default sans stack is (system default, no `@theme` override, no `@nuxt/fonts` entry beyond Teko). OG image body copy uses `Inter` explicitly (loaded only for satori rendering: `ogImage.fonts: ['Inter:400','Inter:700','Teko:700']`), so Inter is the "assumed" body-text font for the brand even though the live site doesn't force-load it.
- Mono font: no custom `--font-mono` token either — `font-mono` classes (RigStatus telemetry, homepage `~/` tagline) fall through to Tailwind's default monospace stack (ui-monospace/Menlo/Consolas). The one explicit brand-mono reference is in the OG image component: `fontFamily: "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace"` for the `~/techhivelabs.net` prompt line — JetBrains Mono is the "intended" mono face but is not actually loaded/self-hosted anywhere in the app itself.

**Radii:** No custom `--radius-*` tokens; uses Tailwind defaults via utility classes directly: `rounded-md`, `rounded-lg`, `rounded-xl` (cards, most content containers), `rounded-2xl` (author photo on homepage), `rounded-full` (pills, badges, avatar rings, glow ring). `rounded-xl` is the dominant card radius across the whole site.

**Borders:** All borders reference Nuxt UI CSS vars, never raw colors: `border-(--ui-border)` (section dividers, card outlines), `ring-1 ring-(--ui-border)` (image thumbnails, related-post cards), green-tinted borders are always green-500 at low opacity: `border-green-500/20`, `/25`, `/30`, `/40`, `hover:border-green-500/30`.

**Shadows/glows:**
- `.glow-ring` utility (main.css): `animation: pulse-glow 3s ease-in-out infinite; border: 3px solid var(--color-green-400);` — pulsing 2-stage box-shadow glow (`0 0 20px rgba(70,194,17,.3), 0 0 40px rgba(70,194,17,.1)` → `0 0 30px .../0 0 60px ...`).
- Ad-hoc hover glows via arbitrary Tailwind shadow values: `hover:shadow-[0_0_30px_rgba(70,194,17,0.12)]` (hero "latest post" card), `hover:shadow-[0_0_30px_rgba(70,194,17,0.1)]` (project cards). Rgba `70,194,17` = green-400.
- Section "energy" blobs: absolutely-positioned divs, `blur-[100px]`/`blur-[160px]`, `bg: var(--color-green-500)`, low opacity (`opacity-15`/`opacity-20`), used behind hero/CTA sections and inside `HiveBackground.vue`.

**Spacing rhythm:**
- Page max-widths: hero content `max-w-7xl`, most content sections `max-w-5xl`, testimonials/CTA `max-w-5xl`/`max-w-2xl`, hero identity column `max-w-3xl`.
- Horizontal page padding: `px-6 sm:px-10 lg:px-8` (hero) or plain `px-6` for standalone `<section>`s.
- Section vertical rhythm: hero is `min-h-[100dvh]`; stats bar `py-16`; most `<section>` blocks `py-20`; CTA `py-24`. `UPageSection` (Nuxt UI) is used for the two content-driven sections (Lab Notes, Things I've Built) and inherits Nuxt UI's own section padding rather than custom classes.
- Card internal padding: `p-5` (project cards, timeline item), `p-6` (glass-card testimonials, author card), `p-4` (related-post / prev-next cards).
- Grid gaps: hero grid `gap-12 lg:gap-16`; stats `gap-8 md:gap-12`; testimonials/projects grids `gap-6`.

---

## 2. Motifs

**Hive / hexagon background — `app/components/HiveBackground.vue`:**
- Built entirely on `<canvas>` + 2D context (NOT SVG at runtime — SVG only survives as the retired `HeroBackground.vue`, mentioned in a comment, and in the OG-image component which still uses inline `<svg><path>` hexagons since satori can't run canvas/JS).
- Geometry: pointy-top hexagons, circumradius 60px, stride 120×78 (odd rows offset by 60px = classic honeycomb lattice), grid built to fully tile the viewport + 2 cells of overflow.
- It's a **reactive, physics-driven** grid, not decoration: each cell has an energy value 0–1 that:
  - decays continuously (`DECAY_PER_SECOND = 1.7`)
  - rises when the pointer hovers within 70px (radius) with falloff 90px
  - propagates to neighbouring cells each frame (`PROPAGATION = 0.58` of the hottest neighbour, rise-only, eased not ticked, specifically to avoid a "flicker at the visibility threshold")
  - ~13% of cells "breathe" on a 4s sine cycle when idle
  - idle "sparks" fire a random cell every 2.2-5.2s when the pointer has been still 2.5s+
- Colors: rest state `rgb(29,82,10)` (~green-900-ish custom triple), breathing state `rgb(57,161,14)` (~green-500), hot state `rgb(70,194,17)` (green-400, `HOT_RGB`). Cell stroke/fill/shadowColor all blend continuously between these three via linear interpolation — no color thresholds/pops.
- Overlays on top of the canvas: three gradient divs (bottom, left-right, top-bottom fades to `--ui-bg` for depth/vignette) + one large radial "energy glow" blob (`blur-[160px]`, green-500, animated 6s opacity/scale pulse via `hex-energy-pulse` keyframes).
- Respects `prefers-reduced-motion`: draws one static frame, no pointer listeners, no RAF loop at all.
- SSR-safe: everything happens in `onMounted`/`onBeforeUnmount`; canvas fades in via a `.is-ready` opacity transition once the first frame is drawn.
- **OG image version** (`app/components/OgImage/TechHive.vue`): a *static* SVG re-implementation of the same lattice math (same 120×78 stride, 720×630 tile covering the right half of the card), with a seeded PRNG (`mulberry32`) so "random" bright cells are deterministic per build. ~12.5% of cells are "bright" (`GREEN_DIM #39a10e`, stroke-opacity .55) vs "dim" (`GREEN_FAINT #1d520a`, stroke-opacity .15).

**Glass cards:** `.glass-card` utility (main.css) — `background: rgba(255,255,255,.03); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,.06)`, with explicit `.dark`/`.light` variants (light mode: `rgba(0,0,0,.02)` bg / `rgba(0,0,0,.06)` border). Used for: the "open to freelance" hero pill, testimonial cards, author card, timeline-item content box, project-card type badge (`absolute top-3 right-3 glass-card rounded-full ...`).

**Gradient/glow effects:**
- `.gradient-text` utility: `linear-gradient(135deg, green-300, green-500, green-300)` clipped to text (`-webkit-background-clip: text` + transparent fill). Explicitly **static** now — a code comment notes the shimmer animation was retired "so headings read as confident type rather than a moving effect."
- Large blurred color blobs (`blur-[100px]`/`blur-[160px]`, low opacity green-500 circles) behind CTA and stats sections.
- Image overlays: `bg-gradient-to-t from-black/80 via-black/20 to-transparent` (project card image legibility scrim), `from-neutral-950/95 via-neutral-950/50 to-transparent` (hero "latest post" card).

**The `~/` mono tagline:** appears twice as a brand signature —
1. Homepage hero: `<span class="text-green-500/60 text-sm">~/</span> <span>full-stack dev · project controls · local AI</span>` inside `class="font-mono"`.
2. OG image footer: `<span opacity:0.6>~/</span><span>techhivelabs.net</span>` in JetBrains-Mono-styled green text.
This "unix prompt" affectation is a core brand motif — it reads like a terminal path.

**Uppercase tracked micro-labels:** a recurring small-caps-style label pattern, always `text-xs` (occasionally `text-[11px]`) + `uppercase` + `tracking-widest` or `tracking-wider` or `tracking-[2px]`, colored `text-(--ui-text-dimmed)`. Examples: `Find me`, `Scroll`, `Latest from the lab`, `Most read` (homepage), `Written by` (author card, `text-[11px] tracking-[2px]`), stat labels (`Years Programming` etc, `tracking-wider`), timeline date (`text-green-400 uppercase tracking-wider`), `← Previous` / `Next →` labels on blog post footer.

**Badge/pill styles:** Nuxt UI `<UBadge>` used for post tags — always `size="sm" color="primary" variant="soft"`. Tag-filter buttons on the blog index use `<UButton size="xs">` toggling `color="primary"/"neutral"` and `variant="solid"/"outline"` for active/inactive state. The homepage "open to freelance" pill is hand-rolled: `inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card text-sm text-green-400` with a small solid green dot (`inline-flex size-2 rounded-full bg-green-400`).

**Accent-word-in-green headline pattern:** nearly every H1/H2 wraps the "punchline" word in `<span class="gradient-text">`, e.g. `Things I've <span class="gradient-text">Built</span>`, `Who's <span class="gradient-text">Writing</span> This`, `What People <span class="gradient-text">Say</span>`, `Let's Talk <span class="gradient-text">Shop</span>`, `Keep <span class="gradient-text">Reading</span>`, hero's `<span class="gradient-text">whatever broke</span>`. This is the single most repeated typographic motif in the codebase.

---

## 3. Components

**Header — `app/layouts/default.vue`, `<UHeader mode="drawer">`:**
- `#left` slot: `NuxtLink to="/"` wrapping `GlobalIcon` (the hex mark, `size-10`) + `TechHive Labs` wordmark (`font-teko text-4xl text-bold`, hidden below `sm`). Wrapper has its own hover flourish: `bg-white/5 rounded-xl px-2 py-1 hover:bg-white/10 hover:scale-110 hover:rotate-3 transition-all duration-200`.
- Center: `<UNavigationMenu :items>` with exactly 5 items: **Home** (`/`), **Portfolio** (`/projects`), **Blog** (`/blog`), **About** (`/about`), **Contact** (`/contact`).
- `#right` slot: `<UColorModeButton size="xl" />` then 4 social icon buttons (`UButton variant="ghost" color="neutral" size="xl"`, hidden below `lg`): GitHub (`i-fa6-brands-github` → github.com/Patrity), X (`i-fa6-brands-x-twitter` → x.com/Patrity), Bluesky (`i-fa6-brands-bluesky` → bsky.app/profile/patrity.com), LinkedIn (`i-fa6-brands-linkedin` → linkedin.com/in/tonycos/). Hover state: `hover:text-(--ui-primary) transition transform duration-200`.
- `#body` slot (mobile drawer): same 5 items, `<UNavigationMenu orientation="vertical" mode="slideover">`.

**Footer — same file, `<UFooter class="bg-white/5 mt-6">`:**
- `#left`: `Copyright © {year}` in `text-(--ui-text-muted) text-sm`.
- Center: same 5 nav items as `variant="link"`.
- `#right`: same 4 socials **plus** an RSS link (`icon="i-heroicons-rss" label="RSS feed" to="/rss.xml" external`), all rendered identically as ghost neutral icon buttons.

**Cards:**
- Blog card: Nuxt UI's `<UBlogPosts><UBlogPost variant="subtle" .../></UBlogPosts>` — title/description/image/date come from content frontmatter; a custom `#description` slot appends a `UBadge` row for tags.
- Homepage "hero" blog card (hand-rolled, not UBlogPost): `NuxtLink` wrapping a 16:9 image, dark gradient scrim, tag badges, title, date + read-time — `rounded-xl ring-1 ring-(--ui-border) hover:ring-green-500/40 hover:shadow-[0_0_30px_rgba(70,194,17,0.12)]`.
- "Most read" row: compact horizontal list — 104×58px thumbnail (`w-26 h-[58px] rounded-md ring-1 ring-(--ui-border)`) + title (hover → `text-green-400`) + date/view-count meta.
- Project card ("Things I've Built"): `NuxtLink` grid item, `rounded-xl border border-(--ui-border) hover:border-green-500/30 hover:shadow-[0_0_30px_rgba(70,194,17,0.1)]`; image with `group-hover:scale-110` zoom, dark scrim, glass-card type-pill top-right, `font-teko text-2xl` title that turns green on hover.
- Related-post card (blog footer): `rounded-lg ring-1 ring-(--ui-border) bg-(--ui-bg-elevated)/50 hover:ring-green-500/30`.
- Prev/Next cards: `rounded-xl ring-1 ring-(--ui-border) p-4 hover:ring-green-500/30`, uppercase tracked micro-label + title.
- Testimonial card: `.glass-card rounded-xl p-6`, oversized green-tinted quote mark (`text-5xl text-green-500/20 font-serif`), attribution row with a small green-tinted icon avatar (`size-9 rounded-full bg-green-500/10`).

**Buttons (all via Nuxt UI `<UButton>`):**
- Primary/solid green: `color="primary" variant="solid"` — main CTAs ("Read the lab notes", "Get in touch").
- Outline neutral: `color="neutral" variant="outline"` — secondary CTAs ("Work with me").
- Outline primary (green outline): `color="primary" variant="outline"` — "see more" links ("Read all the lab notes", "All projects").
- Soft primary: `color="primary" variant="soft"` — softer CTA ("Learn my story"), and the RSS button on the author card.
- Ghost neutral: `color="neutral" variant="ghost"` — icon-only social buttons in header/footer, "Follow on LinkedIn" in the CTA.
- Sizes range `sm`/`lg`/`xl` depending on placement; icons are always Heroicons (`i-heroicons-*`) or Font Awesome brand icons (`i-fa6-brands-*`).

**Author card — `app/components/BlogAuthorCard.vue`:** `.glass-card rounded-xl p-6 flex gap-6`; 80×80 `rounded-xl` photo with `border-2 border-green-500/25`; `Written by` micro-label; name in `text-xl font-semibold`; bio paragraph `text-sm text-(--ui-text-muted) leading-relaxed max-w-2xl`; social row of `UButton variant="outline" color="neutral" size="sm"` icon buttons + one `variant="soft" color="primary"` RSS button.

**Timeline item — `app/components/TimelineItem.vue`:** left dot (`size-12 rounded-full bg-green-500/10 border-2 border-green-500/40`, `UIcon` inside, hover → `border-green-400 bg-green-500/20`) + `.glass-card rounded-xl p-5` content block containing an uppercase-tracked green date label, bold title, optional colored company/role line, muted description. Props: `date, title, company, description, icon?, side?, color?`.

**Animated counter — `app/components/AnimatedCounter.vue`:** `IntersectionObserver` (threshold 0.3) triggers a 2000ms ease-out-cubic count-up from 0 to `target`, with optional `prefix`/`suffix`. Renders as `<span class="tabular-nums">`. Used for the homepage stats bar (20+ Years Programming, 1→4M Fireship Growth, 10+ Years Professional, $12B+ In Projects Managed) styled `font-teko text-5xl sm:text-6xl font-bold text-green-400`.

---

## 4. Motion

All keyframes live in `app/assets/css/main.css` (global) plus one local `<style scoped>` block in `HiveBackground.vue`.

| Keyframe | Effect | Where used |
|---|---|---|
| `float` / `float-delayed` | vertical bob + scale | defined but not referenced in the read files (leftover/available utility) |
| `pulse-glow` | 2-stage box-shadow pulse, green | `.glow-ring` utility |
| `fade-up` | opacity 0→1 + translateY(30px)→0 | hero heading/paragraph/CTA staggered entrance (`animation: fade-up 0.8s ease-out <delay>s both`) |
| `fade-in` | plain opacity fade | hero pill, tagline, scroll indicator, staggered with delays 0.6s/1s/1.5s |
| `slide-in-left` / `slide-in-right` | horizontal slide-in | defined, not directly seen invoked in the read files (available utility, `.reveal-left/.reveal-right` cover this role via JS-driven classes instead) |
| `scale-in` | scale+blur-in | defined, matches `.reveal-scale` semantics |
| `scroll-hint` | bobbing opacity/translateY loop | hero scroll-down chevron icon |
| `gradient-shift` | background-position sweep | defined, not seen wired to an element in the read files (leftover from the retired shimmer text effect) |
| `particle-drift` | rises + fades over 100vh | defined, presumably for a particle-field effect not present in the currently-read components (name suggests a retired/optional hero particle layer) |
| `hex-energy-pulse` (scoped, HiveBackground) | opacity 0.12→0.25 + scale 1→1.15, 6s | the big radial "central energy glow" blob in the hive background |

**Scroll-triggered reveal system:** `useReveal()` composable (`app/composables/useReveal.ts`) — one `IntersectionObserver` (threshold 0.1, rootMargin `0px 0px -50px 0px`) adds a `.visible` class the first time each `.reveal`/`.reveal-left`/`.reveal-right`/`.reveal-scale` element intersects, then unobserves it (one-shot, no re-trigger). Called once per page (`index.vue: useReveal()`).

**Reduced-motion handling — two layers:**
1. CSS: `@media (prefers-reduced-motion: reduce) { .reveal, .reveal-left, .reveal-right, .reveal-scale { opacity:1; transform:none; filter:none; transition:none } }` in `main.css`.
2. No-JS fallback: `app/app.vue` injects a `<noscript>` `<style>` block forcing the same 4 classes to `opacity:1!important;transform:none!important;filter:none!important` — belt-and-suspenders so content is never stuck invisible if the observer never runs.
3. `HiveBackground.vue` independently checks `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and, if true, draws one static canvas frame with zero pointer listeners and no `requestAnimationFrame` loop at all (not just a CSS override — the whole physics sim is skipped).

Section-level stagger pattern: many `v-for` loops set `:style="{ transitionDelay: `${i * 0.15}s` }"` (or `0.1s`) on `.reveal` children so grids/lists cascade in rather than popping together.

---

## 5. Assets

- **Icon mark (header/favicon-style use):** `app/assets/images/th-icon.svg` — hex "TH" mark, viewBox `35 25 130 150`, imported by `app/components/global/GlobalIcon.vue` (`<img src="~/assets/images/th-icon.svg" width="40" height="40">`, used in the header at `size-10`). Flattened path version (7 `<path>` elements, dark hex outline `#161616` + green `#46C211` facets at varying opacity 0.2–0.75) is inlined directly in `OgImage/TechHive.vue` for satori (comment: "flattened: inner viewBox 35 25 130 150, classes → fill attrs").
- **Full lockup:** `app/assets/images/th-logo.svg` — same hex mark plus a wordmark rendered as vector path text ("TechHive" + "Labs", both `class="companyName"` fill `#F9F9F9`), viewBox `575 257.9638 380 202.4935`, exported at 5000×2664px. This looks like a raw export from a design tool (Looka/Tailor-brand-style class names: `aIptOCySncolors-*`, `atgh7KN1KN0filter-floo`, ids like `id-6izo4zJp37`) — no separate license file found; treat as owned original brand asset, no third-party attribution present.
- **Favicon:** `public/favicon.ico` (referenced in `nuxt.config.ts`: `{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }`); no separate `favicon.svg`/apple-touch-icon found in `public/`.
- **OG image approach:** `nuxt-og-image` module (via `@nuxtjs/seo`), `renderer: 'satori'`, default size 1200×630, 7-day cache. Two paths:
  - Site-wide default (`app/app.vue`): `defineOgImageComponent('TechHive', { title: 'Tony Costanzo', description: '...', photo: true })`.
  - Blog index override: same component with `photo: false`, custom title/description.
  - Individual blog posts **override the branded component entirely** and use their own hero image instead (`defineOgImage({ url: heroImage, alt, width, height })` in `pages/blog/[...slug].vue`) — the branded TechHive OG card is only used for non-article pages.
  - The OG component (`app/components/OgImage/TechHive.vue`) rebuilds the hive lattice as static inline SVG (see Motifs §2) plus the flattened hex mark, `Teko` 700 wordmark, word-by-word title with the last word tinted green, `Inter` body copy, a `/images/tony-og.jpg` JPEG photo (note: JPEG specifically because "satori/resvg cannot decode WebP"), and the `~/techhivelabs.net` mono footer line.
  - Portrait photo used across author card / homepage / OG image: `public/images/tony.webp` (site) and `public/images/tony-og.jpg` (OG-only, JPEG for satori compatibility).
- **Other brand-adjacent public assets:** `public/images/` holds only content photography (`editing.webp`, `webdev.webp`, `programming.webp`) and per-project/per-post images under `projects/` and `blog/` subfolders — no additional logo variants (no dark/light-specific logo files, no PNG fallback of the mark, no social-preview-only image besides the satori-generated one).

**Reusable hex mark SVG (`th-icon.svg`, full markup, ready to copy):**
```svg
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" preserveAspectRatio="none" viewBox="714.9 257.96 100.2 115.62">
    <style>.aIptOCySncolors-0 {fill:#161616;fill-opacity:1;}.aIptOCySncolors-1 {fill:#46C211;fill-opacity:1;} /* ... */</style>
    <g opacity="1" transform="rotate(0 714.8978 257.9638)">
        <svg width="100.2044" height="115.6204" x="714.8978" y="257.9638" version="1.1" preserveAspectRatio="none" viewBox="35 25 130 150">
            <g transform="matrix(1 0 0 1 0 0)"><g>
                <path d="M131.7 43.3L100 25 35 62.6v74.8l65 37.6 37.3-21.5 27.7-16.1V62.6l-33.3-19.3z" class="aIptOCySncolors-0"></path>
                <path opacity=".2" d="M35.2 62.4l-.2.2v31.9l65 37.4-64.8-69.5z" class="aIptOCySncolors-1"></path>
                <path d="M137.3 153.5l27.7-16.1V62.6l-65 69.3 37.3 21.6z" class="aIptOCySncolors-1"></path>
                <path opacity=".75" d="M100 131.9l65-69.3-33.3-19.3-31.7 88.6z" class="aIptOCySncolors-1"></path>
                <path opacity=".3" d="M100 131.9L67.9 43.5 35.2 62.4l64.8 69.5z" class="aIptOCySncolors-1"></path>
                <path opacity=".6" d="M100 131.9l31.7-88.6L100 25v106.9z" class="aIptOCySncolors-1"></path>
                <path opacity=".4" d="M100 25L68 43.5l32 88.4V25z" class="aIptOCySncolors-1"></path>
            </g></g>
        </svg>
    </g>
</svg>
```
(Flattened, fill-attribute-only equivalent — the version actually embedded in the OG image and easiest to drop into a new site verbatim — is the 7-path block quoted in `OgImage/TechHive.vue` lines 205-211, reproduced above in §5's icon-mark path list; identical geometry, `fill="#161616"` / `fill="#46C211"` set directly instead of via `<style>` classes.)
Full source paths for copying: `/Users/tony/Documents/GitHub/portfolio-v2/app/assets/images/th-icon.svg`, `/Users/tony/Documents/GitHub/portfolio-v2/app/assets/images/th-logo.svg`.

No license/attribution file accompanies either SVG; they appear to be Tony's own commissioned/generated brand assets (portfolio site owner === logo owner), so no third-party licensing concern for reuse.

---

## 6. Reuse plan

**Copy verbatim (framework-agnostic, no Nuxt UI dependency):**
- The entire `@theme` green scale + all `@keyframes` + all utility classes (`.glow-ring`, `.gradient-text`, `.glass-card`, `.reveal*` + their reduced-motion media query) from `app/assets/css/main.css` — this is plain Tailwind 4 `@theme`/CSS, drops into any Tailwind 4 project unchanged.
- `HiveBackground.vue`'s canvas logic is pure Vue + Canvas 2D + vanilla DOM APIs (`ResizeObserver`, `matchMedia`, `requestAnimationFrame`) — zero Nuxt UI or Nuxt-specific APIs (`onMounted`/`onBeforeUnmount`/`ref` are just Vue). Copies over essentially unchanged; only the `--color-green-500` CSS-var reference in the template needs the same theme token to exist in the new site.
- `useReveal.ts` composable — plain IntersectionObserver, no Nuxt magic beyond auto-import (rename the import or keep Nuxt's auto-import convention).
- `AnimatedCounter.vue` — plain Vue + IntersectionObserver, no Nuxt UI dependency.
- Both logo SVGs (`th-icon.svg`, `th-logo.svg`) and the hex-mark reuse block above — plain SVG, no framework ties. Same for the OG image's static-SVG hive tiling algorithm if a satori-based OG image is wanted on the new site (needs `nuxt-og-image` or equivalent).
- The `~/` mono-tagline motif and uppercase-tracked micro-label convention — just Tailwind class strings (`font-mono text-sm`, `text-xs uppercase tracking-widest text-(--ui-text-dimmed)`), no dependency at all.

**Depend on Nuxt UI (must be re-implemented or Nuxt UI must be installed):**
- `<UHeader>`, `<UFooter>`, `<UNavigationMenu>`, `<UColorModeButton>`, `<UButton>`, `<UBadge>`, `<UPage>`, `<UPageSection>`, `<UPageGrid>`, `<UPageHeader>`, `<UPageAside>`, `<UBlogPosts>`/`<UBlogPost>`, `<UBreadcrumb>`, `<UContentToc>`, `<UIcon>`, `<ULink>`, `<UInput>`, `<UApp>` — the header/footer, blog list/post cards, button variants (`solid`/`outline`/`soft`/`ghost` × `primary`/`neutral`), and color-mode toggle all come from these components. The color system (`--ui-primary`, `--ui-bg`, `--ui-border`, `--ui-text*`, `--ui-bg-elevated`) is Nuxt UI's own CSS variable layer driven by `app.config.ts`'s `ui.colors` — a second site needs Nuxt UI (or a hand-rolled equivalent CSS-var set) for every one of the `(--ui-*)` references sprinkled through the templates.
- `defineOgImageComponent`/`defineOgImage`/`useSchemaOrg`/`useSeoMeta` calls depend on `@nuxtjs/seo` + `nuxt-og-image`.
- Icon names (`i-heroicons-*`, `i-fa6-brands-*`) depend on the Iconify/`@nuxt/icon` integration Nuxt UI ships with.

**What the second site must define itself:**
- A `--ui-*` CSS variable layer (bg/border/text tokens) if Nuxt UI isn't used — the brand CSS in `main.css` never hardcodes neutrals, it always references `(--ui-bg)`, `(--ui-border)`, `(--ui-text-muted)`, `(--ui-text-dimmed)`, `(--ui-text-highlighted)`, so a non-Nuxt-UI site needs to pick/declare its own neutral scale and map these names (or find/replace them) before the copied components look right in both light and dark mode.
- Its own font loading strategy — Teko is currently pulled through `@nuxt/fonts`'s Google provider; a non-Nuxt site needs `@fontsource/teko` or a Google Fonts `<link>` at weights 400/500/600/700, and should decide explicitly on a body sans (Inter is the de-facto choice from the OG image but is not actually wired into the live site's CSS) and a mono face (JetBrains Mono, same situation).
- Its own header/footer/nav markup (structure is simple enough to hand-roll: logo+wordmark link, 5-item nav, color-mode toggle, 4 social icon buttons, footer adds one RSS link) if not using Nuxt UI's layout primitives.
- Blog/project card markup if `<UBlogPost>`/`<UPageGrid>` aren't available — the visual spec (image + gradient scrim + tag badges + title + date/read-time, `rounded-xl`, hover ring/shadow in green) is fully documented above in §3 and is trivial to rebuild in plain divs.

**Surprising/notable findings:**
- The green scale is a genuinely custom hand-tuned ramp (not a stock Tailwind or Nuxt UI green) — `#46c211` (400) is the true brand accent, `#39a10e` (500) is what's wired as Nuxt UI's `primary`.
- Despite `font-mono`/JetBrains-Mono being a load-bearing brand motif (the `~/` tagline), the site never actually loads a mono webfont — it's Tailwind's fallback stack in production, and JetBrains Mono is named explicitly only inside the OG-image satori component. A second site should decide if it wants to actually ship the mono font or keep relying on the system stack.
- The gradient shimmer text animation was deliberately retired (documented in a code comment) in favor of a static gradient-clip — worth preserving that decision rather than "improving" it back into motion.
- Several keyframes (`float`, `float-delayed`, `slide-in-left`, `slide-in-right`, `scale-in`, `gradient-shift`, `particle-drift`) are defined in `main.css` but not visibly wired to any element in the files read for this inventory — they read as either leftover from an earlier design pass or reserved for pages/components not covered here (e.g. a possible particle-field hero variant). Worth grepping the rest of the codebase before assuming they're dead.
- The hex background is CPU-driven canvas physics (custom neighbor-propagation + easing model), not a simple CSS/SVG pattern — genuinely the most complex/distinctive piece of this brand and the one most worth preserving faithfully rather than approximating.
