import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { RuntimeSummary } from '../../core/state';
import type { Command, CommandResult, Query, QueryResult } from '../protocol';
import { BrowserRuntimeClient } from './runtime-client';

interface RuntimeContextValue {
  readonly summary?: RuntimeSummary;
  readonly connected: boolean;
  command(command: Command): Promise<CommandResult>;
  query(query: Query): Promise<QueryResult>;
}

const RuntimeContext = createContext<RuntimeContextValue | undefined>(undefined);

export function RuntimeProvider({ children }: { readonly children: ReactNode }) {
  const client = useMemo(() => new BrowserRuntimeClient(), []);
  const [summary, setSummary] = useState<RuntimeSummary>();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const offSummary = client.onSummary(setSummary);
    const offConnection = client.onConnection(setConnected);
    client.connect();
    return () => { offSummary(); offConnection(); client.disconnect(); };
  }, [client]);
  const command = useCallback((value: Command) => client.command(value), [client]);
  const query = useCallback((value: Query) => client.query(value), [client]);
  const value = useMemo(() => ({ summary, connected, command, query }), [summary, connected, command, query]);
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function useRuntime(): RuntimeContextValue {
  const value = useContext(RuntimeContext);
  if (!value) throw new Error('useRuntime must be inside RuntimeProvider');
  return value;
}
