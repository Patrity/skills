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

// The `open` attribute is one-way, so mirror the user's own toggles back into the ref;
// without this, opening the disclosure by hand and then picking a file would leave the
// ref stale and the next programmatic close would do nothing.
function onDisclosureToggle(event: Event) {
  treeOpen.value = (event.target as HTMLDetailsElement).open
}

/**
 * The path of the open file inside the bundle, as crumbs. Navigation lives in the page
 * header (`skills / <slug>`); this is the "you are here" line above the file itself.
 */
const fileTrail = computed<BreadcrumbItem[]>(() => [
  { label: slug.value, to: `/skill/${slug.value}` },
  ...currentPath.value.split('/').filter(Boolean).map(label => ({ label }))
])
const compactTrail = computed(() => compactBreadcrumbs(fileTrail.value))

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
  <div>
    <SkillHeader
      :skill="skill"
      :slug="slug"
      :sha="detail?.sha"
      :committed-at="detail?.committedAt"
    />

    <div class="mx-auto grid max-w-7xl items-start gap-5 px-4 pt-6 pb-12 sm:px-6 lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-10 lg:pt-10 lg:pb-20">
      <!-- Below lg the sticky column becomes a disclosure above the file. -->
      <details
        :open="treeOpen"
        class="overflow-hidden rounded-xl border border-default bg-elevated lg:hidden"
        @toggle="onDisclosureToggle"
      >
        <summary class="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 font-mono text-[0.8125rem] text-default">
          <UIcon
            name="i-lucide-chevron-right"
            class="size-3.5 text-primary transition-transform"
            :class="{ 'rotate-90': treeOpen }"
          />
          <UIcon
            name="i-lucide-folder"
            class="size-[15px] text-dimmed"
          />
          Files
          <span class="ms-auto text-[0.6875rem] text-dimmed">{{ skill.fileCount }}</span>
        </summary>
        <div class="max-h-[60vh] overflow-y-auto border-t border-default">
          <SkillTree
            :tree="skill.tree"
            :selected-path="currentPath"
            :slug="slug"
            @select="onSelect"
          />
        </div>
      </details>

      <aside class="sticky top-[88px] hidden max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-xl border border-default bg-elevated lg:block">
        <div class="flex items-center justify-between px-4 pt-3 pb-1">
          <MicroLabel>Files</MicroLabel>
          <span class="font-mono text-[0.6875rem] text-dimmed">{{ skill.fileCount }}</span>
        </div>
        <SkillTree
          :tree="skill.tree"
          :selected-path="currentPath"
          :slug="slug"
          @select="onSelect"
        />
      </aside>

      <div class="min-w-0">
        <div class="mb-5 flex items-center justify-between gap-3">
          <nav
            class="flex min-w-0 items-center gap-2 font-mono text-[0.8125rem] text-muted"
            aria-label="File path"
          >
            <UIcon
              :name="isReadme ? 'i-lucide-book-open' : 'i-lucide-file-text'"
              class="size-[15px] shrink-0 text-dimmed"
            />
            <!-- A deep path overflows on phones; the middle collapses there. -->
            <ol class="m-0 hidden min-w-0 list-none items-center gap-1.5 p-0 sm:flex">
              <li
                v-for="(crumb, i) in fileTrail"
                :key="`${i}-${crumb.label}`"
                class="flex min-w-0 items-center gap-1.5"
              >
                <span
                  v-if="i"
                  class="text-dimmed"
                  aria-hidden="true"
                >/</span>
                <NuxtLink
                  v-if="crumb.to"
                  :to="crumb.to"
                  class="truncate text-muted no-underline transition-colors hover:text-primary"
                >{{ crumb.label }}</NuxtLink>
                <span
                  v-else
                  class="truncate"
                  :class="i === fileTrail.length - 1 ? 'text-default' : ''"
                >{{ crumb.label }}</span>
              </li>
            </ol>
            <ol class="m-0 flex min-w-0 list-none items-center gap-1.5 p-0 sm:hidden">
              <li
                v-for="(crumb, i) in compactTrail"
                :key="`${i}-${crumb.label}`"
                class="flex min-w-0 items-center gap-1.5"
              >
                <span
                  v-if="i"
                  class="text-dimmed"
                  aria-hidden="true"
                >/</span>
                <NuxtLink
                  v-if="crumb.to"
                  :to="crumb.to"
                  class="truncate text-muted no-underline transition-colors hover:text-primary"
                >{{ crumb.label }}</NuxtLink>
                <span
                  v-else
                  class="truncate"
                  :class="i === compactTrail.length - 1 ? 'text-default' : ''"
                >{{ crumb.label }}</span>
              </li>
            </ol>
          </nav>

          <!--
            Nuxt's directory-prefix auto-import only dedups the "Skill" prefix when the
            filename itself already starts with it (SkillRow, SkillBadges, SkillTree,
            SkillHeader do). FileActions.vue does not, so it registers as SkillFileActions.
          -->
          <SkillFileActions
            v-model:view="view"
            :slug="slug"
            :path="currentPath"
            :is-markdown="isMarkdown"
            :content="file?.content ?? null"
          />
        </div>

        <div :class="[showCode ? 'w-full' : 'w-full max-w-[46rem]', 'flex min-w-0 flex-col gap-6']">
          <Callout
            v-if="skill.errors.length"
            tone="warning"
            icon="i-lucide-triangle-alert"
            title="This bundle does not validate"
            :description="skill.errors.join(' · ')"
          />

          <Callout
            v-if="fileError && fileError.statusCode !== 404"
            tone="error"
            icon="i-lucide-file-x"
            title="This file did not load"
            :description="fileError.statusMessage ?? 'No reason came back.'"
          />

          <template v-else-if="file">
            <Callout
              v-if="file.kind !== 'text'"
              icon="i-lucide-file"
              :title="file.kind === 'binary' ? 'Binary file' : 'File too large to preview'"
              :description="`${formatBytes(file.size)} · view it on GitHub or download the bundle.`"
            />

            <template v-else>
              <details
                v-if="isMarkdown && !isReadme && file.frontmatterRaw && view === 'rendered'"
                class="overflow-hidden rounded-lg border border-default bg-elevated"
              >
                <summary class="flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-mono text-[0.8125rem] text-muted transition-colors hover:text-default">
                  <UIcon
                    name="i-lucide-braces"
                    class="size-3.5 text-primary"
                  />
                  Frontmatter
                </summary>
                <pre class="m-0 overflow-x-auto border-t border-default p-3 font-mono text-xs text-muted">{{ file.frontmatterRaw }}</pre>
              </details>

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
            <div class="h-6 w-1/3 animate-pulse rounded-md bg-(--ui-border)" />
            <div class="h-4 w-full animate-pulse rounded-md bg-(--ui-border)" />
            <div class="h-4 w-5/6 animate-pulse rounded-md bg-(--ui-border)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
