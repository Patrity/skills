<script setup lang="ts">
// Prose styling lives in one place. Nuxt UI supplies the Prose* components;
// `mdc.headings.anchorLinks` is disabled in nuxt.config to dodge a hydration bug.
import type { MarkdownBody } from '~~/shared/types/skills'

defineProps<{
  /**
   * MDC AST parsed on the server. Preferred: `<MDC :value>` would re-parse the markdown in
   * the browser and hit /api/_mdc/highlight once per code block on every navigation.
   */
  body?: MarkdownBody | null
  /** Raw markdown fallback, parsed client-side. */
  source?: string
  /** Pass something stable like `${slug}:${path}` so MDC's useAsyncData key never collides. */
  cacheKey?: string
}>()
</script>

<template>
  <article class="skill-prose">
    <MDCRenderer
      v-if="body"
      :body="body"
      :data="{}"
      tag="div"
    />
    <MDC
      v-else-if="source"
      :value="source"
      :cache-key="cacheKey"
      tag="div"
    />
  </article>
</template>

<style>
.skill-prose > div > :first-child {
  margin-top: 0;
}
.skill-prose pre {
  overflow-x: auto;
}
</style>
