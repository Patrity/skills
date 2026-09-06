<template>
  <!-- The scroll hint in the hero aims at this section. -->
  <section
    id="writes"
    class="py-12 lg:py-20"
  >
    <div class="max-w-7xl mx-auto px-4 sm:px-6">
      <div class="max-w-3xl mb-7 lg:mb-10">
        <MicroLabel class="block mb-2.5">
          What the run writes
        </MicroLabel>
        <h2 class="font-teko font-semibold text-4xl lg:text-[46px] leading-[.9] tracking-[-0.01em] m-0">
          Three things land in the repo.
        </h2>
        <p class="mt-3.5 text-base/[1.65] text-muted">
          Thirty-one files for the <code class="font-mono text-sm">nuxt-app</code> profile, and no wrapper directory to dig them out of.
        </p>
      </div>

      <div class="relative rounded-xl overflow-hidden p-3 lg:p-6">
        <div
          class="hive-texture absolute inset-0 opacity-[0.28]"
          aria-hidden="true"
        />
        <div class="relative grid grid-cols-1 md:grid-cols-3 gap-4">
          <article class="glass-card glow p-5">
            <MicroLabel>One file</MicroLabel>
            <h3 class="font-teko font-semibold text-[28px] leading-[.9] tracking-[-0.01em] mt-1.5 mb-2">
              CLAUDE.md
            </h3>
            <p class="m-0 mb-3.5 text-sm/[1.55] text-muted">
              Composed from the answers you gave and the bundles you picked. Your own paragraphs stay where you put them.
            </p>
            <pre class="m-0 pt-3 border-t border-default font-mono text-[0.6875rem]/[1.8] text-dimmed whitespace-pre overflow-x-auto [font-variant-ligatures:none]"><b class="font-normal text-(--color-green-500)"># acme-web</b>
<b class="font-normal text-(--color-green-500)">## Git</b>
&lt;!-- skills:base:pushes=ask --&gt;
- Never push without explicit
  approval, even after a commit
  was approved.</pre>
          </article>

          <article class="glass-card glow p-5">
            <MicroLabel>One directory</MicroLabel>
            <h3 class="font-teko font-semibold text-[28px] leading-[.9] tracking-[-0.01em] mt-1.5 mb-2">
              .claude/
            </h3>
            <p class="m-0 mb-3.5 text-sm/[1.55] text-muted">
              Rules scoped to paths, skills with their scripts, hooks, and the settings that wire them up.
            </p>
            <pre class="m-0 pt-3 border-t border-default font-mono text-[0.6875rem]/[1.8] text-dimmed whitespace-pre overflow-x-auto [font-variant-ligatures:none]"><b class="font-normal text-(--color-green-500)">.claude/</b>
  rules/web-nuxt.md
  skills/nuxt-docs/SKILL.md
  hooks/protect-env.sh
  settings.json
  skills.lock.json</pre>
          </article>

          <article class="glass-card glow p-5">
            <MicroLabel>One record</MicroLabel>
            <h3 class="font-teko font-semibold text-[28px] leading-[.9] tracking-[-0.01em] mt-1.5 mb-2">
              Lockfile
            </h3>
            <p class="m-0 mb-3.5 text-sm/[1.55] text-muted">
              Every file the tool wrote, hashed. That is how the next run can take a bundle back out without touching your edits.
            </p>
            <pre class="m-0 pt-3 border-t border-default font-mono text-[0.6875rem]/[1.8] text-dimmed whitespace-pre overflow-x-auto [font-variant-ligatures:none]">{
  "version": 1,
  "projectName": "acme-web",
  "answers": { "pm": "pnpm" },
  "bundles": {
    "nuxt": { "sha": "8f3c1d" }</pre>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>
