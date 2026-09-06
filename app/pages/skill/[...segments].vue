<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui'
import type { TreeNode } from '~~/shared/types/skills'
import { isMarkdownPath } from '~~/shared/utils/language'
import { encodePathSegments } from '~~/shared/utils/paths'
import { formatBytes } from '~~/shared/utils/format'
import { compactBreadcrumbs } from '~~/shared/utils/breadcrumbs'

definePageMeta({
  // One page instance per bundle: moving between files must not remount the tree.
  key: route => `skill-${(route.params.segments as string[] | undefined)?.[0] ?? ''}`
})

const route = useRoute()
const segments = computed(() => {
  const raw = route.params.segments
  return (Array.isArray(raw) ? raw : [raw]).filter(Boolean) as string[]
})
const slug = computed(() => segments.value[0] ?? '')
const routePath = computed(() => segments.value.slice(1).join('/'))

// An upstream failure must stay a 5xx: Vercel ISR caches 404s and empty 200s, but
// keeps serving the stale page on a 5xx.
const { data: detail, error } = await useSkill(slug)
if (error.value) {
  throw createError({
    statusCode: error.value.statusCode ?? 500,
    statusMessage: error.value.statusCode === 404 ? 'Skill not found' : 'Skills are temporarily unavailable',
    fatal: true
  })
}
if (!detail.value) {
  throw createError({ statusCode: 404, statusMessage: 'Skill not found', fatal: true })
}
const skill = computed(() => detail.value!.skill)

function flatten(nodes: TreeNode[], out: TreeNode[] = []): TreeNode[] {
  for (const node of nodes) {
    if (node.type === 'file') out.push(node)
    if (node.children) flatten(node.children, out)
  }
  return out
}
const readmePath = computed(() => flatten(skill.value.tree).find(n => n.name.toLowerCase() === 'readme.md')?.path ?? '')
const currentPath = computed(() => routePath.value || readmePath.value)
const isReadme = computed(() => currentPath.value !== '' && currentPath.value === readmePath.value)
const isMarkdown = computed(() => isMarkdownPath(currentPath.value))

const { data: file, error: fileError, status: fileStatus } = await useSkillFile(slug, currentPath)
// An unknown file inside a known bundle is a 404 page, not an inline alert (spec §5.2).
// The page instance is keyed by slug, so file-to-file navigation re-runs the watcher, not setup.
if (fileError.value?.statusCode === 404) {
  throw createError({ statusCode: 404, statusMessage: 'File not found', fatal: true })
}
watch(fileError, (err) => {
  if (err?.statusCode === 404) showError(createError({ statusCode: 404, statusMessage: 'File not found', fatal: true }))
})

const view = ref<'rendered' | 'source'>('rendered')
const treeOpen = ref(false)

// Code (CodeMirror) gets the full width; prose keeps a reading measure. Markdown with no
// server-rendered body (too large to render) falls through to the code view, so it gets the
// full width too.
const showCode = computed(() => !!file.value && file.value.kind === 'text'
  && !(isMarkdown.value && view.value === 'rendered' && !!file.value.body))

watch(currentPath, () => {
  view.value = 'rendered'
  // The document scrolls now that the dashboard panel's own scroll container is gone.
  if (import.meta.client) window.scrollTo({ top: 0 })
})

function onSelect(path: string) {
  treeOpen.value = false
  navigateTo(`/skill/${slug.value}/${encodePathSegments(path)}`)
}

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
  { label: 'Skills', to: '/skills' },
  { label: skill.value.name, to: isReadme.value ? undefined : `/skill/${slug.value}` },
  ...(isReadme.value ? [] : currentPath.value.split('/').map(label => ({ label })))
])

useSeoMeta({
  title: () => (isReadme.value ? skill.value.name : `${currentPath.value} · ${skill.value.name}`),
  description: () => skill.value.description,
  ogTitle: () => skill.value.name,
  ogDescription: () => skill.value.description
})

