export function parseDocument(html: string) {
  return new DOMParser().parseFromString(html, 'text/html');
}
export function serialize(
  doc: Document,
  temporaryEditable?: { element: HTMLElement; originalValue: string | null },
) {
  const copy = doc.documentElement.cloneNode(true) as HTMLElement;
  if (temporaryEditable) {
    const originals = [doc.documentElement, ...doc.documentElement.querySelectorAll('*')];
    const clones = [copy, ...copy.querySelectorAll('*')];
    const element = clones[originals.indexOf(temporaryEditable.element)];
    if (element) {
      if (temporaryEditable.originalValue === null) element.removeAttribute('contenteditable');
      else element.setAttribute('contenteditable', temporaryEditable.originalValue);
    }
  }
  copy.querySelectorAll('[data-studio-internal]').forEach((e) => e.remove());
  copy.querySelectorAll('meta').forEach((meta) => {
    if (meta.hasAttribute('charset') || meta.httpEquiv.toLowerCase() === 'content-type')
      meta.remove();
  });
  const charset = doc.createElement('meta');
  charset.setAttribute('charset', 'utf-8');
  copy.querySelector('head')!.prepend(charset);
  return `${doc.doctype ? new XMLSerializer().serializeToString(doc.doctype) + '\n' : ''}${copy.outerHTML}`;
}
export function previewSource(html: string) {
  const doc = parseDocument(html);
  const policy = doc.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content =
    "script-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
  policy.dataset.studioInternal = 'true';
  doc.head.prepend(policy);
  return serializeWithPolicy(doc);
}
function serializeWithPolicy(doc: Document) {
  return `${doc.doctype ? new XMLSerializer().serializeToString(doc.doctype) + '\n' : ''}${doc.documentElement.outerHTML}`;
}

export const htmlCodec = {
  normalize: (html: string) => serialize(parseDocument(html)),
};
