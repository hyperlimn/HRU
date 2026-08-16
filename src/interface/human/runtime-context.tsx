import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UniverseSnapshot } from '../../core/state';
import type { Command, CommandResult, Query, QueryResult } from '../protocol';
import { BrowserRuntimeClient } from './runtime-client';

interface RuntimeContextValue {
  readonly snapshot?: UniverseSnapshot;
  readonly connected: boolean;
  command(command: Command): Promise<CommandResult>;
  query(query: Query): Promise<QueryResult>;
}

const RuntimeContext = createContext<RuntimeContextValue | undefined>(undefined);

export function RuntimeProvider({ children }: { readonly children: ReactNode }) {
  const client = useMemo(() => new BrowserRuntimeClient(), []);
  const [snapshot, setSnapshot] = useState<UniverseSnapshot>();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const offSnapshot = client.onSnapshot(setSnapshot);
    const offConnection = client.onConnection(setConnected);
    client.connect();
    return () => { offSnapshot(); offConnection(); client.disconnect(); };
  }, [client]);
  const command = useCallback((value: Command) => client.command(value), [client]);
  const query = useCallback((value: Query) => client.query(value), [client]);
  const value = useMemo(() => ({ snapshot, connected, command, query }), [snapshot, connected, command, query]);
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function useRuntime(): RuntimeContextValue {
  const value = useContext(RuntimeContext);
  if (!value) throw new Error('useRuntime must be inside RuntimeProvider');
  return value;
}
