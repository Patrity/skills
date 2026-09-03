<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui'
import type { TreeNode } from '~~/shared/types/skills'
import { isMarkdownPath } from '~~/shared/utils/language'
import { formatBytes } from '~~/shared/utils/format'

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

const { data: detail, error } = await useSkill(slug)
if (error.value || !detail.value) {
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

const view = ref<'rendered' | 'source'>('rendered')
const treeOpen = ref(false)
const contentEl = ref<HTMLElement>()

watch(currentPath, () => {
  view.value = 'rendered'
  contentEl.value?.scrollTo({ top: 0 })
})

function onSelect(path: string) {
  treeOpen.value = false
  navigateTo(`/skill/${slug.value}/${path}`)
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
  <div class="flex flex-1 min-w-0 h-full">
    <UDashboardPanel
      id="skill-tree"
      resizable
      :default-size="22"
      :min-size="15"
      :max-size="35"
      class="hidden lg:flex"
      :ui="{ body: 'p-0 sm:p-0 gap-0' }"
    >
      <template #header>
        <UDashboardNavbar
          :title="skill.name"
          :toggle="false"
        >
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <SkillTree
          :tree="skill.tree"
          :selected-path="currentPath"
          @select="onSelect"
        />
      </template>
    </UDashboardPanel>

    <UDashboardPanel
      id="skill-content"
      :ui="{ body: 'p-0 sm:p-0 gap-0' }"
    >
      <template #header>
        <UDashboardNavbar>
          <template #leading>
            <UButton
              icon="i-lucide-folder-tree"
              color="neutral"
              variant="ghost"
              class="lg:hidden"
              aria-label="Browse files"
              @click="treeOpen = true"
            />
          </template>
          <template #title>
            <UBreadcrumb
              :items="breadcrumbs"
              class="min-w-0"
            />
          </template>
          <template #right>
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
            />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div
          ref="contentEl"
          class="h-full overflow-y-auto"
        >
          <div class="mx-auto max-w-4xl p-4 sm:p-6 flex flex-col gap-6">
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
              v-if="fileError"
              color="error"
              variant="subtle"
              icon="i-lucide-file-x"
              title="Could not load this file"
              :description="fileError.statusMessage ?? 'Not found'"
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
                  v-if="isMarkdown && view === 'rendered'"
                  :source="file.content ?? ''"
                  :cache-key="`${slug}:${currentPath}`"
                />
                <CodeView
                  v-else
                  :code="file.content ?? ''"
                  :language="isMarkdown ? 'markdown' : file.language"
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
      </template>
    </UDashboardPanel>

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
          @select="onSelect"
        />
      </template>
    </USlideover>
  </div>
</template>
