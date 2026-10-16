import { expect, test } from 'vite-plus/test';
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
  historyBudgetBytes,
} from '../src/core/editor-state';
import { textEditingRule } from '../src/core/editing-rules';

test('history ignores duplicate snapshots and does not mutate previous state', () => {
  const initial = createEditorState('a');
  expect(commitSnapshot(initial, 'a')).toBe(initial);
  const changed = commitSnapshot(initial, 'b');
  expect(initial.history).toEqual(['a']);
  expect(changed.history).toEqual(['a', 'b']);
  expect(canUndo(changed)).toBe(true);
  expect(canRedo(changed)).toBe(false);
});

test('editing after undo replaces the redo branch', () => {
  const state = commitSnapshot(commitSnapshot(createEditorState('a'), 'b'), 'c');
  const back = undo(state);
  expect(currentHtml(back)).toBe('b');
  expect(currentHtml(redo(back))).toBe('c');
  const branched = commitSnapshot(back, 'd');
  expect(branched.history).toEqual(['a', 'b', 'd']);
  expect(redo(branched)).toBe(branched);
  const initial = createEditorState('a');
  expect(undo(initial)).toBe(initial);
});

test('dirty compares content with the saved snapshot, including undo and branching', () => {
  const saved = markSaved(commitSnapshot(createEditorState('a'), 'b'), 'b');
  expect(isDirty(saved)).toBe(false);
  expect(isDirty(undo(saved))).toBe(true);
  expect(isDirty(redo(undo(saved)))).toBe(false);
  expect(isDirty(markSaved(commitSnapshot(saved, 'c'), 'b'))).toBe(true);
  expect(isDirty(commitSnapshot(undo(saved), 'b'))).toBe(false);
});

test('text editing policy depends only on element metadata', () => {
  expect(textEditingRule('IMG', [])).toBe('blocked');
  expect(textEditingRule('P', ['SPAN', 'BR', 'A'])).toBe('editable');
  expect(textEditingRule('DIV', ['P'])).toBe('select-child');
});

test('history trims old snapshots while preserving undo, redo, branching and the saved baseline', () => {
  const content = 'x'.repeat(historyBudgetBytes / 8 - 1);
  const initial = createEditorState(content + '0');
  let state = initial;
  for (let i = 1; i <= 6; i++) state = commitSnapshot(state, content + i);
  expect(state.history).toEqual([3, 4, 5, 6].map((i) => content + i));
  expect(state.position).toBe(3);
  expect(state.savedHtml).toBe(initial.savedHtml);
  expect(initial.history).toEqual([content + '0']);
  expect(isDirty(state)).toBe(true);
  const back = undo(state);
  expect(currentHtml(back)).toBe(content + '5');
  expect(currentHtml(redo(back))).toBe(content + '6');
  const branched = commitSnapshot(back, content + '7');
  expect(currentHtml(branched)).toBe(content + '7');
  expect(canRedo(branched)).toBe(false);
  expect(isDirty(markSaved(branched, content + '7'))).toBe(false);
  expect(commitSnapshot(branched, content + '7')).toBe(branched);
});

test('a document larger than the history budget remains editable and saved state remains accurate', () => {
  const html = '🙂'.repeat(historyBudgetBytes / 4 + 1);
  const initial = createEditorState('saved');
  const state = commitSnapshot(initial, html);
  expect(state.history).toEqual([html]);
  expect(state.position).toBe(0);
  expect(canUndo(state)).toBe(false);
  expect(currentHtml(state)).toBe(html);
  expect(state.savedHtml).toBe('saved');
  expect(isDirty(state)).toBe(true);
  const smaller = commitSnapshot(state, 'small');
  expect(smaller.history).toEqual(['small']);
  expect(isDirty(markSaved(smaller, 'small'))).toBe(false);
});
