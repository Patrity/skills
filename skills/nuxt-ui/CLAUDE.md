## Stack
- Nuxt UI v4 (installed `@nuxt/ui` 4.x). Props, slots and variants differ from training data; verify against the installed source.

## Skills and rules
- Invoke `nuxt-ui-docs` before using or changing a `U*` component; `nuxt-ui-templates` for composition patterns (dashboard, docs, landing).
- Use `U*` components before hand-rolled markup; semantic colour tokens only (`primary`, `neutral`, `text-muted`, `bg-elevated`, `border-default` …), never raw Tailwind palette classes.

## Constraints that bit before
- `UDashboardPanel` renders only named-slot content and has no `grow`/`collapsible` props; `UDashboardNavbar` renders an `<h1>` inside its `#left` default content — override `#left` for secondary titles.
- `UTree` `v-model` holds item objects and `v-model:expanded` holds key strings; always pass `get-key`.
- `UPageCard` renders `title`/`description` only inside the default `#body`; supply your own when you use the body slot.
