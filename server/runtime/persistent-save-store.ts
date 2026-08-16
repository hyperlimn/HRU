import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { UniverseManifest } from '../../src/core/universe-manifest';
import type { UniverseSnapshot } from '../../src/core/state';
import { MULTIPLIERS } from '../../src/interface/protocol';
import { AUTOSAVE_SLOTS, type SavedSnapshot, type SaveStore } from '../../src/modules/saves/save-system';
import type { SnapshotID } from '../../src/shared/ids';

const parameterSchema = z.union([z.string(), z.number().finite(), z.boolean()]);
const manifestSchema = z.object({
  universeId: z.string().min(1), genesisHashes: z.array(z.string()), hashAlgorithm: z.string().min(1),
  lawVersion: z.string().min(1), parameters: z.record(z.string(), parameterSchema),
  enabledDeterministicModules: z.array(z.string()), createdAt: z.iso.datetime(),
}).strict();
const stateSchema = z.object({
  manifest: manifestSchema, tick: z.number().int().nonnegative().safe(), running: z.boolean(),
  requestedMultiplier: z.number().refine((value) => MULTIPLIERS.includes(value as (typeof MULTIPLIERS)[number]), 'Unsupported multiplier'),
  actualTicksPerSecond: z.number().finite().nonnegative(), activeDimension: z.string().min(1),
}).strict();
const savedSnapshotSchema = z.object({
  formatVersion: z.literal(1), id: z.string().regex(/^(autosave|manual)-[a-zA-Z0-9-]+$/),
  kind: z.enum(['autosave', 'manual']), label: z.string(), state: stateSchema, savedAt: z.iso.datetime(),
}).strict();

interface SaveFile extends SavedSnapshot { readonly formatVersion: 1 }

export class IncompatibleSaveError extends Error {
  constructor(message: string) { super(message); this.name = 'IncompatibleSaveError'; }
}

export class PersistentSaveStore implements SaveStore {
  private sequence = 0;
  private operation = Promise.resolve();

  constructor(private readonly directory: string, private readonly currentManifest: UniverseManifest) {}

  saveAutosave(state: UniverseSnapshot): Promise<SavedSnapshot> {
    return this.exclusive(async () => {
      const saved = await this.write('autosave', state, `Autosave at tick ${state.tick}`);
      await this.rotateAutosaves();
      return saved;
    });
  }

  saveManual(state: UniverseSnapshot, label = `Manual save at tick ${state.tick}`): Promise<SavedSnapshot> {
    return this.exclusive(() => this.write('manual', state, label));
  }

  list(): Promise<readonly SavedSnapshot[]> {
    return this.exclusive(async () => {
      await this.ensureDirectory();
      const saves = await this.readAll();
      return saves.sort((a, b) => a.savedAt.localeCompare(b.savedAt));
    });
  }

  load(id: SnapshotID): Promise<UniverseSnapshot | undefined> {
    return this.exclusive(async () => {
      await this.ensureDirectory();
      const path = join(this.directory, `${id}.json`);
      let raw: string;
      try { raw = await readFile(path, 'utf8'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
      const saved = this.parse(raw, path);
      this.assertCompatible(saved.state.manifest);
      return structuredClone(saved.state);
    });
  }

  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const result = this.operation.then(work, work);
    this.operation = result.then(() => undefined, () => undefined);
    return result;
  }

  private async write(kind: SavedSnapshot['kind'], state: UniverseSnapshot, label: string): Promise<SavedSnapshot> {
    await this.ensureDirectory();
    this.sequence += 1;
    const id = `${kind}-${state.tick}-${Date.now()}-${process.pid}-${this.sequence}` as SnapshotID;
    const saved: SaveFile = { formatVersion: 1, id, kind, label, state: structuredClone(state), savedAt: new Date().toISOString() };
    savedSnapshotSchema.parse(saved);
    const target = join(this.directory, `${id}.json`);
    const temporary = `${target}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(saved, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      await rename(temporary, target);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
    return saved;
  }

  private async readAll(): Promise<SavedSnapshot[]> {
    const names = (await readdir(this.directory)).filter((name) => name.endsWith('.json'));
    return Promise.all(names.map(async (name) => this.parse(await readFile(join(this.directory, name), 'utf8'), name)));
  }

  private parse(raw: string, source: string): SavedSnapshot {
    let json: unknown;
    try { json = JSON.parse(raw); } catch { throw new Error(`Invalid save JSON: ${source}`); }
    const result = savedSnapshotSchema.safeParse(json);
    if (!result.success) throw new Error(`Invalid save data in ${source}: ${z.prettifyError(result.error)}`);
    return result.data as unknown as SavedSnapshot;
  }

  private assertCompatible(manifest: UniverseManifest): void {
    const differences: string[] = [];
    if (manifest.universeId !== this.currentManifest.universeId) differences.push('universe ID');
    if (manifest.lawVersion !== this.currentManifest.lawVersion) differences.push('law version');
    if (manifest.hashAlgorithm !== this.currentManifest.hashAlgorithm) differences.push('hash algorithm');
    if (JSON.stringify(manifest.genesisHashes) !== JSON.stringify(this.currentManifest.genesisHashes)) differences.push('genesis hashes');
    if (JSON.stringify(manifest.parameters) !== JSON.stringify(this.currentManifest.parameters)) differences.push('law parameters');
    if (JSON.stringify(manifest.enabledDeterministicModules) !== JSON.stringify(this.currentManifest.enabledDeterministicModules)) differences.push('deterministic modules');
    if (differences.length > 0) throw new IncompatibleSaveError(`Save is incompatible with the current manifest (${differences.join(', ')})`);
  }

  private async rotateAutosaves(): Promise<void> {
    const autosaves = (await this.readAll()).filter((save) => save.kind === 'autosave').sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    for (const save of autosaves.slice(AUTOSAVE_SLOTS)) await rm(join(this.directory, `${save.id}.json`));
  }

  private async ensureDirectory(): Promise<void> { await mkdir(this.directory, { recursive: true }); }
}
