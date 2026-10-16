export type Language = 'ko' | 'en';
export type Theme = 'system' | 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';
export type PreferencesState = Readonly<{
  language: Language;
  theme: Theme;
  systemDark: boolean;
}>;

export function createPreferencesState(
  stored: { language?: string | null; theme?: string | null },
  systemDark: boolean,
): PreferencesState {
  return {
    language: stored.language === 'en' ? 'en' : 'ko',
    theme: stored.theme === 'light' || stored.theme === 'dark' ? stored.theme : 'system',
    systemDark,
  };
}

export function resolveTheme(theme: Theme, systemDark: boolean): EffectiveTheme {
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}
