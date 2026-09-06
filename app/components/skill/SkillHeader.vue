<script setup lang="ts">
import type { SkillManifest } from '~~/shared/types/skills'
import { formatBytes } from '~~/shared/utils/format'

/**
 * The `.phead` band above the tree/content split: crumb, name, description, tags,
 * badges, and the install/meta/links side column.
 *
 * The bundle name is the page's single `<h1>` for every file under `/skill/` (spec §7).
 * The markdown cannot supply it: a CLAUDE.md opens at `##`, `fetch.py` has no headings
 * at all, and the Source view renders no prose. So the file route drops the document's
 * own leading `# Title` (`renderMarkdown`'s `dropLeadingH1`) and this owns the heading.
 */
const props = defineProps<{
  skill: SkillManifest
  slug: string
  /** Snapshot the bundle was read from, shown as `sha · date`. */
  sha?: string
  committedAt?: string
}>()

const { tree } = useGithubUrls()
const { trackDownload, trackSource } = useAnalytics()

const registry = computed(() => {
  if (!props.sha) return null
  const day = props.committedAt?.slice(0, 10)
  return day ? `${props.sha.slice(0, 7)} · ${day}` : props.sha.slice(0, 7)
})

/** The rows the mono meta list renders, in the approved order, empties dropped. */
const meta = computed(() => [
  { key: 'author', value: props.skill.author, href: props.skill.authorUrl },
  { key: 'requires', value: props.skill.requires?.join(' · ') },
  { key: 'suggests', value: props.skill.suggests?.join(' · ') },
  { key: 'gitignore', value: props.skill.gitignore?.join(' · ') },
  { key: 'env', value: props.skill.env?.map(v => v.name).join(' · ') },
  { key: 'files', value: `${props.skill.fileCount} · ${formatBytes(props.skill.totalBytes)}` },
  { key: 'registry', value: registry.value ?? undefined }
].filter(row => !!row.value))
</script>

<template>
  <section class="relative overflow-hidden border-b border-default">
    <div
      class="hive-texture absolute inset-0 opacity-40"
      aria-hidden="true"
    />

    <div class="relative mx-auto max-w-7xl px-4 sm:px-6 pt-8 pb-6 lg:pt-14 lg:pb-10">
      <div class="flex flex-wrap items-end justify-between gap-6 lg:gap-8">
        <div class="min-w-0 max-w-3xl">
          <p class="m-0 font-mono text-xs text-dimmed">
            <NuxtLink
              to="/skills"
              class="text-dimmed no-underline transition-colors hover:text-primary"
            >skills</NuxtLink>
            <span aria-hidden="true"> / </span>
            <span class="text-primary">{{ slug }}</span>
          </p>

          <h1 class="mt-2 mb-0 font-teko text-[40px] font-semibold leading-[.9] tracking-[-0.015em] text-default lg:text-[64px]">
            {{ skill.name }}
          </h1>

          <p class="mt-3.5 max-w-[44rem] text-base/[1.65] text-muted">
            {{ skill.description }}
          </p>

          <SkillTagChips
            v-if="skill.tags.length"
            :tags="skill.tags"
            class="mt-4"
          />
          <SkillBadges
            :badges="skill.badges"
            class="mt-3"
          />
        </div>

        <div class="grid w-full gap-4 lg:w-96">
          <InstallBox
            :command="`pnpx @patrity/skills add ${skill.slug}`"
            :slug="skill.slug"
          />

          <dl class="m-0 grid gap-1 font-mono text-xs">
            <div
              v-for="row in meta"
              :key="row.key"
              class="flex gap-3"
            >
              <dt class="w-[5.5rem] shrink-0 text-dimmed">
                {{ row.key }}
              </dt>
              <dd class="m-0 min-w-0 break-words text-muted">
                <a
                  v-if="row.href"
                  :href="row.href"
                  target="_blank"
                  rel="noopener"
                  class="text-muted no-underline transition-colors hover:text-primary"
                >{{ row.value }}</a>
                <template v-else>
                  {{ row.value }}
                </template>
              </dd>
            </div>
          </dl>

          <div class="flex flex-wrap gap-2">
            <a
              :href="tree(slug)"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1.5 rounded-md border border-default px-2.5 py-1.5 text-[0.8125rem] text-muted no-underline transition-colors hover:border-primary/45 hover:text-primary"
              @click="trackSource(slug)"
            >
              <UIcon
                name="i-simple-icons-github"
                class="size-[15px]"
              />
              Source
            </a>
            <a
              :href="`/api/skills/${slug}/download`"
              class="inline-flex items-center gap-1.5 rounded-md border border-default px-2.5 py-1.5 text-[0.8125rem] text-muted no-underline transition-colors hover:border-primary/45 hover:text-primary"
              @click="trackDownload(slug, 'detail')"
            >
              <UIcon
                name="i-lucide-download"
                class="size-[15px]"
              />
              Download zip
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
