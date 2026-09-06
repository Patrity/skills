<script setup lang="ts">
import type { DocEntry, DocGroup } from '~~/content/docs/nav'
import { docsNav } from '~~/content/docs/nav'

/**
 * The grouped docs index: a micro-label per group, the pages under it in nav order.
 *
 * Rendered twice on the page (the sticky column and the mobile disclosure), so the group
 * order comes from `nav.ts` rather than from a hand-kept list here: a reorder there is the
 * only edit a new doc needs.
 */
defineProps<{
  /** The doc being read; its link is marked `aria-current="page"`. */
  slug: string
}>()

const emit = defineEmits<{ select: [] }>()

const groups = computed(() => {
  const out: { name: DocGroup, entries: DocEntry[] }[] = []
  for (const entry of docsNav) {
    const last = out.at(-1)
    if (last && last.name === entry.group) last.entries.push(entry)
    else out.push({ name: entry.group, entries: [entry] })
  }
  return out
})
</script>

<template>
  <nav
    data-docs-nav
    aria-label="Docs"
    class="grid gap-6"
  >
    <div
      v-for="group in groups"
      :key="group.name"
      class="grid gap-0.5"
    >
      <MicroLabel class="mb-1.5 block">
        {{ group.name }}
      </MicroLabel>
      <NuxtLink
        v-for="entry in group.entries"
        :key="entry.slug"
        :to="`/docs/${entry.slug}`"
        :aria-current="entry.slug === slug ? 'page' : undefined"
        class="block py-1 text-sm no-underline transition-colors"
        :class="entry.slug === slug ? 'font-semibold text-primary' : 'text-muted hover:text-primary'"
        @click="emit('select')"
      >
        {{ entry.title }}
      </NuxtLink>
    </div>
  </nav>
</template>
