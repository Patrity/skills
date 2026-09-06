<script setup lang="ts">
// Prose styling lives in one place. Nuxt UI supplies the Prose* components;
// `mdc.headings.anchorLinks` is disabled in nuxt.config to dodge a hydration bug.
//
// The AST is always parsed server-side (server/utils/markdown.ts). `<MDC :value>` is
// deliberately not used: it re-parses the markdown in the browser on every navigation and
// hits /api/_mdc/highlight once per fenced block.
import type { MarkdownBody } from '~~/shared/types/skills'

withDefaults(defineProps<{
  body: MarkdownBody
  /** Frontmatter, as `<MDC>` passed it: MDCRenderer interpolates `{{ }}` in the body with it. */
  data?: Record<string, unknown> | null
}>(), { data: null })
</script>

<template>
  <article class="skill-prose">
    <MDCRenderer
      :body="body"
      :data="data ?? {}"
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
/*
  A fenced block scrolls; an inline path like `.claude/rules/{a,b,c}.md` has nowhere to
  scroll, so it breaks instead. Without this the widest line of prose sets the document's
  min-content width and the whole page scrolls sideways on a phone.
*/
.skill-prose :not(pre) > code {
  overflow-wrap: anywhere;
}
</style>
