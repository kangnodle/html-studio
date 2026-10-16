import { getCurrentWindow } from '@tauri-apps/api/window';
import type { CloseGuard } from '../../application/ports';

export function watchClose(guard: CloseGuard) {
  let disposed = false,
    confirming = false;
  let unlisten: (() => void) | undefined;
  const window = getCurrentWindow();
  void window
    .onCloseRequested(async (event) => {
      if (!guard.hasUnsavedChanges() && !guard.isBusy()) return;
      event.preventDefault();
      if (confirming || guard.isBusy() || disposed) return;
      confirming = true;
      try {
        if ((await guard.requestClose()) && !disposed) await window.destroy();
      } catch (error) {
        if (!disposed) guard.reportError(error);
      } finally {
        confirming = false;
      }
    })
    .then((cleanup) => {
      if (disposed) cleanup();
      else unlisten = cleanup;
    })
    .catch((error) => {
      if (!disposed) guard.reportError(error);
    });
  return () => {
    disposed = true;
    unlisten?.();
  };
}
