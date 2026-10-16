import { For } from 'solid-js';
import { usePreferences } from './preferences-context';

export function Preferences() {
  const { view, setTheme, setLanguage, t } = usePreferences();
  const language = () => view().language;
  const theme = () => view().theme;
  return (
    <div class="preferences">
      <div class="toggle-group" role="group" aria-label={t('언어')}>
        <button aria-pressed={language() === 'ko'} onClick={() => setLanguage('ko')}>
          한국어
        </button>
        <button aria-pressed={language() === 'en'} onClick={() => setLanguage('en')}>
          English
        </button>
      </div>
      <div class="toggle-group" role="group" aria-label={t('테마')}>
        <For each={['system', 'light', 'dark'] as const}>
          {(value) => (
            <button aria-pressed={theme() === value} onClick={() => setTheme(value)}>
              {t({ system: '시스템', light: '라이트', dark: '다크' }[value])}
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
