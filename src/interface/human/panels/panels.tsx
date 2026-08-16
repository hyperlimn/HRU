import { useCallback, useEffect, useState } from 'react';
import { MULTIPLIERS, type Multiplier } from '../../protocol';
import { useRuntime } from '../runtime-context';
import type { SaveListing } from '../../../modules/saves/save-system';

export function UniversePanel() { const { summary } = useRuntime(); return <dl><dt>Universe</dt><dd>{summary?.manifest.universeId ?? 'Connecting…'}</dd><dt>Law</dt><dd>{summary?.manifest.lawVersion ?? '—'}</dd><dt>Entities</dt><dd>{summary?.entityCount.toLocaleString() ?? '—'}</dd><dt>Bonds</dt><dd>{summary?.totalBondCount.toLocaleString() ?? '—'}</dd><dt>Positive</dt><dd>{summary?.activePositiveBondCount.toLocaleString() ?? '—'}</dd><dt>Repulsions</dt><dd>{summary?.activeRepulsionCount.toLocaleString() ?? '—'}</dd><dt>Clusters</dt><dd>{summary?.clusterCount.toLocaleString() ?? '—'}</dd><dt>Largest cluster</dt><dd>{summary?.largestClusterSize.toLocaleString() ?? '—'}</dd><dt>Condensed</dt><dd>{summary?.condensedEntityCount.toLocaleString() ?? '—'}</dd><dt>Injected</dt><dd>{summary?.injectedEntityCount.toLocaleString() ?? '—'}</dd></dl>; }
export function TimePanel() {
  const { summary, command } = useRuntime();
  const running = summary?.running ?? false;
  return <div className="stack"><button className="primary" onClick={() => command({ type: 'time/set-running', running: !running })}>{running ? 'Pause' : 'Run'}</button>
    <dl><dt>Current tick</dt><dd>{summary?.tick.toLocaleString() ?? '—'}</dd><dt>Actual ticks/sec</dt><dd>{summary?.actualTicksPerSecond.toFixed(0) ?? '—'}</dd></dl>
    <label>Requested multiplier<select value={summary?.requestedMultiplier ?? 1} onChange={(event) => command({ type: 'time/set-multiplier', multiplier: Number(event.target.value) as Multiplier })}>{MULTIPLIERS.map((value) => <option key={value} value={value}>{value}×</option>)}</select></label></div>;
}
export function DimensionsPanel() { const { summary } = useRuntime(); return <><p>{summary?.activeDimension ?? 'dimension-0'}</p><small>A deterministic lens on the canonical universe.</small></>; }
export function SavesPanel() {
  const { command, query, connected } = useRuntime();
  const [saves, setSaves] = useState<readonly SaveListing[]>([]);
  const [status, setStatus] = useState('');
  const refresh = useCallback(async () => {
    const result = await query({ type: 'saves/list' });
    if (result.ok) setSaves((result.data as readonly SaveListing[]).slice().reverse());
    else setStatus(result.message ?? 'Could not load saves');
  }, [query]);
  useEffect(() => { if (connected) void refresh(); }, [connected, refresh]);
  const saveCurrent = async () => {
    setStatus('Saving...'); const result = await command({ type: 'saves/save-current' });
    setStatus(result.ok ? result.message ?? 'Save complete' : result.message ?? 'Save failed'); await refresh();
  };
  const resume = async (save: SaveListing) => {
    setStatus(`Resuming tick ${save.tick}...`); const result = await command({ type: 'saves/resume', snapshotId: save.id });
    setStatus(result.ok ? result.message ?? 'Resume complete' : result.message ?? 'Resume failed'); await refresh();
  };
  return <div className="stack">
    <button onClick={() => void saveCurrent()}>Save current state</button>
    {status && <div className="save-status" role="status">{status}</div>}
    <div className="save-list">{saves.length === 0 ? <small>No saves yet.</small> : saves.map((save) => <div className="save-row" key={save.id}>
      <div><strong>{save.kind}</strong><span>Tick {save.tick.toLocaleString()}</span></div>
      <button onClick={() => void resume(save)}>Resume</button>
    </div>)}</div>
    <small>Autosaves: every 100,000 ticks · 3 rolling slots</small>
  </div>;
}
export function LaboratoryPanel() { return <p>Experiment socket ready. Experiments will receive isolated snapshot forks.</p>; }
export function MachinePanel() { return <p>Shared command/query port ready. MCP transport placeholder.</p>; }
export function SystemPanel() { const { connected, summary } = useRuntime(); return <><dl><dt>Runtime</dt><dd className={connected ? 'online' : 'offline'}>{connected ? 'Connected' : 'Offline'}</dd><dt>Render FPS</dt><dd><RenderFps /></dd><dt>Autosave</dt><dd>{summary?.autosaveStatus ?? '—'}</dd><dt>Last autosave</dt><dd>{summary?.lastAutosaveTick?.toLocaleString() ?? '—'}</dd></dl><label>State digest<output className="digest">{summary?.stateDigest ?? '—'}</output></label></>; }
function RenderFps() { const [fps, setFps] = useState(0); useEffect(() => { const update = (event: Event) => setFps((event as CustomEvent<number>).detail); window.addEventListener('hru:render-fps', update); return () => window.removeEventListener('hru:render-fps', update); }, []); return <>{fps.toFixed(0)}</>; }
