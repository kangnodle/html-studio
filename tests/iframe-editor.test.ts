import { afterAll, expect, test } from 'vite-plus/test';
import { Window } from 'happy-dom';
import { createIframeEditor } from '../src/adapters/dom/iframe-editor';
import { htmlCodec } from '../src/adapters/dom/html-codec';
import type { Selection } from '../src/application/ports';
import { createEditorController } from '../src/application/editor-controller';
import { currentHtml } from '../src/core/editor-state';
import { htmlElements } from '../src/core/html-elements';

const window = new Window();
const descriptors = new Map(
  ['DOMParser', 'XMLSerializer'].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
  ]),
);
Object.defineProperties(globalThis, {
  DOMParser: { configurable: true, value: window.DOMParser },
  XMLSerializer: { configurable: true, value: window.XMLSerializer },
});
afterAll(() => {
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  return window.happyDOM.abort();
});

function setup(
  html = '<html><body><p contenteditable="false">Hello</p><img src="old.png"></body></html>',
  events: { commit?(html: string): void; draft?(html: string): void } = {},
) {
  const document = new window.DOMParser().parseFromString(html, 'text/html');
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  Object.defineProperties(document.defaultView, {
    requestAnimationFrame: {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        frames.set(++frameId, callback);
        return frameId;
      },
    },
    cancelAnimationFrame: {
      configurable: true,
      value: (id: number) => frames.delete(id),
    },
  });
  function tick() {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(0));
  }
  let commits = 0,
    keyboards = 0,
    inspections = 0,
    drafts = 0,
    boundsUpdates = 0;
  let committedHtml = '';
  let draft = '',
    selection: Selection = { tag: '', values: {} };
  const surface = createIframeEditor({
    commit: (html) => {
      commits++;
      committedHtml = html;
      events.commit?.(html);
    },
    draft: (html) => {
      drafts++;
      draft = html;
      events.draft?.(html);
    },
    selection: (value) => {
      inspections++;
      selection = value;
    },
    bounds: (bounds) => {
      boundsUpdates++;
      selection = { ...selection, bounds };
    },
    status() {},
    keyboard: () => {
      keyboards++;
    },
  });
  let disconnects = 0;
  Object.defineProperty(document.defaultView, 'ResizeObserver', {
    configurable: true,
    value: class {
      observe() {}
      disconnect() {
        disconnects++;
      }
    },
  });
  const frame = {
    contentDocument: document,
    srcdoc: '',
  } as unknown as HTMLIFrameElement;
  const initialHtml = htmlCodec.normalize(document.documentElement.outerHTML);
  surface.attach(frame, initialHtml);
  surface.ready();
  const fire = (element: Pick<typeof document.body, 'dispatchEvent'>, type: string) =>
    element.dispatchEvent(new window.Event(type, { bubbles: true }));
  return {
    surface,
    document,
    frame,
    fire,
    tick,
    counts: () => ({
      commits,
      keyboards,
      disconnects,
      inspections,
      drafts,
      boundsUpdates,
    }),
    committedHtml: () => committedHtml,
    draft: () => draft,
    selection: () => selection,
  };
}

test('blank documents accept text without HTML injection and reject insertion during preview', () => {
  const app = setup('<!doctype html><html><body></body></html>');
  expect(app.surface.insertParagraph('<strong>새 내용</strong>')).toBe(true);
  expect(app.document.body.children.length).toBe(1);
  expect(app.document.querySelector('p')!.textContent).toBe('<strong>새 내용</strong>');
  expect(app.document.querySelector('strong')).toBeNull();
  expect(app.selection().tag).toBe('p');
  expect(app.surface.snapshot()).not.toContain('data-studio-internal');
  app.surface.setPreview(true);
  expect(app.surface.insertParagraph('preview')).toBe(false);
  app.surface.dispose();
  expect(app.surface.insertParagraph('disposed')).toBe(false);
});

test('text insertion stays inside the selected section or the last document section', () => {
  const app = setup(
    '<html><body><main><section id="first"><h2>First</h2></section><section id="last"><h2>Last</h2></section></main></body></html>',
  );
  app.surface.insertParagraph('Last section text');
  expect(app.document.querySelector('#last p')!.textContent).toBe('Last section text');
  app.fire(app.document.querySelector('#first h2')!, 'click');
  app.surface.insertParagraph('First section text');
  expect(app.document.querySelector('#first p')!.textContent).toBe('First section text');
  expect(app.document.querySelectorAll('main > p').length).toBe(0);
  app.surface.dispose();
});

