import { usePreferences } from './preferences-context';
import { createSignal, Show, onMount, onCleanup } from 'solid-js';
import type { Selection } from '../application/ports';
import type { SessionFactory } from './editor-session';
import { Toolbar } from './Toolbar';
import { Inspector } from './Inspector';
import { EditorCanvas } from './EditorCanvas';
import { Preferences } from './Preferences';
import { TemplatePicker } from './TemplatePicker';

export function App(props: { createSession: SessionFactory }) {
  const { t } = usePreferences();
  let picker!: HTMLInputElement, imagePicker!: HTMLInputElement;
  const [selection, setSelection] = createSignal<Selection>({
    tag: '',
    values: {},
  });
  const [values, setValues] = createSignal<Record<string, string>>({});
  const [width, setWidth] = createSignal('100%');
  const [preview, setPreview] = createSignal(false);
  const [showTemplates, setShowTemplates] = createSignal(false);
  const session = props.createSession({
    bounds(value) {
      setSelection((selection) => ({ ...selection, bounds: value }));
    },
    selection(value) {
      setSelection(value);
      setValues(value.values);
    },
    keyboard,
  });
  const { controller, surface, lifecycle } = session;
  const [view, setView] = createSignal(controller.view());
  const unsubscribe = controller.subscribe(setView);
  const name = () => view().name;
  const dirty = () => view().dirty;
  const status = () => view().status;
  const tag = () => selection().tag;
  const bounds = () => selection().bounds;
  const open = controller.open;
  async function pickHtmlFile() {
    if (!session.pickHtmlFile) {
      picker.click();
      return;
    }
    try {
      await open(await session.pickHtmlFile());
    } catch (error) {
      controller.reportStatus('파일 열기 실패: ' + String(error));
    }
  }
  const replaceImage = (file?: File) =>
    controller.replaceImage(file ? session.imageFile(file) : undefined);
  function togglePreview() {
    controller.togglePreview(!preview());
    setPreview(!preview());
  }
  function keyboard(event: KeyboardEvent) {
    if (showTemplates()) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's')
        event.preventDefault();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void controller.save();
    }
    const target = event.target as HTMLElement | null;
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === 'z' &&
      !surface.isEditing() &&
      !target?.closest?.('input, textarea, select, [contenteditable]')
    ) {
      event.preventDefault();
      controller.restore(event.shiftKey ? 1 : -1);
    }
    if (event.key === 'Escape' && !showTemplates()) controller.clearSelection();
  }
  onMount(() => {
    window.addEventListener('keydown', keyboard);
    const unwatch = lifecycle.watchClose({
      hasUnsavedChanges: controller.hasUnsavedChanges,
      isBusy: controller.isBusy,
      requestClose: controller.requestClose,
      reportError: (error) => controller.reportStatus('닫기 처리 실패: ' + String(error)),
    });
    onCleanup(() => {
      window.removeEventListener('keydown', keyboard);
      unwatch();
    });
  });
  onCleanup(() => {
    unsubscribe();
    controller.dispose();
  });
  return (
    <div class="app">
      <header class="studio-header">
        <div class="header-identity">
          <div class="brand">
            <span class="logo">H</span>
            <div>
              HTML <strong>Studio</strong>
              <small>VISUAL HTML EDITOR</small>
            </div>
          </div>
          <div class="document-info">
            <span class="document-kind">{t(view().templateLabel ?? '외부 HTML')}</span>
            <div class="filename" title={name()}>
              <span class="document-name">{name()}</span>
              <Show when={dirty()}>
                <span class="dot" />
                {t('수정됨')}
              </Show>
            </div>
          </div>
          <div class="header-preferences">
            <Preferences />
          </div>
        </div>
        <nav class="document-menu" aria-label={t('문서 메뉴')}>
          <div class="document-start-actions">
            <button
              class="new-document"
              disabled={view().saving || view().opening}
              onClick={() => setShowTemplates(true)}
            >
              {t('＋ 새 문서')}
              <span class="button-detail">{t('템플릿 선택')}</span>
            </button>
            <button disabled={view().saving || view().opening} onClick={pickHtmlFile}>
              {t('↥ 파일 열기')}
            </button>
          </div>
          <div class="document-save-actions">
            <button
              disabled={!view().canOverwrite || view().saving || view().opening}
              title={
                view().canOverwrite
                  ? t('열려 있는 원본 HTML 파일에 저장합니다.')
                  : t('덮어쓰려면 파일 열기로 원본 파일을 선택하세요.')
              }
              onClick={controller.overwrite}
            >
              {t('HTML 덮어쓰기')}
            </button>
            <button
              class="primary"
              disabled={view().saving || view().opening}
              onClick={controller.save}
            >
              {t('↓ HTML 저장')}
            </button>
          </div>
        </nav>
      </header>
      <input
        ref={picker}
        hidden
        type="file"
        accept=".html,.htm,text/html"
        onChange={(e) => {
          void open(e.currentTarget.files?.[0]);
          e.currentTarget.value = '';
        }}
      />
      <input
        ref={imagePicker}
        hidden
        type="file"
        accept="image/*"
        onChange={(e) => {
          void replaceImage(e.currentTarget.files?.[0]);
          e.currentTarget.value = '';
        }}
      />
      <Toolbar
        canUndo={() => view().canUndo}
        canRedo={() => view().canRedo}
        preview={preview}
        width={width}
        restore={controller.restore}
        setWidth={setWidth}
        togglePreview={togglePreview}
        insertElement={controller.insertElement}
        templateId={() => view().templateId}
      />
      <div class="workspace">
        <EditorCanvas
          width={width}
          tag={tag}
          bounds={bounds}
          open={open}
          attach={surface.attach}
          ready={surface.ready}
        />
        <Inspector
          tag={tag}
          values={values}
          setValues={setValues}
          change={controller.change}
          draftChange={controller.draftChange}
          pickImage={() => imagePicker.click()}
          deleteElement={controller.deleteElement}
        />
      </div>
      <footer>
        <span class="status-dot" />
        {t(status())}
        <span class="shortcut">{t('Ctrl+S 저장 · Esc 선택 해제')}</span>
      </footer>
      <Show when={showTemplates()}>
        <TemplatePicker
          templates={session.templates}
          create={async (template) => {
            const created = await controller.newDocument(template);
            if (created) {
              setPreview(false);
              controller.togglePreview(false);
              setWidth(
                template.id === 'research' ? '794px' : template.id === 'slides' ? '1120px' : '100%',
              );
            }
            return created;
          }}
          close={() => setShowTemplates(false)}
        />
      </Show>
    </div>
  );
}
