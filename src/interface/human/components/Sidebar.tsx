import type { PanelRegistry } from '../panel-registry';
import { Panel } from './Panel';

export function Sidebar({ registry }: { readonly registry: PanelRegistry }) {
  const panels=registry.list();const time=panels.find(({id})=>id==='time');
  return <aside className="sidebar">
    <header className="brand"><strong>HRU</strong><span>HASH-RELATIONAL UNIVERSE</span></header>
    {time&&<section className="persistent-time"><div className="persistent-time-title">TIME</div><time.Component/></section>}
    <div className="panel-list">{panels.filter(({id})=>id!=='time').map(({ id, title, Component }) => <Panel key={id} title={title}><Component /></Panel>)}</div>
  </aside>;
}
