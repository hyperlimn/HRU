import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'node:http';
import type { ClientMessage, ServerMessage } from '../../src/interface/protocol';
import type { UniverseSnapshot } from '../../src/core/state';
import { CommandRouter } from '../commands/command-router';

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
  broadcast(snapshot: UniverseSnapshot): void {
    const message = JSON.stringify({ kind: 'snapshot', payload: snapshot } satisfies ServerMessage);
    for (const client of this.server.clients) if (client.readyState === WebSocket.OPEN) client.send(message);
  }
  close(): Promise<void> { return new Promise((resolve) => this.server.close(() => resolve())); }
}
