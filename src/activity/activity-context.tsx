import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityBuffer,
  type ActivityEvent,
  type ActivityEventDraft,
} from "./activity-events";

interface ActivityContextValue {
  readonly events: readonly ActivityEvent[];
  readonly retention: number;
  record(event: ActivityEventDraft): void;
  ingest(event: ActivityEvent): void;
  clear(): void;
  setRetention(retention: number): void;
}

const ActivityContext = createContext<ActivityContextValue | undefined>(
  undefined,
);

export function ActivityProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const buffer = useRef(new ActivityBuffer());
  const [events, setEvents] = useState<readonly ActivityEvent[]>([]);
  const [retention, setRetentionState] = useState(
    buffer.current.getRetention(),
  );
  const publish = useCallback(
    () => setEvents([...buffer.current.snapshot()]),
    [],
  );
  const record = useCallback(
    (event: ActivityEventDraft) => {
      buffer.current.append(event);
      publish();
    },
    [publish],
  );
  const ingest = useCallback(
    (event: ActivityEvent) => {
      buffer.current.ingest(event);
      publish();
    },
    [publish],
  );
  const clear = useCallback(() => {
    buffer.current.clear();
    publish();
  }, [publish]);
  const setRetention = useCallback(
    (value: number) => {
      buffer.current.setRetention(value);
      setRetentionState(value);
      publish();
    },
    [publish],
  );
  const value = useMemo(
    () => ({ events, retention, record, ingest, clear, setRetention }),
    [events, retention, record, ingest, clear, setRetention],
  );
  return (
    <ActivityContext.Provider value={value}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity(): ActivityContextValue {
  const value = useContext(ActivityContext);
  if (!value) throw new Error("useActivity must be inside ActivityProvider");
  return value;
}
