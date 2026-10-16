import {
  canRedo,
  canUndo,
  commitSnapshot,
  createEditorState,
  currentHtml,
  isDirty,
  markSaved,
  redo,
  undo,
  type EditorState,
} from './editor-state';

export type DocumentSnapshot = Readonly<{
  html: string;
  savedHtml: string;
  name: string;
  templateId?: string;
  templateLabel?: string;
}>;

export type EditorDocument = Readonly<{
  document: EditorState;
  name: string;
  templateId?: string;
  templateLabel?: string;
  draft?: string;
  identity: number;
  revision: number;
}>;

// HTML is normalized at the application boundary, before entering the core.
export function createEditorDocument(snapshot: DocumentSnapshot): EditorDocument {
  return {
    document: markSaved(createEditorState(snapshot.html), snapshot.savedHtml),
    name: snapshot.name,
    templateId: snapshot.templateId,
    templateLabel: snapshot.templateLabel,
    identity: 0,
    revision: 0,
  };
}

export function replaceEditorDocument(
  state: EditorDocument,
  snapshot: DocumentSnapshot,
): EditorDocument {
  return {
    ...createEditorDocument(snapshot),
    identity: state.identity + 1,
    revision: state.revision + 1,
  };
}

export function commitDocument(state: EditorDocument, html: string): EditorDocument {
  const document = commitSnapshot(state.document, html);
  return {
    ...state,
    document,
    draft: undefined,
    revision: state.revision + Number(document !== state.document),
  };
}

export function draftDocument(state: EditorDocument, html: string): EditorDocument {
  return {
    ...state,
    draft: html,
    revision: state.revision + Number(html !== (state.draft ?? currentHtml(state.document))),
  };
}

export function restoreDocument(state: EditorDocument, direction: -1 | 1): EditorDocument {
  const document = direction === -1 ? undo(state.document) : redo(state.document);
  return document === state.document ? state : { ...state, document, revision: state.revision + 1 };
}

export function recordDocumentSave(
  state: EditorDocument,
  html: string,
  identity: number,
): EditorDocument {
  return identity === state.identity
    ? { ...state, document: markSaved(state.document, html) }
    : state;
}

export function documentView(state: EditorDocument) {
  const { document, draft, name, templateId, templateLabel } = state;
  return {
    document,
    name,
    templateId,
    templateLabel,
    dirty: isDirty(document, draft),
    canUndo: canUndo(document) || (draft !== undefined && draft !== currentHtml(document)),
    canRedo: canRedo(document) && (draft === undefined || draft === currentHtml(document)),
  };
}

export function documentSnapshot(state: EditorDocument): DocumentSnapshot {
  return {
    html: state.draft ?? currentHtml(state.document),
    savedHtml: state.document.savedHtml,
    name: state.name,
    templateId: state.templateId,
    templateLabel: state.templateLabel,
  };
}

export function isDocumentSnapshot(value: unknown): value is DocumentSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Record<string, unknown>;
  return (
    typeof snapshot.html === 'string' &&
    typeof snapshot.savedHtml === 'string' &&
    typeof snapshot.name === 'string' &&
    (snapshot.templateId === undefined || typeof snapshot.templateId === 'string') &&
    (snapshot.templateLabel === undefined || typeof snapshot.templateLabel === 'string')
  );
}
