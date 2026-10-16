import { expect, test } from 'vite-plus/test';
import {
  createEditorDocument,
  replaceEditorDocument,
  commitDocument,
  draftDocument,
  restoreDocument,
  recordDocumentSave,
  documentView,
  documentSnapshot,
  isDocumentSnapshot,
} from '../src/core/editor-document';
import { planElementInsertion } from '../src/core/element-insertion';
import { htmlElements } from '../src/core/html-elements';

const initial = () =>
  createEditorDocument({
    html: 'initial',
    savedHtml: 'initial',
    name: 'page.html',
  });

test('drafts, commits and history are immutable and retain the saved baseline', () => {
  const state = initial();
  const original = JSON.stringify(state);
  const draft = draftDocument(state, 'draft');
  expect(documentSnapshot(draft).html).toBe('draft');
  expect(documentView(draft)).toMatchObject({
    dirty: true,
    canUndo: true,
    canRedo: false,
  });
  expect(draftDocument(draft, 'draft').revision).toBe(draft.revision);
  const committed = commitDocument(draft, 'draft');
  expect(committed.draft).toBeUndefined();
  expect(committed.document.history).toEqual(['initial', 'draft']);
  expect(commitDocument(committed, 'draft').revision).toBe(committed.revision);
  const undone = restoreDocument(committed, -1);
  expect(documentView(undone)).toMatchObject({
    dirty: false,
    canUndo: false,
    canRedo: true,
  });
  expect(restoreDocument(undone, -1)).toBe(undone);
  expect(documentSnapshot(restoreDocument(undone, 1)).html).toBe('draft');
  const branched = commitDocument(undone, 'branch');
  expect(documentView(branched).canRedo).toBe(false);
  expect(JSON.stringify(state)).toBe(original);
});

test('save acknowledgments apply only to the captured document and preserve later drafts', () => {
  const state = initial();
  const edited = commitDocument(state, 'saved');
  const later = draftDocument(edited, 'later');
  const saved = recordDocumentSave(later, 'saved', state.identity);
  expect(documentSnapshot(saved)).toMatchObject({
    html: 'later',
    savedHtml: 'saved',
  });
  expect(documentView(saved).dirty).toBe(true);
  const replaced = replaceEditorDocument(saved, {
    html: 'template',
    savedHtml: '',
    name: 'new.html',
    templateId: 'blank',
    templateLabel: 'Blank',
  });
  expect(replaced.identity).toBe(state.identity + 1);
  expect(replaced.revision).toBe(saved.revision + 1);
  expect(replaced.document.history).toEqual(['template']);
  expect(replaced.draft).toBeUndefined();
  expect(documentView(replaced).dirty).toBe(true);
  expect(recordDocumentSave(replaced, 'saved', state.identity)).toBe(replaced);
  expect(documentSnapshot(createEditorDocument(documentSnapshot(saved)))).toEqual(
    documentSnapshot(saved),
  );
});

test('recovery validation accepts document data and rejects malformed fields without storage', () => {
  const snapshot = documentSnapshot(initial());
  expect(isDocumentSnapshot(snapshot)).toBe(true);
  expect(
    isDocumentSnapshot({
      ...snapshot,
      savedHtml: '',
      templateId: 'blank',
      templateLabel: '',
    }),
  ).toBe(true);
  for (const value of [
    null,
    undefined,
    [],
    'html',
    {},
    { ...snapshot, html: 42 },
    { ...snapshot, savedHtml: null },
    { ...snapshot, name: false },
    { ...snapshot, templateId: 42 },
    { ...snapshot, templateLabel: null },
  ])
    expect(isDocumentSnapshot(value)).toBe(false);
});

test('insertion plans preserve literal text and document structure without DOM globals', () => {
  const text = '<script>한글 & literal</script>';
  for (const [tag] of htmlElements) expect(planElementInsertion(tag, text, false)).toBeDefined();
  expect(planElementInsertion('script', text, false)).toBeUndefined();
  expect(planElementInsertion('main', text, true)).toBeUndefined();
  expect(planElementInsertion('p', text, true)).toMatchObject({
    tag: 'p',
    text,
  });
  expect(planElementInsertion('code', text, false)).toEqual({
    tag: 'pre',
    children: [{ tag: 'code', text }],
  });
  expect(planElementInsertion('nav', text, false)?.children?.[0]).toEqual({
    tag: 'a',
    text,
    attributes: { href: '#' },
  });
  expect(planElementInsertion('ul', text, false)?.children).toEqual([
    { tag: 'li', text },
    { tag: 'li', text },
  ]);
  const table = planElementInsertion('table', text, false)!;
  expect(table.children?.map((child) => child.tag)).toEqual(['thead', 'tbody']);
  expect(table.children?.[0].children?.[0].children).toHaveLength(2);
  expect(table.children?.[0].children?.[0].children?.[0]).toMatchObject({
    tag: 'th',
    text,
    attributes: { scope: 'col' },
  });
  expect(table.children?.[1].children).toHaveLength(2);
});
