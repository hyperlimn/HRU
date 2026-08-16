import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { UniverseManifest } from '../../src/core/universe-manifest';
import type { UniverseSnapshot } from '../../src/core/state';
import { AUTOSAVE_SLOTS, type SavedSnapshot, type SaveStore } from '../../src/modules/saves/save-system';
import type { SnapshotID } from '../../src/shared/ids';

const hash = z.string().regex(/^[0-9a-f]{64}$/);
const tick = z.number().int().nonnegative().safe();
const parameters = z.object({
  B: z.number().int().min(1).max(256), Vmax: z.number().int().positive().safe(),
  alpha: z.number().finite(), epsilon: z.number().finite(), thetaAffinity: z.number().finite(),
  thetaBond: z.number().finite(), thetaRepel: z.number().finite(), thetaDissolve: z.number().finite(),
  condensationTicks: z.number().int().positive().safe(), injectionInterval: z.number().int().positive().safe(), outsideSeed: z.string(),
}).strict();
const manifestSchema = z.object({
  universeId: z.string().min(1), genesisHashes: z.array(hash).length(2), hashAlgorithm: z.literal('sha256'),
  lawVersion: z.literal('hru-law-1'), parameters, enabledDeterministicModules: z.array(z.string()), createdAt: z.iso.datetime(),
}).strict();
const provenance = z.discriminatedUnion('origin', [
  z.object({ origin: z.literal('genesis'), createdAtTick: z.literal(0), seed: z.enum(['seed1', 'seed2']) }).strict(),
  z.object({ origin: z.literal('injection'), createdAtTick: tick, injectionCounter: tick }).strict(),
  z.object({ origin: z.literal('condensation'), createdAtTick: tick, parentHashes: z.array(hash).min(2) }).strict(),
]);
const stateSchema = z.object({
  manifest: manifestSchema, tick,
  entities: z.array(z.object({ hash, provenance }).strict()),
  bonds: z.array(z.object({ low: hash, high: hash, strength: z.number().finite().min(-1).max(1) }).strict()),
  contexts: z.array(z.object({ entityHash: hash, contextHash: hash }).strict()),
  clusterStability: z.array(z.object({ clusterHash: hash, memberHashes: z.array(hash).min(2), consecutiveTicks: z.number().int().positive().safe() }).strict()),
  condensationRecords: z.array(z.object({ entityHash: hash, createdAtTick: tick, parentHashes: z.array(hash).min(2) }).strict()),
  injectionCounter: tick, deterministicModuleState: z.record(z.string(), z.string()),
}).strict();
const saveSchema = z.object({
  formatVersion: z.literal(2), id: z.string().regex(/^(autosave|manual)-[a-zA-Z0-9-]+$/),
  kind: z.enum(['autosave', 'manual']), label: z.string(), state: stateSchema, savedAt: z.iso.datetime(),
}).strict();
interface SaveFile extends SavedSnapshot { readonly formatVersion: 2 }

export class IncompatibleSaveError extends Error { constructor(message: string) { super(message); this.name = 'IncompatibleSaveError'; } }

