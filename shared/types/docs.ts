import type { DocEntry } from '../../content/docs/nav'
import type { MarkdownRender } from './skills'

/** One docs page: its nav entry plus the markdown parsed to the MDC AST on the server. */
export interface DocResponse extends MarkdownRender {
  entry: DocEntry
}
