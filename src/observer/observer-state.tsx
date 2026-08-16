import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ObservationCursor, ObservationEventBatch, ObservationFrame, ObservedEntityDetail, RecentActivityCounts, RelationshipEvent, SequencedRelationshipEvent } from './observation-types';
import type { HashHex } from '../shared/ids';
import { renderChannels, type RenderChannelId } from './render-channels';
import { useRuntime } from '../interface/human/runtime-context';

export interface VisualEvent { readonly event: RelationshipEvent; readonly observedAt: number }
interface ObserverStateValue {
  readonly frame?: ObservationFrame; readonly visualEvents: readonly VisualEvent[]; readonly activity: RecentActivityCounts;
  readonly channels: Readonly<Record<RenderChannelId, boolean>>; readonly selectedHash?: HashHex; readonly selected?: ObservedEntityDetail;
  toggleChannel(id: RenderChannelId): void; select(hash?: HashHex): void;
}
const ObserverStateContext = createContext<ObserverStateValue | undefined>(undefined);
const defaults = Object.fromEntries(renderChannels.map((channel) => [channel.id, channel.defaultVisible])) as Record<RenderChannelId, boolean>;

export function ObserverStateProvider({ children }: { readonly children: ReactNode }) {
  const { connected, query, pushedEvents } = useRuntime(); const [frame, setFrame] = useState<ObservationFrame>();
  const [visualEvents, setVisualEvents] = useState<readonly VisualEvent[]>([]); const [channels, setChannels] = useState(defaults); const [selectedHash, setSelectedHash] = useState<HashHex>();
  const cursor = useRef<ObservationCursor | undefined>(undefined); const generation = useRef<number | undefined>(undefined); const known = useRef(new Set<string>()); const polling = useRef(false);
  const ingest = useCallback((events: readonly SequencedRelationshipEvent[], nextGeneration: number) => {
    if (generation.current !== nextGeneration) { generation.current = nextGeneration; known.current.clear(); setVisualEvents([]); }
    const now = performance.now(); const additions = events.filter(({ event }) => !known.current.has(event.eventId));
    additions.forEach(({ event }) => known.current.add(event.eventId));
    if (additions.length) setVisualEvents((current) => [...current, ...additions.map(({ event }) => ({ event, observedAt: now }))].slice(-512));
  }, []);
  useEffect(() => { if (pushedEvents) ingest(pushedEvents.events, pushedEvents.generation); }, [pushedEvents, ingest]);
  useEffect(() => {
    if (!connected) { cursor.current = undefined; generation.current = undefined; return; }
    let active = true;
    const poll = async () => {
      if (polling.current) return; polling.current = true;
      try {
        const [frameResult, eventResult] = await Promise.all([query({ type: 'observation/frame' }), query({ type: 'observation/events', ...(cursor.current ? { cursor: cursor.current } : {}), limit: 512 })]);
        if (!active) return;
        if (frameResult.ok) setFrame(frameResult.data as ObservationFrame);
        if (eventResult.ok) { const batch = eventResult.data as ObservationEventBatch; cursor.current = batch.nextCursor; ingest(batch.events, batch.generation); }
      } finally { polling.current = false; }
    };
    void poll(); const timer = window.setInterval(() => void poll(), 250); return () => { active = false; window.clearInterval(timer); };
  }, [connected, query, ingest]);
  const selected = useMemo(() => {
    if (!frame || !selectedHash) return undefined; const entity = frame.entities.find((item) => item.hash === selectedHash); if (!entity) return undefined;
    const cluster = frame.clusters.find((item) => item.memberHashes.includes(selectedHash));
    const bonds = frame.bonds.filter((bond) => bond.low === selectedHash || bond.high === selectedHash).map((bond) => ({ ...bond, neighborHash: bond.low === selectedHash ? bond.high : bond.low }));
    return { ...entity, ...(cluster ? { cluster } : {}), bonds };
  }, [frame, selectedHash]);
  const activity = useMemo(() => countActivity(visualEvents.map(({ event }) => event)), [visualEvents]);
  const toggleChannel = useCallback((id: RenderChannelId) => setChannels((value) => ({ ...value, [id]: !value[id] })), []);
  const select = useCallback((hash?: HashHex) => setSelectedHash(hash), []);
  const value = useMemo(() => ({ frame, visualEvents, activity, channels, selectedHash, selected, toggleChannel, select }), [frame, visualEvents, activity, channels, selectedHash, selected, toggleChannel, select]);
  return <ObserverStateContext.Provider value={value}>{children}</ObserverStateContext.Provider>;
}

export function useObserverState(): ObserverStateValue { const value = useContext(ObserverStateContext); if (!value) throw new Error('useObserverState must be inside ObserverStateProvider'); return value; }

export function countActivity(events: readonly RelationshipEvent[]): RecentActivityCounts {
  const count = (types: readonly RelationshipEvent['type'][]) => events.filter((event) => types.includes(event.type)).length;
  return { positiveCreated: count(['positive-bond-created']), negativeCreated: count(['negative-bond-created']), dissolved: count(['bond-dissolved']), activeTransitions: count(['bond-became-active-positive', 'bond-became-active-repulsion', 'bond-left-active-positive', 'bond-left-active-repulsion']), clustersFormed: count(['cluster-formed']), clustersDissolved: count(['cluster-dissolved']), injections: count(['entity-injected']), condensations: count(['entity-condensed']) };
}
