---
paths:
  - "{{appDir}}/**/*.vue"
---

# Vue / Nuxt UI components

- **Use Nuxt UI components, not hand-rolled markup.** Reach for `U*` components (`UButton`, `UCard`, `UTree`, `UDashboardPanel`, `UPageHero`, …) before writing raw `<div>` + Tailwind.
- **Invoke the `nuxt-ui-docs` skill before using or changing a component.** Installed Nuxt UI is **v4**; training-data knowledge of props/slots/variants is stale. Use `nuxt-ui-templates` for composition patterns (dashboard, docs, landing).
- **Color: semantic design tokens only — never raw Tailwind palette classes.** Aliases: `primary`, `secondary`, `success`, `info`, `warning`, `error`, `neutral`. Surfaces/text: `text-default`, `text-muted`, `text-dimmed`, `text-highlighted`, `bg-default`, `bg-muted`, `bg-elevated`, `bg-accented`, `border-default`, `border-muted`, `border-accented`. No `text-gray-200`, `slate-*`, `zinc-*`.
- **Validate UI work with `playwright-cli`, NOT the Playwright MCP** — the `browser-testing` bundle on this site (`/skill/browser-testing`) has the how-to.
