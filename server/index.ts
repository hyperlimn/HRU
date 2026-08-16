import { createServer, type Server } from 'node:http';
import { AuthoritativeRuntime } from './runtime/authoritative-runtime';
import { SimulationWorkerHost } from './runtime/simulation-worker-host';
import { CommandRouter } from './commands/command-router';
import { RuntimeWebSocketServer } from './websocket/websocket-server';
import { McpSocket } from './mcp/mcp-socket';
import { createLawV1Manifest } from './law/manifest';
import { createGenesisState } from './law/entities';

export interface RuntimeStack { runtime: AuthoritativeRuntime; worker: SimulationWorkerHost; http: Server; websocket: RuntimeWebSocketServer; mcp: McpSocket; onShutdownRequested(listener: () => void): void; stop(): Promise<void> }

export async function startRuntimeStack(port = 8787, instanceId = 'direct-runtime'): Promise<RuntimeStack> {
  const manifest = createLawV1Manifest();
  const worker = new SimulationWorkerHost();
  const initialSummary = await worker.start(createGenesisState(manifest));
  const runtime = new AuthoritativeRuntime(worker, initialSummary, manifest);
  let shutdownRequested: (() => void) | undefined;
  const http = createServer((request, response) => {
    if (request.method === 'POST' && request.url === '/control/shutdown') {
      if (request.headers['x-hru-instance'] !== instanceId) { response.writeHead(403); response.end('Forbidden'); return; }
      response.writeHead(202, { 'content-type': 'application/json' }); response.end(JSON.stringify({ status: 'stopping' }));
      setImmediate(() => shutdownRequested?.()); return;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ service: 'HRU runtime', status: 'running', pid: process.pid, instanceId }));
  });
  await new Promise<void>((resolve, reject) => { http.once('error', reject); http.listen(port, '127.0.0.1', resolve); });
  const websocket = new RuntimeWebSocketServer(http, new CommandRouter(runtime));
  runtime.on('summary', (summary) => websocket.broadcast(summary));
  runtime.start();
  const mcp = new McpSocket(runtime);
  return { runtime, worker, http, websocket, mcp, onShutdownRequested: (listener) => { shutdownRequested = listener; }, stop: async () => {
    runtime.stop(); await websocket.close(); await worker.stop(); await new Promise<void>((resolve) => http.close(() => resolve()));
  } };
}
