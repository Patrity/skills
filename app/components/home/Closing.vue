<script setup lang="ts">
import { LINKS } from '~~/shared/utils/links'
</script>

<template>
  <section class="py-12 lg:py-20 border-t border-default text-center">
    <div class="max-w-7xl mx-auto px-4 sm:px-6">
      <h2 class="font-teko font-semibold text-[38px] lg:text-[56px] leading-[.92] tracking-[-0.01em] m-0 mx-auto max-w-[22ch]">
        Take the whole thing, or take one bundle and ignore me on the rest.
      </h2>

      <InstallBox
        command="pnpx @patrity/skills init"
        slug="init"
        class="mt-8 mx-auto max-w-96"
      />

      <p class="mt-6 text-sm text-muted">
        <!-- The byline claims the identity: rel="me" on the profile, plain links on the rest. -->
        <a
          :href="LINKS.lab"
          class="text-default no-underline border-b border-default hover:text-primary transition-colors"
        >Tony Costanzo</a> ·
        <a
          :href="LINKS.lab"
          class="text-default no-underline border-b border-default hover:text-primary transition-colors"
        >TechHive Labs</a> ·
        <a
          :href="LINKS.x"
          target="_blank"
          rel="me noopener"
          class="text-default no-underline border-b border-default hover:text-primary transition-colors"
        >@Patrity</a>
      </p>
    </div>
  </section>
</template>
