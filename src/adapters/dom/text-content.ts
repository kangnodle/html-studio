import { replaceTextSegments } from '../../core/text-edit';

// Keep embedded controls, icons, and executable content out of text editing.
export function textNodes(element: HTMLElement): Text[] {
  const nodes: Text[] = [];
  const walker = element.ownerDocument.createTreeWalker(element, 4);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (
      !node.parentElement?.closest(
        'script, style, svg, math, input, textarea, select, [aria-hidden="true"]',
      )
    )
      nodes.push(node as Text);
  }
  return nodes;
}

// Ignore HTML indentation, but keep whitespace in an otherwise empty text element.
export function inspectorTextNodes(element: HTMLElement): Text[] {
  return textNodes(element).filter(
    (node) => node.data.trim() || node.parentElement?.children.length === 0,
  );
}

// Apply a textual diff without replacing syntax spans or their attributes.
export function replaceCodeText(element: HTMLElement, value: string) {
  const nodes = textNodes(element);
  const segments = nodes.map((node) => node.data);
  const next = replaceTextSegments(segments, value);
  if (next === segments) return;
  if (!nodes.length) {
    element.appendChild(element.ownerDocument.createTextNode(value));
    return;
  }
  nodes.forEach((node, index) => {
    if (node.data !== next[index]) node.data = next[index];
  });
}
