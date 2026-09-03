// @nuxtjs/mdc generates `.nuxt/mdc-highlighter.mjs` and aliases it as `#mdc-highlighter`
// for both Nuxt and Nitro. The Nitro tsconfig maps the alias to an extensionless path that
// TypeScript cannot resolve, so declare the shape the module actually exports.
declare module '#mdc-highlighter' {
  import type { Highlighter } from '@nuxtjs/mdc'

  const highlighter: Highlighter
  export default highlighter
}
