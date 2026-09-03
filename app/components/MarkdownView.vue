<script setup lang="ts">
// Prose styling lives in one place. Nuxt UI supplies the Prose* components;
// `mdc.headings.anchorLinks` is disabled in nuxt.config to dodge a hydration bug.
//
// The AST is always parsed server-side (server/utils/markdown.ts). `<MDC :value>` is
// deliberately not used: it re-parses the markdown in the browser on every navigation and
// hits /api/_mdc/highlight once per fenced block.
import type { MarkdownBody } from '~~/shared/types/skills'

defineProps<{
  body: MarkdownBody
}>()
</script>

<template>
  <article class="skill-prose">
    <MDCRenderer
      :body="body"
      :data="{}"
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
