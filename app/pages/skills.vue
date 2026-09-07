<script setup lang="ts">
import { tagCounts } from '~~/shared/utils/tags'

const route = useRoute()
const router = useRouter()
const { data, status, error } = await useSkillsList()
// See index.vue: an upstream failure has to stay a 5xx so ISR keeps the stale page.
if (error.value) {
  throw createError({
    statusCode: error.value.statusCode ?? 500,
    statusMessage: 'Skills are temporarily unavailable',
    fatal: true
  })
}

const q = ref(typeof route.query.q === 'string' ? route.query.q : '')
const activeTag = ref<string | null>(typeof route.query.tag === 'string' ? route.query.tag : null)

// Keep the URL in sync so a filtered list can be shared; replace so Back isn't flooded.
watch([q, activeTag], ([nextQ, nextTag]) => {
  router.replace({ query: { ...(nextQ ? { q: nextQ } : {}), ...(nextTag ? { tag: nextTag } : {}) } })
})

const skills = computed(() => data.value?.skills ?? [])

const tags = computed(() => tagCounts(skills.value))
const tagNames = computed(() => tags.value.map(t => t.tag))
const counts = computed(() => Object.fromEntries(tags.value.map(t => [t.tag, t.count])))

const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase()
  return skills.value.filter((s) => {
    if (activeTag.value && !s.tags.includes(activeTag.value)) return false
    if (!needle) return true
    const haystack = [s.name, s.slug, s.description, s.author, ...s.tags].join(' ').toLowerCase()
    return haystack.includes(needle)
  })
})

const isFiltered = computed(() => !!activeTag.value || !!q.value.trim())

function toggleTag(tag: string) {
  activeTag.value = activeTag.value === tag ? null : tag
}

function clearFilters() {
  activeTag.value = null
  q.value = ''
}

/**
 * The eyebrow is live filter state, not a headline count: it says how many rows the
 * list is showing you and nothing about how big the registry is.
 */
const countLabel = computed(() => (isFiltered.value
  ? `${filtered.value.length} ${filtered.value.length === 1 ? 'match' : 'matches'}`
  : 'All bundles'))

const description = 'Every Claude Code bundle in the registry. Filter by name or tag, read the files before you trust them, take the zip.'
const { public: { siteUrl } } = useRuntimeConfig()

useSiteSeo({
  title: 'All skills',
  description,
  ogUrl: `${siteUrl.replace(/\/+$/, '')}/skills`
})
</script>

<template>
  <div>
    <section class="relative overflow-hidden border-b border-default">
      <div
        class="hive-texture absolute inset-0 opacity-40"
        aria-hidden="true"
      />

      <div class="relative mx-auto max-w-7xl px-4 sm:px-6 pt-8 pb-6 lg:pt-14 lg:pb-10">
        <div class="flex flex-wrap items-end justify-between gap-6 lg:gap-8">
          <div class="max-w-3xl">
            <MicroLabel class="block mb-2.5">
              {{ countLabel }}
            </MicroLabel>
            <h1 class="m-0 font-teko text-[40px] font-semibold leading-[.9] tracking-[-0.015em] lg:text-[64px]">
              The bundles. <span class="text-primary">Take what you want.</span>
            </h1>
            <p class="mt-3.5 max-w-[44rem] text-base/[1.65] text-muted">
              Each one is a slice of the <code class="font-mono text-sm text-default">.claude/</code> directory I run on my own projects: skills, rules, hooks, settings, and the CLAUDE.md lines that make them make sense together.
            </p>
          </div>

          <UInput
            v-model="q"
            type="search"
            icon="i-lucide-search"
            placeholder="Filter by name, tag or file.."
            aria-label="Filter bundles"
            class="w-full sm:w-88"
            :ui="{ base: 'text-[0.8125rem]' }"
          />
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 sm:px-6 pt-6 pb-12 lg:pt-8 lg:pb-20">
      <div
        v-if="tagNames.length"
        class="mb-6 flex flex-wrap items-center gap-1.5 lg:mb-8"
      >
        <SkillTagChips
          interactive
          :tags="tagNames"
          :counts="counts"
          :active="activeTag"
          label="Filter bundles by tag"
          @toggle="toggleTag"
        />
        <button
          v-if="isFiltered"
          type="button"
          class="inline-flex items-center gap-1 rounded-full px-2 font-mono text-[0.6875rem]/[1.7] text-dimmed cursor-pointer transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          @click="clearFilters"
        >
          <UIcon
            name="i-lucide-x"
            class="size-3"
          />
          Clear
        </button>
      </div>

      <div
        v-if="status === 'pending'"
        class="grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        <div
          v-for="i in 4"
          :key="i"
          class="h-40 animate-pulse rounded-xl bg-(--ui-border)"
        />
      </div>

      <div
        v-else-if="filtered.length"
        class="grid grid-cols-1 items-start gap-3 md:grid-cols-2"
      >
        <SkillRow
          v-for="skill in filtered"
          :key="skill.slug"
          :skill="skill"
          :active-tag="activeTag"
        />
      </div>

      <Callout
        v-else
        icon="i-lucide-search-x"
        title="Nothing matches"
        :description="isFiltered
          ? 'Drop a word from the search, or clear the tag filter.'
          : 'Nothing is published yet.'"
        class="max-w-2xl"
      />
    </section>
  </div>
</template>
