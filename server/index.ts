import { createServer, type Server } from 'node:http';
import { resolve } from 'node:path';
import { CommandRouter } from './commands/command-router';
import { createGenesisState } from './law/entities';
import { createLawV1Manifest } from './law/manifest';
import { McpSocket } from './mcp/mcp-socket';
import { AuthoritativeRuntime } from './runtime/authoritative-runtime';
import { SimulationWorkerHost } from './runtime/simulation-worker-host';
import { VisualLabService } from './visual-lab/service';
import { RuntimeWebSocketServer } from './websocket/websocket-server';

export interface RuntimeStack {
  runtime: AuthoritativeRuntime;
  worker: SimulationWorkerHost;
  http: Server;
  websocket: RuntimeWebSocketServer;
  mcp: McpSocket;
  onShutdownRequested(listener: () => void): void;
  stop(): Promise<void>;
}

async function closeHttp(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
}

export async function startRuntimeStack(
  port = 8787,
  instanceId = 'direct-runtime',
  saveDirectory?: string,
  observerDirectory?: string,
): Promise<RuntimeStack> {
  const manifest = createLawV1Manifest();
  const worker = new SimulationWorkerHost();
  let http: Server | undefined;
  let websocket: RuntimeWebSocketServer | undefined;

  try {
    const initialSummary = await worker.start(createGenesisState(manifest));
    const visualLab = await VisualLabService.create(resolve(observerDirectory ?? resolve('.hru-data', 'observer'), 'visual-lab.json'));
    const runtime = new AuthoritativeRuntime(worker, initialSummary, manifest, saveDirectory, visualLab);
    let shutdownRequested: (() => void) | undefined;

    http = createServer((request, response) => {
      if (request.method === 'POST' && request.url === '/control/shutdown') {
        if (request.headers['x-hru-instance'] !== instanceId) {
          response.writeHead(403);
          response.end('Forbidden');
          return;
        }
        response.writeHead(202, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ status: 'stopping' }));
        setImmediate(() => shutdownRequested?.());
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ service: 'HRU runtime', status: 'running', pid: process.pid, instanceId }));
    });
    await new Promise<void>((resolveListen, reject) => {
      const onError = (error: Error) => reject(error);
      http!.once('error', onError);
      http!.listen(port, '127.0.0.1', () => {
        http!.off('error', onError);
        resolveListen();
      });
    });

    websocket = new RuntimeWebSocketServer(http, new CommandRouter(runtime));
    runtime.on('summary', (summary) => websocket!.broadcast(summary));
    runtime.on('observation-events', (events, generation) => websocket!.broadcastEvents(events, generation));
    runtime.on('visual-state', (state) => websocket!.broadcastVisualState(state));
    runtime.on('activity', (event) => websocket!.broadcastActivity(event));
    runtime.start();
    const mcp = new McpSocket(runtime);
    let stopped = false;

    return {
      runtime,
      worker,
      http,
      websocket,
      mcp,
      onShutdownRequested(listener) { shutdownRequested = listener; },
      async stop() {
        if (stopped) return;
        stopped = true;
        runtime.stop();
        await websocket!.close();
        await worker.stop();
        await closeHttp(http!);
      },
    };
  } catch (error) {
    await websocket?.close().catch(() => undefined);
    if (http) await closeHttp(http).catch(() => undefined);
    await worker.stop().catch(() => undefined);
    throw error;
  }
}