test('common HTML elements can be inserted, edited, exported and deleted', () => {
  for (const [tag] of htmlElements) {
    const app = setup('<!doctype html><html><body></body></html>');
    try {
      expect(app.surface.insertElement(tag, '<literal>내용</literal>')).toBe(true);
      const element = app.document.body.firstElementChild!;
      expect(element.tagName.toLowerCase()).toBe(tag === 'code' ? 'pre' : tag);
      expect(app.document.querySelector('literal')).toBeNull();
      if (tag === 'table') {
        expect(element.querySelectorAll('tr')).toHaveLength(3);
        expect(element.querySelectorAll('th[scope="col"]')).toHaveLength(2);
        expect(element.querySelectorAll('td')).toHaveLength(4);
      }
      const editable = element.querySelector('code, td, li, p, a') ?? element;
      app.fire(editable, 'click');
      const key = app.selection().values['editor-kind'] === 'code' ? 'code-text' : 'text-node-0';
      expect(app.surface.change(key, '수정한 내용', false)).toBe(true);
      const exported = htmlCodec.normalize(app.surface.snapshot());
      expect(exported).toContain('수정한 내용');
      expect(exported).not.toContain('data-studio-internal');
      app.fire(element, 'click');
      expect(app.surface.deleteElement()).toBe(true);
      expect(app.document.body.children).toHaveLength(0);
      expect(app.selection().tag).toBe('');
    } finally {
      app.surface.dispose();
    }
  }
});

test('insertion keeps blocks outside headings, lists and tables and main unique', () => {
  const app = setup(
    '<main><section><h1>Title</h1><ul><li>Item</li></ul><table><tbody><tr><td>Cell</td></tr></tbody></table></section></main>',
  );
  try {
    const heading = app.document.querySelector('h1')!;
    app.fire(heading, 'click');
    app.surface.insertElement('h2', 'Subtitle');
    expect(heading.nextElementSibling!.tagName).toBe('H2');
    app.fire(app.document.querySelector('li')!, 'click');
    app.surface.insertElement('section', 'New section');
    expect(app.document.querySelector('ul')!.nextElementSibling!.tagName).toBe('SECTION');
    app.fire(app.document.querySelector('td')!, 'click');
    app.surface.insertElement('code', 'const x = 1;');
    expect(app.document.querySelector('td > pre > code')!.textContent).toBe('const x = 1;');
    expect(app.surface.insertElement('main', 'Duplicate')).toBe(false);
    expect(app.document.querySelectorAll('main')).toHaveLength(1);
    app.surface.insertElement('nav', 'Menu');
    expect(app.document.querySelector('body > nav > a')!.textContent).toBe('Menu');
    expect(app.surface.insertElement('script' as never, 'alert(1)')).toBe(false);
    const roundtrip = new window.DOMParser().parseFromString(app.surface.snapshot(), 'text/html');
    expect(roundtrip.querySelector('section > h2')!.textContent).toBe('Subtitle');
    expect(roundtrip.querySelector('td > pre > code')!.textContent).toBe('const x = 1;');
  } finally {
    app.surface.dispose();
  }
});

test('delete protects the document root, preview and disposed surfaces', () => {
  const app = setup('<section><h2>Title</h2><p>Content</p></section>');
  app.fire(app.document.body, 'click');
  expect(app.selection().values['can-delete']).toBe('');
  expect(app.surface.deleteElement()).toBe(false);
  app.fire(app.document.querySelector('section')!, 'click');
  app.surface.setPreview(true);
  expect(app.selection().values['can-delete']).toBe('');
  expect(app.surface.deleteElement()).toBe(false);
  expect(app.surface.insertElement('table', 'Preview')).toBe(false);
  app.surface.setPreview(false);
  expect(app.selection().values['can-delete']).toBe('true');
  expect(app.surface.deleteElement()).toBe(true);
  expect(app.document.body.innerHTML).toBe('');
  app.surface.dispose();
  expect(app.surface.deleteElement()).toBe(false);
  expect(app.surface.insertElement('h1', 'Disposed')).toBe(false);
});

test('element insertion and deletion participate in save and undo/redo history', async () => {
  const app = setup('<p>Original</p>');
  let saved = '';
  const controller = createEditorController(app.surface.snapshot(), {
    surface: app.surface,
    codec: htmlCodec,
    dialogs: { confirmDiscard: async () => true },
    storage: {
      saveHtml: async (html) => {
        saved = html;
        return true;
      },
      saveMessage: 'Saved',
    },
  });
  try {
    const original = currentHtml(controller.view().document);
    controller.insertElement('table', 'Cell');
    const added = currentHtml(controller.view().document);
    expect(added).toContain('<table');
    expect(controller.view().document.history).toHaveLength(2);
    await controller.save();
    expect(saved).toBe(added);
    expect(controller.view().dirty).toBe(false);
    controller.deleteElement();
    expect(currentHtml(controller.view().document)).toBe(original);
    expect(controller.view().dirty).toBe(true);
    controller.restore(-1);
    expect(currentHtml(controller.view().document)).toBe(added);
    controller.restore(1);
    expect(currentHtml(controller.view().document)).toBe(original);
  } finally {
    controller.dispose();
  }
});