export class PersistentSaveStore implements SaveStore {
  private sequence = 0; private operation = Promise.resolve();
  constructor(private readonly directory: string, private readonly currentManifest: UniverseManifest) {}
  saveAutosave(state: UniverseSnapshot): Promise<SavedSnapshot> { return this.exclusive(async () => { const saved = await this.write('autosave', state, `Autosave at tick ${state.tick}`); await this.rotateAutosaves(); return saved; }); }
  saveManual(state: UniverseSnapshot, label = `Manual save at tick ${state.tick}`): Promise<SavedSnapshot> { return this.exclusive(() => this.write('manual', state, label)); }
  list(): Promise<readonly SavedSnapshot[]> { return this.exclusive(async () => { await this.ensureDirectory(); return (await this.readAll()).sort((a, b) => a.savedAt.localeCompare(b.savedAt) || a.id.localeCompare(b.id)); }); }
  load(id: SnapshotID): Promise<UniverseSnapshot | undefined> { return this.exclusive(async () => {
    await this.ensureDirectory(); const path = join(this.directory, `${id}.json`); let raw: string;
    try { raw = await readFile(path, 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
    const saved = this.parse(raw, path); this.assertCompatible(saved.state.manifest); return structuredClone(saved.state);
  }); }
  private exclusive<T>(work: () => Promise<T>): Promise<T> { const result = this.operation.then(work, work); this.operation = result.then(() => undefined, () => undefined); return result; }
  private async write(kind: SavedSnapshot['kind'], state: UniverseSnapshot, label: string): Promise<SavedSnapshot> {
    await this.ensureDirectory(); this.sequence += 1;
    const id = `${kind}-${state.tick}-${Date.now()}-${process.pid}-${this.sequence}` as SnapshotID;
    const saved: SaveFile = { formatVersion: 2, id, kind, label, state: structuredClone(state), savedAt: new Date().toISOString() };
    this.validateSemantics(saveSchema.parse(saved).state as unknown as UniverseSnapshot);
    const target = join(this.directory, `${id}.json`); const temporary = `${target}.tmp`;
    try { await writeFile(temporary, `${JSON.stringify(saved, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' }); await rename(temporary, target); }
    catch (error) { await rm(temporary, { force: true }).catch(() => undefined); throw error; }
    return saved;
  }
  private async readAll(): Promise<SavedSnapshot[]> { const names = (await readdir(this.directory)).filter((name) => name.endsWith('.json')).sort(); return Promise.all(names.map(async (name) => this.parse(await readFile(join(this.directory, name), 'utf8'), name))); }
  private parse(raw: string, source: string): SavedSnapshot {
    let json: unknown; try { json = JSON.parse(raw); } catch { throw new Error(`Invalid save JSON: ${source}`); }
    if (typeof json === 'object' && json !== null && 'formatVersion' in json && (json as { formatVersion?: unknown }).formatVersion !== 2) {
      throw new IncompatibleSaveError(`Save ${source} uses incompatible foundation save format/law; expected HRU Law v1 format 2`);
    }
    const result = saveSchema.safeParse(json); if (!result.success) throw new Error(`Invalid save data in ${source}: ${z.prettifyError(result.error)}`);
    const saved = result.data as unknown as SavedSnapshot; this.validateSemantics(saved.state); return saved;
  }
  private validateSemantics(state: UniverseSnapshot): void {
    const hashes = state.entities.map((entity) => entity.hash); const entitySet = new Set(hashes);
    if (entitySet.size !== hashes.length) throw new Error('Invalid save data: duplicate entity hash');
    if (state.contexts.length !== hashes.length || new Set(state.contexts.map((context) => context.entityHash)).size !== hashes.length || state.contexts.some((context) => !entitySet.has(context.entityHash))) throw new Error('Invalid save data: contexts must map exactly once to every entity');
    if (state.bonds.some((bond) => bond.low >= bond.high || !entitySet.has(bond.low) || !entitySet.has(bond.high))) throw new Error('Invalid save data: bonds must use canonical existing entity pairs');
    if (new Set(state.bonds.map((bond) => `${bond.low}:${bond.high}`)).size !== state.bonds.length) throw new Error('Invalid save data: duplicate bond');
    for (const record of state.clusterStability) if (record.memberHashes.some((hash, index) => index > 0 && record.memberHashes[index - 1]! >= hash)) throw new Error('Invalid save data: cluster member hashes must be uniquely sorted');
    for (const record of state.condensationRecords) if (record.parentHashes.some((hash, index) => index > 0 && record.parentHashes[index - 1]! >= hash)) throw new Error('Invalid save data: condensation parent hashes must be uniquely sorted');
    if (state.clusterStability.some((record) => record.memberHashes.some((hash) => !entitySet.has(hash)))) throw new Error('Invalid save data: cluster stability references unknown entities');
    if (state.condensationRecords.some((record) => !entitySet.has(record.entityHash) || record.parentHashes.some((hash) => !entitySet.has(hash)))) throw new Error('Invalid save data: condensation references unknown entities');
  }
  private assertCompatible(manifest: UniverseManifest): void {
    const differences: string[] = [];
    if (manifest.lawVersion !== this.currentManifest.lawVersion) differences.push(`law version ${manifest.lawVersion}`);
    if (manifest.universeId !== this.currentManifest.universeId) differences.push('universe ID');
    if (manifest.hashAlgorithm !== this.currentManifest.hashAlgorithm) differences.push('hash algorithm');
    if (JSON.stringify(manifest.genesisHashes) !== JSON.stringify(this.currentManifest.genesisHashes)) differences.push('genesis hashes');
    if (JSON.stringify(manifest.parameters) !== JSON.stringify(this.currentManifest.parameters)) differences.push('law parameters');
    if (JSON.stringify(manifest.enabledDeterministicModules) !== JSON.stringify(this.currentManifest.enabledDeterministicModules)) differences.push('deterministic modules');
    if (differences.length) throw new IncompatibleSaveError(`Save is incompatible with HRU Law v1 (${differences.join(', ')})`);
  }
  private async rotateAutosaves(): Promise<void> { const autosaves = (await this.readAll()).filter((save) => save.kind === 'autosave').sort((a, b) => b.savedAt.localeCompare(a.savedAt) || b.id.localeCompare(a.id)); for (const save of autosaves.slice(AUTOSAVE_SLOTS)) await rm(join(this.directory, `${save.id}.json`)); }
  private async ensureDirectory(): Promise<void> { await mkdir(this.directory, { recursive: true }); }
}
