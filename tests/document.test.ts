import { afterAll, describe, expect, test } from 'vite-plus/test';
import { Window } from 'happy-dom';
import { readFileSync } from 'node:fs';
import { htmlCodec, parseDocument, previewSource, serialize } from '../src/adapters/dom/html-codec';

const window = new Window();
const previousParser = Object.getOwnPropertyDescriptor(globalThis, 'DOMParser');
const previousSerializer = Object.getOwnPropertyDescriptor(globalThis, 'XMLSerializer');
Object.defineProperties(globalThis, {
  DOMParser: { configurable: true, value: window.DOMParser },
  XMLSerializer: { configurable: true, value: window.XMLSerializer },
});
afterAll(() => {
  for (const [key, descriptor] of [
    ['DOMParser', previousParser],
    ['XMLSerializer', previousSerializer],
  ] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  return window.happyDOM.abort();
});

describe('HTML document import and export', () => {
  test('exports one UTF-8 declaration for missing, legacy and conflicting charsets', () => {
    for (const head of [
      '',
      '<meta charset="windows-1252">',
      '<meta http-equiv="Content-Type" content="text/html; charset=shift_jis">',
      '<meta charset="windows-1252"><meta charset="utf-8"><meta http-equiv="CONTENT-TYPE" content="text/html; charset=euc-kr">',
    ]) {
      const doc = parseDocument(`<html><head>${head}</head><body><p>한글 🙂</p></body></html>`);
      const original = doc.documentElement.outerHTML;
      const exported = serialize(doc);
      const reopened = parseDocument(exported);
      expect(reopened.head.firstElementChild?.outerHTML).toBe('<meta charset="utf-8">');
      expect(reopened.querySelectorAll('meta').length).toBe(1);
      expect(reopened.body.textContent).toBe('한글 🙂');
      expect(serialize(reopened)).toBe(exported);
      expect(doc.documentElement.outerHTML).toBe(original);
    }
  });
  test('built-in documents are self-contained and survive preview/export round trips', () => {
    for (const name of ['blank', 'manual', 'research', 'slides']) {
      const html = readFileSync(new URL(`../src/templates/${name}.html`, import.meta.url), 'utf8');
      const normalized = htmlCodec.normalize(html);
      const reopened = parseDocument(serialize(parseDocument(previewSource(normalized))));
      expect(reopened.doctype?.name).toBe('html');
      expect(reopened.querySelector('meta[charset]')?.getAttribute('charset')).toBe('utf-8');
      expect(
        reopened.querySelectorAll('script, link[rel="stylesheet"], img[src^="http"]').length,
      ).toBe(0);
      expect(serialize(reopened)).toBe(normalized);
      if (name === 'blank') expect(reopened.body.children.length).toBe(0);
      if (name === 'manual') {
        for (const link of reopened.querySelectorAll('nav a'))
          expect(reopened.querySelector(link.getAttribute('href')!)).not.toBeNull();
      }
      if (name === 'slides') expect(reopened.querySelectorAll('.slide').length).toBe(4);
    }
  });
  test('preview round trips preserve the normalized snapshot with or without a doctype', () => {
    for (const html of [
      '<html><body>No doctype</body></html>',
      '<!doctype html><html><body>HTML5</body></html>',
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd"><html><body>Custom doctype</body></html>',
    ]) {
      const normalized = htmlCodec.normalize(html);
      expect(serialize(parseDocument(previewSource(normalized)))).toBe(normalized);
    }
  });
  test('exports edited content, styles and original scripts without editor policy', () => {
    const original =
      '<!doctype html><html><head><style>h1{color:red}</style><script>original()</script></head><body><h1>Hello</h1></body></html>';
    const document = parseDocument(previewSource(original));
    document.querySelector('h1')!.textContent = 'Edited';
    const exported = serialize(document);
    expect(exported.toLowerCase()).toMatch(/^<!doctype html>/);
    expect(exported).toContain('<h1>Edited</h1>');
    expect(exported).toContain('<style>h1{color:red}</style>');
    expect(exported).toContain('<script>original()</script>');
    expect(exported).not.toContain('data-studio-internal');
    expect(exported).not.toContain('Content-Security-Policy');
    expect(parseDocument(exported).querySelector('h1')!.textContent).toBe('Edited');
  });

  test('places a script-blocking policy before imported head content', () => {
    const document = parseDocument(
      previewSource('<html><head><script>original()</script></head><body>Page</body></html>'),
    );
    const policy = document.head.firstElementChild!;
    expect(policy.tagName).toBe('META');
    expect(policy.getAttribute('http-equiv')).toBe('Content-Security-Policy');
    expect(policy.getAttribute('content')).toContain("script-src 'none'");
    expect(policy.getAttribute('content')).toContain("form-action 'none'");
  });

  test('preserves image and link changes across export and reopening', () => {
    const document = parseDocument(
      '<html><body><img src="old.png"><a href="/old">Link</a></body></html>',
    );
    document.querySelector('img')!.setAttribute('src', 'data:image/png;base64,AAAA');
    document.querySelector('a')!.setAttribute('href', 'https://example.com/new');
    const reopened = parseDocument(serialize(document));
    expect(reopened.querySelector('img')!.getAttribute('src')).toBe('data:image/png;base64,AAAA');
    expect(reopened.querySelector('a')!.getAttribute('href')).toBe('https://example.com/new');
  });
});
