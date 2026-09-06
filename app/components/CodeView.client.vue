<script setup lang="ts">
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { drawSelection, EditorView, highlightSpecialChars, lineNumbers } from '@codemirror/view'
import { bracketMatching, defaultHighlightStyle, foldGutter, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { markdown } from '@codemirror/lang-markdown'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { yaml } from '@codemirror/lang-yaml'
import { python } from '@codemirror/lang-python'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import type { Language } from '~~/shared/types/skills'

const props = defineProps<{
  code: string
  language: Language
}>()

const host = ref<HTMLDivElement>()
const colorMode = useColorMode()
let view: EditorView | null = null
const languageCompartment = new Compartment()
const themeCompartment = new Compartment()

function languageExtension(lang: Language): Extension {
  switch (lang) {
    case 'markdown': return markdown()
    case 'javascript': return javascript()
    case 'typescript': return javascript({ typescript: true })
    case 'json': return json()
    case 'yaml': return yaml()
    case 'python': return python()
    case 'shell': return StreamLanguage.define(shell)
    default: return []
  }
}

/**
 * Light mode is drawn from the design tokens (`--cm-bg`, `--cm-gutter`, `--cm-accent` in
 * `app/assets/css/main.css`); dark keeps one-dark, which the design signed off as-is.
 * Token colouring stays on CodeMirror's `defaultHighlightStyle` — the tag vocabulary lives
 * in `@lezer/highlight`, which is not a direct dependency and is not worth adding for it.
 */
const lightTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--cm-bg)', color: 'var(--ui-text)' },
  '.cm-content': { caretColor: 'var(--cm-accent)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--cm-accent)' },
  '.cm-gutters': {
    backgroundColor: 'var(--cm-gutter)',
    borderRight: '1px solid var(--ui-border)',
    color: 'var(--ui-text-dimmed)'
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--cm-accent) 6%, transparent)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--cm-accent) 20%, transparent)'
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--ui-text-dimmed)'
  }
}, { dark: false })

function themeExtension(dark: boolean): Extension {
  return dark ? oneDark : [lightTheme, syntaxHighlighting(defaultHighlightStyle, { fallback: true })]
}

const baseTheme = EditorView.theme({
  '&': { fontSize: '13px' },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.7'
  },
  '.cm-content': { padding: '12px 0' },
  '.cm-line': { padding: '0 16px' }
})

function createView(el: HTMLDivElement) {
  view = new EditorView({
    parent: el,
    state: EditorState.create({
      doc: props.code,
      extensions: [
        lineNumbers(),
        highlightSpecialChars(),
        drawSelection(),
        bracketMatching(),
        foldGutter(),
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        baseTheme,
        languageCompartment.of(languageExtension(props.language)),
        themeCompartment.of(themeExtension(colorMode.value === 'dark'))
      ]
    })
  })
}

watch(host, (el) => {
  if (el && !view) createView(el)
}, { immediate: true, flush: 'post' })

watch(() => props.code, (code) => {
  if (view && code !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } })
  }
})

watch(() => props.language, (lang) => {
  view?.dispatch({ effects: languageCompartment.reconfigure(languageExtension(lang)) })
})

watch(() => colorMode.value, (mode) => {
  view?.dispatch({ effects: themeCompartment.reconfigure(themeExtension(mode === 'dark')) })
})

onUnmounted(() => {
  view?.destroy()
  view = null
})
</script>

<template>
  <div
    ref="host"
    class="code-view rounded-xl border border-default overflow-hidden"
  />
</template>

<style>
.code-view .cm-editor {
  height: auto;
}
.code-view .cm-editor.cm-focused {
  outline: none;
}
</style>
