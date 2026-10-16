import { expect, test } from 'vite-plus/test';
import { translate } from '../src/ui/translations';
import { resolveTheme } from '../src/core/preferences';

test('language changes translate an existing status without changing document or error text', () => {
  const status = '변경 사항을 적용했습니다.';
  expect(translate('ko', status)).toBe(status);
  expect(translate('en', status)).toBe('Changes applied.');
  expect(translate('en', '파일 열기 실패: Error: missing.html')).toBe(
    'Failed to open file: Error: missing.html',
  );
  expect(translate('en', 'my-document.html')).toBe('my-document.html');
  expect(translate('ko', status)).toBe(status);
});

test('only system theme follows changes to the OS color scheme', () => {
  expect(resolveTheme('system', false)).toBe('light');
  expect(resolveTheme('system', true)).toBe('dark');
  expect(resolveTheme('light', true)).toBe('light');
  expect(resolveTheme('dark', false)).toBe('dark');
});
