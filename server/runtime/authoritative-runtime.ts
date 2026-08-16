import { EventEmitter } from 'node:events';
import { resolve } from 'node:path';
import type { RuntimeSummary, UniverseSnapshot } from '../../src/core/state';
import type { UniverseManifest } from '../../src/core/universe-manifest';
import type { Command, CommandResult, Query, QueryResult } from '../../src/interface/protocol';
import type { RuntimePort } from '../../src/runtime/runtime-port';
import { DIMENSION_ZERO } from '../../src/shared/ids';
import { ModuleRegistry } from '../../src/modules/module-registry';
import { DimensionRegistry } from './dimension-registry';
import { EmptyLaboratory } from './laboratory';
import { PersistentSaveStore } from './persistent-save-store';
import type { SimulationWorkerHost } from './simulation-worker-host';

export class AuthoritativeRuntime extends EventEmitter implements RuntimePort {
  readonly modules = new ModuleRegistry(); readonly saves: PersistentSaveStore;
  readonly dimensions = new DimensionRegistry(); readonly laboratory = new EmptyLaboratory();
  private summary: RuntimeSummary; private activeDimension = DIMENSION_ZERO;
  private autosaveStatus: RuntimeSummary['autosaveStatus'] = 'idle'; private lastAutosaveTick?: number;

  constructor(private readonly worker: SimulationWorkerHost, initialSummary: RuntimeSummary, manifest: UniverseManifest, saveDirectory = resolve('.hru-data', 'saves')) {
    super(); this.summary = initialSummary; this.saves = new PersistentSaveStore(saveDirectory, manifest);
    for (const module of [
      { id: 'dimensions', label: 'Dimensions', version: '1.0.0', deterministic: true }, { id: 'saves', label: 'Save System', version: '2.0.0', deterministic: false },
      { id: 'laboratory', label: 'Laboratory', version: '0.1.0', deterministic: false }, { id: 'instruments', label: 'Instruments', version: '1.0.0', deterministic: true },
      { id: 'hru-law-1', label: 'HRU Universe Law v1', version: '1.0.0', deterministic: true },
    ]) this.modules.register(module);
    worker.on('summary', (summary: RuntimeSummary) => { this.summary = this.decorate(summary); this.emit('summary', this.summary); });
    worker.on('autosave-boundary', (state: UniverseSnapshot) => void this.persistAutosave(state));
    worker.on('error', (error) => console.error('SIM WORKER   ERROR', error));
  }
  start(): void { this.emit('summary', this.currentSummary()); }
  stop(): void { this.removeAllListeners(); }
  currentSummary(): RuntimeSummary { return this.decorate(this.summary); }
  snapshot(): Promise<UniverseSnapshot> { return this.worker.getState(); }

  async command(command: Command): Promise<CommandResult> {
    switch (command.type) {
      case 'time/set-running': this.summary = this.decorate(await this.worker.setRunning(command.running)); break;
      case 'time/set-multiplier': this.summary = this.decorate(await this.worker.setMultiplier(command.multiplier)); break;
      case 'saves/save-current': { const state = await this.worker.getState(); const saved = await this.saves.saveManual(state, command.label); return { ok: true, data: saved, message: `Saved tick ${saved.state.tick}` }; }
      case 'saves/resume': { const state = await this.saves.load(command.snapshotId); if (!state) return { ok: false, message: 'Snapshot not found' }; this.summary = this.decorate(await this.worker.replaceState(state)); this.emit('summary', this.summary); return { ok: true, data: this.summary, message: `Resumed tick ${state.tick}` }; }
      case 'dimensions/select': { const state = await this.worker.getState(); this.dimensions.project(command.dimensionId, state); this.activeDimension = command.dimensionId; this.summary = this.decorate(this.summary); break; }
    }
    this.emit('summary', this.summary); return { ok: true, data: this.summary };
  }
  async query(query: Query): Promise<QueryResult> {
    switch (query.type) {
      case 'universe/state': return { ok: true, data: this.currentSummary() };
      case 'saves/list': return { ok: true, data: await this.saves.list() };
      case 'dimensions/list': return { ok: true, data: this.dimensions.list().map(({ id, label }) => ({ id, label })) };
      case 'laboratory/list': return { ok: true, data: this.laboratory.list().map(({ id, label }) => ({ id, label })) };
      case 'modules/list': return { ok: true, data: this.modules.list() };
    }
  }
  private decorate(summary: RuntimeSummary): RuntimeSummary { return { ...summary, activeDimension: this.activeDimension, autosaveStatus: this.autosaveStatus, ...(this.lastAutosaveTick === undefined ? {} : { lastAutosaveTick: this.lastAutosaveTick }) }; }
  private async persistAutosave(state: UniverseSnapshot): Promise<void> {
    this.autosaveStatus = 'saving'; this.emit('summary', this.currentSummary());
    try { await this.saves.saveAutosave(state); this.lastAutosaveTick = state.tick; this.autosaveStatus = 'saved'; }
    catch (error) { this.autosaveStatus = 'error'; console.error('SAVE STORE   AUTOSAVE FAILED', error); }
    this.summary = this.decorate(this.summary); this.emit('summary', this.summary);
  }
}
