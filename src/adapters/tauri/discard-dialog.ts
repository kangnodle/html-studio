import { confirm } from '@tauri-apps/plugin-dialog';
import type { DiscardDialog } from '../../application/ports';

export function createDiscardDialog(translate: (message: string) => string): DiscardDialog {
  return {
    confirmDiscard(message) {
      return confirm(translate(message), {
        title: translate('저장하지 않은 변경 사항'),
        kind: 'warning',
        okLabel: translate('변경 사항 버리기'),
        cancelLabel: translate('계속 편집'),
      });
    },
  };
}

export const confirmDiscard = createDiscardDialog((message) => message).confirmDiscard;
