import { invoke } from '@tauri-apps/api/core';
import type { ImportFile } from '../../application/ports';

export async function openHtml(): Promise<ImportFile | undefined> {
  const result = await invoke<[string, string, number] | null>('open_html');
  if (!result) return;
  const [name, html, fileId] = result;
  return {
    name,
    text: async () => html,
    overwriteHtml: (html) => invoke<boolean>('overwrite_html', { html, fileId }),
  };
}

export async function saveHtml(html: string, name: string): Promise<boolean> {
  return (await invoke<string | null>('save_html', { html, name })) !== null;
}
