import { expect, test } from 'vite-plus/test';
import { createEditorController } from '../src/application/editor-controller';
import { currentHtml } from '../src/core/editor-state';
import type {
  EditorSurface,
  HtmlStorage,
  DiscardDialog,
  HtmlTemplate,
  RecoveryStorage,
  RecoveryDocument,
} from '../src/application/ports';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function setup(overrides: Partial<HtmlStorage & DiscardDialog> = {}, recovery?: RecoveryStorage) {
  let html = 'initial';
  let pending: string | undefined;
  let confirms = 0,
    saves = 0;
  const surface: EditorSurface = {
    snapshot: () => html,
    scheduleDraft: (listener) => listener(html),
    finishEditing() {
      if (pending !== undefined) {
        html = pending;
        pending = undefined;
      }
    },
    load(value) {
      html = value;
    },
    clearSelection() {},
    change: () => false,
    setPreview() {},
    imageTarget: () => undefined,
    insertParagraph: () => false,
    insertElement: () => false,
    deleteElement: () => false,
    dispose() {},
  };
  const services: HtmlStorage & DiscardDialog = {
    saveHtml: async () => {
      saves++;
      return true;
    },
    confirmDiscard: async () => {
      confirms++;
      return true;
    },
    saveMessage: 'saved',
    ...overrides,
  };
  const controller = createEditorController('initial', {
    surface,
    storage: services,
    dialogs: services,
    codec: { normalize: (value) => value },
    recovery,
  });
  return {
    controller,
    surface,
    edit(value: string) {
      html = value;
      controller.commit();
    },
    draft(value: string) {
      pending = value;
      controller.observeDraft(value);
    },
    counts: () => ({ confirms, saves }),
    html: () => html,
  };
}
const file = (html: string, name = 'new.html') => ({
  name,
  text: async () => html,
});
const template: HtmlTemplate = {
  id: 'manual',
  label: '사용자 매뉴얼',
  description: '설명',
  name: 'manual.html',
  html: 'manual content',
};

test('restart recovers the latest draft, document identity and unsaved state', async () => {
  let backup: RecoveryDocument | undefined;
  const recovery: RecoveryStorage = {
    load: () => backup,
    save(value) {
      backup = value;
      return true;
    },
  };
  const app = setup({}, recovery);
  await app.controller.newDocument(template);
  app.draft('unfinished typing');
  app.controller.dispose();
  const restarted = setup({}, recovery);
  expect(currentHtml(restarted.controller.view().document)).toBe('unfinished typing');
  expect(restarted.controller.view()).toMatchObject({
    name: template.name,
    templateId: template.id,
    templateLabel: template.label,
    dirty: true,
    canOverwrite: false,
  });
  restarted.surface.load('unfinished typing');
  await restarted.controller.save();
  expect(setup({}, recovery).controller.view().dirty).toBe(false);
  await restarted.controller.open(file('another file', 'another.html'));
  expect(setup({}, recovery).controller.view()).toMatchObject({
    name: 'another.html',
    templateId: undefined,
    dirty: false,
  });
});

test('failed automatic recovery writes keep editing available and report the failure', () => {
  const app = setup({}, { load: () => undefined, save: () => false });
  app.edit('keep this edit');
  expect(currentHtml(app.controller.view().document)).toBe('keep this edit');
  expect(app.controller.view().status).toContain('자동 저장에 실패');
});

test('recovery skips status-only and identical updates but retries failed writes', async () => {
  const backups: RecoveryDocument[] = [];
  let succeeds = true;
  const app = setup(
    {},
    {
      load: () => undefined,
      save(value) {
        backups.push(value);
        return succeeds;
      },
    },
  );
  app.edit('edited');
  app.controller.reportStatus('status only');
  app.controller.commit();
  app.draft('edited');
  expect(backups).toHaveLength(1);
  await app.controller.save();
  expect(backups).toHaveLength(2);
  expect(backups[1]!.savedHtml).toBe('edited');
  await app.controller.open(file('edited', 'renamed.html'));
  expect(backups).toHaveLength(3);
  expect(backups[2]!.name).toBe('renamed.html');
  succeeds = false;
  app.edit('later');
  app.controller.reportStatus('retry');
  expect(backups).toHaveLength(5);
  succeeds = true;
  app.controller.reportStatus('retry succeeds');
  app.controller.reportStatus('no more writes');
  expect(backups).toHaveLength(6);
  app.controller.dispose();
});

