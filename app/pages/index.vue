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

const description = 'Answer a few questions and download a CLAUDE.md and a .claude/ directory: rules that carry the direction, skills that carry the how-to, hooks that fail closed. Compose it on the web or from the CLI, or take any single bundle on its own.'

useSeoMeta({
  // The app-level titleTemplate appends " · Skills".
  title: 'The Claude Code setup I actually run',
  description,
  ogTitle: 'The Claude Code setup I actually run · Skills',
  ogDescription: description
})

// `defineOgImage(component, props)` is v6's name for what the plan calls
// defineOgImageComponent: same arguments, and the old name only logs a deprecation.
defineOgImage('Skills', { title: 'The Claude Code setup I actually run' })
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
