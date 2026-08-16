import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { UniverseEngine } from '../law/engine';
import { createGenesisState } from '../law/entities';
import { createLawV1Manifest } from '../law/manifest';
import { IncompatibleSaveError, PersistentSaveStore } from './persistent-save-store';

const temporaryDirectories: string[] = [];
async function directory(): Promise<string> { const value = await mkdtemp(join(tmpdir(), 'hru-save-test-')); temporaryDirectories.push(value); return value; }
afterEach(async () => { await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

describe('PersistentSaveStore Law v1', () => {
  it('survives restart and restores exact authoritative state', async () => {
    const path = await directory(); const manifest = createLawV1Manifest('2026-01-01T00:00:00.000Z'); const state = new UniverseEngine(createGenesisState(manifest)).advance(40);
    const saved = await new PersistentSaveStore(path, manifest).saveManual(state, 'Persistent');
    expect(await new PersistentSaveStore(path, { ...manifest, createdAt: '2027-01-01T00:00:00.000Z' }).load(saved.id)).toEqual(state);
  });
  it('keeps newest three autosaves and never rotates manual saves', async () => {
    const path = await directory(); const manifest = createLawV1Manifest('2026-01-01T00:00:00.000Z'); const base = createGenesisState(manifest); const store = new PersistentSaveStore(path, manifest);
    await store.saveManual({ ...base, tick: 7 }); for (const tick of [100_000, 200_000, 300_000, 400_000]) await store.saveAutosave({ ...base, tick });
    const saves = await new PersistentSaveStore(path, manifest).list();
    expect(saves.filter((save) => save.kind === 'manual').map((save) => save.state.tick)).toEqual([7]);
    expect(saves.filter((save) => save.kind === 'autosave').map((save) => save.state.tick)).toEqual([200_000, 300_000, 400_000]);
  });
  it('clearly rejects old foundation saves and incompatible Law v1 manifests', async () => {
    const path = await directory(); const manifest = createLawV1Manifest('2026-01-01T00:00:00.000Z'); const store = new PersistentSaveStore(path, manifest); const saved = await store.saveManual(createGenesisState(manifest));
    const file = join(path, `${saved.id}.json`); const old = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>; old.formatVersion = 1; await writeFile(file, JSON.stringify(old));
    await expect(store.load(saved.id)).rejects.toThrow(IncompatibleSaveError); await expect(store.load(saved.id)).rejects.toThrow('foundation');
    const valid = await store.saveManual(createGenesisState(manifest));
    const incompatible = new PersistentSaveStore(path, { ...manifest, parameters: { ...manifest.parameters, B: 9 } });
    await expect(incompatible.load(valid.id)).rejects.toThrow('law parameters');
  });
  it('validates arbitrary JSON rather than trusting it', async () => {
    const path = await directory(); const manifest = createLawV1Manifest('2026-01-01T00:00:00.000Z'); const store = new PersistentSaveStore(path, manifest); const saved = await store.saveManual(createGenesisState(manifest));
    const file = join(path, `${saved.id}.json`); const json = JSON.parse(await readFile(file, 'utf8')) as { state: { tick: unknown } }; json.state.tick = 'bad'; await writeFile(file, JSON.stringify(json));
    await expect(store.load(saved.id)).rejects.toThrow('Invalid save data');
  });
});
