<script setup lang="ts">
import type { CliManifest } from '~~/shared/types/setup'
import { resolveBundles } from '~~/shared/setup/wizard'

// Same rule as the other pages: an upstream failure stays a 5xx so ISR keeps serving the last
// good copy instead of pinning an empty builder for the cache window.
const { data: manifest, error } = await useFetch<CliManifest>('/api/cli/manifest', { key: 'cli:manifest' })
if (error.value) {
  throw createError({
    statusCode: error.value.statusCode ?? 500,
    statusMessage: 'The setup manifest is temporarily unavailable',
    fatal: true
  })
}

// `useFetch` hands back `undefined` before the first response; the composables want a settled
// `null` for "no manifest yet".
const cliManifest = computed(() => manifest.value ?? null)

const { state, preset, axes, recommended, lockedBy, valid, nameError, setProjectName, setAnswer, toggleBundle, selectPreset } = useBuildState(cliManifest)
const { plan, snippetsLoading, warnings } = useSetupPlan(state, cliManifest)

const schemaErrors = computed(() => manifest.value?.errors ?? [])
const resolvedBundles = computed(() => (manifest.value ? resolveBundles(state.value.bundles, manifest.value.skills).bundles : []))

const description = 'Compose a Claude Code setup in the browser: pick a preset, answer a few questions, tick the bundles, and download the zip — or copy the equivalent CLI command.'
const { public: { siteUrl } } = useRuntimeConfig()

useSeoMeta({
  title: 'Build your setup',
  description,
  ogTitle: 'Build your setup',
  ogDescription: description,
  ogUrl: `${siteUrl.replace(/\/+$/, '')}/build`
})
</script>

<template>
  <UDashboardPanel
    id="build"
    :ui="{ body: 'gap-4' }"
  >
    <template #header>
      <!--
        #left (not #title/#leading): DashboardNavbar.vue nests <h1 data-slot="title"> inside
        #left's own default content, so overriding #left is what keeps exactly one h1 on the page.
      -->
      <UDashboardNavbar>
        <template #left>
          <UDashboardSidebarCollapse />
          <h1 class="text-sm font-semibold text-highlighted truncate">
            Build your setup
          </h1>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="schemaErrors.length"
        color="error"
        variant="subtle"
        icon="i-lucide-octagon-alert"
        title="The base schema has errors; the builder is disabled until they are fixed."
      >
        <template #description>
          <ul class="list-disc ps-4 space-y-0.5">
            <li
              v-for="message in schemaErrors"
              :key="message"
            >
              {{ message }}
            </li>
          </ul>
        </template>
      </UAlert>

      <div
        v-else-if="manifest"
        class="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0"
      >
        <BuildForm
          :manifest="manifest"
          :state="state"
          :preset="preset"
          :axes="axes"
          :locked-by="lockedBy"
          :recommended="recommended"
          :valid="valid"
          :name-error="nameError"
          @update:preset="selectPreset"
          @update:project-name="setProjectName"
          @answer="setAnswer"
          @toggle="toggleBundle"
        />
        <BuildSetupPreview
          :plan="plan"
          :warnings="warnings"
          :loading="snippetsLoading"
          :bundles="resolvedBundles"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
