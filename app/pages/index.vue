<script setup lang="ts">
// Never render an empty page over an upstream failure: a cacheable 200 would pin the
// blank state for the ISR window, whereas a 5xx keeps the stale copy served.
const { data, error } = await useSkillsList()
if (error.value) {
  throw createError({
    statusCode: error.value.statusCode ?? 500,
    statusMessage: 'Skills are temporarily unavailable',
    fatal: true
  })
}
const { repo } = useGithubUrls()
const featured = computed(() => (data.value?.skills ?? []).slice(0, 6))

useSeoMeta({
  // The app-level titleTemplate appends " · Skills".
  title: 'Reusable Claude Code setups',
  description: 'Open-source, downloadable Claude Code setups: skills, rules, hooks and settings bundled to drop into any project.',
  ogTitle: 'Skills — reusable Claude Code setups',
  ogDescription: 'Open-source, downloadable Claude Code setups: skills, rules, hooks and settings bundled to drop into any project.'
})
</script>

<template>
  <UDashboardPanel
    id="home"
    :ui="{ body: 'p-0 sm:p-0 gap-0' }"
  >
    <template #header>
      <!--
        #left (not #title/#leading): DashboardNavbar.vue nests <h1 data-slot="title"> inside
        #left's own default content, unconditionally — overriding #title alone still renders
        an empty h1 (which would double up with the hero's own h1 below). Overriding #left
        replaces that whole default, so no h1 renders here at all.
      -->
      <UDashboardNavbar>
        <template #left>
          <UDashboardSidebarCollapse />
          <span class="text-sm font-semibold text-highlighted truncate">Home</span>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UPageHero
        headline="Open source"
        title="Reusable Claude Code setups, one download away."
        description="Every bundle here mirrors a project's .claude/ directory — skills, rules, hooks, settings and a CLAUDE.md pointer — so a new project starts with the tooling you already trust."
        :links="[
          { label: 'Browse skills', to: '/skills', icon: 'i-lucide-package', size: 'xl' },
          { label: 'Read the docs', to: '/docs', color: 'neutral', variant: 'subtle', trailingIcon: 'i-lucide-arrow-right', size: 'xl' }
        ]"
      />

      <UPageSection
        headline="How it works"
        title="Bundles mirror your .claude/ directory"
        description="Each bundle lives in skills/<slug>/ in the GitHub repo. A README with YAML frontmatter is the only required file; everything else is exactly what you would commit under .claude/."
        :features="[
          { title: 'Download and drop in', description: 'Grab the zip, unzip it into your project\'s .claude/ folder, paste the CLAUDE.md pointer if the bundle ships one.', icon: 'i-lucide-download' },
          { title: 'Rendered straight from GitHub', description: 'Pages are built from the repository at request time. A merge to main is live in seconds, no redeploy.', icon: 'i-lucide-git-branch' },
          { title: 'Readable before you install', description: 'Browse the file tree, read SKILL.md and rules with rendered markdown, inspect hooks and settings with syntax highlighting.', icon: 'i-lucide-eye' }
        ]"
      />

      <UPageSection
        headline="Start a project"
        title="One command, one coherent CLAUDE.md"
        description="Run the wizard in a project directory: it asks about package manager, workflow, docs, git policy and testing, lets you pick bundles, and writes .claude/ plus a CLAUDE.md where every rule lands in its section. Re-run any time; a lockfile keeps it idempotent."
        :links="[{ label: 'CLI docs', to: '/docs/cli', color: 'neutral', variant: 'subtle', trailingIcon: 'i-lucide-arrow-right' }]"
      >
        <SkillInstallCommand
          command="pnpx @patrity/skills init"
          slug="init"
          class="max-w-md mx-auto"
        />
      </UPageSection>

      <UPageSection
        v-if="featured.length"
        headline="Latest"
        title="Bundles"
        :links="[{ label: 'All skills', to: '/skills', color: 'neutral', variant: 'subtle', trailingIcon: 'i-lucide-arrow-right' }]"
      >
        <UPageGrid>
          <SkillCard
            v-for="skill in featured"
            :key="skill.slug"
            :skill="skill"
            from="index"
          />
        </UPageGrid>
      </UPageSection>

      <UPageSection
        headline="Contribute"
        title="Add your own bundle"
        description="Open a pull request that adds a directory under skills/ with a README. CI validates the frontmatter; once merged to main the bundle is live within seconds — no rebuild."
        :links="[{ label: 'Open on GitHub', to: repo, target: '_blank', icon: 'i-simple-icons-github', color: 'neutral', variant: 'outline' }]"
      />
    </template>
  </UDashboardPanel>
</template>
