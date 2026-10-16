import { afterEach, afterAll, expect, test } from 'vite-plus/test';
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';
import { saveHtml, openHtml } from '../src/adapters/tauri/file-access';
import {
  openHtml as openBrowserHtml,
  supportsFilePicker,
} from '../src/adapters/browser/file-access';
import { confirmDiscard, createDiscardDialog } from '../src/adapters/tauri/discard-dialog';

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const previousTauri = Object.getOwnPropertyDescriptor(globalThis, 'isTauri');
Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
Object.defineProperty(globalThis, 'isTauri', {
  configurable: true,
  writable: true,
  value: true,
});
afterEach(() => {
  clearMocks();
  Reflect.deleteProperty(window, 'showOpenFilePicker');
});
afterAll(() => {
  for (const [key, descriptor] of [
    ['window', previousWindow],
    ['isTauri', previousTauri],
  ] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

test('native save reports success only after the backend completes', async () => {
  const html = '<!doctype html><html><body>한글</body></html>';
  mockIPC((command, payload) => {
    expect(command).toBe('save_html');
    expect(payload).toEqual({ html, name: 'page.html' });
    return 'C:\\Documents\\page.html';
  });
  expect(await saveHtml(html, 'page.html')).toBe(true);
});

test('cancelling a native save does not report success', async () => {
  mockIPC(() => null);
  expect(await saveHtml('draft', 'page.html')).toBe(false);
});

test('native write failures propagate to the editor', async () => {
  mockIPC(() => {
    throw new Error('Access denied');
  });
  await expect(saveHtml('draft', 'page.html')).rejects.toThrow('Access denied');
});

test('native overwrite uses the opened file identifier without requesting a save path', async () => {
  const calls: string[] = [];
  mockIPC((command, payload) => {
    calls.push(command);
    if (command === 'open_html') return ['original.html', 'original 한글', 3];
    expect(command).toBe('overwrite_html');
    expect(payload).toEqual({ html: 'edited 한글', fileId: 3 });
    return true;
  });
  const file = await openHtml();
  expect(file?.name).toBe('original.html');
  expect(await file?.text()).toBe('original 한글');
  expect(await file?.overwriteHtml?.('edited 한글')).toBe(true);
  expect(calls).toEqual(['open_html', 'overwrite_html']);
});

test('cancelling native open produces no replacement file', async () => {
  mockIPC(() => null);
  expect(await openHtml()).toBeUndefined();
});

test('browser overwrite writes and closes the handle selected when opening', async () => {
  const actions: string[] = [];
  const handle = {
    getFile: async () => ({
      name: 'original.html',
      text: async () => 'original',
    }),
    createWritable: async () => ({
      write: async (html: string) => {
        actions.push(html);
      },
      close: async () => {
        actions.push('close');
      },
    }),
  };
  Object.defineProperty(window, 'showOpenFilePicker', {
    configurable: true,
    value: async () => [handle],
  });
  expect(supportsFilePicker()).toBe(true);
  const file = await openBrowserHtml();
  expect(await file?.text()).toBe('original');
  expect(await file?.overwriteHtml?.('edited')).toBe(true);
  expect(actions).toEqual(['edited', 'close']);
});

test('failed browser writes abort the stream and propagate the failure', async () => {
  let aborted = false;
  Object.defineProperty(window, 'showOpenFilePicker', {
    configurable: true,
    value: async () => [
      {
        getFile: async () => ({
          name: 'page.html',
          text: async () => 'original',
        }),
        createWritable: async () => ({
          write: async () => {
            throw new Error('disk full');
          },
          abort: async () => {
            aborted = true;
          },
        }),
      },
    ],
  });
  const file = await openBrowserHtml();
  await expect(file!.overwriteHtml!('edited')).rejects.toThrow('disk full');
  expect(aborted).toBe(true);
});

test('discard confirmation respects the native cancel choice', async () => {
  mockIPC((command) => {
    expect(command).toBe('plugin:dialog|message');
    return false;
  });
  expect(await confirmDiscard('Discard?')).toBe(false);
});

test('native dialog obtains translations at invocation time without UI state', async () => {
  let prefix = 'first:';
  const dialogs = createDiscardDialog((message) => prefix + message);
  mockIPC((command, payload) => {
    expect(command).toBe('plugin:dialog|message');
    expect(payload).toMatchObject({
      message: 'second:Discard?',
      title: 'second:저장하지 않은 변경 사항',
      buttons: {
        OkCancelCustom: ['second:변경 사항 버리기', 'second:계속 편집'],
      },
    });
    return 'second:변경 사항 버리기';
  });
  prefix = 'second:';
  expect(await dialogs.confirmDiscard('Discard?')).toBe(true);
});
