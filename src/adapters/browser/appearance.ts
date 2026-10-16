import type { Appearance } from '../../application/preferences-ports';

export function createBrowserAppearance(): Appearance {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  return {
    readSystemDark: () => media.matches,
    watchSystemDark(listener) {
      const handler = (event: MediaQueryListEvent) => listener(event.matches);
      media.addEventListener('change', handler);
      return () => media.removeEventListener('change', handler);
    },
    apply(value) {
      document.documentElement.dataset.theme = value.theme;
      document.documentElement.lang = value.language;
    },
  };
}
