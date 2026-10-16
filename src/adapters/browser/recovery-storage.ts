import { isDocumentSnapshot } from '../../core/editor-document';
import type { RecoveryStorage } from '../../application/ports';

const key = 'html-studio.last-document';

export const recoveryStorage: RecoveryStorage = {
  load() {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (isDocumentSnapshot(value)) return value;
    } catch {
      // An unavailable or damaged backup must not prevent opening the editor.
    }
  },
  save(value) {
    try {
      const json = JSON.stringify(value);
      if (localStorage.getItem(key) !== json) localStorage.setItem(key, json);
      return true;
    } catch {
      return false;
    }
  },
};
