<script setup lang="ts">
// Wraps @nuxtjs/mdc so prose styling lives in one place. Nuxt UI supplies the Prose*
// components; `mdc.headings.anchorLinks` is disabled in nuxt.config to dodge a hydration bug.
defineProps<{
  source: string
  /** Pass something stable like `${slug}:${path}` so MDC's useAsyncData key never collides. */
  cacheKey?: string
}>()
</script>

<template>
  <article class="skill-prose">
    <MDC
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
