import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { RuntimeSummary } from "../../core/state";
import type { Command, CommandResult, Query, QueryResult } from "../protocol";
import { BrowserRuntimeClient } from "./runtime-client";
import type { SequencedRelationshipEvent } from "../../observer/observation-types";
import type { VisualLabState } from "../../visual-lab/types";
import { useActivity } from "../../activity/activity-context";

interface RuntimeContextValue {
  readonly summary?: RuntimeSummary;
  readonly connected: boolean;
  readonly pushedEvents?: {
    readonly generation: number;
    readonly events: readonly SequencedRelationshipEvent[];
  };
  readonly pushedVisualState?: VisualLabState;
  command(command: Command): Promise<CommandResult>;
  query(query: Query): Promise<QueryResult>;
}

const RuntimeContext = createContext<RuntimeContextValue | undefined>(
  undefined,
);

export function RuntimeProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const { ingest, record } = useActivity();
  const client = useMemo(() => new BrowserRuntimeClient(), []);
  const [summary, setSummary] = useState<RuntimeSummary>();
  const [connected, setConnected] = useState(false);
  const [pushedEvents, setPushedEvents] = useState<{
    readonly generation: number;
    readonly events: readonly SequencedRelationshipEvent[];
  }>();
  const [pushedVisualState, setPushedVisualState] = useState<VisualLabState>();
  useEffect(() => {
    const offSummary = client.onSummary(setSummary);
    const offConnection = client.onConnection((next) => {
      setConnected(next);
      record({
        category: "RUNTIME",
        level: next ? "info" : "warning",
        action: next ? "CONNECT" : "DISCONNECT",
        message: `runtime ${next ? "connected" : "disconnected"}`,
        origin: "runtime",
      });
    });
    const offEvents = client.onEvents(setPushedEvents);
    const offVisual = client.onVisualState(setPushedVisualState);
    const offActivity = client.onActivity(ingest);
    client.connect();
    return () => {
      offSummary();
      offConnection();
      offEvents();
      offVisual();
      offActivity();
      client.disconnect();
    };
  }, [client, ingest, record]);
  const command = useCallback(
    (value: Command) => client.command(value),
    [client],
  );
  const query = useCallback((value: Query) => client.query(value), [client]);
  const value = useMemo(
    () => ({
      summary,
      connected,
      pushedEvents,
      pushedVisualState,
      command,
      query,
    }),
    [summary, connected, pushedEvents, pushedVisualState, command, query],
  );
  return (
    <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>
  );
}

export function useRuntime(): RuntimeContextValue {
  const value = useContext(RuntimeContext);
  if (!value) throw new Error("useRuntime must be inside RuntimeProvider");
  return value;
}
