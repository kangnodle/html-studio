import { translate } from './ui/translations';
import { PreferencesProvider } from './ui/preferences-context';
import { createPreferencesController } from './application/preferences-controller';
import { preferencesStorage } from './adapters/browser/preferences-storage';
import { recoveryStorage } from './adapters/browser/recovery-storage';
import { createBrowserAppearance } from './adapters/browser/appearance';
import { render } from 'solid-js/web';
import { isTauri } from '@tauri-apps/api/core';
import { createEditorController } from './application/editor-controller';
import { currentHtml } from './core/editor-state';
import type { HtmlStorage, DiscardDialog, WindowLifecycle } from './application/ports';
import { createIframeEditor } from './adapters/dom/iframe-editor';
import { htmlCodec } from './adapters/dom/html-codec';
import * as browserFiles from './adapters/browser/file-access';
import * as tauriFiles from './adapters/tauri/file-access';
import { confirmDiscard as confirmBrowserDiscard } from './adapters/browser/discard-dialog';
import { createDiscardDialog } from './adapters/tauri/discard-dialog';
import { watchClose as watchBrowserClose } from './adapters/browser/window-lifecycle';
import { watchClose as watchTauriClose } from './adapters/tauri/window-lifecycle';
import { templates } from './templates/catalog';
import { App } from './ui/App';
import type { SessionFactory } from './ui/editor-session';
import './style.css';

const desktop = isTauri();
const storage: HtmlStorage = {
  saveHtml: desktop ? tauriFiles.saveHtml : browserFiles.saveHtml,
  saveMessage: desktop ? 'HTML 파일을 저장했습니다.' : 'HTML 파일을 다운로드했습니다.',
};

const preferences = createPreferencesController({
  storage: preferencesStorage,
  appearance: createBrowserAppearance(),
});
const t = (message: string) => translate(preferences.view().language, message);
const nativeDialogs = createDiscardDialog(t);

const dialogs: DiscardDialog = {
  confirmDiscard: desktop
    ? nativeDialogs.confirmDiscard
    : (message) => confirmBrowserDiscard(t(message)),
};
const lifecycle: WindowLifecycle = {
  watchClose: desktop ? watchTauriClose : watchBrowserClose,
};

const createSession: SessionFactory = (hooks) => {
  let controller!: ReturnType<typeof createEditorController>;
  const surface = createIframeEditor({
    ...hooks,
    commit: (html) => controller.commit(html),
    draft: (html) => controller.observeDraft(html),
    status: (message) => controller.reportStatus(message),
  });
  controller = createEditorController(templates[0].html, {
    surface,
    codec: htmlCodec,
    storage,
    dialogs,
    initialTemplate: templates[0],
    recovery: recoveryStorage,
  });
  return {
    controller,
    templates,
    surface: {
      attach: (frame) => surface.attach(frame, currentHtml(controller.view().document)),
      ready: surface.ready,
      isEditing: surface.isEditing,
    },
    lifecycle,
    pickHtmlFile: desktop
      ? tauriFiles.openHtml
      : browserFiles.supportsFilePicker()
        ? browserFiles.openHtml
        : undefined,
    imageFile: (file) => ({ readDataUrl: () => browserFiles.readImage(file) }),
  };
};

render(
  () => (
    <PreferencesProvider controller={preferences}>
      <App createSession={createSession} />
    </PreferencesProvider>
  ),
  document.getElementById('root')!,
);