test('creating a template resets history and detaches the previously opened original', async () => {
  const app = setup();
  let overwrites = 0;
  await app.controller.open({
    ...file('original'),
    overwriteHtml: async () => {
      overwrites++;
      return true;
    },
  });
  app.edit('edited original');
  expect(await app.controller.newDocument(template)).toBe(true);
  expect(app.html()).toBe(template.html);
  expect(app.controller.view().name).toBe('manual.html');
  expect(app.controller.view().templateId).toBe('manual');
  expect(app.controller.view().canUndo).toBe(false);
  expect(app.controller.view().canOverwrite).toBe(false);
  expect(app.controller.view().dirty).toBe(true);
  await app.controller.overwrite();
  expect(overwrites).toBe(0);
  await app.controller.save();
  expect(app.controller.view().dirty).toBe(false);
});

test('rejecting template replacement preserves pending edits and the original file', async () => {
  const app = setup({ confirmDiscard: async () => false });
  await app.controller.open({
    ...file('original'),
    overwriteHtml: async () => true,
  });
  app.draft('pending edit');
  expect(await app.controller.newDocument(template)).toBe(false);
  expect(app.html()).toBe('pending edit');
  expect(app.controller.view().canOverwrite).toBe(true);
  expect(app.controller.view().templateId).toBeUndefined();
});

test('template creation supersedes a pending file read and old save completion', async () => {
  const read = deferred<string>();
  const write = deferred<boolean>();
  const app = setup({ saveHtml: () => write.promise });
  const saving = app.controller.save();
  const opening = app.controller.open({
    name: 'slow.html',
    text: () => read.promise,
  });
  await app.controller.newDocument(template);
  read.resolve('old import');
  write.resolve(true);
  await Promise.all([opening, saving]);
  expect(app.html()).toBe(template.html);
  expect(app.controller.view().dirty).toBe(true);
  expect(app.controller.view().opening).toBe(false);
  expect(app.controller.view().saving).toBe(false);
});

test('changes during template discard confirmation prevent replacement', async () => {
  const confirm = deferred<boolean>();
  const app = setup({ confirmDiscard: () => confirm.promise });
  app.edit('first');
  const task = app.controller.newDocument(template);
  await Promise.resolve();
  app.edit('later');
  confirm.resolve(true);
  expect(await task).toBe(false);
  expect(app.html()).toBe('later');
});

test('overwrite flushes pending edits to the opened original without exporting a copy', async () => {
  const app = setup();
  let written = '';
  expect(app.controller.view().canOverwrite).toBe(false);
  await app.controller.open({
    ...file('original'),
    overwriteHtml: async (html) => {
      written = html;
      return true;
    },
  });
  expect(app.controller.view().canOverwrite).toBe(true);
  app.draft('edited 한글');
  await app.controller.overwrite();
  expect(written).toBe('edited 한글');
  expect(app.counts().saves).toBe(0);
  expect(app.controller.view().dirty).toBe(false);
  expect(app.controller.view().status).toBe('HTML 파일을 덮어썼습니다.');
});

test('overwrite captures its original file and cannot mark a replacement document saved', async () => {
  const write = deferred<boolean>();
  const writes: string[] = [];
  const app = setup();
  await app.controller.open({
    ...file('first', 'first.html'),
    overwriteHtml: (html) => {
      writes.push(html);
      return write.promise;
    },
  });
  app.edit('first edit');
  const task = app.controller.overwrite();
  await app.controller.save();
  await app.controller.overwrite();
  expect(writes).toEqual(['first edit']);
  expect(app.counts().saves).toBe(0);
  await app.controller.open(file('second'));
  app.edit('second edit');
  write.resolve(true);
  await task;
  expect(app.controller.view().document.savedHtml).toBe('second');
  expect(app.controller.view().dirty).toBe(true);
  expect(app.controller.view().canOverwrite).toBe(false);
  expect(app.controller.view().saving).toBe(false);
});

