import { usePreferences } from './preferences-context';
import { createSignal, For } from 'solid-js';
import type { Accessor } from 'solid-js';
import { htmlElements, type HtmlElementTag } from '../core/html-elements';

type Props = {
  canUndo: Accessor<boolean>;
  canRedo: Accessor<boolean>;
  preview: Accessor<boolean>;
  width: Accessor<string>;
  restore(direction: -1 | 1): void;
  setWidth(value: string): void;
  togglePreview(): void;
  insertElement(tag: HtmlElementTag, text: string): void;
  templateId: Accessor<string | undefined>;
};

export function Toolbar(props: Props) {
  const { t } = usePreferences();
  const [elementTag, setElementTag] = createSignal<HtmlElementTag>('p');
  const { canUndo, canRedo, preview, width, restore, setWidth, togglePreview } = props;
  const sizes = () => {
    if (props.templateId() === 'research')
      return [
        ['100%', '전체 너비'],
        ['794px', 'A4 문서'],
        ['390px', '모바일'],
      ];
    if (props.templateId() === 'slides')
      return [
        ['100%', '전체 너비'],
        ['1120px', '16:9 슬라이드'],
        ['390px', '모바일'],
      ];
    return [
      ['100%', '데스크톱'],
      ['768px', '태블릿'],
      ['390px', '모바일'],
    ];
  };
  return (
    <div class="toolbar">
      <div class="tools">
        <button disabled={!canUndo()} onClick={() => restore(-1)} title={t('실행 취소 (Ctrl+Z)')}>
          ↶
        </button>
        <button
          disabled={!canRedo()}
          onClick={() => restore(1)}
          title={t('다시 실행 (Ctrl+Shift+Z)')}
        >
          ↷
        </button>
        <span class="divider" />
        <span class="mode">{preview() ? t('미리보기') : t('✦ 편집 모드')}</span>
        <select
          class="element-type"
          aria-label={t('추가할 요소')}
          disabled={preview()}
          value={elementTag()}
          onChange={(e) => setElementTag(e.currentTarget.value as HtmlElementTag)}
        >
          <For each={htmlElements}>
            {([tag, label]) => (
              <option value={tag}>
                {t(label)} &lt;{tag}&gt;
              </option>
            )}
          </For>
        </select>
        <button
          class="insert-text"
          disabled={preview()}
          title={t('선택한 컨테이너 안 또는 선택한 요소 뒤에 추가합니다.')}
          onClick={() => props.insertElement(elementTag(), t('새 내용을 입력하세요.'))}
        >
          {t('＋ 요소 추가')}
        </button>
      </div>
      <div class="devices">
        <For each={sizes()}>
          {([value, label]) => (
            <button classList={{ active: width() === value }} onClick={() => setWidth(value)}>
              {t(label)}
            </button>
          )}
        </For>
      </div>
      <button classList={{ active: preview() }} onClick={togglePreview}>
        {preview() ? t('편집으로 돌아가기') : t('◉ 미리보기')}
      </button>
    </div>
  );
}