test('draft snapshots exclude temporary editable attributes and finish restores the original', () => {
  const app = setup();
  try {
    const paragraph = app.document.querySelector('p')!;
    app.fire(paragraph, 'dblclick');
    expect(paragraph.getAttribute('contenteditable')).toBe('true');
    paragraph.textContent = 'Edited';
    app.fire(paragraph, 'input');
    app.tick();
    expect(app.draft()).toContain('Edited');
    expect(app.draft()).toContain('contenteditable="false"');
    expect(paragraph.getAttribute('contenteditable')).toBe('true');
    app.surface.finishEditing();
    expect(paragraph.getAttribute('contenteditable')).toBe('false');
    expect(app.counts().commits).toBe(1);
  } finally {
    app.surface.dispose();
  }
});

test('a burst of canvas inputs creates one snapshot with the latest text per frame', () => {
  const app = setup();
  try {
    const paragraph = app.document.querySelector('p')!;
    app.fire(paragraph, 'dblclick');
    let snapshots = 0;
    const root = app.document.documentElement;
    const clone = root.cloneNode.bind(root);
    root.cloneNode = (deep) => {
      snapshots++;
      return clone(deep);
    };
    for (const value of ['A', 'AB', 'AB한글']) {
      paragraph.textContent = value;
      app.fire(paragraph, 'input');
    }
    expect(snapshots).toBe(0);
    app.tick();
    expect(snapshots).toBe(1);
    expect(app.counts().drafts).toBe(1);
    expect(app.draft()).toContain('AB한글');
    expect(paragraph.getAttribute('contenteditable')).toBe('true');
  } finally {
    app.surface.dispose();
  }
});

test('save before the next frame flushes canvas text once and cancels the queued draft', async () => {
  let controller!: ReturnType<typeof createEditorController>;
  const app = setup('<p>Original</p>', {
    commit: (html) => controller.commit(html),
    draft: (html) => controller.observeDraft(html),
  });
  let saved = '';
  let backup = '';
  controller = createEditorController(app.surface.snapshot(), {
    surface: app.surface,
    codec: htmlCodec,
    dialogs: { confirmDiscard: async () => true },
    storage: {
      saveMessage: 'Saved',
      saveHtml: async (html) => {
        saved = html;
        return true;
      },
    },
    recovery: {
      load: () => undefined,
      save: (value) => {
        backup = value.html;
        return true;
      },
    },
  });
  try {
    const paragraph = app.document.querySelector('p')!;
    app.fire(paragraph, 'dblclick');
    paragraph.textContent = 'Latest 한글';
    app.fire(paragraph, 'input');
    let snapshots = 0;
    const root = app.document.documentElement;
    const clone = root.cloneNode.bind(root);
    root.cloneNode = (deep) => {
      snapshots++;
      return clone(deep);
    };
    await controller.save();
    expect(saved).toContain('<p>Latest 한글</p>');
    expect(backup).toBe(saved);
    expect(snapshots).toBe(1);
    expect(controller.view().dirty).toBe(false);
    app.tick();
    expect(app.counts().drafts).toBe(0);
    expect(controller.view().document.history).toHaveLength(2);
  } finally {
    controller.dispose();
  }
});

test('undo and disposal flush an inspector draft before its scheduled frame', () => {
  for (const action of ['undo', 'dispose']) {
    const app = setup('<p>Original</p>');
    let backup = '';
    const controller = createEditorController(app.surface.snapshot(), {
      surface: app.surface,
      codec: htmlCodec,
      dialogs: { confirmDiscard: async () => true },
      storage: { saveMessage: 'Saved', saveHtml: async () => true },
      recovery: {
        load: () => undefined,
        save: (value) => {
          backup = value.html;
          return true;
        },
      },
    });
    try {
      app.fire(app.document.querySelector('p')!, 'click');
      controller.draftChange('text-node-0', 'Latest');
      if (action === 'undo') {
        controller.restore(-1);
        expect(currentHtml(controller.view().document)).toContain('<p>Original</p>');
        expect(controller.view().canRedo).toBe(true);
      } else {
        controller.dispose();
        expect(backup).toContain('<p>Latest</p>');
      }
      app.tick();
      expect(app.counts().drafts).toBe(0);
      expect(backup).toContain(action === 'undo' ? '<p>Original</p>' : '<p>Latest</p>');
    } finally {
      controller.dispose();
    }
  }
});

test('document reload and disposal cancel queued snapshots and bounds measurements', () => {
  for (const action of ['reload', 'dispose']) {
    const app = setup();
    const paragraph = app.document.querySelector('p')!;
    app.fire(paragraph, 'dblclick');
    paragraph.textContent = 'Pending';
    app.fire(paragraph, 'input');
    if (action === 'reload') app.surface.load('<p>Replacement</p>');
    else app.surface.dispose();
    const counts = app.counts();
    app.tick();
    expect(app.counts()).toEqual(counts);
    app.surface.dispose();
  }
});

