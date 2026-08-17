import { useCallback, useEffect, useState } from "react";
import type { SaveListing } from "../../../modules/saves/save-system";
import { useVisualLab } from "../../../visual-lab/visual-lab-context";
import { MULTIPLIERS, type Multiplier } from "../../protocol";
import { useRuntime } from "../runtime-context";
import type { DimensionID } from "../../../shared/ids";

export function UniversePanel() {
  const { summary } = useRuntime();
  return (
    <dl>
      <dt>Universe</dt>
      <dd>{summary?.manifest.universeId ?? "Connecting…"}</dd>
      <dt>Law</dt>
      <dd>{summary?.manifest.lawVersion ?? "—"}</dd>
      <dt>Entities</dt>
      <dd>{summary?.entityCount.toLocaleString() ?? "—"}</dd>
      <dt>Bonds</dt>
      <dd>{summary?.totalBondCount.toLocaleString() ?? "—"}</dd>
      <dt>Positive</dt>
      <dd>{summary?.activePositiveBondCount.toLocaleString() ?? "—"}</dd>
      <dt>Repulsions</dt>
      <dd>{summary?.activeRepulsionCount.toLocaleString() ?? "—"}</dd>
      <dt>Clusters</dt>
      <dd>{summary?.clusterCount.toLocaleString() ?? "—"}</dd>
      <dt>Largest cluster</dt>
      <dd>{summary?.largestClusterSize.toLocaleString() ?? "—"}</dd>
      <dt>Condensed</dt>
      <dd>{summary?.condensedEntityCount.toLocaleString() ?? "—"}</dd>
      <dt>Injected</dt>
      <dd>{summary?.injectedEntityCount.toLocaleString() ?? "—"}</dd>
    </dl>
  );
}
export function TimePanel() {
  const { summary, command } = useRuntime();
  const running = summary?.running ?? false;
  return (
    <div className="time-instrument">
      <span className="time-tick-label">TICK</span>
      <output className="time-tick">
        {summary?.tick.toLocaleString() ?? "—"}
      </output>
      <div className="time-status">
        <button
          className={running ? "time-running active" : "time-running"}
          onClick={() =>
            command({ type: "time/set-running", running: !running })
          }
        >
          {running ? "Running" : "Paused"}
        </button>
        <label>
          <span className="sr-only">Requested multiplier</span>
          <select
            value={summary?.requestedMultiplier ?? 1}
            onChange={(event) =>
              command({
                type: "time/set-multiplier",
                multiplier: Number(event.target.value) as Multiplier,
              })
            }
          >
            {MULTIPLIERS.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
      </div>
      <output className="time-throughput">
        {summary?.actualTicksPerSecond.toFixed(0) ?? "—"} ticks/sec
      </output>
    </div>
  );
}
export function DimensionsPanel() {
  const { summary, connected, query, command } = useRuntime();
  const [dimensions, setDimensions] = useState<
    readonly { readonly id: DimensionID; readonly label: string }[]
  >([]);
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (connected)
      void query({ type: "dimensions/list" }).then((result) => {
        if (result.ok)
          setDimensions(
            result.data as readonly { id: DimensionID; label: string }[],
          );
        else setStatus(result.message ?? "Could not load dimensions");
      });
  }, [connected, query]);
  return (
    <div className="stack">
      <label className="field-label">
        Observation dimension
        <select
          value={summary?.activeDimension ?? "dimension-0"}
          onChange={async (event) => {
            const result = await command({
              type: "dimensions/select",
              dimensionId: event.target.value as DimensionID,
            });
            setStatus(
              result.ok
                ? `Active dimension: ${event.target.value}`
                : (result.message ?? "Dimension change failed"),
            );
          }}
        >
          {dimensions.length ? (
            dimensions.map((dimension) => (
              <option key={dimension.id} value={dimension.id}>
                {dimension.label}
              </option>
            ))
          ) : (
            <option value="dimension-0">Dimension 0</option>
          )}
        </select>
      </label>
      {status && <output className="save-status">{status}</output>}
      <small>A deterministic lens on the canonical universe.</small>
    </div>
  );
}
export function SavesPanel() {
  const { command, query, connected } = useRuntime();
  const [saves, setSaves] = useState<readonly SaveListing[]>([]);
  const [status, setStatus] = useState("");
  const refresh = useCallback(async () => {
    const result = await query({ type: "saves/list" });
    if (result.ok)
      setSaves((result.data as readonly SaveListing[]).slice().reverse());
    else setStatus(result.message ?? "Could not load saves");
  }, [query]);
  useEffect(() => {
    if (connected) void refresh();
  }, [connected, refresh]);
  const saveCurrent = async () => {
    setStatus("Saving…");
    const result = await command({ type: "saves/save-current" });
    setStatus(
      result.ok
        ? (result.message ?? "Save complete")
        : (result.message ?? "Save failed"),
    );
    await refresh();
  };
  const resume = async (save: SaveListing) => {
    setStatus(`Resuming tick ${save.tick}…`);
    const result = await command({ type: "saves/resume", snapshotId: save.id });
    setStatus(
      result.ok
        ? (result.message ?? "Resume complete")
        : (result.message ?? "Resume failed"),
    );
    await refresh();
  };
  return (
    <div className="stack">
      <button onClick={() => void saveCurrent()}>Save current state</button>
      {status && (
        <div className="save-status" role="status">
          {status}
        </div>
      )}
      <div className="save-list">
        {saves.length === 0 ? (
          <small>No saves yet.</small>
        ) : (
          saves.map((save) => (
            <div className="save-row" key={save.id}>
              <div>
                <strong>{save.kind}</strong>
                <span>Tick {save.tick.toLocaleString()}</span>
              </div>
              <button onClick={() => void resume(save)}>Resume</button>
            </div>
          ))
        )}
      </div>
      <small>Autosaves: every 100,000 ticks · 3 rolling slots</small>
    </div>
  );
}
export function LaboratoryPanel() {
  const { connected, query } = useRuntime();
  const [experiments, setExperiments] = useState<
    readonly { readonly id: string; readonly label: string }[]
  >([]);
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!connected) return;
    void query({ type: "laboratory/list" }).then((result) => {
      if (result.ok)
        setExperiments(result.data as readonly { id: string; label: string }[]);
      else setStatus(result.message ?? "Laboratory unavailable");
    });
  }, [connected, query]);
  if (status) return <p className="warning">{status}</p>;
  if (experiments.length === 0)
    return (
      <p>Experiment socket available. No experiment modules are registered.</p>
    );
  return (
    <div className="stack">
      {experiments.map((experiment) => (
        <div key={experiment.id}>
          <strong>{experiment.label}</strong>
          <small>{experiment.id}</small>
        </div>
      ))}
    </div>
  );
}
export function MachinePanel() {
  return (
    <dl>
      <dt>Shared RuntimePort</dt>
      <dd className="online">Available</dd>
      <dt>WebSocket transport</dt>
      <dd className="online">Available</dd>
      <dt>MCP transport</dt>
      <dd>Not exposed</dd>
    </dl>
  );
}
export function SystemPanel() {
  const { connected, summary } = useRuntime();
  return (
    <>
      <dl>
        <dt>Runtime</dt>
        <dd className={connected ? "online" : "offline"}>
          {connected ? "Connected" : "Offline"}
        </dd>
        <dt>Render FPS</dt>
        <dd>
          <RenderFps />
        </dd>
        <dt>Autosave</dt>
        <dd>{summary?.autosaveStatus ?? "—"}</dd>
        <dt>Last autosave</dt>
        <dd>{summary?.lastAutosaveTick?.toLocaleString() ?? "—"}</dd>
      </dl>
      <label>
        State digest
        <output className="digest">{summary?.stateDigest ?? "—"}</output>
      </label>
    </>
  );
}
function RenderFps() {
  const [fps, setFps] = useState(0);
  const { state } = useVisualLab();
  useEffect(() => {
    const update = (event: Event) =>
      setFps((event as CustomEvent<number>).detail);
    window.addEventListener("hru:render-fps", update);
    return () => window.removeEventListener("hru:render-fps", update);
  }, []);
  return (
    <>{state?.values["performance.showFps"] ? fps.toFixed(0) : "hidden"}</>
  );
}