const { trackSkillView } = useAnalytics()
onMounted(() => trackSkillView(slug.value))
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 sm:px-6 py-6">
    <div class="lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-6">
      <!-- Side column, plain grid now that the dashboard panels are gone. -->
      <aside class="hidden lg:block min-w-0">
        <div class="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-lg border border-default">
          <SkillTree
            :tree="skill.tree"
            :selected-path="currentPath"
            :slug="slug"
            @select="onSelect"
          />
        </div>
      </aside>

      <!--
        `overflow-x-auto` replaces the scroll boundary the dashboard panel body used to
        provide: the meta card's min-content is wider than a 375px viewport, and without a
        container to scroll it the whole document scrolls sideways.
      -->
      <div class="min-w-0 flex flex-col gap-4 overflow-x-auto">
        <!--
          Page chrome only: the bundle README supplies the page's single h1, so nothing
          here may render one (Task 8 restyles this row).
        -->
        <header class="flex items-center gap-2 min-w-0">
          <UButton
            icon="i-lucide-folder-tree"
            color="neutral"
            variant="ghost"
            class="lg:hidden"
            aria-label="Browse files"
            @click="treeOpen = true"
          />
          <!-- A deep file path overflows on phones; collapse the middle there. -->
          <UBreadcrumb
            :items="breadcrumbs"
            class="hidden sm:flex min-w-0"
          />
          <UBreadcrumb
            :items="compactBreadcrumbs(breadcrumbs)"
            class="sm:hidden min-w-0"
          />
          <!--
            Nuxt's directory-prefix auto-import only dedups the "Skill" prefix when the
            filename itself already starts with it (SkillCard, SkillBadges, SkillTree,
            SkillMetaCard do). FileActions.vue does not, so it registers as SkillFileActions.
          -->
          <SkillFileActions
            v-model:view="view"
            :slug="slug"
            :path="currentPath"
            :is-markdown="isMarkdown"
            :content="file?.content ?? null"
            class="ms-auto"
          />
        </header>

        <div :class="[showCode ? 'w-full' : 'mx-auto w-full max-w-4xl', 'flex flex-col gap-6 min-w-0']">
          <SkillMetaCard
            v-if="isReadme"
            :skill="skill"
          />

          <UAlert
            v-if="skill.errors.length"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="This bundle has validation issues"
            :description="skill.errors.join(' · ')"
          />

          <UAlert
            v-if="fileError && fileError.statusCode !== 404"
            color="error"
            variant="subtle"
            icon="i-lucide-file-x"
            title="Could not load this file"
            :description="fileError.statusMessage ?? 'Something went wrong'"
          />

          <template v-else-if="file">
            <UAlert
              v-if="file.kind !== 'text'"
              color="neutral"
              variant="subtle"
              icon="i-lucide-file"
              :title="file.kind === 'binary' ? 'Binary file' : 'File too large to preview'"
              :description="`${formatBytes(file.size)} · view it on GitHub or download the bundle.`"
            />

            <template v-else>
              <UCollapsible v-if="isMarkdown && !isReadme && file.frontmatterRaw && view === 'rendered'">
                <UButton
                  label="Frontmatter"
                  icon="i-lucide-braces"
                  trailing-icon="i-lucide-chevron-down"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                />
                <template #content>
                  <pre class="mt-2 rounded-md bg-elevated border border-default p-3 text-xs overflow-x-auto">{{ file.frontmatterRaw }}</pre>
                </template>
              </UCollapsible>

              <MarkdownView
                v-if="isMarkdown && view === 'rendered' && file.body"
                :body="file.body"
                :data="file.data"
              />
              <CodeView
                v-else
                :code="file.content ?? ''"
                :language="file.language"
              />
            </template>
          </template>

          <div
            v-else-if="fileStatus === 'pending'"
            class="space-y-3"
          >
            <USkeleton class="h-6 w-1/3" />
            <USkeleton class="h-4 w-full" />
            <USkeleton class="h-4 w-5/6" />
          </div>
        </div>
      </div>
    </div>

    <USlideover
      v-model:open="treeOpen"
      side="left"
      :title="skill.name"
      :ui="{ body: 'p-0' }"
    >
      <template #body>
        <SkillTree
          :tree="skill.tree"
          :selected-path="currentPath"
          :slug="slug"
          @select="onSelect"
        />
      </template>
    </USlideover>
  </div>
</template>