test('continuous draft snapshots never mutate live editable attributes or end the session', () => {
  for (const original of [null, 'false', 'plaintext-only']) {
    const app = setup('<p>Hello <span>world</span></p>');
    try {
      const paragraph = app.document.querySelector('p')!;
      if (original !== null) paragraph.setAttribute('contenteditable', original);
      app.fire(paragraph, 'dblclick');
      const observer = new window.MutationObserver(() => {});
      observer.observe(paragraph, {
        attributes: true,
        attributeFilter: ['contenteditable'],
      });
      for (const text of ['A', 'AB', 'AB한', 'AB한글']) {
        paragraph.firstChild!.textContent = text;
        app.fire(paragraph, 'input');
        app.tick();
        expect(app.surface.isEditing()).toBe(true);
        expect(app.document.activeElement).toBe(paragraph);
        expect(observer.takeRecords()).toHaveLength(0);
        const saved = new window.DOMParser().parseFromString(app.draft(), 'text/html');
        expect(saved.querySelector('p')!.getAttribute('contenteditable')).toBe(original);
        expect(saved.querySelector('span')!.textContent).toBe('world');
      }
      expect(app.counts().commits).toBe(0);
      observer.disconnect();
      app.surface.finishEditing();
      expect(paragraph.getAttribute('contenteditable')).toBe(original);
      expect(app.counts().commits).toBe(1);
    } finally {
      app.surface.dispose();
    }
  }
});

test('focus moves inside the editing element without ending editing, but outside commits', () => {
  const app = setup('<p>Hello <span tabindex="0">world</span></p><button>Outside</button>');
  try {
    const paragraph = app.document.querySelector('p')!;
    app.fire(paragraph, 'dblclick');
    paragraph.dispatchEvent(
      new window.FocusEvent('focusout', {
        bubbles: true,
        relatedTarget: paragraph.querySelector('span'),
      }),
    );
    expect(app.surface.isEditing()).toBe(true);
    paragraph.dispatchEvent(
      new window.FocusEvent('focusout', {
        bubbles: true,
        relatedTarget: app.document.querySelector('button'),
      }),
    );
    expect(app.surface.isEditing()).toBe(false);
    expect(app.counts().commits).toBe(1);
  } finally {
    app.surface.dispose();
  }
});

test('code editor preserves whitespace, syntax spans and literal HTML across serialization', () => {
  const app = setup(
    '<pre class="snippet"><code data-language="js"><span class="token">const</span> x = 1;\n</code></pre>',
  );
  try {
    const token = app.document.querySelector('span')!;
    app.fire(token, 'dblclick');
    expect(app.selection().tag).toBe('code');
    expect(app.surface.isEditing()).toBe(true);
    expect(app.selection().values['code-text']).toBe('const x = 1;\n');
    const value = 'const x = "<b>";\n  next();\n';
    expect(app.surface.change('code-text', value, false)).toBe(true);
    expect(app.document.querySelector('code')!.textContent).toBe(value);
    expect(token.textContent).toBe('const');
    const reopened = new window.DOMParser().parseFromString(app.surface.snapshot(), 'text/html');
    expect(reopened.querySelector('code')!.textContent).toBe(value);
    expect(reopened.querySelector('.token')).not.toBeNull();
    expect(reopened.querySelector('code')!.getAttribute('data-language')).toBe('js');
    expect(reopened.querySelector('b')).toBeNull();
  } finally {
    app.surface.dispose();
  }
});

