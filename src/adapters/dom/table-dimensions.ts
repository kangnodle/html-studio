import { calculateTableColumns, clampTableSize } from '../../core/table-layout';

export function tableCell(element?: HTMLElement) {
  return element?.closest('td, th') as HTMLTableCellElement | null;
}

// Map logical columns rather than cellIndex, which ignores merged cells.
export function tableColumns(cell: HTMLTableCellElement) {
  const table = cell.closest('table')!;
  const rows = Array.from(table.rows);
  const groups = Array.from(new Set(rows.map((row) => row.parentElement)));
  const descriptors = rows.map((row) => ({
    group: groups.indexOf(row.parentElement),
    cells: Array.from(row.cells, (current) => ({
      rowSpan: current.rowSpan,
      colSpan: current.colSpan,
      width: current.getBoundingClientRect().width,
    })),
  }));
  const layout = calculateTableColumns(descriptors, {
    row: rows.indexOf(cell.parentElement as HTMLTableRowElement),
    cell: cell.cellIndex,
  });
  return { table, ...layout };
}

export function resizeColumn(cell: HTMLTableCellElement, width: number) {
  createColumnResize(cell).resize(width);
}

export function createColumnResize(cell: HTMLTableCellElement) {
  const { table, index, widths } = tableColumns(cell);
  let columns: HTMLTableColElement[] | undefined;
  let totalWidth = widths.reduce((sum, value) => sum + clampTableSize(value), 0);
  return {
    width: widths[index],
    resize(width: number) {
      if (!columns) {
        // Expand span declarations while retaining existing column attributes.
        const groups = Array.from(table.children).filter(
          (e) => e.tagName === 'COLGROUP',
        ) as HTMLTableColElement[];
        columns = [];
        for (const group of groups) {
          if (!group.children.length) {
            for (let i = 0; i < Math.max(1, Number(group.getAttribute('span')) || 1); i++)
              group.appendChild(table.ownerDocument.createElement('col'));
            group.removeAttribute('span');
          }
          for (const column of Array.from(group.children) as HTMLTableColElement[]) {
            const span = Math.max(1, Number(column.getAttribute('span')) || 1);
            column.removeAttribute('span');
            columns.push(column);
            let previous = column;
            for (let i = 1; i < span; i++) {
              const copy = column.cloneNode(true) as HTMLTableColElement;
              copy.removeAttribute('id');
              previous.after(copy);
              previous = copy;
              columns.push(copy);
            }
          }
        }
        let group = groups.at(-1);
        if (!group) {
          group = table.ownerDocument.createElement('colgroup');
          const anchor = Array.from(table.children).find((e) => e.tagName !== 'CAPTION');
          table.insertBefore(group, anchor || null);
        }
        while (columns.length < widths.length) {
          const column = table.ownerDocument.createElement('col');
          group.appendChild(column);
          columns.push(column);
        }
        for (const [x, value] of widths.entries()) {
          columns[x].style.width = `${clampTableSize(value)}px`;
        }
        table.style.tableLayout = 'fixed';
      }
      const next = clampTableSize(width);
      totalWidth += next - clampTableSize(widths[index]);
      widths[index] = next;
      columns[index].style.width = `${next}px`;
      table.style.width = `${totalWidth}px`;
    },
  };
}

export function resizeRow(cell: HTMLTableCellElement, height: number) {
  const row = cell.parentElement as HTMLTableRowElement;
  row.style.height = `${clampTableSize(height)}px`;
  for (const current of Array.from(row.cells)) {
    if (current.rowSpan === 1) {
      current.style.boxSizing = 'border-box';
      current.style.height = row.style.height;
    }
  }
}
