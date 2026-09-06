import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import type { Highlighter } from '@nuxtjs/mdc'
import type { MarkdownRender } from '~~/shared/types/skills'
import { dropLeadingH1 } from '~~/server/lib/skills/markdown-body'

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

export interface RenderMarkdownOptions {
  /**
   * Remove the body's leading top-level `h1`, for a caller that renders the title itself:
   * the skill page's header owns the `<h1>` for every file under `/skill/`, and the docs
   * page takes its `<h1>` from the nav entry. Without this those pages print the same words
   * twice and carry two `<h1>`s. A `#` further down the document is the author's, and stays.
   */
  dropLeadingH1?: boolean
}

/**
 * Parse and syntax-highlight markdown into the MDC AST that `<MDCRenderer>` consumes.
 * Doing it here is the whole point: the browser used to run the parser on every navigation
 * and issue one `/api/_mdc/highlight` round trip per fenced block.
 *
 * `toc`/`contentHeading` are off because nothing renders a table of contents and no page
 * wants a synthesised title; the page's own `<h1>` comes from its header, not the markdown
 * (see `dropLeadingH1`).
 *
 * Throws with `label` in the message; the caller picks the status code.
 */
export async function renderMarkdown(md: string, label: string, options: RenderMarkdownOptions = {}): Promise<MarkdownRender> {
  try {
    const { body, data } = await parseMarkdown(md, {
      highlight: { highlighter: await getHighlighter() },
      toc: false,
      contentHeading: false
    })
    if (options.dropLeadingH1) dropLeadingH1(body)
    // `data` is the frontmatter (contentHeading is off, so no synthesised title/description).
    // <MDC> handed the same object to <MDCRenderer :data>, which interpolates {{ }} with it.
    return { body, data: data as Record<string, unknown> }
  } catch (err) {
    throw new Error(`Failed to render markdown for ${label}`, { cause: err })
  }
}
