<script setup lang="ts">
// Never render an empty page over an upstream failure: a cacheable 200 would pin the
// blank state for the ISR window, whereas a 5xx keeps the stale copy served.
const { data, error } = await useSkillsList()
if (error.value) {
  throw createError({
    statusCode: error.value.statusCode ?? 500,
    statusMessage: 'Skills are temporarily unavailable',
    fatal: true
  })
}

/** In the order /api/skills returns them (slug, ascending), which is install order. */
const bundles = computed(() => data.value?.skills ?? [])

const description = 'The Claude Code setup I use on my own projects: a CLAUDE.md, rules, skills and hooks, split into bundles so you can take the parts that fit. Build it in the browser or from the CLI, or take one bundle on its own.'

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
    <HomeHeroTerminal />
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
