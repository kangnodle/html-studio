import { expect, test } from 'vite-plus/test';
import { recoveryStorage } from '../src/adapters/browser/recovery-storage';

test('recovery storage validates backups and handles unavailable storage', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let stored: string | null = null;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => stored,
      setItem: (_key: string, value: string) => {
        stored = value;
      },
    },
  });
  try {
    expect(recoveryStorage.load()).toBeUndefined();
    const backup = { html: '<p>draft</p>', savedHtml: '', name: 'draft.html' };
    expect(recoveryStorage.save(backup)).toBe(true);
    expect(recoveryStorage.load()).toEqual(backup);
    for (const invalid of [
      '{broken',
      'null',
      '{}',
      '{"html":42}',
      JSON.stringify({ ...backup, templateId: 42 }),
    ]) {
      stored = invalid;
      expect(recoveryStorage.load()).toBeUndefined();
    }
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('Storage unavailable');
      },
    });
    expect(recoveryStorage.load()).toBeUndefined();
    expect(recoveryStorage.save(backup)).toBe(false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
