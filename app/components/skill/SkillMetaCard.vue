<script setup lang="ts">
import type { SkillManifest } from '~~/shared/types/skills'
import { formatBytes } from '~~/shared/utils/format'

defineProps<{ skill: SkillManifest }>()
</script>

<template>
  <UPageCard
    variant="subtle"
    :ui="{ container: 'gap-3' }"
  >
    <!--
      UPageCard (v4.11) only auto-renders #title/#description as part of the
      #body slot's *default* content; supplying a custom #body slot replaces
      that default entirely, so the title/description props would silently be
      dropped. Rendered manually here, matching SkillCard.vue's classes.
    -->
    <template #body>
      <h2 class="text-xl font-semibold text-highlighted">
        {{ skill.name }}
      </h2>
      <p class="mt-1 text-toned">
        {{ skill.description }}
      </p>
      <div class="flex flex-wrap items-center gap-1.5 mt-3">
        <UBadge
          v-for="tag in skill.tags"
          :key="tag"
          :label="tag"
          color="primary"
          variant="soft"
          size="sm"
        />
      </div>
      <SkillBadges
        :badges="skill.badges"
        class="mt-3"
      />
      <SkillInstallCommand
        :command="`pnpx @patrity/skills add ${skill.slug}`"
        :slug="skill.slug"
        class="mt-4"
      />
      <dl class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <dt class="text-xs text-muted">
            Author
          </dt>
          <dd class="truncate">
            <ULink
              v-if="skill.authorUrl"
              :to="skill.authorUrl"
              target="_blank"
              class="text-primary"
            >{{ skill.author }}</ULink>
            <span v-else>{{ skill.author }}</span>
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            Files
          </dt>
          <dd>{{ skill.fileCount }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            Size
          </dt>
          <dd>{{ formatBytes(skill.totalBytes) }}</dd>
        </div>
        <div v-if="skill.requires?.length">
          <dt class="text-xs text-muted">
            Requires
          </dt>
          <dd class="font-mono text-xs">
            {{ skill.requires.join(', ') }}
          </dd>
        </div>
      </dl>
    </template>
  </UPageCard>
</template>
