import { usePreferences } from './preferences-context';
import { Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { Selection } from '../application/ports';
type Props = {
  width: Accessor<string>;
  tag: Accessor<string>;
  bounds: Accessor<Selection['bounds']>;
  open(file?: File): Promise<void>;
  attach(frame: HTMLIFrameElement): void;
  ready(): void;
};
export function EditorCanvas(props: Props) {
  const { t } = usePreferences();
  const { width, tag, bounds, open } = props;
  return (
    <main
      class="canvas"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void open(e.dataTransfer?.files[0]);
      }}
    >
      <div class="canvas-label">
        <span>PAGE CANVAS</span>
        <span>
          {width() === '100%' ? t('유동 너비') : width()}
          {' · '}
          {t('스크립트 실행 제한')}
        </span>
      </div>
      <div class="page" style={{ width: width() }}>
        <iframe
          ref={props.attach}
          title={t('HTML 편집 화면')}
          sandbox="allow-same-origin"
          onLoad={props.ready}
        />
        <Show when={bounds()}>
          {(b) => (
            <div
              class="selection"
              style={{
                left: `${b().x}px`,
                top: `${b().y}px`,
                width: `${b().w}px`,
                height: `${b().h}px`,
              }}
            >
              <span>{tag()}</span>
            </div>
          )}
        </Show>
      </div>
    </main>
  );
}
