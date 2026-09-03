<script setup lang="ts">
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

const tags = computed(() => {
  const counts = new Map<string, number>()
  for (const s of skills.value) for (const t of s.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, count]) => ({ tag, count }))
})

const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase()
  return skills.value.filter((s) => {
    if (activeTag.value && !s.tags.includes(activeTag.value)) return false
    if (!needle) return true
    const haystack = [s.name, s.slug, s.description, s.author, ...s.tags].join(' ').toLowerCase()
    return haystack.includes(needle)
  })
})

function toggleTag(tag: string) {
  activeTag.value = activeTag.value === tag ? null : tag
}

const description = 'Browse every Claude Code bundle: search by name, filter by tag, view the source or download a zip.'
const { public: { siteUrl } } = useRuntimeConfig()

useSeoMeta({
  title: 'All skills',
  description,
  ogTitle: 'All skills',
  ogDescription: description,
  ogUrl: `${siteUrl.replace(/\/+$/, '')}/skills`
})
</script>

<template>
  <UDashboardPanel
    id="skills-index"
    :ui="{ body: 'gap-4' }"
  >
    <template #header>
      <UDashboardNavbar title="Skills">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #trailing>
          <UBadge
            :label="String(filtered.length)"
            color="neutral"
            variant="subtle"
          />
        </template>
        <template #right>
          <UInput
            v-model="q"
            icon="i-lucide-search"
            placeholder="Search skills…"
            size="sm"
            class="w-48 sm:w-64"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div
        v-if="tags.length"
        class="flex flex-wrap gap-1.5"
      >
        <UButton
          v-for="{ tag, count } in tags"
          :key="tag"
          :label="`${tag} · ${count}`"
          size="xs"
          :color="activeTag === tag ? 'primary' : 'neutral'"
          :variant="activeTag === tag ? 'solid' : 'subtle'"
          @click="toggleTag(tag)"
        />
        <UButton
          v-if="activeTag || q"
          label="Clear"
          icon="i-lucide-x"
          size="xs"
          color="neutral"
          variant="ghost"
          @click="activeTag = null; q = ''"
        />
      </div>

      <div
        v-if="status === 'pending'"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
      >
        <USkeleton
          v-for="i in 3"
          :key="i"
          class="h-48 w-full"
        />
      </div>

      <UPageGrid v-else-if="filtered.length">
        <SkillCard
          v-for="skill in filtered"
          :key="skill.slug"
          :skill="skill"
          from="index"
        />
      </UPageGrid>

      <UAlert
        v-else
        color="neutral"
        variant="subtle"
        icon="i-lucide-search-x"
        title="No skills match"
        :description="q || activeTag ? 'Try a different search or clear the tag filter.' : 'No bundles have been published yet.'"
      />
    </template>
  </UDashboardPanel>
</template>
