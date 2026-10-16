import {
  createPreferencesState,
  resolveTheme,
  type Language,
  type Theme,
  type PreferencesState,
} from '../core/preferences';
import type { Appearance, PreferencesStorage } from './preferences-ports';

export function createPreferencesController(ports: {
  storage: PreferencesStorage;
  appearance: Appearance;
}) {
  const { storage, appearance } = ports;
  let state = createPreferencesState(storage.load(), appearance.readSystemDark());
  let started = false,
    disposed = false;
  let unwatch: (() => void) | undefined;
  const listeners = new Set<(value: PreferencesState) => void>();
  function publish() {
    listeners.forEach((listener) => listener(state));
  }
  function apply() {
    appearance.apply({
      language: state.language,
      theme: resolveTheme(state.theme, state.systemDark),
    });
  }
  function change(value: PreferencesState, persist: boolean) {
    if (disposed) return;
    state = value;
    if (started) {
      if (persist) storage.save({ language: state.language, theme: state.theme });
      apply();
    }
    publish();
  }
  return {
    view: () => state,
    subscribe(listener: (value: PreferencesState) => void) {
      if (disposed) return () => {};
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    },
    setLanguage(language: Language) {
      if (language !== state.language) change({ ...state, language }, true);
    },
    setTheme(theme: Theme) {
      if (theme !== state.theme) change({ ...state, theme }, true);
    },
    start() {
      if (disposed || started) return;
      started = true;
      unwatch = appearance.watchSystemDark((systemDark) => {
        if (systemDark !== state.systemDark) change({ ...state, systemDark }, false);
      });
      state = { ...state, systemDark: appearance.readSystemDark() };
      storage.save({ language: state.language, theme: state.theme });
      apply();
      publish();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unwatch?.();
      unwatch = undefined;
      listeners.clear();
    },
  };
}

export type PreferencesController = ReturnType<typeof createPreferencesController>;
