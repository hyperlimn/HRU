import { renderChannels } from '../../../observer/render-channels';
import { useObserverState } from '../../../observer/observer-state';

export function ObserverPanel() {
  const { frame, activity } = useObserverState();
  return <div className="stack"><p>Read-only Dimension-0 projection · frame tick {frame?.tick.toLocaleString() ?? '—'}</p><small>Recent observation activity (observer buffer, not universe state)</small><dl>
    <dt>Positive created</dt><dd>{activity.positiveCreated}</dd><dt>Negative created</dt><dd>{activity.negativeCreated}</dd><dt>Dissolved</dt><dd>{activity.dissolved}</dd>
    <dt>Threshold changes</dt><dd>{activity.activeTransitions}</dd><dt>Clusters formed</dt><dd>{activity.clustersFormed}</dd><dt>Clusters dissolved</dt><dd>{activity.clustersDissolved}</dd>
    <dt>Injections</dt><dd>{activity.injections}</dd><dt>Condensations</dt><dd>{activity.condensations}</dd>
  </dl></div>;
}

export function EntityPanel() {
  const { selected, select } = useObserverState();
  if (!selected) return <p>Select a rendered entity to inspect its read-only observation record.</p>;
  return <div className="stack"><button onClick={() => select(undefined)}>Clear selection</button>
    <label>Hash<output className="digest">{selected.hash}</output></label><button onClick={() => void navigator.clipboard.writeText(selected.hash)}>Copy hash</button>
    <dl><dt>Origin</dt><dd>{selected.provenance.origin}</dd><dt>Created</dt><dd>{selected.createdAtTick.toLocaleString()}</dd><dt>Cluster</dt><dd>{selected.clusterHash?.slice(0,12) ?? 'free'}</dd></dl>
    <label>Context<output className="digest">{selected.contextHash}</output></label>
    <div className="entity-bonds">{selected.bonds.length ? selected.bonds.map((bond) => <div key={`${bond.low}:${bond.high}`}><strong>{bond.classification}</strong><span>{bond.neighborHash.slice(0,16)}…</span><span>{bond.strength.toFixed(4)}</span></div>) : <small>No current bonds.</small>}</div>
  </div>;
}

export function RenderPanel() {
  const { channels, toggleChannel } = useObserverState();
  return <div className="stack"><div className="checks">{renderChannels.map((channel) => <label key={channel.id}><input type="checkbox" checked={channels[channel.id]} onChange={() => toggleChannel(channel.id)} />{channel.label}</label>)}</div>
    <div className="legend"><span><i className="cyan" />positive</span><span><i className="magenta" />negative</span><span><i className="gold" />condensed</span><span><i className="ghost" />recent event</span></div>
    <small>Solid geometry is current state. Fading geometry is recent observer-only activity.</small>
  </div>;
}
