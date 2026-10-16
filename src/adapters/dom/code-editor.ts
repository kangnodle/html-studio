export function createCodeInput(document: Document, code: HTMLElement, value: string) {
  const input = document.createElement('textarea');
  input.dataset.studioInternal = 'true';
  input.setAttribute('aria-label', '코드 블록 직접 편집');
  input.spellcheck = false;
  input.wrap = 'off';
  input.value = value;
  const style = document.defaultView!.getComputedStyle(code);
  const area = code.closest('pre') || code;
  const areaStyle = document.defaultView!.getComputedStyle(area);
  Object.assign(input.style, {
    position: 'fixed',
    zIndex: '2147483647',
    boxSizing: 'border-box',
    margin: '0',
    resize: 'none',
    border: '2px solid #34765c',
    borderRadius: areaStyle.borderRadius,
    padding: areaStyle.padding,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    color: style.color,
    backgroundColor:
      areaStyle.backgroundColor === 'rgba(0, 0, 0, 0)' ? '#fff' : areaStyle.backgroundColor,
    whiteSpace: 'pre',
    tabSize: '2',
  });
  document.body.appendChild(input);

  return input;
}

export function positionCodeInput(
  input: HTMLTextAreaElement,
  r: Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>,
) {
  Object.assign(input.style, {
    left: `${r.x}px`,
    top: `${r.y}px`,
    width: `${r.width}px`,
    height: `${Math.max(r.height, 80)}px`,
  });
}
