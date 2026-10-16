import type { DocumentSnapshot } from '../core/editor-document';
import type { HtmlElementTag } from '../core/html-elements';

export interface HtmlCodec {
  normalize(html: string): string;
}

export interface ImportFile {
  readonly name: string;
  text(): Promise<string>;
  overwriteHtml?(html: string): Promise<boolean>;
}

export type HtmlTemplate = Readonly<{
  id: string;
  label: string;
  description: string;
  name: string;
  html: string;
}>;

export interface ImageFile {
  readDataUrl(): Promise<string>;
}

export type Selection = {
  tag: string;
  values: Record<string, string>;
  bounds?: { x: number; y: number; w: number; h: number };
};

export interface EditorSurface {
  snapshot(): string;
  scheduleDraft(listener: (html: string) => void): void;
  finishEditing(): string | void;
  load(html: string): void;
  clearSelection(): void;
  change(key: string, value: string, attribute: boolean, draft?: boolean): boolean;
  setPreview(preview: boolean): void;
  imageTarget(): ((dataUrl: string) => boolean) | undefined;
  insertParagraph(text: string): boolean;
  insertElement(tag: HtmlElementTag, text: string): boolean;
  deleteElement(): boolean;
  dispose(): void;
}

export interface HtmlStorage {
  saveHtml(html: string, name: string): Promise<boolean>;
  readonly saveMessage: string;
}

export type RecoveryDocument = DocumentSnapshot;

export interface RecoveryStorage {
  load(): RecoveryDocument | undefined;
  save(value: RecoveryDocument): boolean;
}

export interface DiscardDialog {
  confirmDiscard(message: string): Promise<boolean>;
}

export interface WindowLifecycle {
  watchClose(guard: CloseGuard): () => void;
}

export interface CloseGuard {
  hasUnsavedChanges(): boolean;
  isBusy(): boolean;
  requestClose(): Promise<boolean>;
  reportError(error: unknown): void;
}
