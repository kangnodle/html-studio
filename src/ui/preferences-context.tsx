import {
  createContext,
  useContext,
  createSignal,
  onMount,
  onCleanup,
  type ParentProps,
} from 'solid-js';
import type { PreferencesController } from '../application/preferences-controller';
import { translate } from './translations';

function bindPreferences(controller: PreferencesController) {
  const [view, setView] = createSignal(controller.view());
  const unsubscribe = controller.subscribe(setView);
  onMount(controller.start);
  onCleanup(() => {
    unsubscribe();
    controller.dispose();
  });
  return {
    view,
    setLanguage: controller.setLanguage,
    setTheme: controller.setTheme,
    t: (message: string) => translate(view().language, message),
  };
}

const PreferencesContext = createContext<ReturnType<typeof bindPreferences>>();

export function PreferencesProvider(props: ParentProps<{ controller: PreferencesController }>) {
  const value = bindPreferences(props.controller);
  return <PreferencesContext.Provider value={value}>{props.children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('PreferencesProvider is required');
  return value;
}
