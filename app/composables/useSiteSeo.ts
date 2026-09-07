import type { MaybeRefOrGetter } from 'vue'

export interface SiteSeoInput {
  /** The `<title>`, before the app template appends " · Skills". */
  title: MaybeRefOrGetter<string>
  description: MaybeRefOrGetter<string>
  /**
   * The social-card title, when it differs from the page title — the home page spells the
   * site out because a shared card carries no template, and a bundle page drops the file
   * path so the card is the bundle, not the file. Defaults to `title`.
   */
  ogTitle?: MaybeRefOrGetter<string>
  /**
   * The title drawn on the card itself, when it differs from `ogTitle`. The card already
   * carries the wordmark and `skills.patrity.com · by TechHive Labs`, so a title that
   * repeats the site name only spends the two lines `fitOgTitle` budgets and comes back
   * truncated. Defaults to `ogTitle ?? title`.
   */
  ogImageTitle?: MaybeRefOrGetter<string>
  /** Absolute URL of the page, when the route alone does not settle it (`/docs` → `/docs/<slug>`). */
  ogUrl?: MaybeRefOrGetter<string>
}

/**
 * One SEO call per page: the meta tags and the OG card, from the same strings.
 *
 * Every value is read through `toValue`, so a page whose data arrives in a computed (the
 * bundle name, the doc title) passes the getter and the tags follow it across a client-side
 * navigation. `defineOgImage` is server-only, so its props resolve once per render — which
 * is the only time a crawler is looking.
 *
 * `og:site_name`, `og:type` and the site-wide `twitterCard` stay in `app.vue`, so a page
 * that renders without calling this still carries them. `error.vue` is not one of those:
 * Nuxt renders it INSTEAD of `app.vue`, so it sets its own. Repeating `twitterCard` here
 * is free: unhead keys meta by name, so the page entry replaces the app one rather than
 * adding a second tag.
 */
export function useSiteSeo(input: SiteSeoInput): void {
  const ogTitle = () => toValue(input.ogTitle ?? input.title)

  useSeoMeta({
    title: () => toValue(input.title),
    description: () => toValue(input.description),
    ogTitle,
    ogDescription: () => toValue(input.description),
    twitterCard: 'summary_large_image',
    ...(input.ogUrl ? { ogUrl: () => toValue(input.ogUrl!) } : {})
  })

  // `defineOgImage(component, props)` is v6's name for what the plan calls
  // `defineOgImageComponent`: same arguments; the old name only logs a deprecation.
  defineOgImage('Skills', { title: () => toValue(input.ogImageTitle ?? input.ogTitle ?? input.title) })
}
