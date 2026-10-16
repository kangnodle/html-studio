export type TableCell = Readonly<{
  rowSpan: number;
  colSpan: number;
  width: number;
}>;
export type TableRow = Readonly<{ group: number; cells: readonly TableCell[] }>;

export const minimumTableSize = 24;
export const clampTableSize = (size: number) => Math.max(minimumTableSize, size);

export function parseTableSize(value: string): number | undefined {
  if (!value.trim()) return;
  const size = Number(value.trim().replace(/px$/i, ''));
  return Number.isFinite(size) && size >= minimumTableSize ? size : undefined;
}

// Logical columns account for merged cells and rowSpan=0 within a row group.
export function calculateTableColumns(
  rows: readonly TableRow[],
  target: { row: number; cell: number },
) {
  const grid: TableCell[][] = [];
  const remainingByGroup = new Map<number, number>();
  for (const row of rows)
    remainingByGroup.set(row.group, (remainingByGroup.get(row.group) ?? 0) + 1);
  let index = 0,
    count = 0;
  rows.forEach((row, y) => {
    const remaining = remainingByGroup.get(row.group)!;
    remainingByGroup.set(row.group, remaining - 1);
    const slots = (grid[y] ??= []);
    let x = 0;
    row.cells.forEach((cell, cellIndex) => {
      while (slots[x]) x++;
      const height = Math.min(cell.rowSpan || remaining, remaining);
      for (let dy = 0; dy < height; dy++) {
        const destination = (grid[y + dy] ??= []);
        for (let dx = 0; dx < cell.colSpan; dx++) destination[x + dx] = cell;
      }
      if (y === target.row && cellIndex === target.cell) index = x + cell.colSpan - 1;
      x += cell.colSpan;
      count = Math.max(count, x, slots.length);
    });
  });
  const widths = Array.from({ length: count }, () => 0);
  for (const row of grid) {
    row.forEach((cell, x) => {
      if (!widths[x] || cell.colSpan === 1) widths[x] = cell.width / cell.colSpan;
    });
  }
  return { index, widths };
}
