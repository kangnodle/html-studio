import { createSignal, For, onMount, onCleanup } from 'solid-js';
import type { HtmlTemplate } from '../application/ports';
import { usePreferences } from './preferences-context';

export function TemplatePicker(props: {
  templates: readonly HtmlTemplate[];
  create(template: HtmlTemplate): Promise<boolean>;
  close(): void;
}) {
  const { t } = usePreferences();
  let dialog!: HTMLDialogElement;
  const [selected, setSelected] = createSignal(props.templates[0]);
  const [creating, setCreating] = createSignal(false);
  onMount(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialog.showModal();
    onCleanup(() => {
      dialog.close();
      if (opener?.isConnected) opener.focus();
    });
  });

  async function createDocument() {
    if (creating()) return;
    setCreating(true);
    try {
      if (await props.create(selected())) props.close();
    } finally {
      setCreating(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      class="template-picker"
      aria-labelledby="template-title"
      aria-describedby="template-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!creating()) props.close();
      }}
    >
      <div class="template-heading">
        <div>
          <span class="dialog-eyebrow">HTML STUDIO</span>
          <h2 id="template-title">{t('어떤 문서를 만들까요?')}</h2>
          <p id="template-description">{t('템플릿을 선택하고 나만의 문서로 편집하세요.')}</p>
        </div>
        <button
          class="dialog-close"
          aria-label={t('닫기')}
          disabled={creating()}
          onClick={props.close}
        >
          ×
        </button>
      </div>
      <div class="template-content">
        <fieldset class="template-options" disabled={creating()}>
          <legend>{t('기본 템플릿')}</legend>
          <For each={props.templates}>
            {(template, index) => (
              <label class="template-card" classList={{ selected: selected().id === template.id }}>
                <input
                  type="radio"
                  name="html-template"
                  value={template.id}
                  checked={selected().id === template.id}
                  onChange={() => setSelected(template)}
                />
                <span class={`template-icon ${template.id}`} aria-hidden="true">
                  {['□', '≡', '¶', '▣', '✦'][index()]}
                </span>
                <span class="template-copy">
                  <strong>{t(template.label)}</strong>
                  <span>{t(template.description)}</span>
                </span>
              </label>
            )}
          </For>
        </fieldset>
        <div class="template-preview">
          <div class="template-preview-heading">
            <strong>{t(selected().label)}</strong>
            <span>{t('미리보기')}</span>
          </div>
          <div class="template-preview-page">
            <iframe title={t('템플릿 미리보기')} sandbox="" srcdoc={selected().html} />
            {selected().id === 'blank' && (
              <div class="blank-preview">
                <span aria-hidden="true">□</span>
                <strong>{t('완전히 빈 캔버스')}</strong>
                <p>{t('선택한 뒤 문구 추가로 첫 내용을 작성하세요.')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div class="template-footer">
        <span>{t('현재 문서의 변경 사항은 전환 전에 확인합니다.')}</span>
        <button disabled={creating()} onClick={props.close}>
          {t('취소')}
        </button>
        <button class="primary" disabled={creating()} onClick={createDocument}>
          {t(creating() ? '문서 만드는 중…' : '이 템플릿으로 시작')}
        </button>
      </div>
    </dialog>
  );
}