test('canvas code input preserves markup, newlines and literal HTML, and removes its UI on commit', () => {
  const app = setup(
    '<pre><code data-language="js"><span class="token">const</span> x = 1;\n</code></pre>',
  );
  try {
    app.fire(app.document.querySelector('.token')!, 'dblclick');
    const input = app.document.querySelector('textarea')!;
    expect(input.value).toBe('const x = 1;\n');
    expect(app.document.activeElement).toBe(input);
    for (const value of ['const x = 2;\n', 'const x = "<b>";\n  next();\n']) {
      input.value = value;
      app.fire(input, 'input');
      app.tick();
      expect(app.surface.isEditing()).toBe(true);
      expect(app.document.activeElement).toBe(input);
      const saved = new window.DOMParser().parseFromString(app.draft(), 'text/html');
      expect(saved.querySelector('code')!.textContent).toBe(value);
      expect(saved.querySelector('.token')).not.toBeNull();
      expect(saved.querySelector('textarea, b, [data-studio-internal]')).toBeNull();
      expect(saved.querySelector('code')!.getAttribute('data-language')).toBe('js');
    }
    input.setSelectionRange(input.value.length, input.value.length);
    const tab = new window.KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(input.value.endsWith('\n  ')).toBe(true);
    expect(app.document.querySelector('code')!.textContent).toBe(input.value);
    input.dispatchEvent(
      new window.KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(app.surface.isEditing()).toBe(false);
    expect(app.document.querySelector('textarea')).toBeNull();
    expect(app.counts().commits).toBe(1);
  } finally {
    app.surface.dispose();
  }
});

test('bare pre blocks can be edited and preview and disposal remove the temporary input', () => {
  const app = setup('<pre>first\n  second</pre>');
  try {
    app.surface.setPreview(true);
    app.fire(app.document.querySelector('pre')!, 'dblclick');
    expect(app.document.querySelector('textarea')).toBeNull();
    app.surface.setPreview(false);
    app.fire(app.document.querySelector('pre')!, 'dblclick');
    expect(app.document.querySelector('textarea')!.value).toBe('first\n  second');
    app.surface.dispose();
    expect(app.document.querySelector('textarea')).toBeNull();
  } finally {
    app.surface.dispose();
  }
});

test('inspector ignores indentation and keeps text fields stable when cleared and retyped', () => {
  const app = setup(
    '<main>\n  <h1>Heading</h1>\n  <p><span>Details</span></p>\n  <svg><title>Icon</title></svg>\n</main>',
  );
  try {
    const main = app.document.querySelector('main')!;
    const heading = main.querySelector('h1')!;
    const span = main.querySelector('span')!;
    app.fire(main, 'click');
    expect(app.selection().values['text-count']).toBe('2');
    expect(app.selection().values['text-node-0']).toBe('Heading');
    expect(app.selection().values['text-node-1']).toBe('Details');
    for (const value of ['Hello?', '', '새 문구', ' ', '<b>수정 완료</b>']) {
      expect(app.surface.change('text-node-0', value, false)).toBe(true);
      expect(heading.textContent).toBe(value);
      expect(app.selection().values['text-count']).toBe('2');
      expect(app.selection().values['text-node-0']).toBe(value);
      expect(span.textContent).toBe('Details');
    }
    expect(main.querySelector('h1')).toBe(heading);
    expect(main.querySelector('span')).toBe(span);
    expect(main.querySelector('b')).toBeNull();
    expect(main.querySelector('title')!.textContent).toBe('Icon');
    expect(app.surface.snapshot()).toContain('<main>\n  <h1>');
    app.fire(span, 'click');
    expect(app.selection().values['text-count']).toBe('1');
    app.surface.change('text-node-0', 'Other element', false);
    expect(span.textContent).toBe('Other element');
    expect(heading.textContent).toBe('<b>수정 완료</b>');
  } finally {
    app.surface.dispose();
  }
});

test('inspector drafts can be revised without saving and commit as one undo step', () => {
  const app = setup('<p>Original <strong>nested text</strong></p>');
  let saves = 0;
  const controller = createEditorController(app.surface.snapshot(), {
    surface: app.surface,
    codec: htmlCodec,
    dialogs: { confirmDiscard: async () => true },
    storage: {
      saveHtml: async () => {
        saves++;
        return true;
      },
      saveMessage: 'Saved',
    },
  });
  try {
    const original = currentHtml(controller.view().document);
    const paragraph = app.document.querySelector('p')!;
    app.fire(paragraph, 'click');
    for (const value of ['Hello?', '', '한', '한글 수정']) {
      controller.draftChange('text-node-0', value);
      app.tick();
      expect(paragraph.firstChild!.textContent).toBe(value);
      expect(app.selection().values['text-node-0']).toBe(value);
      expect(controller.view().dirty).toBe(true);
      expect(controller.view().canUndo).toBe(true);
      expect(controller.view().document.history).toHaveLength(1);
      expect(saves).toBe(0);
    }
    controller.change('text-node-0', '한글 수정');
    expect(controller.view().document.history).toHaveLength(2);
    const revised = currentHtml(controller.view().document);
    expect(revised).toContain('한글 수정<strong>nested text</strong>');
    controller.restore(-1);
    expect(currentHtml(controller.view().document)).toBe(original);
    controller.restore(1);
    expect(currentHtml(controller.view().document)).toBe(revised);
    expect(saves).toBe(0);
  } finally {
    controller.dispose();
  }
});

test('saving an inspector draft includes the current input and permits further edits', async () => {
  const app = setup('<p>Original</p>');
  let saved = '';
  const controller = createEditorController(app.surface.snapshot(), {
    surface: app.surface,
    codec: htmlCodec,
    dialogs: { confirmDiscard: async () => true },
    storage: {
      saveHtml: async (html) => {
        saved = html;
        return true;
      },
      saveMessage: 'Saved',
    },
  });
  try {
    app.fire(app.document.querySelector('p')!, 'click');
    controller.draftChange('text-node-0', 'Before save');
    await controller.save();
    expect(saved).toContain('<p>Before save</p>');
    expect(controller.view().dirty).toBe(false);
    controller.draftChange('text-node-0', 'After save');
    app.tick();
    expect(app.document.querySelector('p')!.textContent).toBe('After save');
    expect(controller.view().dirty).toBe(true);
    expect(saved).toContain('<p>Before save</p>');
  } finally {
    controller.dispose();
  }
});

test('table cells and label text edits retain nested elements, controls and associations', () => {
  const app = setup(
    '<table><tbody><tr><td rowspan="2"><strong>A</strong><a href="/x">B</a></td><td>C</td></tr></tbody></table><label for="agree"><input id="agree" type="checkbox"><span>Agree</span></label>',
  );
  try {
    const cell = app.document.querySelector('td')!;
    app.fire(cell, 'click');
    expect(app.selection().values['text-count']).toBe('2');
    app.surface.change('text-node-0', '<new>', false);
    expect(cell.querySelector('strong')!.textContent).toBe('<new>');
    expect(cell.querySelector('a')!.getAttribute('href')).toBe('/x');
    expect(cell.getAttribute('rowspan')).toBe('2');
    expect(app.document.querySelectorAll('td')[1]!.textContent).toBe('C');
    const label = app.document.querySelector('label')!;
    app.fire(label, 'dblclick');
    app.surface.change('text-node-0', '동의', false);
    expect(label.getAttribute('for')).toBe('agree');
    expect(label.querySelector('input')).not.toBeNull();
    expect(label.querySelector('span')!.textContent).toBe('동의');
  } finally {
    app.surface.dispose();
  }
});

test('chip parent selection preserves icons and permits text and border edits', () => {
  const app = setup(
    '<button class="chip"><svg><title>Icon</title></svg><span>Ready</span></button>',
  );
  try {
    app.fire(app.document.querySelector('span')!, 'click');
    app.surface.change('select-parent', '', false);
    expect(app.selection().tag).toBe('button');
    expect(app.selection().values['text-count']).toBe('1');
    app.surface.change('text-node-0', '완료', false);
    app.surface.change('border', '1px solid red', false);
    expect(app.document.querySelector('button')!.className).toBe('chip');
    expect(app.document.querySelector('title')!.textContent).toBe('Icon');
    expect(app.document.querySelector('button')!.style.border).toContain('red');
    app.surface.setPreview(true);
    expect(app.surface.change('text-node-0', 'No', false)).toBe(false);
    expect(app.document.querySelector('span')!.textContent).toBe('완료');
  } finally {
    app.surface.dispose();
  }
});

test('structured text changes participate in save, undo and redo history', async () => {
  const app = setup('<pre><code><span class="token">old</span> value\n</code></pre>');
  let saved = '';
  const controller = createEditorController(app.surface.snapshot(), {
    surface: app.surface,
    codec: htmlCodec,
    dialogs: { confirmDiscard: async () => true },
    storage: {
      saveHtml: async (html) => {
        saved = html;
        return true;
      },
      saveMessage: 'Saved',
    },
  });
  try {
    app.fire(app.document.querySelector('code')!, 'click');
    controller.change('code-text', 'new value\n  <tag>\n');
    expect(controller.view().dirty).toBe(true);
    expect(controller.view().canUndo).toBe(true);
    await controller.save();
    const parse = (html: string) => new window.DOMParser().parseFromString(html, 'text/html');
    expect(parse(saved).querySelector('code')!.textContent).toBe('new value\n  <tag>\n');
    expect(parse(saved).querySelector('.token')).not.toBeNull();
    expect(controller.view().dirty).toBe(false);
    controller.restore(-1);
    expect(parse(currentHtml(controller.view().document)).querySelector('code')!.textContent).toBe(
      'old value\n',
    );
    expect(controller.view().dirty).toBe(true);
    controller.restore(1);
    expect(currentHtml(controller.view().document)).toBe(saved);
    expect(controller.view().dirty).toBe(false);
  } finally {
    controller.dispose();
  }
});

test('reload and disposal remove old handlers and disconnect observers', () => {
  const app = setup();
  const paragraph = app.document.querySelector('p')!;
  app.fire(paragraph, 'keydown');
  expect(app.counts().keyboards).toBe(1);
  app.surface.ready();
  expect(app.counts().disconnects).toBe(1);
  app.fire(paragraph, 'keydown');
  expect(app.counts().keyboards).toBe(2);
  app.surface.dispose();
  app.fire(paragraph, 'keydown');
  app.fire(paragraph, 'dblclick');
  expect(app.counts().keyboards).toBe(2);
  expect(app.counts().disconnects).toBe(2);
  expect(paragraph.getAttribute('contenteditable')).toBe('false');
});

test('file and URL image replacements remove responsive sources only for the selected image', () => {
  for (const fileReplacement of [false, true]) {
    const app = setup(
      '<html><body><picture><source srcset="old-wide.png" media="(min-width: 1px)"><img src="old.png" srcset="old-high.png 2x" sizes="100vw" alt="Keep me"></picture><picture><source srcset="other-wide.png"><img src="other.png"></picture></body></html>',
    );
    const image = app.document.querySelector('img')!;
    app.fire(image, 'click');
    const src = fileReplacement ? 'data:image/png;base64,AAAA' : 'https://example.com/new.png';
    if (fileReplacement) expect(app.surface.imageTarget()!(src)).toBe(true);
    else expect(app.surface.change('src', src, true)).toBe(true);
    const reopened = new window.DOMParser().parseFromString(app.surface.snapshot(), 'text/html');
    const replaced = reopened.querySelector('img')!;
    expect(replaced.getAttribute('src')).toBe(src);
    expect(replaced.hasAttribute('srcset')).toBe(false);
    expect(replaced.hasAttribute('sizes')).toBe(false);
    expect(replaced.getAttribute('alt')).toBe('Keep me');
    expect(replaced.closest('picture')!.querySelector('source')).toBeNull();
    expect(reopened.querySelector('source')!.getAttribute('srcset')).toBe('other-wide.png');
    app.surface.dispose();
  }
});

test('leaving the image URL unchanged preserves responsive sources', () => {
  const app = setup(
    '<html><body><picture><source srcset="wide.png"><img src="old.png" srcset="high.png 2x" sizes="100vw"></picture></body></html>',
  );
  app.fire(app.document.querySelector('img')!, 'click');
  const before = app.surface.snapshot();
  app.surface.change('src', 'old.png', true);
  expect(app.surface.snapshot()).toBe(before);
  app.surface.dispose();
});

test('image targets are invalidated by document replacement even while old nodes are connected', () => {
  const app = setup();
  try {
    const image = app.document.querySelector('img')!;
    app.fire(image, 'click');
    const apply = app.surface.imageTarget()!;
    app.surface.load('replacement');
    expect(image.isConnected).toBe(true);
    expect(apply('late image')).toBe(false);
    expect(image.getAttribute('src')).toBe('old.png');
    expect(app.surface.snapshot()).toBe('replacement');
  } finally {
    app.surface.dispose();
  }
});

test('preview hides selection bounds and disables editing', () => {
  const app = setup();
  try {
    const paragraph = app.document.querySelector('p')!;
    app.fire(paragraph, 'click');
    expect(app.selection().bounds).toBeDefined();
    app.surface.setPreview(true);
    expect(app.selection().bounds).toBeUndefined();
    app.fire(paragraph, 'dblclick');
    expect(app.surface.isEditing()).toBe(false);
  } finally {
    app.surface.dispose();
  }
});

test('scroll and resize update bounds without resetting inspector input values', () => {
  const app = setup();
  try {
    app.fire(app.document.querySelector('p')!, 'click');
    const inspections = app.counts().inspections;
    app.document.dispatchEvent(new window.Event('scroll'));
    app.document.defaultView!.dispatchEvent(new window.Event('resize'));
    app.tick();
    expect(app.counts().inspections).toBe(inspections);
    expect(app.selection().bounds).toBeDefined();
  } finally {
    app.surface.dispose();
  }
});

test('bounds measurements are batched and unchanged bounds do not notify the UI', () => {
  const app = setup();
  try {
    const paragraph = app.document.querySelector('p')!;
    app.fire(paragraph, 'click');
    let reads = 0;
    paragraph.getBoundingClientRect = () => {
      reads++;
      return new window.DOMRect(10, 20, 100, 40);
    };
    for (let i = 0; i < 10; i++) {
      app.document.dispatchEvent(new window.Event('scroll'));
      app.document.defaultView!.dispatchEvent(new window.Event('resize'));
    }
    expect(reads).toBe(0);
    app.tick();
    expect(reads).toBe(1);
    expect(app.counts().boundsUpdates).toBe(1);
    app.document.dispatchEvent(new window.Event('scroll'));
    app.tick();
    expect(reads).toBe(2);
    expect(app.counts().boundsUpdates).toBe(1);
    expect(app.selection().bounds).toEqual({ x: 10, y: 20, w: 100, h: 40 });
  } finally {
    app.surface.dispose();
  }
});

test('inspector text drafts avoid computed styles and other table cell measurements', () => {
  const app = setup('<table><tr><td>A</td><td>B</td></tr></table>');
  const controller = createEditorController(app.surface.snapshot(), {
    surface: app.surface,
    codec: htmlCodec,
    dialogs: { confirmDiscard: async () => true },
    storage: { saveMessage: 'Saved', saveHtml: async () => true },
  });
  try {
    app.fire(app.document.querySelector('td')!, 'click');
    let styles = 0,
      reads = 0;
    const view = app.document.defaultView!;
    const getStyle = view.getComputedStyle.bind(view);
    view.getComputedStyle = (element) => {
      styles++;
      return getStyle(element);
    };
    app.document.querySelectorAll('td')[1]!.getBoundingClientRect = () => {
      reads++;
      return new window.DOMRect(0, 0, 100, 40);
    };
    for (const value of ['A1', 'A12', 'A123']) controller.draftChange('text-node-0', value);
    app.tick();
    expect(styles).toBe(0);
    expect(reads).toBe(0);
    expect(app.selection().values['text-node-0']).toBe('A123');
    expect(controller.view().dirty).toBe(true);
  } finally {
    controller.dispose();
  }
});

test('drag bursts use the latest position and release or cancellation flushes before a frame', () => {
  for (const end of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    const app = setup('<table><tr><td>A</td><td>B</td></tr></table>');
    try {
      const cell = app.document.querySelector('td')!;
      cell.getBoundingClientRect = () => new window.DOMRect(0, 0, 100, 40);
      app.fire(cell, 'click');
      const handle = app.document.querySelector('[data-table-resize="column"]')!;
      Object.defineProperty(handle, 'setPointerCapture', { value() {} });
      const pointer = (type: string, clientX: number) =>
        handle.dispatchEvent(
          new window.PointerEvent(type, {
            bubbles: true,
            button: 0,
            pointerId: 1,
            clientX,
          }),
        );
      pointer('pointerdown', 100);
      for (const x of [120, 140, 160]) pointer('pointermove', x);
      expect(app.document.querySelector('col')).toBeNull();
      app.tick();
      expect(app.document.querySelector('col')!.style.width).toBe('160px');
      expect(app.counts().drafts).toBe(1);
      pointer('pointermove', 190);
      pointer(end, 190);
      expect(app.document.querySelector('col')!.style.width).toBe('190px');
      expect(app.committedHtml()).toContain('190px');
      expect(app.committedHtml()).not.toContain('data-table-resize');
      app.tick();
      expect(app.counts().commits).toBe(1);
      expect(app.counts().drafts).toBe(1);
    } finally {
      app.surface.dispose();
    }
  }
});

test('table sizing controls apply dimensions, reject invalid values and are excluded from exports', () => {
  const app = setup(
    '<table><tr><td><span>A</span></td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>',
  );
  try {
    app.fire(app.document.querySelector('span')!, 'click');
    expect(app.selection().values['table-cell']).toBe('true');
    expect(app.document.querySelectorAll('[data-table-resize]')).toHaveLength(2);
    expect(app.surface.change('table-column-width', '180px', false)).toBe(true);
    expect(app.document.querySelector('col')!.style.width).toBe('180px');
    expect(app.surface.change('table-row-height', '80', false)).toBe(true);
    expect(app.document.querySelector('tr')!.style.height).toBe('80px');
    const before = app.surface.snapshot();
    expect(before).not.toContain('data-table-resize');
    for (const value of ['', '-10px', 'auto', 'Infinity', '20px']) {
      expect(app.surface.change('table-row-height', value, false)).toBe(false);
    }
    expect(app.surface.snapshot()).toBe(before);
    app.surface.setPreview(true);
    expect(app.document.querySelector('[data-table-resize]')).toBeNull();
    expect(app.surface.change('table-column-width', '200', false)).toBe(false);
    app.surface.setPreview(false);
    expect(app.document.querySelectorAll('[data-table-resize]')).toHaveLength(2);
    app.surface.clearSelection();
    expect(app.document.querySelector('[data-table-resize]')).toBeNull();
  } finally {
    app.surface.dispose();
  }
});

test('table drag commits once on release and removes controls on disposal', () => {
  const app = setup('<table><tr><td>A</td><td>B</td></tr></table>');
  try {
    const cell = app.document.querySelector('td')!;
    Object.defineProperty(cell, 'getBoundingClientRect', {
      value: () => ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 100,
        bottom: 40,
        width: 100,
        height: 40,
      }),
    });
    app.fire(cell, 'click');
    const handle = app.document.querySelector('[data-table-resize="column"]')!;
    Object.defineProperty(handle, 'setPointerCapture', { value() {} });
    handle.dispatchEvent(
      new window.PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        pointerId: 1,
        clientX: 100,
      }),
    );
    handle.dispatchEvent(
      new window.PointerEvent('pointermove', {
        bubbles: true,
        pointerId: 1,
        clientX: 160,
      }),
    );
    app.tick();
    expect(app.document.querySelector('col')!.style.width).toBe('160px');
    expect(app.counts().commits).toBe(0);
    handle.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    expect(app.counts().commits).toBe(1);
    expect(app.draft()).not.toContain('data-table-resize');
    app.surface.dispose();
    expect(app.document.querySelector('[data-table-resize]')).toBeNull();
  } finally {
    app.surface.dispose();
  }
});

