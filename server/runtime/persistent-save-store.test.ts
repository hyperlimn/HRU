import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { UniverseManifest } from '../../src/core/universe-manifest';
import type { UniverseSnapshot } from '../../src/core/state';
import { DEFAULT_UNIVERSE_ID, DIMENSION_ZERO } from '../../src/shared/ids';
import { IncompatibleSaveError, PersistentSaveStore } from './persistent-save-store';

const temporaryDirectories: string[] = [];
const manifest: UniverseManifest = {
  universeId: DEFAULT_UNIVERSE_ID, genesisHashes: ['foundation'], hashAlgorithm: 'test-hash', lawVersion: 'foundation-0',
  parameters: { exact: true }, enabledDeterministicModules: [], createdAt: '2026-01-01T00:00:00.000Z',
};
const state = (tick: number): UniverseSnapshot => ({ manifest, tick, running: false, requestedMultiplier: 25, actualTicksPerSecond: 123, activeDimension: DIMENSION_ZERO });

async function directory(): Promise<string> { const value = await mkdtemp(join(tmpdir(), 'hru-save-test-')); temporaryDirectories.push(value); return value; }
afterEach(async () => { await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

describe('PersistentSaveStore', () => {
  it('survives store restart and restores the exact authoritative snapshot', async () => {
    const path = await directory();
    const first = new PersistentSaveStore(path, manifest);
    const saved = await first.saveManual(state(42), 'Persistent');
    const restarted = new PersistentSaveStore(path, { ...manifest, createdAt: '2027-01-01T00:00:00.000Z' });
    expect(await restarted.load(saved.id)).toEqual(state(42));
  });

  it('keeps the newest three autosaves and never rotates manual saves', async () => {
    const path = await directory(); const store = new PersistentSaveStore(path, manifest);
    await store.saveManual(state(7));
    for (const tick of [100_000, 200_000, 300_000, 400_000]) await store.saveAutosave(state(tick));
    const restarted = new PersistentSaveStore(path, manifest); const saves = await restarted.list();
    expect(saves.filter((save) => save.kind === 'manual').map((save) => save.state.tick)).toEqual([7]);
    expect(saves.filter((save) => save.kind === 'autosave').map((save) => save.state.tick)).toEqual([200_000, 300_000, 400_000]);
  });

  it('rejects incompatible manifests with a clear error', async () => {
    const path = await directory(); const store = new PersistentSaveStore(path, manifest); const saved = await store.saveManual(state(9));
    const incompatible = new PersistentSaveStore(path, { ...manifest, lawVersion: 'foundation-99' });
    await expect(incompatible.load(saved.id)).rejects.toThrow(IncompatibleSaveError);
    await expect(incompatible.load(saved.id)).rejects.toThrow('law version');
  });

  it('validates JSON content before loading it', async () => {
    const path = await directory(); const store = new PersistentSaveStore(path, manifest); const saved = await store.saveManual(state(9));
    const file = join(path, `${saved.id}.json`); const json = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
    json.state = { tick: 'not-a-number' }; await writeFile(file, JSON.stringify(json));
    await expect(store.load(saved.id)).rejects.toThrow('Invalid save data');
  });
});
