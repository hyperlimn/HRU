import { readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

const PID_FILE = resolve('.hru-dev.pid');

async function main(): Promise<void> {
  let record: { pid: number; marker: string; instanceId: string };
  try { record = JSON.parse(await readFile(PID_FILE, 'utf8')) as typeof record; }
  catch { console.log('HRU          NOT RUNNING'); return; }
  if (record.marker !== 'HRU_DEV_STACK' || !Number.isSafeInteger(record.pid) || record.pid <= 0 || typeof record.instanceId !== 'string') throw new Error('Invalid HRU PID record; refusing to stop a process');

  try {
    process.kill(record.pid, 0);
    const response = await fetch('http://127.0.0.1:8787');
    const health = await response.json() as { pid?: number; instanceId?: string };
    if (health.pid !== record.pid || health.instanceId !== record.instanceId) throw new Error('Recorded PID does not match the running HRU instance; refusing to stop it');
    const shutdown = await fetch('http://127.0.0.1:8787/control/shutdown', { method: 'POST', headers: { 'x-hru-instance': record.instanceId } });
    if (shutdown.status !== 202) throw new Error(`HRU rejected shutdown request (${shutdown.status})`);
    console.log(`HRU          STOPPING RECORDED STACK (PID ${record.pid})`);
    const deadline = Date.now() + 8_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      try { process.kill(record.pid, 0); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') { await unlink(PID_FILE).catch(() => undefined); console.log('HRU          STOPPED'); return; } throw error; }
    }
    console.warn('HRU          GRACE PERIOD EXPIRED; STOPPING VERIFIED PID');
    process.kill(record.pid, 'SIGKILL');
    await unlink(PID_FILE).catch(() => undefined);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ESRCH') throw error;
    await unlink(PID_FILE).catch(() => undefined);
    console.log('HRU          NOT RUNNING (stale record removed)');
  }
}

void main();
