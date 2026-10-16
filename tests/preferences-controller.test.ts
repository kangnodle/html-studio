import { expect, test } from 'vite-plus/test';
import { createPreferencesController } from '../src/application/preferences-controller';
import { createPreferencesState } from '../src/core/preferences';
import type { Appearance, PreferencesStorage } from '../src/application/preferences-ports';

function setup(stored: ReturnType<PreferencesStorage['load']> = {}) {
  let dark = false;
  let listener: ((dark: boolean) => void) | undefined;
  let watches = 0,
    unwatches = 0;
  const saved: Parameters<PreferencesStorage['save']>[0][] = [];
  const applied: Parameters<Appearance['apply']>[0][] = [];
  const controller = createPreferencesController({
    storage: { load: () => stored, save: (value) => saved.push(value) },
    appearance: {
      readSystemDark: () => dark,
      watchSystemDark(value) {
        listener = value;
        watches++;
        return () => {
          unwatches++;
        };
      },
      apply: (value) => applied.push(value),
    },
  });
  return {
    controller,
    saved,
    applied,
    setSystemDark(value: boolean) {
      dark = value;
      listener?.(value);
    },
    counts: () => ({ watches, unwatches }),
  };
}

test('invalid persisted preferences fall back without requiring browser globals', () => {
  expect(createPreferencesState({ language: 'fr', theme: 'invalid' }, true)).toEqual({
    language: 'ko',
    theme: 'system',
    systemDark: true,
  });
  expect(createPreferencesState({ language: 'en', theme: 'dark' }, false)).toEqual({
    language: 'en',
    theme: 'dark',
    systemDark: false,
  });
});

test('initialization reads state while appearance and persistence start explicitly once', () => {
  const app = setup({ language: 'en', theme: 'system' });
  expect(app.saved).toHaveLength(0);
  expect(app.applied).toHaveLength(0);
  app.setSystemDark(true);
  app.controller.start();
  app.controller.start();
  expect(app.applied).toEqual([{ language: 'en', theme: 'dark' }]);
  expect(app.saved).toEqual([{ language: 'en', theme: 'system' }]);
  expect(app.counts().watches).toBe(1);
  app.controller.dispose();
});

test('OS changes follow system theme without overwriting the saved preference', () => {
  const app = setup();
  app.controller.start();
  app.setSystemDark(true);
  expect(app.applied.at(-1)?.theme).toBe('dark');
  expect(app.saved).toHaveLength(1);
  app.controller.setTheme('light');
  app.setSystemDark(false);
  app.setSystemDark(true);
  expect(app.applied.at(-1)?.theme).toBe('light');
  expect(app.saved.at(-1)?.theme).toBe('light');
  expect(app.saved).toHaveLength(2);
  app.controller.setTheme('system');
  expect(app.applied.at(-1)?.theme).toBe('dark');
  app.controller.dispose();
});

test('language and theme changes persist and notify independently of Solid', () => {
  const app = setup();
  app.controller.start();
  const languages: string[] = [];
  const unsubscribe = app.controller.subscribe((value) => languages.push(value.language));
  app.controller.setLanguage('en');
  app.controller.setLanguage('en');
  expect(languages).toEqual(['ko', 'en']);
  expect(app.saved.at(-1)).toEqual({ language: 'en', theme: 'system' });
  expect(app.applied.at(-1)).toEqual({ language: 'en', theme: 'light' });
  unsubscribe();
  app.controller.setLanguage('ko');
  expect(languages).toHaveLength(2);
  app.controller.dispose();
});

test('disposal removes the OS listener once and ignores late events and commands', () => {
  const app = setup();
  app.controller.start();
  app.controller.dispose();
  app.controller.dispose();
  const applied = app.applied.length,
    saved = app.saved.length;
  app.setSystemDark(true);
  app.controller.setTheme('dark');
  app.controller.setLanguage('en');
  app.controller.start();
  expect(app.applied).toHaveLength(applied);
  expect(app.saved).toHaveLength(saved);
  expect(app.counts()).toEqual({ watches: 1, unwatches: 1 });
});
