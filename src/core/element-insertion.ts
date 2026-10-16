import { htmlElements, type HtmlElementTag } from './html-elements';

export const isHtmlElementTag = (tag: string): tag is HtmlElementTag =>
  htmlElements.some(([value]) => value === tag);

export type ElementBlueprint = Readonly<{
  tag: string;
  text?: string;
  attributes?: Readonly<Record<string, string>>;
  styles?: Readonly<Record<string, string>>;
  children?: readonly ElementBlueprint[];
}>;

// Describes document content without creating nodes or interpreting text as HTML.
export function planElementInsertion(
  tag: string,
  text: string,
  hasMain: boolean,
): ElementBlueprint | undefined {
  if (!isHtmlElementTag(tag) || (tag === 'main' && hasMain)) return;
  if (tag === 'table') {
    const row = (heading: boolean): ElementBlueprint => ({
      tag: 'tr',
      children: Array.from({ length: 2 }, () => ({
        tag: heading ? 'th' : 'td',
        text,
        attributes: heading ? { scope: 'col' } : undefined,
        styles: { border: '1px solid #888', padding: '8px' },
      })),
    });
    return {
      tag,
      styles: { 'border-collapse': 'collapse', width: '100%' },
      children: [
        { tag: 'thead', children: [row(true)] },
        { tag: 'tbody', children: [row(false), row(false)] },
      ],
    };
  }
  if (tag === 'code') return { tag: 'pre', children: [{ tag, text }] };
  if (tag === 'ul' || tag === 'ol')
    return {
      tag,
      children: [
        { tag: 'li', text },
        { tag: 'li', text },
      ],
    };
  if (tag === 'nav') return { tag, children: [{ tag: 'a', text, attributes: { href: '#' } }] };
  if (['main', 'section', 'article', 'div'].includes(tag))
    return { tag, children: [{ tag: 'p', text }] };
  return { tag, text, attributes: tag === 'a' ? { href: '#' } : undefined };
}
