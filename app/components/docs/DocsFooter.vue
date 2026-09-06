<script setup lang="ts">
import type { DocEntry } from '~~/content/docs/nav'
import { docsNav } from '~~/content/docs/nav'
import { LINKS } from '~~/shared/utils/links'

/**
 * The end of a doc: the source on GitHub, the next page in nav order, and the slot the
 * author card fills (Task 11). The edit URL is built from the repo link rather than from
 * `runtimeConfig.public.github`, which points at the raw/API host the store reads.
 */
const props = defineProps<{ entry: DocEntry }>()

const editUrl = computed(() => `${LINKS.repo}/edit/main/content/docs/${props.entry.file}`)

const next = computed<DocEntry | null>(() => {
  const index = docsNav.findIndex(d => d.slug === props.entry.slug)
  return index === -1 ? null : docsNav[index + 1] ?? null
})
</script>

<template>
  <!-- A div, not a <footer>: at this depth a <footer> would be a second contentinfo
       landmark beside the site one. -->
  <div class="mt-10">
    <div class="flex flex-wrap items-center justify-between gap-4 border-t border-default pt-5 text-sm">
      <a
        :href="editUrl"
        target="_blank"
        rel="noopener"
        class="inline-flex items-center gap-1.5 text-muted no-underline transition-colors hover:text-primary"
      >
        Edit on GitHub
        <UIcon
          name="i-lucide-arrow-up-right"
          class="size-3.5"
        />
      </a>

      <NuxtLink
        v-if="next"
        :to="`/docs/${next.slug}`"
        class="inline-flex items-center gap-1.5 text-muted no-underline transition-colors hover:text-primary"
      >
        Next: {{ next.title }}
        <UIcon
          name="i-lucide-arrow-right"
          class="size-3.5"
        />
      </NuxtLink>
    </div>

    <!-- Task 11 fills this with the author card; nothing renders until it does. -->
    <slot name="author" />
  </div>
</template>
