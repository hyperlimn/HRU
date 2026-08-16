import type { Command, CommandResult, ClientMessage, Query, QueryResult, ServerMessage } from '../protocol';
import type { RuntimeSummary } from '../../core/state';
import type { SequencedRelationshipEvent } from '../../observer/observation-types';
import type { VisualLabState } from '../../visual-lab/types';

type SummaryListener = (summary: RuntimeSummary) => void;
type ConnectionListener = (connected: boolean) => void;
type EventListener = (batch: { readonly generation: number; readonly events: readonly SequencedRelationshipEvent[] }) => void;
type VisualStateListener = (state: VisualLabState) => void;

export class BrowserRuntimeClient {
  private socket?: WebSocket;
  private readonly summaryListeners = new Set<SummaryListener>();
  private readonly connectionListeners = new Set<ConnectionListener>();
  private readonly eventListeners = new Set<EventListener>();
  private readonly visualStateListeners = new Set<VisualStateListener>();
  private readonly pending = new Map<string, (result: CommandResult | QueryResult) => void>();
  private sequence = 0;

  connect(): void {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    this.socket = new WebSocket(`${protocol}://${location.hostname}:8787/runtime`);
    this.socket.addEventListener('open', () => { this.emitConnection(true); this.query({ type: 'universe/state' }); });
    this.socket.addEventListener('close', () => {
      this.emitConnection(false);
      for (const resolve of this.pending.values()) resolve({ ok: false, message: 'Runtime disconnected' });
      this.pending.clear();
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as ServerMessage;
      if (message.kind === 'summary') this.summaryListeners.forEach((listener) => listener(message.payload));
      if (message.kind === 'observation-events') this.eventListeners.forEach((listener) => listener(message.payload));
      if (message.kind === 'visual-state') this.visualStateListeners.forEach((listener) => listener(message.payload));
      if (message.kind === 'response') { this.pending.get(message.requestId)?.(message.payload); this.pending.delete(message.requestId); }
      if (message.kind === 'response' && message.payload.ok && 'data' in message.payload) {
        const data = message.payload.data as Partial<RuntimeSummary> | undefined;
        if (data?.manifest && typeof data.tick === 'number' && typeof data.stateDigest === 'string') this.summaryListeners.forEach((listener) => listener(data as RuntimeSummary));
      }
    });
  }

  disconnect(): void { this.socket?.close(); }
  command(payload: Command): Promise<CommandResult> { return this.request('command', payload) as Promise<CommandResult>; }
  query(payload: Query): Promise<QueryResult> { return this.request('query', payload) as Promise<QueryResult>; }
  onSummary(listener: SummaryListener): () => void { this.summaryListeners.add(listener); return () => this.summaryListeners.delete(listener); }
  onConnection(listener: ConnectionListener): () => void { this.connectionListeners.add(listener); return () => this.connectionListeners.delete(listener); }
  onEvents(listener: EventListener): () => void { this.eventListeners.add(listener); return () => this.eventListeners.delete(listener); }
  onVisualState(listener: VisualStateListener): () => void { this.visualStateListeners.add(listener); return () => this.visualStateListeners.delete(listener); }
  private send(message: ClientMessage): void { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message)); }
  private request(kind: 'command' | 'query', payload: Command | Query): Promise<CommandResult | QueryResult> {
    if (this.socket?.readyState !== WebSocket.OPEN) return Promise.resolve({ ok: false, message: 'Runtime is not connected' });
    const requestId = this.id();
    return new Promise((resolve) => { this.pending.set(requestId, resolve); this.send({ kind, requestId, payload } as ClientMessage); });
  }
  private emitConnection(connected: boolean): void { this.connectionListeners.forEach((listener) => listener(connected)); }
  private id(): string { this.sequence += 1; return `browser-${this.sequence}`; }
}
