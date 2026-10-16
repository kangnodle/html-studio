import type { createEditorController } from '../application/editor-controller';
import type {
  ImageFile,
  ImportFile,
  HtmlTemplate,
  WindowLifecycle,
  Selection,
} from '../application/ports';

export type SessionFactory = (hooks: {
  selection(value: Selection): void;
  bounds(value: Selection['bounds']): void;
  keyboard(event: KeyboardEvent): void;
}) => {
  controller: ReturnType<typeof createEditorController>;
  surface: {
    attach(frame: HTMLIFrameElement): void;
    ready(): void;
    isEditing(): boolean;
  };
  lifecycle: WindowLifecycle;
  imageFile(file: File): ImageFile;
  pickHtmlFile?: () => Promise<ImportFile | undefined>;
  templates: readonly HtmlTemplate[];
};
