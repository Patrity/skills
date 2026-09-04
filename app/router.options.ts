import type { RouterConfig } from 'nuxt/schema'

/**
 * Nuxt's default `scrollBehavior` hands `{ el: to.hash }` to vue-router for *any* hash, and
 * vue-router runs that through `document.querySelector`. `/build` keeps its whole state in the
 * hash (`#p=nuxt-app&n=my-app&a=pm:pnpm,…`), which is not a valid CSS selector, so every shared
 * builder link logged `VUE_ROUTER_R0010`/`R0041`. Here a hash is only a scroll target when it
 * names an element that exists; anything else is treated as state.
 *
 * Client-only, like every `scrollBehavior`: `document` is always available here.
 */
function elementFor(hash: string): HTMLElement | null {
  const raw = hash.slice(1)
  if (!raw) return null
  let id = raw
  try {
    id = decodeURIComponent(raw)
  } catch {
    // A malformed escape is not an id either; fall back to the raw text.
  }
  // getElementById, not querySelector: an id-shaped lookup cannot be an invalid selector.
  return document.getElementById(id)
}

/** What Nuxt's default offsets an anchor by, so a sticky header does not cover the heading. */
function scrollMarginTop(el: HTMLElement): number {
  return (Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0)
    + (Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0)
}

export default <RouterConfig>{
  scrollBehavior(to, from, savedPosition) {
    const el = to.hash ? elementFor(to.hash) : null
    if (el) return { el, top: scrollMarginTop(el) }
    // Same page, no target: never yank the reader to the top because a state hash changed.
    if (to.path === from.path) return false
    return savedPosition ?? { left: 0, top: 0 }
  }
}