test('table dimensions survive export and reopening and participate in undo and redo', async () => {
  const app = setup('<table><tr><td>A</td><td>B</td></tr></table>');
  let saved = '';
  const controller = createEditorController(app.surface.snapshot(), {
    surface: app.surface,
    codec: htmlCodec,
    dialogs: { confirmDiscard: async () => true },
    storage: {
      saveHtml: async (html) => {
        saved = html;
        return true;
      },
      saveMessage: 'Saved',
    },
  });
  try {
    app.fire(app.document.querySelector('td')!, 'click');
    controller.change('table-column-width', '180px');
    controller.change('table-row-height', '100px');
    await controller.save();
    const reopened = new window.DOMParser().parseFromString(saved, 'text/html');
    expect(reopened.querySelector('col')!.style.width).toBe('180px');
    expect(reopened.querySelector('tr')!.style.height).toBe('100px');
    expect(reopened.querySelector('[data-table-resize]')).toBeNull();
    controller.restore(-1);
    expect(currentHtml(controller.view().document)).not.toContain('height: 100px');
    expect(currentHtml(controller.view().document)).toContain('180px');
    controller.restore(1);
    expect(currentHtml(controller.view().document)).toBe(saved);
    expect(controller.view().dirty).toBe(false);
  } finally {
    controller.dispose();
  }
});
