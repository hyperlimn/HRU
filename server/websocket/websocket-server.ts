import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'node:http';
import type { ClientMessage, ServerMessage } from '../../src/interface/protocol';
import type { RuntimeSummary } from '../../src/core/state';
import type { SequencedRelationshipEvent } from '../../src/observer/observation-types';
import { CommandRouter } from '../commands/command-router';
import type { VisualLabState } from '../../src/visual-lab/types';
import type { ActivityEvent } from '../../src/activity/activity-events';

export class RuntimeWebSocketServer {
  private readonly server: WebSocketServer;
  constructor(httpServer: Server, private readonly router: CommandRouter) {
    this.server = new WebSocketServer({ server: httpServer, path: '/runtime' });
    this.server.on('connection', (socket) => {
      socket.send(JSON.stringify({ kind: 'status', payload: { connected: true } } satisfies ServerMessage));
      socket.on('message', async (raw) => {
        try { socket.send(JSON.stringify(await this.router.handle(JSON.parse(raw.toString()) as ClientMessage))); }
        catch (error) { socket.send(JSON.stringify({ kind: 'response', requestId: 'invalid', payload: { ok: false, message: String(error) } } satisfies ServerMessage)); }
      });
    });
  }
  broadcast(summary: RuntimeSummary): void {
    const message = JSON.stringify({ kind: 'summary', payload: summary } satisfies ServerMessage);
    for (const client of this.server.clients) if (client.readyState === WebSocket.OPEN) client.send(message);
  }
  broadcastEvents(events: readonly SequencedRelationshipEvent[], generation: number): void {
    const message = JSON.stringify({ kind: 'observation-events', payload: { generation, events } } satisfies ServerMessage);
    for (const client of this.server.clients) if (client.readyState === WebSocket.OPEN && client.bufferedAmount < 1_000_000) client.send(message);
  }
  broadcastVisualState(state: VisualLabState): void {
    const message = JSON.stringify({ kind: 'visual-state', payload: state } satisfies ServerMessage);
    for (const client of this.server.clients) if (client.readyState === WebSocket.OPEN && client.bufferedAmount < 1_000_000) client.send(message);
  }
  broadcastActivity(event: ActivityEvent): void {
    const message = JSON.stringify({ kind: 'activity-event', payload: event } satisfies ServerMessage);
    for (const client of this.server.clients) if (client.readyState === WebSocket.OPEN && client.bufferedAmount < 1_000_000) client.send(message);
  }
  close(): Promise<void> {
    for (const client of this.server.clients) client.terminate();
    return new Promise((resolve, reject) => this.server.close((error) => error ? reject(error) : resolve()));
  }
}
