import { currentHtml, type EditorState } from '../core/editor-state';
import {
  createEditorDocument,
  replaceEditorDocument,
  commitDocument,
  draftDocument,
  restoreDocument,
  recordDocumentSave,
  documentView,
  documentSnapshot,
} from '../core/editor-document';
import type {
  EditorSurface,
  HtmlCodec,
  ImageFile,
  ImportFile,
  HtmlStorage,
  DiscardDialog,
  HtmlTemplate,
  RecoveryStorage,
} from './ports';
import type { HtmlElementTag } from '../core/html-elements';
import type { DocumentSnapshot } from '../core/editor-document';

export type EditorView = Readonly<{
  document: EditorState;
  name: string;
  dirty: boolean;
  saving: boolean;
  opening: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canOverwrite: boolean;
  templateLabel?: string;
  templateId?: string;
  status: string;
}>;

export function createEditorController(
  initialHtml: string,
  ports: {
    surface: EditorSurface;
    codec: HtmlCodec;
    storage: HtmlStorage;
    dialogs: DiscardDialog;
    initialTemplate?: HtmlTemplate;
    recovery?: RecoveryStorage;
  },
) {
  const { surface, codec, storage, dialogs } = ports;
  const html = codec.normalize(initialHtml);
  const recovered = ports.recovery?.load();
  let lastRecovery: DocumentSnapshot | undefined = recovered;
  let state = createEditorDocument(
    recovered
      ? {
          ...recovered,
          html: codec.normalize(recovered.html),
          savedHtml: recovered.savedHtml === '' ? '' : codec.normalize(recovered.savedHtml),
        }
      : {
          html,
          savedHtml: html,
          name: ports.initialTemplate?.name ?? 'untitled.html',
          templateId: ports.initialTemplate?.id,
          templateLabel: ports.initialTemplate?.label,
        },
  );
  let sourceFile: ImportFile | undefined;
  let saving = false,
    opening = false,
    disposed = false;
  let openToken = 0;
  let status = '요소를 클릭해 선택하고, 텍스트는 더블 클릭해 수정하세요.';
  const listeners = new Set<(view: EditorView) => void>();
  const view = (): EditorView => ({
    ...documentView(state),
    saving,
    opening,
    status,
    canOverwrite: !!sourceFile?.overwriteHtml,
  });
  const publish = () => {
    if (disposed) return;
    if (ports.recovery) {
      const snapshot = documentSnapshot(state);
      if (
        !lastRecovery ||
        snapshot.html !== lastRecovery.html ||
        snapshot.savedHtml !== lastRecovery.savedHtml ||
        snapshot.name !== lastRecovery.name ||
        snapshot.templateId !== lastRecovery.templateId ||
        snapshot.templateLabel !== lastRecovery.templateLabel
      ) {
        if (ports.recovery.save(snapshot)) lastRecovery = snapshot;
        else status = '작업 자동 저장에 실패했습니다. HTML 파일로 저장하세요.';
      }
    }
    listeners.forEach((listener) => listener(view()));
  };
  function reportStatus(message: string) {
    if (disposed) return;
    status = message;
    publish();
  }
  function commit(html?: string) {
    if (disposed) return;
    html ??= surface.snapshot();
    state = commitDocument(state, html);
    publish();
  }
  function flush() {
    if (disposed) return;
    commit(surface.finishEditing() ?? undefined);
  }
  function observeDraft(html: string) {
    if (disposed) return;
    state = draftDocument(state, html);
    publish();
  }
  function restore(direction: -1 | 1) {
    if (disposed) return;
    flush();
    const next = restoreDocument(state, direction);
    if (next === state) return;
    state = next;
    surface.load(currentHtml(state.document));
    publish();
  }
  async function replaceDocument(file?: ImportFile, template?: HtmlTemplate) {
    if (!file || disposed) return false;
    const token = ++openToken;
    opening = true;
    publish();
    try {
      const html = codec.normalize(await file.text());
      if (disposed || token !== openToken) return false;
      flush();
      const checkedVersion = state.revision;
      if (view().dirty) {
        const accepted = await dialogs.confirmDiscard(
          template
            ? '저장하지 않은 변경 사항을 버리고 새 문서를 만드시겠습니까?'
            : '저장하지 않은 변경 사항을 버리고 새 파일을 여시겠습니까?',
        );
        if (disposed || token !== openToken || !accepted) return false;
        flush();
        if (checkedVersion !== state.revision) {
          reportStatus('확인 중 문서가 변경되었습니다. 문서 전환을 다시 시도하세요.');
          return false;
        }
      }
      state = replaceEditorDocument(state, {
        html,
        savedHtml: template ? '' : html,
        name: file.name,
        templateId: template?.id,
        templateLabel: template?.label,
      });
      sourceFile = template ? undefined : file;
      surface.load(html);
      reportStatus(
        template
          ? '새 문서를 만들었습니다. 내용을 편집한 뒤 HTML로 저장하세요.'
          : '파일을 열었습니다. 상대 경로의 CSS·이미지는 자동으로 불러오지 못합니다. 외부 URL 또는 내장 리소스를 사용하세요.',
      );
      return true;
    } catch (error) {
      if (!disposed && token === openToken) reportStatus(`파일 열기 실패: ${String(error)}`);
      return false;
    } finally {
      if (!disposed && token === openToken) {
        opening = false;
        publish();
      }
    }
  }
  async function saveDocument(overwrite = false) {
    if (saving || disposed) return;
    const writeOriginal = sourceFile?.overwriteHtml?.bind(sourceFile);
    if (overwrite && !writeOriginal) {
      reportStatus('덮어쓰려면 파일 열기로 원본 파일을 선택하세요.');
      return;
    }
    flush();
    const html = currentHtml(state.document),
      id = state.identity;
    saving = true;
    publish();
    try {
      const success = await (overwrite ? writeOriginal!(html) : storage.saveHtml(html, state.name));
      if (disposed || id !== state.identity) return;
      if (!success) {
        reportStatus('저장을 취소했습니다.');
        return;
      }
      state = recordDocumentSave(state, html, id);
      reportStatus(overwrite ? 'HTML 파일을 덮어썼습니다.' : storage.saveMessage);
    } catch (error) {
      if (!disposed && id === state.identity) reportStatus(`저장 실패: ${String(error)}`);
    } finally {
      if (!disposed) {
        saving = false;
        publish();
      }
    }
  }
  async function replaceImage(file?: ImageFile) {
    if (!file || disposed) return;
    surface.finishEditing();
    const apply = surface.imageTarget(),
      id = state.identity;
    if (!apply) return;
    try {
      const dataUrl = await file.readDataUrl();
      if (!disposed && id === state.identity && apply(dataUrl)) commit();
    } catch (error) {
      if (!disposed && id === state.identity) reportStatus(`이미지 읽기 실패: ${String(error)}`);
    }
  }
  async function requestClose() {
    if (disposed) return false;
    flush();
    if (saving || opening) return false;
    if (!view().dirty) return true;
    const checkedVersion = state.revision;
    const accepted = await dialogs.confirmDiscard(
      '저장하지 않은 변경 사항을 버리고 닫으시겠습니까?',
    );
    if (disposed) return false;
    flush();
    return accepted && checkedVersion === state.revision && !saving && !opening;
  }
  function insertElement(tag: HtmlElementTag, text: string) {
    if (disposed) return;
    surface.finishEditing();
    if (surface.insertElement(tag, text)) {
      commit();
      reportStatus('요소를 추가했습니다. 속성 패널에서 내용을 수정하세요.');
    }
  }
  return {
    view,
    commit,
    observeDraft,
    async open(file?: ImportFile) {
      await replaceDocument(file);
    },
    newDocument(template: HtmlTemplate) {
      return replaceDocument({ name: template.name, text: async () => template.html }, template);
    },
    insertParagraph(text: string) {
      insertElement('p', text);
    },
    insertElement,
    deleteElement() {
      if (disposed) return;
      surface.finishEditing();
      if (surface.deleteElement()) {
        commit();
        reportStatus('요소를 삭제했습니다. 실행 취소로 복구할 수 있습니다.');
      }
    },
    save: () => saveDocument(),
    overwrite: () => saveDocument(true),
    restore,
    replaceImage,
    requestClose,
    reportStatus,
    subscribe(listener: (view: EditorView) => void) {
      if (disposed) return () => {};
      listeners.add(listener);
      listener(view());
      return () => {
        listeners.delete(listener);
      };
    },
    change(key: string, value: string, attribute = false) {
      if (disposed) return;
      surface.finishEditing();
      if (surface.change(key, value, attribute)) {
        commit();
        reportStatus('변경 사항을 적용했습니다.');
      }
    },
    draftChange(key: string, value: string, attribute = false) {
      if (disposed) return;
      surface.finishEditing();
      if (surface.change(key, value, attribute, true)) surface.scheduleDraft(observeDraft);
    },
    togglePreview(preview: boolean) {
      if (disposed) return;
      flush();
      surface.setPreview(preview);
    },
    clearSelection() {
      if (disposed) return;
      flush();
      surface.clearSelection();
    },
    hasUnsavedChanges() {
      if (disposed) return false;
      flush();
      return view().dirty;
    },
    isBusy: () => !disposed && (saving || opening),
    dispose() {
      if (disposed) return;
      flush();
      disposed = true;
      saving = false;
      opening = false;
      openToken++;
      listeners.clear();
      surface.dispose();
    },
  };
}
