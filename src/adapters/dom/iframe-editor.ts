import { createCodeInput, positionCodeInput } from './code-editor';
import { codeTarget, textValues, inspectElement } from './element-inspection';
import { createTableResizeControls } from './table-resize-controls';
import { parseTableSize } from '../../core/table-layout';
import { textEditingRule } from '../../core/editing-rules';
import type { HtmlElementTag } from '../../core/html-elements';
import { isHtmlElementTag, planElementInsertion } from '../../core/element-insertion';
import { materializeElement } from './element-insertion';
import type { EditorSurface, Selection } from '../../application/ports';
import { previewSource, serialize } from './html-codec';
import { inspectorTextNodes, replaceCodeText } from './text-content';
import { tableCell, resizeColumn, resizeRow } from './table-dimensions';

type Hooks = {
  commit(html: string): void;
  draft(html: string): void;
  selection(selection: Selection): void;
  bounds(bounds: Selection['bounds']): void;
  status(message: string): void;
  keyboard(event: KeyboardEvent): void;
};

export function createIframeEditor(hooks: Hooks): EditorSurface & {
  attach(frame: HTMLIFrameElement, initialHtml: string): void;
  ready(): void;
  isEditing(): boolean;
} {
  let frame: HTMLIFrameElement | undefined;
  let doc: Document | undefined;
  let selected: HTMLElement | undefined, editing: HTMLElement | undefined;
  let textElement: HTMLElement | undefined;
  let selectedTextNodes: Text[] = [];
  let oldEditable: string | null = null;
  let codeInput: HTMLTextAreaElement | undefined;
  let preview = false,
    disposed = false,
    generation = 0;
  let pendingHtml = '';
  let cleanup = () => {};
  let animationFrame: number | undefined;
  let draftListener: ((html: string) => void) | undefined;
  let boundsPending = false;
  let lastBounds: Selection['bounds'];
  let inspection: Selection = { tag: '', values: {} };

  function scheduleFrame() {
    if (!doc || disposed || animationFrame !== undefined) return;
    animationFrame = doc.defaultView!.requestAnimationFrame(() => {
      animationFrame = undefined;
      tableControls.flush();
      const listener = draftListener;
      draftListener = undefined;
      if (listener) listener(snapshot());
      if (boundsPending) updateBounds();
    });
  }
  function scheduleDraft(listener: (html: string) => void = hooks.draft) {
    if (!doc || disposed) return;
    draftListener = listener;
    scheduleFrame();
  }
  function scheduleBounds() {
    boundsPending = true;
    scheduleFrame();
  }

  const tableControls = createTableResizeControls({
    context: () => ({ document: doc, selected, enabled: !preview && !editing }),
    finishEditing,
    draft: () => scheduleDraft(),
    commit: () => {
      const html = snapshot();
      hooks.commit(html);
      return html;
    },
    updateBounds: scheduleBounds,
    inspect,
  });

  function restoreEditable() {
    if (!editing) return;
    if (oldEditable === null) editing.removeAttribute('contenteditable');
    else editing.setAttribute('contenteditable', oldEditable);
  }
  function snapshot() {
    tableControls.flush();
    draftListener = undefined;
    if (!doc) return pendingHtml;
    return serialize(doc, editing ? { element: editing, originalValue: oldEditable } : undefined);
  }
  function selectionTextNodes() {
    // Keep field identities while typing, including when a text node becomes empty.
    if (textElement !== selected) {
      textElement = selected;
      selectedTextNodes = selected ? inspectorTextNodes(selected) : [];
    }
    return selectedTextNodes;
  }
  function inspect() {
    inspection = inspectElement(doc, selected, preview, selectionTextNodes());
    lastBounds = inspection.bounds;
    tableControls.update();
    hooks.selection(inspection);
  }
  function updateBounds() {
    boundsPending = false;
    const tableBounds = tableControls.measure();
    const r =
      selected?.isConnected && doc && !preview ? selected.getBoundingClientRect() : undefined;
    const codeBounds =
      codeInput && editing
        ? (editing.closest('pre') || editing).getBoundingClientRect()
        : undefined;
    const bounds = r ? { x: r.x, y: r.y, w: r.width, h: r.height } : undefined;
    tableControls.update(tableBounds);
    if (codeInput && codeBounds) positionCodeInput(codeInput, codeBounds);
    if (
      bounds?.x !== lastBounds?.x ||
      bounds?.y !== lastBounds?.y ||
      bounds?.w !== lastBounds?.w ||
      bounds?.h !== lastBounds?.h
    ) {
      lastBounds = bounds;
      inspection = { ...inspection, bounds };
      hooks.bounds(bounds);
    }
  }
  function finishEditing() {
    const resized = tableControls.finishResize();
    if (!editing) return resized;
    restoreEditable();
    editing = undefined;
    const input = codeInput;
    codeInput = undefined;
    input?.remove();
    textElement = undefined;
    const html = snapshot();
    hooks.commit(html);
    inspect();
    return html;
  }
  function clearSelection() {
    selected = undefined;
    inspect();
  }
  function replaceImageSource(image: HTMLElement, src: string) {
    if (image.getAttribute('src') === src) return;
    image.removeAttribute('srcset');
    image.removeAttribute('sizes');
    image
      .closest('picture')
      ?.querySelectorAll('source')
      .forEach((source) => source.remove());
    image.setAttribute('src', src);
  }
  function detach() {
    generation++;
    if (animationFrame !== undefined) doc?.defaultView!.cancelAnimationFrame(animationFrame);
    animationFrame = undefined;
    draftListener = undefined;
    boundsPending = false;
    cleanup();
    cleanup = () => {};
    tableControls.dispose();
    codeInput?.remove();
    codeInput = undefined;
    restoreEditable();
    editing = undefined;
    doc = undefined;
    clearSelection();
  }
  function load(html: string) {
    if (disposed) return;
    detach();
    pendingHtml = html;
    if (frame) frame.srcdoc = previewSource(html);
  }
  function ready() {
    if (disposed || !frame?.contentDocument) return;
    detach();
    doc = frame.contentDocument;
    const document = doc,
      view = document.defaultView!;
    const removers: (() => void)[] = [];
    function listen(target: EventTarget, type: string, handler: EventListener, capture = false) {
      target.addEventListener(type, handler, capture);
      removers.push(() => target.removeEventListener(type, handler, capture));
    }
    listen(document, 'click', (event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest) return;
      if (tableControls.contains(target)) return;
      if (target === codeInput) return;
      event.preventDefault();
      if (preview || editing?.contains(target)) return;
      finishEditing();
      selected = codeTarget(target) || target;
      inspect();
    });
    listen(document, 'dblclick', (event) => {
      if (preview) return;
      const target = event.target as HTMLElement | null;
      if (!target?.tagName) return;
      if (tableControls.contains(target)) return;
      const code = codeTarget(target);
      if (code) {
        if (editing === code && codeInput) return;
        finishEditing();
        selected = code;
        editing = code;
        oldEditable = code.getAttribute('contenteditable');
        codeInput = createCodeInput(document, code, textValues(code)['code-text'] || '');
        updateBounds();
        codeInput.focus();
        inspect();
        hooks.status('코드 블록을 직접 편집하세요. Tab 들여쓰기 · Ctrl+Enter 적용 · Esc 종료');
        return;
      }
      const rule = textEditingRule(
        target.tagName,
        Array.from(target.children, (child) => child.tagName),
      );
      if (rule === 'blocked') return;
      if (rule === 'select-child') {
        finishEditing();
        selected = target;
        inspect();
        hooks.status(
          '오른쪽 문구 입력창에서 수정하거나 텍스트가 있는 하위 요소를 더블 클릭하세요.',
        );
        return;
      }
      finishEditing();
      selected = target;
      editing = target;
      oldEditable = target.getAttribute('contenteditable');
      target.setAttribute('contenteditable', 'true');
      target.focus();
      inspect();
    });
    listen(document, 'focusout', (event) => {
      const next = (event as FocusEvent).relatedTarget;
      if (next === codeInput) return;
      if (next && editing?.contains(next as Node)) return;
      finishEditing();
    });
    listen(document, 'input', () => {
      if (codeInput && editing) replaceCodeText(editing, codeInput.value);
      scheduleDraft();
      scheduleBounds();
    });
    listen(document, 'submit', (event) => event.preventDefault());
    listen(document, 'pointerdown', tableControls.pointerDown);
    listen(document, 'pointermove', tableControls.pointerMove);
    listen(document, 'pointerup', tableControls.finishResize);
    listen(document, 'pointercancel', tableControls.finishResize);
    listen(document, 'lostpointercapture', tableControls.finishResize);
    listen(document, 'keydown', (event) => {
      const key = event as KeyboardEvent;
      if (codeInput && event.target === codeInput) {
        if (key.key === 'Tab') {
          key.preventDefault();
          codeInput.setRangeText('  ', codeInput.selectionStart, codeInput.selectionEnd, 'end');
          if (editing) replaceCodeText(editing, codeInput.value);
          scheduleDraft();
          scheduleBounds();
          return;
        }
        if ((key.ctrlKey || key.metaKey) && key.key === 'Enter') {
          key.preventDefault();
          finishEditing();
          return;
        }
      }
      hooks.keyboard(key);
    });
    listen(document, 'scroll', scheduleBounds, true);
    listen(view, 'resize', scheduleBounds);
    const observer = new (view as Window & typeof globalThis).ResizeObserver(scheduleBounds);
    observer.observe(document.body);
    cleanup = () => {
      removers.forEach((remove) => remove());
      observer.disconnect();
    };
  }
  function insertElement(tag: HtmlElementTag, text: string) {
    if (!doc || disposed || preview || !isHtmlElementTag(tag)) return false;
    finishEditing();
    const plan = planElementInsertion(tag, text, !!doc.querySelector('main'));
    if (!plan) {
      if (tag === 'main')
        hooks.status('본문 영역은 이미 있습니다. 기존 main 요소를 선택해 수정하세요.');
      return false;
    }
    const element = materializeElement(doc, plan);
    const container =
      tag === 'nav' || tag === 'main'
        ? doc.body
        : (selected?.closest('section, article, main, nav, div, blockquote, td, th') ??
          doc.querySelector('main > section:last-of-type') ??
          doc.querySelector('main') ??
          doc.body);
    let anchor: Element | undefined = selected;
    while (anchor && anchor !== container && anchor.parentElement !== container)
      anchor = anchor.parentElement ?? undefined;
    if (anchor && anchor !== container && container.contains(anchor)) anchor.after(element);
    else container.append(element);
    selected = element;
    inspect();
    return true;
  }
  return {
    attach(element, html) {
      frame = element;
      load(html);
    },
    ready,
    snapshot,
    scheduleDraft,
    finishEditing,
    clearSelection,
    load,
    isEditing: () => !!editing,
    insertParagraph(text) {
      return insertElement('p', text);
    },
    insertElement,
    deleteElement() {
      if (
        !doc ||
        disposed ||
        preview ||
        !selected ||
        selected === doc.body ||
        !doc.body.contains(selected)
      )
        return false;
      finishEditing();
      const target = selected.tagName === 'CODE' ? (selected.closest('pre') ?? selected) : selected;
      target.remove();
      textElement = undefined;
      clearSelection();
      return true;
    },
    setPreview(value) {
      preview = value;
      inspect();
      updateBounds();
    },
    change(key, value, attribute, draft = false) {
      if (!selected?.isConnected || !doc || preview) return false;
      if (key === 'table-column-width' || key === 'table-row-height') {
        const cell = tableCell(selected);
        if (!cell) return false;
        const size = parseTableSize(value);
        if (size === undefined) {
          hooks.status('표 크기는 24 이상의 숫자 또는 px 값으로 입력하세요. 예: 120px');
          inspect();
          return false;
        }
        if (key === 'table-column-width') resizeColumn(cell, size);
        else resizeRow(cell, size);
        inspect();
        return true;
      }
      if (key === 'select-parent') {
        if (!selected.parentElement || selected.parentElement === doc.body) return false;
        selected = selected.parentElement;
        inspect();
        return false;
      }
      if (key === 'code-text' && textValues(selected)['editor-kind'] === 'code') {
        replaceCodeText(selected, value);
      } else if (/^text-node-\d+$/.test(key)) {
        if (!(key in textValues(selected, selectionTextNodes()))) return false;
        const node = selectionTextNodes()[Number(key.slice(10))];
        if (!node || !selected.contains(node)) return false;
        node.data = value;
      } else if (key === 'code-text') return false;
      else if (attribute) {
        if (key === 'src' && selected.tagName === 'IMG') replaceImageSource(selected, value);
        else selected.setAttribute(key, value);
      } else {
        if (value && !(doc.defaultView as Window & typeof globalThis).CSS.supports(key, value)) {
          hooks.status('올바른 CSS 값을 입력하세요. 예: 24px, 1rem, #345678');
          inspect();
          return false;
        }
        selected.style.setProperty(key, value);
      }
      if (draft && (key === 'code-text' || /^text-node-\d+$/.test(key))) {
        inspection = {
          ...inspection,
          values: { ...inspection.values, [key]: value },
        };
        hooks.selection(inspection);
        scheduleBounds();
      } else inspect();
      return true;
    },
    imageTarget() {
      if (!selected || selected.tagName !== 'IMG') return;
      const target = selected,
        id = generation;
      return (dataUrl) => {
        if (disposed || id !== generation || !target.isConnected || target.ownerDocument !== doc)
          return false;
        replaceImageSource(target, dataUrl);
        inspect();
        return true;
      };
    },
    dispose() {
      disposed = true;
      detach();
      frame = undefined;
    },
  };
}
