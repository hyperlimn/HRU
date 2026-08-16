import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { RuntimeSummary } from '../../core/state';
import type { Command, CommandResult, Query, QueryResult } from '../protocol';
import { BrowserRuntimeClient } from './runtime-client';
import type { SequencedRelationshipEvent } from '../../observer/observation-types';

interface RuntimeContextValue {
  readonly summary?: RuntimeSummary;
  readonly connected: boolean;
  readonly pushedEvents?: { readonly generation: number; readonly events: readonly SequencedRelationshipEvent[] };
  command(command: Command): Promise<CommandResult>;
  query(query: Query): Promise<QueryResult>;
}

const RuntimeContext = createContext<RuntimeContextValue | undefined>(undefined);

export function RuntimeProvider({ children }: { readonly children: ReactNode }) {
  const client = useMemo(() => new BrowserRuntimeClient(), []);
  const [summary, setSummary] = useState<RuntimeSummary>();
  const [connected, setConnected] = useState(false);
  const [pushedEvents, setPushedEvents] = useState<{ readonly generation: number; readonly events: readonly SequencedRelationshipEvent[] }>();
  useEffect(() => {
    const offSummary = client.onSummary(setSummary);
    const offConnection = client.onConnection(setConnected);
    const offEvents = client.onEvents(setPushedEvents);
    client.connect();
    return () => { offSummary(); offConnection(); offEvents(); client.disconnect(); };
  }, [client]);
  const command = useCallback((value: Command) => client.command(value), [client]);
  const query = useCallback((value: Query) => client.query(value), [client]);
  const value = useMemo(() => ({ summary, connected, pushedEvents, command, query }), [summary, connected, pushedEvents, command, query]);
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function useRuntime(): RuntimeContextValue {
  const value = useContext(RuntimeContext);
  if (!value) throw new Error('useRuntime must be inside RuntimeProvider');
  return value;
}
