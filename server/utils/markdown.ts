import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import type { Highlighter } from '@nuxtjs/mdc'
import type { MarkdownBody } from '~~/shared/types/skills'

// `#mdc-highlighter` is the Shiki instance @nuxtjs/mdc generates from `mdc.highlight`
// in nuxt.config. The module aliases it into the Nitro bundle (module.mjs pushes it onto
// nitro.alias and externals.inline) for its own /api/_mdc/highlight handler, so our routes
// can import it too. Calling it directly keeps highlighting in-process; the module's default
// server highlighter would $fetch that route once per code block instead.
let highlighter: Promise<Highlighter> | undefined

function getHighlighter(): Promise<Highlighter> {
  highlighter ??= import('#mdc-highlighter').then(m => m.default)
  return highlighter
}

/**
 * Parse and syntax-highlight markdown into the MDC AST that `<MDCRenderer>` consumes.
 * Doing it here is the whole point: the browser used to run the parser on every navigation
 * and issue one `/api/_mdc/highlight` round trip per fenced block.
 *
 * `toc`/`contentHeading` are off because nothing renders a table of contents and the page
 * keeps the markdown's own `# Title` as its h1.
 *
 * Throws with `label` in the message; the caller picks the status code.
 */
export async function renderMarkdown(md: string, label: string): Promise<MarkdownBody> {
  try {
    const { body } = await parseMarkdown(md, {
      highlight: { highlighter: await getHighlighter() },
      toc: false,
      contentHeading: false
    })
    return body
  } catch (err) {
    throw new Error(`Failed to render markdown for ${label}`, { cause: err })
  }
}
