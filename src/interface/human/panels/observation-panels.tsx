import { useMemo } from 'react';
import { renderChannels } from '../../../observer/render-channels';
import { useObserverState } from '../../../observer/observer-state';
import { transformedEntityVisual } from '../../../visual-lab/transform';
import { useVisualLab } from '../../../visual-lab/visual-lab-context';
import { buildParticleField } from '../../../observer/vfx/procedural/particle-field';
import { buildVortexField } from '../../../observer/vfx/procedural/vortex-field';

export function ObserverPanel() {
  const { frame, activity } = useObserverState();
  return <div className="stack"><p>Read-only Dimension-0 projection · frame tick {frame?.tick.toLocaleString() ?? '—'}</p><small>Recent observation activity (observer buffer, not universe state)</small><dl>
    <dt>Positive created</dt><dd>{activity.positiveCreated}</dd><dt>Negative created</dt><dd>{activity.negativeCreated}</dd><dt>Dissolved</dt><dd>{activity.dissolved}</dd>
    <dt>Threshold changes</dt><dd>{activity.activeTransitions}</dd><dt>Clusters formed</dt><dd>{activity.clustersFormed}</dd><dt>Clusters dissolved</dt><dd>{activity.clustersDissolved}</dd>
    <dt>Injections</dt><dd>{activity.injections}</dd><dt>Condensations</dt><dd>{activity.condensations}</dd>
  </dl></div>;
}

export function EntityPanel() {
  const { selected, select, frame, visualEvents } = useObserverState(); const { state } = useVisualLab();
  const particle = useMemo(() => selected && frame && state && state.values['vfx.particleField.enabled'] ? buildParticleField(frame, visualEvents, selected.hash, state.values).explanations.get(selected.hash) : undefined, [selected, frame, visualEvents, state]);
  const vortex = useMemo(() => selected && frame && state && state.values['vfx.vortexField.enabled'] ? buildVortexField(frame, visualEvents, selected.hash, state.values).explanations.get(selected.hash) : undefined, [selected, frame, visualEvents, state]);
  if (!selected) return <p>Select a rendered entity to inspect its read-only observation record.</p>;
  const visual = state ? transformedEntityVisual(selected, state.values) : undefined;
  return <div className="stack"><button onClick={() => select(undefined)}>Clear selection</button>
    <label>Hash<output className="digest">{selected.hash}</output></label><button onClick={() => void navigator.clipboard.writeText(selected.hash)}>Copy hash</button>
    <dl><dt>Origin</dt><dd>{selected.provenance.origin}</dd><dt>Created</dt><dd>{selected.createdAtTick.toLocaleString()}</dd><dt>Cluster</dt><dd>{selected.clusterHash?.slice(0,12) ?? 'free'}</dd></dl>
    <label>Context<output className="digest">{selected.contextHash}</output></label>
    <div className="entity-bonds">{selected.bonds.length ? selected.bonds.map((bond) => <div key={`${bond.low}:${bond.high}`}><strong>{bond.classification}</strong><span>{bond.neighborHash.slice(0,16)}…</span><span>{bond.strength.toFixed(4)}</span></div>) : <small>No current bonds.</small>}</div>
    {visual && <section className="visual-inspector"><strong>Why it looks this way</strong><dl><dt>Base hue</dt><dd>{visual.base.baseHue.toFixed(4)}</dd><dt>Base size</dt><dd>{visual.base.size.toFixed(3)}</dd><dt>Final size</dt><dd>{visual.size.toFixed(3)}</dd><dt>Final color</dt><dd>{visual.finalColor}</dd><dt>Emissive</dt><dd>{visual.emissive.toFixed(3)}</dd><dt>Geometry</dt><dd>{visual.base.geometryVariation}</dd><dt>Hash smoothness</dt><dd>{visual.base.smoothnessUnit.toFixed(4)} → detail {visual.geometryDetail}</dd><dt>Provenance ×</dt><dd>{visual.provenanceMultiplier.toFixed(2)}</dd><dt>Accents</dt><dd>{visual.accentStrength.toFixed(2)}</dd><dt>Dimension-0</dt><dd>{visual.position.x.toFixed(1)}, {visual.position.y.toFixed(1)}, {visual.position.z.toFixed(1)}</dd></dl>{particle && <><strong>Particle Field</strong><dl><dt>Source</dt><dd>{particle.sourceIdentity.slice(0,16)}…</dd><dt>Seed</dt><dd>{particle.seedHex.slice(0,16)}…</dd><dt>Fractions</dt><dd>r {particle.fractions.radial.toFixed(3)} · θ {particle.fractions.angular.toFixed(3)} · phase {particle.fractions.phase.toFixed(3)}</dd><dt>Particles</dt><dd>{particle.rendered} / {particle.requested}</dd><dt>Radius</dt><dd>{particle.effectiveRadius.toFixed(3)}</dd><dt>Brightness</dt><dd>{particle.effectiveBrightness.toFixed(3)}</dd><dt>Size</dt><dd>{particle.effectiveSizeRange[0].toFixed(3)}–{particle.effectiveSizeRange[1].toFixed(3)}</dd><dt>Drivers</dt><dd>{[...new Set(particle.activeDrivers)].join(', ')}</dd></dl></>}{vortex && <><strong>Vortex Field</strong><dl><dt>Source</dt><dd>{vortex.sourceIdentity.slice(0,16)}…</dd><dt>Identity</dt><dd>{vortex.vortexIdentity.slice(0,16)}…</dd><dt>Radius</dt><dd>{vortex.radius.toFixed(3)}</dd><dt>Twist</dt><dd>{vortex.twist.toFixed(3)}</dd><dt>Rotation</dt><dd>{vortex.rotation.toFixed(5)}</dd><dt>Turbulence</dt><dd>{vortex.turbulence.toFixed(3)}</dd><dt>Drivers</dt><dd>{[...new Set(vortex.drivers)].join(', ')}</dd></dl></>}</section>}
  </div>;
}

export function RenderPanel() {
  const { channels, toggleChannel } = useObserverState();
  return <div className="stack"><div className="checks">{renderChannels.map((channel) => <label key={channel.id}><input type="checkbox" checked={channels[channel.id]} onChange={() => toggleChannel(channel.id)} />{channel.label}</label>)}</div>
    <div className="legend"><span><i className="cyan" />positive</span><span><i className="magenta" />negative</span><span><i className="gold" />condensed</span><span><i className="ghost" />recent event</span></div>
    <small>Solid geometry is current state. Fading geometry is recent observer-only activity.</small>
  </div>;
}
