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
const bundles = computed(() => data.value?.skills ?? [])
const featured = computed(() => bundles.value.slice(0, 6))

const description = 'Answer a few questions and download a CLAUDE.md and a .claude/ directory: rules that carry the direction, skills that carry the how-to, hooks that fail closed. Compose it on the web or from the CLI, or take any single bundle on its own.'

useSeoMeta({
  // The app-level titleTemplate appends " · Skills".
  title: 'An opinionated Claude Code setup',
  description,
  ogTitle: 'Skills — an opinionated Claude Code setup',
  ogDescription: description
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
        title="Tony's opinionated Claude Code setup."
        description="Answer a few questions and get a CLAUDE.md and a .claude/ directory that match how I work: rules that carry the direction, skills that carry the how-to, hooks that fail closed, docs a test keeps honest. Every piece is also a bundle you can take on its own."
      >
        <template #links>
          <UButton
            label="Build it on the web"
            to="/build"
            icon="i-lucide-hammer"
            size="xl"
          />
          <SkillInstallCommand
            command="pnpx @patrity/skills init"
            slug="init"
            class="w-full sm:w-auto sm:min-w-72"
          />
        </template>

        <p class="text-sm text-muted text-center">
          by
          <ULink
            to="https://github.com/Patrity"
            target="_blank"
            class="text-default hover:text-primary"
          >Patrity</ULink>
        </p>
      </UPageHero>

      <UPageSection
        headline="Build"
        title="Two ways in, one result"
        description="Both front ends call the same planner, so the zip the builder hands you is the set of files init writes into an empty directory: a composed CLAUDE.md, .claude/ with the skills, rules and hooks you picked, a managed .gitignore block, and a lockfile."
        :features="[
          { title: 'The web builder', description: 'Pick a preset, answer the questions, and watch the CLAUDE.md compose as you go. Download the zip, or copy a link that carries your answers to someone else.', icon: 'i-lucide-hammer' },
          { title: 'The CLI', description: 'pnpx @patrity/skills init runs the same wizard in a terminal. After that, add installs another bundle and update re-renders the project against the current registry.', icon: 'i-lucide-terminal' }
        ]"
        :links="[
          { label: 'Open the builder', to: '/build', icon: 'i-lucide-hammer' },
          { label: 'Start here', to: '/docs/start-here', color: 'neutral', variant: 'subtle', trailingIcon: 'i-lucide-arrow-right' }
        ]"
      />

      <UPageSection
        v-if="bundles.length"
        headline="What's in the box"
        title="Fourteen questions, nine bundles"
        description="The questions cover the package manager, the repo layout, how much process a change goes through, how UI work is validated, how docs are kept, whether Claude may commit and push on its own, where the project deploys, whether the memory server is wired up, whether rules are reminders or fail-closed hooks, and whether there is a non-engineering domain it must not guess about. Follow-ups appear only when they apply."
      >
        <div class="flex flex-wrap justify-center gap-2">
          <NuxtLink
            v-for="bundle in bundles"
            :key="bundle.slug"
            :to="`/skill/${bundle.slug}`"
          >
            <UBadge
              :label="bundle.name"
              color="neutral"
              variant="subtle"
              size="lg"
              class="hover:text-primary transition-colors"
            />
          </NuxtLink>
        </div>
        <div class="flex justify-center mt-8">
          <UButton
            label="All bundles"
            to="/skills"
            color="neutral"
            variant="subtle"
            trailing-icon="i-lucide-arrow-right"
          />
        </div>
      </UPageSection>

      <UPageSection
        headline="How it works"
        title="Bundles mirror your .claude/ directory"
        description="Each bundle lives in skills/<slug>/ in the GitHub repo. A README with YAML frontmatter is the only required file; everything else is exactly what you would commit under .claude/."
        :features="[
          { title: 'Rendered straight from GitHub', description: 'Pages are built from the repository at request time. A merge to main is live in seconds, no redeploy.', icon: 'i-lucide-git-branch' },
          { title: 'Readable before you install', description: 'Browse the file tree, read SKILL.md and rules with rendered markdown, inspect hooks and settings with syntax highlighting.', icon: 'i-lucide-eye' }
        ]"
      />

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
        description="The registry stays curated and opinionated, and a genuinely reusable bundle is still welcome. Open a pull request that adds a directory under skills/ with a README. CI validates the frontmatter; once merged to main the bundle is live within seconds, no rebuild."
        :links="[{ label: 'Open on GitHub', to: repo, target: '_blank', icon: 'i-simple-icons-github', color: 'neutral', variant: 'outline' }]"
      />
    </template>
  </UDashboardPanel>
</template>
