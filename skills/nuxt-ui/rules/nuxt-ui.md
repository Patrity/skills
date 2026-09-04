---
paths:
  - "{{appDir}}/**/*.vue"
  - "{{appDir}}/app.config.ts"
---

# Nuxt UI v4 conventions

**Verify every prop, slot and variant against the installed version before you use it.** Invoke the `nuxt-ui-docs` skill, or read the component source in `node_modules/@nuxt/ui`. v4 renamed and re-scoped a lot: `USwitch` (not `UToggle`), `USeparator` (not `UDivider`), and several components moved their content into named slots. A prop recalled from training data compiles, renders nothing, and looks like a CSS bug.

Use the `nuxt-ui-templates` skill for composition — how a dashboard, docs or landing layout is actually assembled — before hand-rolling a shell.

## Theming

Palette aliases are chosen once, in `app.config.ts`:

```ts
export default defineAppConfig({
  ui: {
    colors: { primary: 'green', neutral: 'slate' }  // any Tailwind palette name
  }
})
```

- Components then take semantic colours only: `primary`, `secondary`, `success`, `info`, `warning`, `error`, `neutral`. Never a raw palette class — the alias list is in `web-vue-ui.md`.
- **No `dark:` variants.** Nuxt UI's tokens resolve per colour mode already; a `dark:` class is how a component ends up unreadable in one mode.
- **No `@apply`.** Tailwind v4 does not treat it the way v3 did — compose with `:ui` slot overrides or `class`.
- Restyle a component through its `:ui` prop (or `app.config.ts` for every instance), not by wrapping it in a div that fights its own styles.
- Size and variant scales are shared: `xs`–`xl`, and `solid` / `outline` / `soft` / `subtle` / `ghost` / `link` where the component supports them.

## Icons

Iconify names, `i-<collection>-<name>` — prefer `lucide`. Pass them as props (`icon`, `leading-icon`, `trailing-icon`) rather than nesting a `UIcon` inside a button.

## Forms

`UForm` + `UFormField` with a zod schema on `:schema`; bind fields with `v-model` on `state`. Validation messages come from the schema — do not hand-roll error text under an input.

## Components with slot-only content

Several v4 components render nothing unless the content is in the right named slot. Check before assuming a prop exists:

- `UDashboardPanel` renders named-slot content only (`#header`, `#body`, `#footer`) and has no `grow` or `collapsible` prop.
- `UDashboardNavbar` puts its `<h1>` inside the default content of `#left` — override `#left` for a secondary title, or the page ends up with two `h1`s.
- `UPageCard` renders `title` and `description` only inside its default `#body`; supply them yourself when you take that slot over.
- `UTree` binds item **objects** in `v-model` and item **keys** in `v-model:expanded`; always pass `get-key`.

## Verifying

Rendered-only failures — a slot that stayed empty, a variant that does not exist, a colour that resolved to nothing — never show up in typecheck or unit tests. Prove UI work in a real browser with `playwright-cli`; the `browser-testing` bundle carries the workflow.
