import { afterAll, expect, test } from 'vite-plus/test';
import { Window } from 'happy-dom';
import {
  tableColumns,
  createColumnResize,
  resizeColumn,
  resizeRow,
} from '../src/adapters/dom/table-dimensions';

const window = new Window();
afterAll(() => window.happyDOM.abort());
function setup(html: string) {
  const doc = new window.DOMParser().parseFromString(html, 'text/html');
  for (const cell of Array.from(doc.querySelectorAll('td, th'))) {
    Object.defineProperty(cell, 'getBoundingClientRect', {
      value: () => ({ width: 100 * Number(cell.getAttribute('colspan') || 1) }),
    });
  }
  return doc as unknown as Document;
}

test('column resize maps rowspan and colspan and leaves cell contents and neighboring widths intact', () => {
  const doc = setup(
    '<table><thead><tr><th>A</th><th>B</th><th>C</th></tr></thead><tbody><tr><td rowspan="2">X</td><td colspan="2"><b>Y</b></td></tr><tr><td>M</td><td>N</td></tr></tbody></table>',
  );
  const cell = doc.querySelectorAll('td')[1]!;
  expect(tableColumns(cell).index).toBe(2);
  resizeColumn(cell, 180);
  expect(Array.from(doc.querySelectorAll('col')).map((c) => c.style.width)).toEqual([
    '100px',
    '100px',
    '180px',
  ]);
  expect(doc.querySelector('table')!.style.width).toBe('380px');
  expect(doc.querySelector('table')!.style.tableLayout).toBe('fixed');
  expect(doc.querySelector('b')!.textContent).toBe('Y');
  expect(cell.colSpan).toBe(2);
  expect(doc.querySelector('td')!.rowSpan).toBe(2);
  expect(tableColumns(doc.querySelectorAll('td')[2]!).index).toBe(1);
});

test('row resize changes only the selected row and preserves spanning cells', () => {
  const doc = setup('<table><tr><td rowspan="2">X</td><td>A</td></tr><tr><td>B</td></tr></table>');
  const cell = doc.querySelectorAll('td')[1]!;
  resizeRow(cell, 90);
  expect(cell.style.height).toBe('90px');
  expect(cell.parentElement!.style.height).toBe('90px');
  expect(doc.querySelector('td')!.style.height).toBe('');
  expect(doc.querySelectorAll('tr')[1]!.style.height).toBe('');
});

test('existing column attributes survive expanded span declarations and minimum widths', () => {
  const doc = setup(
    '<table><colgroup><col span="2" class="existing"></colgroup><tr><td>A</td><td>B</td></tr></table>',
  );
  resizeColumn(doc.querySelector('td')!, 1);
  expect(doc.querySelectorAll('col.existing')).toHaveLength(2);
  expect(doc.querySelector('col')!.style.width).toBe('24px');
  expect(doc.querySelectorAll('col')[1]!.style.width).toBe('100px');
});

test('column drag measures a large merged table once and reuses its column nodes', () => {
  const doc = new window.DOMParser().parseFromString(
    '<table><colgroup><col span="2" class="existing"></colgroup>' +
      '<tr><td colspan="2">Merged</td></tr>' +
      '<tr><td>A</td><td>B</td></tr>'.repeat(1000) +
      '</table>',
    'text/html',
  );
  let reads = 0;
  for (const cell of doc.querySelectorAll('td')) {
    cell.getBoundingClientRect = () => {
      reads++;
      return new window.DOMRect(0, 0, 100 * cell.colSpan, 40);
    };
  }
  const drag = createColumnResize(doc.querySelector('td')! as unknown as HTMLTableCellElement);
  expect(reads).toBe(2001);
  expect(doc.querySelector('col')!.getAttribute('span')).toBe('2');
  drag.resize(180);
  const columns = [...doc.querySelectorAll('col')];
  for (const width of [200, 1, 240]) drag.resize(width);
  expect(reads).toBe(2001);
  expect([...doc.querySelectorAll('col')]).toEqual(columns);
  expect(columns.map((column) => column.style.width)).toEqual(['100px', '240px']);
  expect(doc.querySelector('table')!.style.width).toBe('340px');
  expect(doc.querySelectorAll('col.existing')).toHaveLength(2);
});
