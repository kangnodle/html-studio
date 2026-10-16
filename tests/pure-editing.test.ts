import { expect, test } from 'vite-plus/test';
import { replaceTextSegments } from '../src/core/text-edit';
import { calculateTableColumns, parseTableSize, clampTableSize } from '../src/core/table-layout';
import { createEditorState, isDirty, markSaved } from '../src/core/editor-state';

test('code replacements retain unchanged tokens, whitespace, and literal markup', () => {
  const segments = ['const', ' x = ', '1', ';\n'];
  const original = [...segments];
  for (const value of ['const x = 2;\n', 'const x = "<b>";\n']) {
    const result = replaceTextSegments(segments, value);
    expect(result.join('')).toBe(value);
    expect(result[0]).toBe('const');
    expect(result.at(-1)).toBe(';\n');
  }
  expect(segments).toEqual(original);
  expect(replaceTextSegments(segments, segments.join(''))).toBe(segments);
  expect(replaceTextSegments([], '한글\n')).toEqual(['한글\n']);
});

test('text edits reconstruct the requested value across segment boundaries and Unicode', () => {
  const sources = ['', 'abc', '한글🙂', 'a\nb', '<span>'];
  const targets = ['', 'x', '한🙂글', '\n  next();\n', '<b>literal</b>'];
  for (const source of sources) {
    for (let first = 0; first <= source.length; first++) {
      for (let second = first; second <= source.length; second++) {
        const segments = [
          source.slice(0, first),
          source.slice(first, second),
          source.slice(second),
        ];
        for (const value of targets) {
          const result = replaceTextSegments(segments, value);
          expect(result.join('')).toBe(value);
          expect(result.length).toBe(segments.length);
          expect(segments.join('')).toBe(source);
        }
      }
    }
  }
});

test('table layout isolates rowspan=0 to its row group and maps merged columns', () => {
  const rows = [
    {
      group: 0,
      cells: [
        { rowSpan: 0, colSpan: 1, width: 80 },
        { rowSpan: 1, colSpan: 2, width: 200 },
      ],
    },
    {
      group: 0,
      cells: [
        { rowSpan: 1, colSpan: 1, width: 90 },
        { rowSpan: 1, colSpan: 1, width: 110 },
      ],
    },
    {
      group: 1,
      cells: [
        { rowSpan: 1, colSpan: 1, width: 70 },
        { rowSpan: 1, colSpan: 2, width: 220 },
      ],
    },
  ];
  const original = JSON.stringify(rows);
  expect(calculateTableColumns(rows, { row: 0, cell: 1 })).toEqual({
    index: 2,
    widths: [70, 90, 110],
  });
  expect(calculateTableColumns(rows, { row: 1, cell: 0 }).index).toBe(1);
  expect(calculateTableColumns(rows, { row: 2, cell: 0 }).index).toBe(0);
  expect(JSON.stringify(rows)).toBe(original);
});

test('dimension validation rejects invalid and undersized values without DOM APIs', () => {
  expect(parseTableSize(' 120px ')).toBe(120);
  expect(parseTableSize('24PX')).toBe(24);
  expect(parseTableSize('80.5')).toBe(80.5);
  for (const value of ['', ' ', '-10px', '20px', 'auto', 'Infinity', 'NaN']) {
    expect(parseTableSize(value)).toBeUndefined();
  }
  expect(clampTableSize(-10)).toBe(24);
  expect(clampTableSize(180)).toBe(180);
});

test('large tables read row groups a linear number of times and keep rowspan groups isolated', () => {
  let groupReads = 0;
  const count = 2000;
  const rows = Array.from({ length: count }, (_, index) => ({
    get group() {
      groupReads++;
      return index < count / 2 ? 0 : 1;
    },
    cells:
      index === 0
        ? [
            { rowSpan: 0, colSpan: 1, width: 80 },
            { rowSpan: 1, colSpan: 1, width: 100 },
          ]
        : [{ rowSpan: 1, colSpan: 1, width: 100 }],
  }));
  expect(calculateTableColumns(rows, { row: count / 2 - 1, cell: 0 }).index).toBe(1);
  expect(groupReads).toBeLessThan(count * 10);
  expect(calculateTableColumns(rows, { row: count / 2, cell: 0 }).index).toBe(0);
});

test('draft dirty detection uses the same saved baseline as committed history', () => {
  const state = createEditorState('saved');
  expect(isDirty(state)).toBe(false);
  expect(isDirty(state, 'typing')).toBe(true);
  expect(isDirty(state, 'saved')).toBe(false);
  expect(isDirty(markSaved(state, 'typing'), 'typing')).toBe(false);
});
