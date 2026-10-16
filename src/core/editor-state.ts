export type EditorState = Readonly<{
  history: readonly string[];
  position: number;
  savedHtml: string;
}>;

export const historyBudgetBytes = 32 * 1024 * 1024;

export const currentHtml = (state: EditorState) => state.history[state.position];
export const isDirty = (state: EditorState, draft = currentHtml(state)) =>
  draft !== state.savedHtml;
export const canUndo = (state: EditorState) => state.position > 0;
export const canRedo = (state: EditorState) => state.position < state.history.length - 1;

export function createEditorState(html: string): EditorState {
  return { history: [html], position: 0, savedHtml: html };
}

export function commitSnapshot(state: EditorState, html: string): EditorState {
  if (html === currentHtml(state)) return state;
  const history = [...state.history.slice(0, state.position + 1), html];
  let bytes = html.length * 2;
  let start = history.length - 1;
  // Keep the current document even when it alone exceeds the UTF-16 byte budget.
  while (start > 0 && bytes + history[start - 1].length * 2 <= historyBudgetBytes) {
    bytes += history[--start].length * 2;
  }
  const retained = history.slice(start);
  return {
    ...state,
    history: retained,
    position: retained.length - 1,
  };
}

export function undo(state: EditorState): EditorState {
  return canUndo(state) ? { ...state, position: state.position - 1 } : state;
}

export function redo(state: EditorState): EditorState {
  return canRedo(state) ? { ...state, position: state.position + 1 } : state;
}

export function markSaved(state: EditorState, savedHtml: string): EditorState {
  return { ...state, savedHtml };
}
