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
    trackInstallCopy: (slug: string) => track('skill-install-copy', { slug })
  }
}