test('overwrite completion keeps edits made during the write dirty', async () => {
  const write = deferred<boolean>();
  const app = setup();
  await app.controller.open({
    ...file('original'),
    overwriteHtml: () => write.promise,
  });
  app.edit('captured');
  const task = app.controller.overwrite();
  app.edit('later edit');
  write.resolve(true);
  await task;
  expect(app.controller.view().document.savedHtml).toBe('captured');
  expect(app.controller.view().dirty).toBe(true);
});

test('cancelled file replacement retains the original overwrite target', async () => {
  const app = setup({ confirmDiscard: async () => false });
  let written = '';
  await app.controller.open({
    ...file('original'),
    overwriteHtml: async (html) => {
      written = html;
      return true;
    },
  });
  app.edit('edit');
  await app.controller.open(file('replacement'));
  await app.controller.overwrite();
  expect(written).toBe('edit');
  expect(app.controller.view().canOverwrite).toBe(true);
});

test('unavailable, cancelled and failed overwrites preserve unsaved edits', async () => {
  for (const overwriteHtml of [
    undefined,
    async () => false,
    async () => {
      throw new Error('Access denied');
    },
  ]) {
    const app = setup();
    await app.controller.open({ ...file('original'), overwriteHtml });
    app.edit('edit');
    await app.controller.overwrite();
    expect(app.controller.view().document.savedHtml).toBe('original');
    expect(app.controller.view().dirty).toBe(true);
    expect(app.controller.view().saving).toBe(false);
    expect(app.counts().saves).toBe(0);
  }
});

test('pending text edits are confirmed before opening and cancellation preserves them', async () => {
  let confirms = 0;
  const app = setup({
    confirmDiscard: async () => {
      confirms++;
      return false;
    },
  });
  app.draft('pending text');
  await app.controller.open(file('replacement'));
  expect(confirms).toBe(1);
  expect(currentHtml(app.controller.view().document)).toBe('pending text');
  expect(app.controller.view().dirty).toBe(true);
  expect(app.controller.view().opening).toBe(false);
});

test('saving records the captured snapshot while later edits remain dirty', async () => {
  const save = deferred<boolean>();
  let written: string | undefined;
  const app = setup({
    saveHtml: (html) => {
      written = html;
      return save.promise;
    },
  });
  app.edit('a');
  const task = app.controller.save();
  app.edit('b');
  save.resolve(true);
  await task;
  expect(written).toBe('a');
  expect(app.controller.view().document.savedHtml).toBe('a');
  expect(app.controller.view().dirty).toBe(true);
  app.controller.restore(-1);
  expect(app.controller.view().dirty).toBe(false);
});

test('save completion from the previous document cannot overwrite the new document', async () => {
  const save = deferred<boolean>();
  const app = setup({ saveHtml: () => save.promise });
  app.edit('old edit');
  const task = app.controller.save();
  await app.controller.open(file('new document'));
  app.edit('new edit');
  const status = app.controller.view().status;
  save.resolve(true);
  await task;
  expect(app.controller.view().document.savedHtml).toBe('new document');
  expect(app.controller.view().dirty).toBe(true);
  expect(app.controller.view().status).toBe(status);
  expect(app.controller.view().saving).toBe(false);
});

test('cancelled and failed saves preserve the saved baseline and release the save lock', async () => {
  const app = setup({ saveHtml: async () => false });
  app.edit('edit');
  await app.controller.save();
  expect(app.controller.view().document.savedHtml).toBe('initial');
  expect(app.controller.view().dirty).toBe(true);
  expect(app.controller.view().saving).toBe(false);
  const failed = setup({
    saveHtml: async () => {
      throw new Error('denied');
    },
  });
  failed.edit('edit');
  await failed.controller.save();
  expect(failed.controller.view().dirty).toBe(true);
  expect(failed.controller.view().saving).toBe(false);
  expect(failed.controller.view().status).toContain('denied');
});

