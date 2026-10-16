import type { Selection } from '../../application/ports';
import { inspectorTextNodes, textNodes } from './text-content';
import { tableCell, tableColumns } from './table-dimensions';

export function codeTarget(element: HTMLElement) {
  const pre = element.closest('pre');
  return (pre?.querySelector('code') || pre || element.closest('code')) as HTMLElement | null;
}
export function textValues(
  element: HTMLElement,
  nodes = inspectorTextNodes(element),
): Record<string, string> {
  if (
    element.closest('script, style, svg, math') ||
    /^(HTML|BODY|TABLE|THEAD|TBODY|TFOOT|TR|INPUT|TEXTAREA|SELECT)$/.test(element.tagName)
  )
    return {};
  if (/^(PRE|CODE)$/.test(element.tagName))
    return {
      'code-text': textNodes(element)
        .map((node) => node.data)
        .join(''),
      'editor-kind': 'code',
    };
  return {
    'text-count': String(nodes.length),
    ...Object.fromEntries(nodes.map((node, index) => [`text-node-${index}`, node.data])),
  };
}

export function inspectElement(
  doc: Document | undefined,
  selected: HTMLElement | undefined,
  preview: boolean,
  nodes?: Text[],
): Selection {
  if (!doc || !selected?.isConnected) {
    return { tag: '', values: {} };
  }
  const s = doc.defaultView!.getComputedStyle(selected);
  const r = selected.getBoundingClientRect();
  const cell = tableCell(selected);
  const columns = cell ? tableColumns(cell) : undefined;
  return {
    tag: selected.tagName.toLowerCase(),
    values: {
      ...textValues(selected, nodes),
      ...(cell && columns
        ? {
            'table-column-width': `${Math.round(columns.widths[columns.index])}px`,
            'table-row-height': `${Math.round(cell.parentElement!.getBoundingClientRect().height)}px`,
            'table-cell': 'true',
          }
        : {}),
      'can-select-parent':
        selected.parentElement && selected.parentElement !== doc.body ? 'true' : '',
      'can-delete': !preview && selected !== doc.body && doc.body.contains(selected) ? 'true' : '',
      color: s.color,
      'background-color': s.backgroundColor,
      'font-size': s.fontSize,
      'font-family': s.fontFamily,
      padding: s.padding,
      margin: s.margin,
      'border-radius': s.borderRadius,
      border: s.border,
      width: selected.style.width,
      href: selected.getAttribute('href') || '',
      src: selected.getAttribute('src') || '',
      alt: selected.getAttribute('alt') || '',
    },
    bounds: preview ? undefined : { x: r.x, y: r.y, w: r.width, h: r.height },
  };
}
