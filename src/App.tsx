import { SceneObserver } from './observer/SceneObserver';
import { RuntimeProvider } from './interface/human/runtime-context';
import { Sidebar } from './interface/human/components/Sidebar';
import { panelRegistry } from './interface/human/panels/registry';
import { ObserverStateProvider } from './observer/observer-state';

export function App() { return <RuntimeProvider><ObserverStateProvider><main><SceneObserver /><Sidebar registry={panelRegistry} /></main></ObserverStateProvider></RuntimeProvider>; }
