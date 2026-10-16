import type { CloseGuard } from '../../application/ports';

export function watchClose(guard: CloseGuard) {
  const handler = (event: BeforeUnloadEvent) => {
    if (guard.hasUnsavedChanges() || guard.isBusy()) {
      event.preventDefault();
      event.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}
