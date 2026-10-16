import type { ElementBlueprint } from '../../core/element-insertion';

export function materializeElement(document: Document, blueprint: ElementBlueprint): HTMLElement {
  const element = document.createElement(blueprint.tag);
  if (blueprint.text !== undefined) element.textContent = blueprint.text;
  for (const [key, value] of Object.entries(blueprint.attributes ?? {}))
    element.setAttribute(key, value);
  for (const [key, value] of Object.entries(blueprint.styles ?? {}))
    element.style.setProperty(key, value);
  for (const child of blueprint.children ?? []) element.append(materializeElement(document, child));
  return element;
}
