/**
 * The builder's form controls, from the approved design (`.lbl`, `.help`, `.ctl` in
 * docs/design/previews/_shared/page.css): a Teko question, mono helper text under it, and a
 * mono control. Shared by the project-name field and every axis so the column reads as one
 * list of questions rather than as two kinds of field.
 */
export const FIELD_UI = {
  label: 'block font-teko text-[22px] font-semibold leading-none tracking-[-0.01em] text-default',
  description: 'mt-1.5 block font-mono text-[0.6875rem]/[1.5] text-dimmed',
  container: 'mt-2',
  error: 'mt-2 font-mono text-[0.6875rem] text-error'
} as const

/** Values are paths, package managers and slugs: they read as mono, like the CLAUDE.md they land in. */
export const INPUT_UI = { base: 'font-mono text-[0.8125rem]' } as const
