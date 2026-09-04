type EventData = Record<string, string | number | boolean>

/** Thin wrapper over nuxt-umami. In dev/preview the module runs in faux mode and every call is a no-op. */
export function useAnalytics() {
  function track(name: string, data?: EventData) {
    if (import.meta.server) return
    void umTrackEvent(name, data)
  }
  return {
    trackSkillView: (slug: string) => track('skill-view', { slug }),
    trackDownload: (slug: string, from: 'index' | 'detail') => track('skill-download', { slug, from }),
    trackSource: (slug: string) => track('skill-source', { slug }),
    trackInstallCopy: (slug: string) => track('skill-install-copy', { slug }),
    // Flattened to strings: Umami event data holds scalars, not arrays or objects.
    trackBuildDownload: (profile: string, bundles: string[], answers: Record<string, string>) => track('setup-build-download', {
      profile,
      bundles: bundles.join(','),
      axes: Object.entries(answers).map(([k, v]) => `${k}=${v}`).join(';')
    }),
    trackBuildCopyCli: (profile: string) => track('setup-build-copy-cli', { profile })
  }
}
