import { usePreferences } from './preferences-context';
import { createMemo, For, Show } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
type Props = {
  tag: Accessor<string>;
  values: Accessor<Record<string, string>>;
  setValues: Setter<Record<string, string>>;
  change(key: string, value: string, attribute?: boolean): void;
  draftChange(key: string, value: string): void;
  pickImage(): void;
  deleteElement(): void;
};
export function Inspector(props: Props) {
  const { t } = usePreferences();
  const { tag, values, setValues, change } = props;
  const textCount = createMemo(() => Number(values()['text-count']) || 0);
  const textFields = createMemo(() =>
    Array.from({ length: textCount() }, (_, index) => `text-node-${index}`),
  );
  function editText(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    props.draftChange(key, value);
  }
  const fields = [
    ['color', '글자색'],
    ['background-color', '배경색'],
    ['font-size', '글자 크기'],
    ['font-family', '글꼴'],
    ['padding', '안쪽 여백'],
    ['margin', '바깥 여백'],
    ['border-radius', '모서리'],
    ['border', '테두리'],
    ['width', '너비'],
  ];
  return (
    <aside>
      <div class="panel-title">
        {t('요소 속성')}
        <span>INSPECTOR</span>
      </div>
      <Show
        when={tag()}
        fallback={
          <div class="empty">
            <div>⌖</div>
            <h3>{t('편집할 요소를 선택하세요')}</h3>
            <p>
              {t('화면에서 요소를 클릭하면')}
              <br />
              {t('스타일과 속성이 여기에 표시됩니다.')}
            </p>
            <div class="tips">
              <b>{t('빠른 시작')}</b>
              <p>{t('① 새 문서에서 템플릿을 선택하거나 파일을 여세요.')}</p>
              <p>{t('② 텍스트를 더블 클릭해 수정하세요.')}</p>
              <p>{t('빈 문서는 요소 추가로 시작하세요.')}</p>
              <p>{t('③ 완성한 페이지를 HTML로 저장하세요.')}</p>
            </div>
          </div>
        }
      >
        <div class="selected-tag">
          &lt;{tag()}&gt;<span>{t('선택한 요소')}</span>
        </div>
        <Show when={values()['can-select-parent']}>
          <button onClick={() => change('select-parent', '')}>{t('상위 요소 선택')}</button>
        </Show>
        <button disabled={!values()['can-delete']} onClick={props.deleteElement}>
          {t('선택한 요소 삭제')}
        </button>
        <p class="hint">
          {t('컨테이너를 삭제하면 내부 요소도 함께 삭제됩니다. 실행 취소로 복구할 수 있습니다.')}
        </p>
        <Show when={values()['editor-kind'] === 'code'}>
          <div class="panel-section">{t('코드블록')}</div>
          <label>
            {t('코드 내용')}
            <textarea
              class="code-input"
              rows={10}
              spellcheck={false}
              value={values()['code-text'] || ''}
              onInput={(e) => editText('code-text', e.currentTarget.value)}
              onBlur={(e) => change('code-text', e.currentTarget.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')
                  change('code-text', e.currentTarget.value);
                if (e.key === 'Tab') {
                  e.preventDefault();
                  const input = e.currentTarget;
                  input.setRangeText('  ', input.selectionStart, input.selectionEnd, 'end');
                  editText('code-text', input.value);
                }
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  change('code-text', e.currentTarget.value);
                }
              }}
            />
          </label>
          <p class="hint">
            {t(
              '입력한 코드는 바로 반영됩니다. Tab으로 들여쓰기할 수 있습니다. 기존 강조 태그는 유지되며 구문 강조는 자동 갱신되지 않습니다.',
            )}
          </p>
        </Show>
        <Show when={values()['table-cell']}>
          <div class="panel-section">{t('표 크기')}</div>
          <For
            each={[
              ['table-column-width', '열 너비'],
              ['table-row-height', '행 높이'],
            ]}
          >
            {([key, label]) => (
              <label>
                {t(label)}
                <input
                  aria-label={t(label)}
                  value={values()[key] || ''}
                  placeholder={t('예: 120px')}
                  onInput={(e) => setValues((v) => ({ ...v, [key]: e.currentTarget.value }))}
                  onBlur={(e) => change(key, e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') change(key, e.currentTarget.value);
                  }}
                />
              </label>
            )}
          </For>
          <p class="hint">
            {t(
              '셀 오른쪽 경계를 좌우로, 아래쪽 경계를 위아래로 드래그하세요. 병합 셀에서는 오른쪽 끝 열과 시작 행을 조절합니다. 내용보다 작게 줄어들지 않을 수 있습니다.',
            )}
          </p>
        </Show>
        <Show when={textCount() > 0}>
          <div class="panel-section">
            {tag() === 'td' || tag() === 'th' ? t('셀 문구') : t('문구')}
          </div>
          <div class="text-fields">
            <For each={textFields()}>
              {(key, index) => (
                <label>
                  {t('문구')}
                  {index() + 1}
                  <textarea
                    class="text-input"
                    aria-label={`${t('문구')}${index() + 1}`}
                    rows={3}
                    value={values()[key] || ''}
                    onInput={(e) => editText(key, e.currentTarget.value)}
                    onBlur={(e) => change(key, e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')
                        change(key, e.currentTarget.value);
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        change(key, e.currentTarget.value);
                      }
                    }}
                  />
                </label>
              )}
            </For>
          </div>
          <p class="hint">
            {t(
              '입력한 문구는 바로 반영되며 저장 없이 계속 수정할 수 있습니다. 내부 태그와 아이콘은 유지됩니다.',
            )}
          </p>
        </Show>
        <div class="panel-section">{t('스타일')}</div>
        <For each={fields}>
          {([key, label]) => (
            <label>
              {t(label)}
              <input
                value={values()[key] || ''}
                placeholder={t('예: 16px')}
                onInput={(e) => setValues((v) => ({ ...v, [key]: e.currentTarget.value }))}
                onBlur={(e) => change(key, e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') change(key, e.currentTarget.value);
                }}
              />
            </label>
          )}
        </For>
        <Show when={tag() === 'a'}>
          <div class="panel-section">{t('링크')}</div>
          <label>
            {t('주소')}
            <input
              value={values().href}
              onInput={(e) => setValues((v) => ({ ...v, href: e.currentTarget.value }))}
              onBlur={(e) => change('href', e.currentTarget.value, true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') change('href', e.currentTarget.value, true);
              }}
            />
          </label>
        </Show>
        <Show when={tag() === 'img'}>
          <div class="panel-section">{t('이미지')}</div>
          <label>
            {t('이미지 주소')}
            <input
              value={values().src}
              onInput={(e) => setValues((v) => ({ ...v, src: e.currentTarget.value }))}
              onBlur={(e) => change('src', e.currentTarget.value, true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') change('src', e.currentTarget.value, true);
              }}
            />
          </label>
          <label>
            {t('대체 텍스트')}
            <input
              value={values().alt}
              onInput={(e) => setValues((v) => ({ ...v, alt: e.currentTarget.value }))}
              onBlur={(e) => change('alt', e.currentTarget.value, true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') change('alt', e.currentTarget.value, true);
              }}
            />
          </label>
          <button class="image-button" onClick={props.pickImage}>
            {t('↥ 이미지 파일로 교체')}
          </button>
        </Show>
        <p class="hint">{t('값을 입력하고 Enter를 누르거나 다른 항목을 클릭하면 적용됩니다.')}</p>
      </Show>
    </aside>
  );
}
