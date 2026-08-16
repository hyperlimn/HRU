import { SceneObserver } from './observer/SceneObserver';
import { RuntimeProvider } from './interface/human/runtime-context';
import { Sidebar } from './interface/human/components/Sidebar';
import { panelRegistry } from './interface/human/panels/registry';

export function App() { return <RuntimeProvider><main><SceneObserver /><Sidebar registry={panelRegistry} /></main></RuntimeProvider>; }
