import type { Command, CommandResult, ClientMessage, Query, QueryResult, ServerMessage } from '../protocol';
import type { RuntimeSummary } from '../../core/state';
import type { SequencedRelationshipEvent } from '../../observer/observation-types';
import type { VisualLabState } from '../../visual-lab/types';
import type { ActivityEvent } from '../../activity/activity-events';

type SummaryListener = (summary: RuntimeSummary) => void;
type ConnectionListener = (connected: boolean) => void;
type EventListener = (batch: { readonly generation: number; readonly events: readonly SequencedRelationshipEvent[] }) => void;
type VisualStateListener = (state: VisualLabState) => void;
type ActivityListener = (event: ActivityEvent) => void;
interface PendingRequest { readonly resolve: (result: CommandResult | QueryResult) => void; readonly timeout: number }

const REQUEST_TIMEOUT_MS = 10_000;

export class BrowserRuntimeClient {
  private socket?: WebSocket;
  private readonly summaryListeners = new Set<SummaryListener>();
  private readonly connectionListeners = new Set<ConnectionListener>();
  private readonly eventListeners = new Set<EventListener>();
  private readonly visualStateListeners = new Set<VisualStateListener>();
  private readonly activityListeners = new Set<ActivityListener>();
  private readonly pending = new Map<string, PendingRequest>();
  private sequence = 0;

  connect(): void {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${location.hostname}:8787/runtime`);
    this.socket = socket;
    socket.addEventListener('open', () => { if (this.socket !== socket) return; this.emitConnection(true); void this.query({ type: 'universe/state' }); });
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      this.emitConnection(false);
      this.settlePending({ ok: false, message: 'Runtime disconnected' });
    });
    socket.addEventListener('message', (event) => {
      if (this.socket !== socket) return;
      let message: ServerMessage;
      try { message = JSON.parse(String(event.data)) as ServerMessage; }
      catch { return; }
      if (message.kind === 'summary') this.summaryListeners.forEach((listener) => listener(message.payload));
      if (message.kind === 'observation-events') this.eventListeners.forEach((listener) => listener(message.payload));
      if (message.kind === 'visual-state') this.visualStateListeners.forEach((listener) => listener(message.payload));
      if (message.kind === 'activity-event') this.activityListeners.forEach((listener) => listener(message.payload));
      if (message.kind === 'response') {
        const pending = this.pending.get(message.requestId);
        if (pending) { window.clearTimeout(pending.timeout); pending.resolve(message.payload); this.pending.delete(message.requestId); }
      }
      if (message.kind === 'response' && message.payload.ok && 'data' in message.payload) {
        const data = message.payload.data as Partial<RuntimeSummary> | undefined;
        if (data?.manifest && typeof data.tick === 'number' && typeof data.stateDigest === 'string') this.summaryListeners.forEach((listener) => listener(data as RuntimeSummary));
      }
    });
  }

  disconnect(): void { const socket = this.socket; this.socket = undefined; this.settlePending({ ok: false, message: 'Runtime client closed' }); socket?.close(); }
  command(payload: Command): Promise<CommandResult> { return this.request('command', payload) as Promise<CommandResult>; }
  query(payload: Query): Promise<QueryResult> { return this.request('query', payload) as Promise<QueryResult>; }
  onSummary(listener: SummaryListener): () => void { this.summaryListeners.add(listener); return () => this.summaryListeners.delete(listener); }
  onConnection(listener: ConnectionListener): () => void { this.connectionListeners.add(listener); return () => this.connectionListeners.delete(listener); }
  onEvents(listener: EventListener): () => void { this.eventListeners.add(listener); return () => this.eventListeners.delete(listener); }
  onVisualState(listener: VisualStateListener): () => void { this.visualStateListeners.add(listener); return () => this.visualStateListeners.delete(listener); }
  onActivity(listener: ActivityListener): () => void { this.activityListeners.add(listener); return () => this.activityListeners.delete(listener); }
  private send(message: ClientMessage): void { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message)); }
  private request(kind: 'command' | 'query', payload: Command | Query): Promise<CommandResult | QueryResult> {
    if (this.socket?.readyState !== WebSocket.OPEN) return Promise.resolve({ ok: false, message: 'Runtime is not connected' });
    const requestId = this.id();
    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        this.pending.delete(requestId);
        resolve({ ok: false, message: `Runtime request timed out after ${REQUEST_TIMEOUT_MS / 1_000} seconds` });
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(requestId, { resolve, timeout });
      this.send({ kind, requestId, payload, ...(kind === 'command' ? { origin: 'human-ui' as const } : {}) } as ClientMessage);
    });
  }
  private settlePending(result: CommandResult | QueryResult): void { for (const pending of this.pending.values()) { window.clearTimeout(pending.timeout); pending.resolve(result); } this.pending.clear(); }
  private emitConnection(connected: boolean): void { this.connectionListeners.forEach((listener) => listener(connected)); }
  private id(): string { this.sequence += 1; return `browser-${this.sequence}`; }
}
