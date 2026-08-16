import { parentPort } from 'node:worker_threads';

if (!parentPort) throw new Error('Simulation worker requires a parent port');
parentPort.postMessage({ type: 'ready' });
parentPort.on('message', (message: { type: string }) => {
  if (message.type === 'ping') parentPort?.postMessage({ type: 'pong' });
});
