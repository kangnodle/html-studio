import type { PreferencesStorage } from '../../application/preferences-ports';

export const preferencesStorage: PreferencesStorage = {
  load() {
    try {
      return {
        language: localStorage.getItem('html-studio.language'),
        theme: localStorage.getItem('html-studio.theme'),
      };
    } catch {
      return {};
    }
  },
  save(value) {
    try {
      localStorage.setItem('html-studio.language', value.language);
      localStorage.setItem('html-studio.theme', value.theme);
    } catch {
      /* Preferences still work when persistence is unavailable. */
    }
  },
};
