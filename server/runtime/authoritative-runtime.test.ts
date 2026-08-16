import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SaveListing } from '../../src/modules/saves/save-system';
import { UniverseEngine } from '../law/engine';
import { createGenesisState } from '../law/entities';
import { createLawV1Manifest } from '../law/manifest';
import { stateDigest } from '../law/state-digest';
import { AuthoritativeRuntime } from './authoritative-runtime';
import { SimulationWorkerHost } from './simulation-worker-host';

describe('worker-owned save continuation', () => {
  it('save/restart/resume matches uninterrupted execution exactly', async () => {
    const path = await mkdtemp(join(tmpdir(), 'hru-runtime-test-')); const manifest = createLawV1Manifest('2026-01-01T00:00:00.000Z');
    const worker1 = new SimulationWorkerHost(); const initial1 = await worker1.start(createGenesisState(manifest)); const runtime1 = new AuthoritativeRuntime(worker1, initial1, manifest, path);
    try {
      const at100 = new UniverseEngine(createGenesisState(manifest)).advance(100); await worker1.replaceState(at100);
      const result = await runtime1.command({ type: 'saves/save-current', label: 'Continuation' }); const listing = result.data as SaveListing;
      const saved = (await runtime1.saves.list()).find((item) => item.id === listing.id)!;
      const uninterrupted = new UniverseEngine(saved.state).advance(200);
      await worker1.stop();
      const worker2 = new SimulationWorkerHost(); const initial2 = await worker2.start(createGenesisState({ ...manifest, createdAt: '2027-01-01T00:00:00.000Z' })); const runtime2 = new AuthoritativeRuntime(worker2, initial2, manifest, path);
      try { expect((await runtime2.command({ type: 'saves/resume', snapshotId: saved.id })).ok).toBe(true); const resumed = new UniverseEngine(await worker2.getState()).advance(200); expect(stateDigest(resumed)).toBe(stateDigest(uninterrupted)); }
      finally { runtime2.stop(); await worker2.stop(); }
    } finally { runtime1.stop(); await worker1.stop().catch(() => undefined); await rm(path, { recursive: true, force: true }); }
  }, 30_000);
});
