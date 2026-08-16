import { writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer as createViteServer } from 'vite';
import { startRuntimeStack } from '../server/index';

const PID_FILE = resolve('.hru-dev.pid');

async function main(): Promise<void> {
  const instanceId = randomUUID();
  const runtimeStack = await startRuntimeStack(
    8787,
    instanceId,
    process.env.HRU_DATA_DIR ? resolve(process.env.HRU_DATA_DIR) : undefined,
    process.env.HRU_OBSERVER_DATA_DIR ? resolve(process.env.HRU_OBSERVER_DATA_DIR) : undefined,
  );
  let vite;
  try {
    vite = await createViteServer({ server: { port: 5173, strictPort: true } });
    await vite.listen();
    await writeFile(PID_FILE, JSON.stringify({ pid: process.pid, marker: 'HRU_DEV_STACK', instanceId }), 'utf8');
  } catch (error) {
    await runtimeStack.stop();
    throw error;
  }

  console.log('\nHRU\n');
  console.log('RUNTIME      RUNNING');
  console.log('SIM WORKER   RUNNING');
  console.log('WEB UI       RUNNING  http://localhost:5173');
  console.log('WEBSOCKET    READY    ws://localhost:8787/runtime');
  console.log(`MCP          ${runtimeStack.mcp.status}`);
  console.log('SAVE STORE   READY');
  console.log(`MODULES      ${runtimeStack.runtime.modules.size} loaded\n`);

  let stopping = false;
  const stop = async () => {
    if (stopping) return; stopping = true;
    console.log('\nHRU          STOPPING');
    const results = await Promise.allSettled([vite.close(), runtimeStack.stop()]);
    await unlink(PID_FILE).catch(() => undefined);
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length > 0) { console.error('HRU          STOPPED WITH CLEANUP ERRORS', failures); process.exitCode = 1; }
    else console.log('HRU          STOPPED');
  };
  runtimeStack.onShutdownRequested(() => void stop());
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
}

main().catch(async (error) => { console.error('HRU          FAILED', error); await unlink(PID_FILE).catch(() => undefined); process.exit(1); });
