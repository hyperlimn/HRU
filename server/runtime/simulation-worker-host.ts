import { EventEmitter } from 'node:events';
import { Worker } from 'node:worker_threads';
import type { AuthoritativeUniverseState, RuntimeSummary } from '../../src/core/state';
import type { Multiplier } from '../../src/interface/protocol';
import type { WorkerRequest, WorkerResponse } from './worker-protocol';

export class SimulationWorkerHost extends EventEmitter {
  private worker?: Worker;
  private sequence = 0;
  private readonly pending = new Map<string, { resolve(value: AuthoritativeUniverseState | RuntimeSummary | undefined): void; reject(error: Error): void }>();

  async start(state: AuthoritativeUniverseState): Promise<RuntimeSummary> {
    this.worker = new Worker(new URL('./simulation-worker-bootstrap.mjs', import.meta.url));
    this.worker.on('message', (message: WorkerResponse) => this.handle(message));
    this.worker.on('error', (error) => { const failure = error instanceof Error ? error : new Error(String(error)); for (const request of this.pending.values()) request.reject(failure); this.pending.clear(); if (this.listenerCount('error') > 0) this.emit('error', failure); });
    await new Promise<void>((resolve, reject) => { this.worker?.once('message', (message: WorkerResponse) => message.type === 'ready' && resolve()); this.worker?.once('error', reject); });
    return this.request<RuntimeSummary>({ type: 'initialize', requestId: this.id(), state });
  }

  setRunning(running: boolean): Promise<RuntimeSummary> { return this.request({ type: 'set-running', requestId: this.id(), running }); }
  setMultiplier(multiplier: Multiplier): Promise<RuntimeSummary> { return this.request({ type: 'set-multiplier', requestId: this.id(), multiplier }); }
  getState(): Promise<AuthoritativeUniverseState> { return this.request({ type: 'get-state', requestId: this.id() }); }
  getSummary(): Promise<RuntimeSummary> { return this.request({ type: 'get-summary', requestId: this.id() }); }
  replaceState(state: AuthoritativeUniverseState): Promise<RuntimeSummary> { return this.request({ type: 'replace-state', requestId: this.id(), state }); }
  async stop(): Promise<void> { for (const request of this.pending.values()) request.reject(new Error('Worker stopped')); this.pending.clear(); await this.worker?.terminate(); }

  private request<T extends AuthoritativeUniverseState | RuntimeSummary>(request: WorkerRequest): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.set(request.requestId, { resolve: (value) => resolve(value as T), reject });
      this.worker?.postMessage(request);
    });
  }

  private handle(message: WorkerResponse): void {
    if (message.type === 'summary') this.emit('summary', message.summary);
    else if (message.type === 'autosave-boundary') this.emit('autosave-boundary', message.state);
    else if (message.type === 'response') {
      const pending = this.pending.get(message.requestId); if (!pending) return; this.pending.delete(message.requestId);
      if (message.ok) pending.resolve(message.data); else pending.reject(new Error(message.message));
    }
  }
  private id(): string { this.sequence += 1; return `worker-${this.sequence}`; }
}
