import type { EffectiveTheme, Language, Theme } from '../core/preferences';

export interface PreferencesStorage {
  load(): { language?: string | null; theme?: string | null };
  save(preferences: { language: Language; theme: Theme }): void;
}

export interface Appearance {
  readSystemDark(): boolean;
  watchSystemDark(listener: (dark: boolean) => void): () => void;
  apply(value: { language: Language; theme: EffectiveTheme }): void;
}
