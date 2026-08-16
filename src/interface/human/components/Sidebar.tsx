import type { PanelRegistry } from '../panel-registry';
import { Panel } from './Panel';

export function Sidebar({ registry }: { readonly registry: PanelRegistry }) {
  return <aside className="sidebar">
    <header className="brand"><strong>HRU</strong><span>HASH-RELATIONAL UNIVERSE</span></header>
    <div className="panel-list">{registry.list().map(({ id, title, Component }) => <Panel key={id} title={title}><Component /></Panel>)}</div>
  </aside>;
}