test('duplicate save requests do not write twice', async () => {
  const save = deferred<boolean>();
  let calls = 0;
  const app = setup({
    saveHtml: () => {
      calls++;
      return save.promise;
    },
  });
  const task = app.controller.save();
  await app.controller.save();
  expect(calls).toBe(1);
  save.resolve(true);
  await task;
});

test('latest open request wins regardless of file read completion order', async () => {
  const read = deferred<string>();
  const app = setup();
  const first = app.controller.open({
    name: 'slow.html',
    text: () => read.promise,
  });
  await app.controller.open(file('latest'));
  read.resolve('stale');
  await first;
  expect(app.controller.view().name).toBe('new.html');
  expect(app.html()).toBe('latest');
});

test('failed file reads preserve the document and release the open lock', async () => {
  const app = setup();
  await app.controller.open({
    name: 'bad.html',
    text: async () => {
      throw new Error('read failed');
    },
  });
  expect(app.html()).toBe('initial');
  expect(app.controller.view().opening).toBe(false);
  expect(app.controller.view().status).toContain('read failed');
});

test('edits made during discard confirmation prevent document replacement', async () => {
  const confirm = deferred<boolean>();
  const app = setup({ confirmDiscard: () => confirm.promise });
  app.edit('first');
  const task = app.controller.open(file('replacement'));
  await Promise.resolve();
  app.edit('second');
  confirm.resolve(true);
  await task;
  expect(app.html()).toBe('second');
  expect(app.controller.view().dirty).toBe(true);
});

test('closing rechecks changes made during confirmation and blocks pending work', async () => {
  const confirm = deferred<boolean>();
  const app = setup({ confirmDiscard: () => confirm.promise });
  app.draft('first');
  const task = app.controller.requestClose();
  app.draft('second');
  confirm.resolve(true);
  expect(await task).toBe(false);
  const save = deferred<boolean>();
  const busy = setup({ saveHtml: () => save.promise });
  const saving = busy.controller.save();
  expect(await busy.controller.requestClose()).toBe(false);
  save.resolve(true);
  await saving;
  expect(await busy.controller.requestClose()).toBe(true);
});

test('image reads cannot modify a replacement document', async () => {
  const image = deferred<string>();
  const app = setup();
  let applied = false;
  app.surface.imageTarget = () => () => {
    applied = true;
    return true;
  };
  const task = app.controller.replaceImage({
    readDataUrl: () => image.promise,
  });
  await app.controller.open(file('new document'));
  image.resolve('image');
  await task;
  expect(applied).toBe(false);
});

test('disposal invalidates outstanding work and releases subscribers', async () => {
  const read = deferred<string>();
  const app = setup();
  let updates = 0;
  app.controller.subscribe(() => updates++);
  const task = app.controller.open({
    name: 'late.html',
    text: () => read.promise,
  });
  app.controller.dispose();
  const count = updates;
  read.resolve('late');
  await task;
  expect(app.html()).toBe('initial');
  expect(updates).toBe(count);
});

test('disposed controllers never call surface effects or notify new subscribers', async () => {
  const app = setup();
  let effects = 0;
  app.surface.dispose = () => {
    effects++;
  };
  app.controller.dispose();
  const forbidden = () => {
    throw new Error('surface accessed after disposal');
  };
  app.surface.snapshot = forbidden;
  app.surface.finishEditing = forbidden;
  app.surface.change = forbidden;
  app.surface.clearSelection = forbidden;
  app.surface.setPreview = forbidden;
  app.controller.commit();
  app.controller.change('color', 'red');
  app.controller.clearSelection();
  app.controller.togglePreview(true);
  app.controller.insertParagraph('late');
  app.controller.reportStatus('late callback');
  app.controller.subscribe(forbidden);
  await app.controller.open(file('late'));
  await app.controller.save();
  expect(await app.controller.newDocument(template)).toBe(false);
  expect(app.controller.hasUnsavedChanges()).toBe(false);
  expect(app.controller.isBusy()).toBe(false);
  app.controller.dispose();
  expect(effects).toBe(1);
});
