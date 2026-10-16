import type { ImportFile } from '../../application/ports';

type FilePickerWindow = Window & {
  showOpenFilePicker?: (options: {
    multiple: boolean;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle[]>;
};

export function supportsFilePicker(): boolean {
  return typeof (window as FilePickerWindow).showOpenFilePicker === 'function';
}

export async function openHtml(): Promise<ImportFile | undefined> {
  try {
    const [handle] = await (window as FilePickerWindow).showOpenFilePicker!({
      multiple: false,
      types: [{ description: 'HTML', accept: { 'text/html': ['.html', '.htm'] } }],
    });
    const file = await handle.getFile();
    return {
      name: file.name,
      text: () => file.text(),
      async overwriteHtml(html) {
        const writer = await handle.createWritable();
        try {
          await writer.write(html);
          await writer.close();
        } catch (error) {
          await writer.abort().catch(() => {});
          throw error;
        }
        return true;
      },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    throw error;
  }
}

export async function saveHtml(html: string, name: string): Promise<boolean> {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return true;
}

export function readImage(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('이미지를 읽을 수 없습니다.'));
    reader.onabort = () => reject(new Error('이미지 읽기가 취소되었습니다.'));
    reader.readAsDataURL(file);
  });
}
