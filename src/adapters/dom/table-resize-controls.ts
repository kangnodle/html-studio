import { tableCell, createColumnResize, resizeRow } from './table-dimensions';

type Hooks = {
  context(): { document?: Document; selected?: HTMLElement; enabled: boolean };
  finishEditing(): void;
  draft(): void;
  commit(): string;
  updateBounds(): void;
  inspect(): void;
};

export function createTableResizeControls(hooks: Hooks) {
  let tableHandles: HTMLButtonElement[] = [];
  let pendingSize: number | undefined;
  let resizing:
    | {
        axis: 'column' | 'row';
        resize(size: number): void;
        start: number;
        size: number;
        pointer: number;
      }
    | undefined;
  function measure() {
    const { document: doc, selected, enabled } = hooks.context();
    const cell = tableCell(selected);
    if (!doc || !cell || !enabled) return;
    return {
      cell: cell.getBoundingClientRect(),
      row: cell.parentElement!.getBoundingClientRect(),
    };
  }
  function update(bounds = measure()) {
    const { document: doc, selected, enabled } = hooks.context();
    const cell = tableCell(selected);
    if (!doc || !cell || !enabled || !bounds) {
      dispose();
      return;
    }
    if (!tableHandles.length) {
      tableHandles = ['column', 'row'].map((axis) => {
        const handle = doc!.createElement('button');
        handle.type = 'button';
        handle.dataset.studioInternal = 'true';
        handle.dataset.tableResize = axis;
        handle.setAttribute('aria-label', axis === 'column' ? '열 너비 조절' : '행 높이 조절');
        handle.title =
          axis === 'column' ? '좌우로 드래그해 열 너비 조절' : '위아래로 드래그해 행 높이 조절';
        Object.assign(handle.style, {
          position: 'fixed',
          zIndex: '2147483646',
          padding: '0',
          margin: '0',
          border: '0',
          background: '#34765c',
          opacity: '0.85',
          touchAction: 'none',
        });
        doc!.body.appendChild(handle);
        return handle;
      });
    }
    const { cell: r, row } = bounds;
    Object.assign(tableHandles[0].style, {
      left: `${r.right - 4}px`,
      top: `${r.top}px`,
      width: '8px',
      height: `${r.height}px`,
      cursor: 'col-resize',
    });
    Object.assign(tableHandles[1].style, {
      left: `${r.left}px`,
      top: `${row.bottom - 4}px`,
      width: `${r.width - 8}px`,
      height: '8px',
      cursor: 'row-resize',
    });
  }
  function pointerDown(event: Event) {
    const { selected, enabled } = hooks.context();
    const pointer = event as PointerEvent;
    const handle = event.target as HTMLButtonElement;
    const cell = tableCell(selected);
    if (!cell || !enabled || !tableHandles.includes(handle) || pointer.button !== 0) return;
    event.preventDefault();
    hooks.finishEditing();
    const axis = handle.dataset.tableResize as 'column' | 'row';
    const column = axis === 'column' ? createColumnResize(cell) : undefined;
    resizing = {
      axis,
      resize: column ? column.resize : (size) => resizeRow(cell, size),
      start: axis === 'column' ? pointer.clientX : pointer.clientY,
      size: axis === 'column' ? column!.width : cell.parentElement!.getBoundingClientRect().height,
      pointer: pointer.pointerId,
    };
    handle.setPointerCapture(pointer.pointerId);
  }
  function pointerMove(event: Event) {
    const pointer = event as PointerEvent;
    if (!resizing || resizing.pointer !== pointer.pointerId) return;
    pendingSize =
      resizing.size +
      (resizing.axis === 'column' ? pointer.clientX : pointer.clientY) -
      resizing.start;
    hooks.draft();
    hooks.updateBounds();
  }
  function flush() {
    if (!resizing || pendingSize === undefined) return;
    const size = pendingSize;
    pendingSize = undefined;
    resizing.resize(size);
  }
  function finishResize(event?: Event) {
    if (!resizing || (event && resizing.pointer !== (event as PointerEvent).pointerId)) return;
    flush();
    resizing = undefined;
    const html = hooks.commit();
    hooks.inspect();
    return html;
  }
  function dispose() {
    pendingSize = undefined;
    resizing = undefined;
    tableHandles.forEach((handle) => handle.remove());
    tableHandles = [];
  }
  return {
    update,
    measure,
    pointerDown,
    pointerMove,
    finishResize,
    flush,
    dispose,
    contains: (target: HTMLElement) => tableHandles.includes(target as HTMLButtonElement),
  };
}
