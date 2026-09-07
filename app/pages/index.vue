<script setup lang="ts">
import type { BaseResponse } from '~~/shared/types/setup'

// Never render an empty page over an upstream failure: a cacheable 200 would pin the
// blank state for the ISR window, whereas a 5xx keeps the stale copy served. Both routes
// read the same snapshot, so they fail together, but they are separate ISR entries, so
// treat either failure the same way.
// Both calls are made before the await so they share one round trip: the bundle list already
// carries the bundle count, and /api/base is the cheap half of the manifest (no profiles, no
// repeat of the skills array) and carries the axis count.
const [{ data, error }, { data: base, error: baseError }] = await Promise.all([
  useSkillsList(),
  useFetch<BaseResponse>('/api/base', { key: 'home:base' })
])
const listError = computed(() => error.value ?? baseError.value)
if (listError.value) {
  throw createError({
    statusCode: listError.value.statusCode ?? 500,
    statusMessage: 'Skills are temporarily unavailable',
    fatal: true
  })
}

/** In the order /api/skills returns them (slug, ascending), which is install order. */
const bundles = computed(() => data.value?.skills ?? [])

// A broken base schema comes back as a 200 with `base: null`, so the count can be missing
// while the bundles are fine; the hero pill drops that half rather than claiming "zero questions".
const axisCount = computed(() => base.value?.base?.axes.length ?? 0)

const description = 'Nine bundles, fourteen questions, one CLAUDE.md and a .claude/ directory: rules that carry the direction, skills that carry the how-to, hooks that fail closed. Build it in the browser or from the CLI, or take one bundle on its own.'

useSiteSeo({
  // The app-level titleTemplate appends " · Skills". A shared link carries no template, so
  // the og:title spells the site out; the card itself already draws the wordmark, so it
  // takes the bare title rather than a suffixed one that would not fit.
  title: 'The Claude Code setup I actually run',
  description,
  ogTitle: 'The Claude Code setup I actually run · Skills',
  ogImageTitle: 'The Claude Code setup I actually run'
})
</script>

<template>
  <div>
    <HomeHeroTerminal
      :bundle-count="bundles.length"
      :axis-count="axisCount"
    />
    <HomeWhatYouGet />
    <HomeOpinions />
    <HomeBundleList
      v-if="bundles.length"
      :bundles="bundles"
    />
    <HomeLabFeed />
    <HomeClosing />
  </div>
</template>
