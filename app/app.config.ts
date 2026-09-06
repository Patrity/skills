export default defineAppConfig({
  ui: {
    colors: { primary: 'green', neutral: 'neutral' },
    // Slot names verified against .nuxt/ui/{button,input,select,tabs,tree,checkbox}.ts.
    button: { slots: { base: 'font-semibold' } },
    input: { slots: { base: 'font-mono text-sm' } },
    select: { slots: { base: 'font-mono text-sm' } },
    tabs: { slots: { list: 'bg-(--ui-bg-elevated) border border-(--ui-border) rounded-lg p-1', trigger: 'font-medium' } },
    tree: { slots: { link: 'font-mono text-sm', linkTrailingIcon: 'text-green-500' } },
    checkbox: { slots: { label: 'text-sm' } }
  }
})
