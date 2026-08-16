import { Worker } from 'node:worker_threads';

export class SimulationWorkerHost {
  private worker?: Worker;

  async start(): Promise<void> {
    this.worker = new Worker(new URL('./simulation-worker.ts', import.meta.url));
    await new Promise<void>((resolve, reject) => {
      this.worker?.once('message', (message: { type?: string }) => message.type === 'ready' && resolve());
      this.worker?.once('error', reject);
    });
  }

  async stop(): Promise<void> { await this.worker?.terminate(); }
}
