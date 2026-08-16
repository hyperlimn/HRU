import { EventEmitter } from 'node:events';
import { resolve } from 'node:path';
import type { UniverseSnapshot, UniverseState } from '../../src/core/state';
import type { Command, CommandResult, Query, QueryResult } from '../../src/interface/protocol';
import type { RuntimePort } from '../../src/runtime/runtime-port';
import { DEFAULT_UNIVERSE_ID, DIMENSION_ZERO } from '../../src/shared/ids';
import { AUTOSAVE_INTERVAL_TICKS } from '../../src/modules/saves/save-system';
import { ModuleRegistry } from '../../src/modules/module-registry';
import { DimensionRegistry } from './dimension-registry';
import { EmptyLaboratory } from './laboratory';
import { PersistentSaveStore } from './persistent-save-store';
import { TickRateMeter } from './tick-rate-meter';

const BASE_TICKS_PER_SECOND = 20;

export class AuthoritativeRuntime extends EventEmitter implements RuntimePort {
  readonly modules = new ModuleRegistry();
  readonly saves: PersistentSaveStore;
  readonly dimensions = new DimensionRegistry();
  readonly laboratory = new EmptyLaboratory();
  private timer?: NodeJS.Timeout;
  private readonly tickRate = new TickRateMeter();
  private state: UniverseState;

  constructor(saveDirectory = resolve('.hru-data', 'saves')) {
    super();
    const manifest = {
      universeId: DEFAULT_UNIVERSE_ID,
      genesisHashes: ['genesis-placeholder-0'],
      hashAlgorithm: 'future-hash-selection',
      lawVersion: 'foundation-0',
      parameters: {},
      enabledDeterministicModules: [],
      createdAt: new Date().toISOString(),
    } as const;
    this.state = { manifest, tick: 0, running: false, requestedMultiplier: 1, actualTicksPerSecond: 0, activeDimension: DIMENSION_ZERO };
    this.saves = new PersistentSaveStore(saveDirectory, manifest);
    for (const module of [
      { id: 'dimensions', label: 'Dimensions', version: '0.1.0', deterministic: true },
      { id: 'saves', label: 'Save System', version: '0.1.0', deterministic: false },
      { id: 'laboratory', label: 'Laboratory', version: '0.1.0', deterministic: false },
      { id: 'instruments', label: 'Instruments', version: '0.1.0', deterministic: true },
    ]) this.modules.register(module);
  }

  start(): void {
    this.tickRate.record(performance.now(), this.state.tick);
    this.timer = setInterval(() => {
      const now = performance.now();
      if (this.state.running) {
        const step = this.state.requestedMultiplier;
        const previousTick = this.state.tick;
        const tick = previousTick + step;
        this.state = { ...this.state, tick, actualTicksPerSecond: this.tickRate.record(now, tick) };
        if (Math.floor(previousTick / AUTOSAVE_INTERVAL_TICKS) < Math.floor(tick / AUTOSAVE_INTERVAL_TICKS)) {
          void this.saves.saveAutosave(this.snapshot()).catch((error) => console.error('SAVE STORE   AUTOSAVE FAILED', error));
        }
      } else if (this.state.actualTicksPerSecond !== 0) {
        this.state = { ...this.state, actualTicksPerSecond: this.tickRate.reset() };
      } else this.tickRate.reset();
      this.emit('snapshot', this.snapshot());
    }, 1000 / BASE_TICKS_PER_SECOND);
  }

  stop(): void { if (this.timer) clearInterval(this.timer); }
  snapshot(): UniverseSnapshot { return structuredClone(this.state); }

  async command(command: Command): Promise<CommandResult> {
    switch (command.type) {
      case 'time/set-running':
        this.tickRate.reset();
        this.state = { ...this.state, running: command.running, actualTicksPerSecond: 0 };
        if (command.running) this.tickRate.record(performance.now(), this.state.tick);
        break;
      case 'time/set-multiplier': this.state = { ...this.state, requestedMultiplier: command.multiplier }; break;
      case 'saves/save-current': {
        const saved = await this.saves.saveManual(this.snapshot(), command.label);
        return { ok: true, data: saved, message: `Saved tick ${saved.state.tick}` };
      }
      case 'saves/resume': {
        const saved = await this.saves.load(command.snapshotId);
        if (!saved) return { ok: false, message: 'Snapshot not found' };
        this.tickRate.reset(); this.state = structuredClone(saved);
        this.emit('snapshot', this.snapshot());
        return { ok: true, data: this.snapshot(), message: `Resumed tick ${saved.tick}` };
      }
      case 'dimensions/select':
        this.dimensions.project(command.dimensionId, this.snapshot());
        this.state = { ...this.state, activeDimension: command.dimensionId }; break;
    }
    this.emit('snapshot', this.snapshot());
    return { ok: true };
  }

  async query(query: Query): Promise<QueryResult> {
    switch (query.type) {
      case 'universe/state': return { ok: true, data: this.snapshot() };
      case 'saves/list': return { ok: true, data: await this.saves.list() };
      case 'dimensions/list': return { ok: true, data: this.dimensions.list().map(({ id, label }) => ({ id, label })) };
      case 'laboratory/list': return { ok: true, data: this.laboratory.list().map(({ id, label }) => ({ id, label })) };
      case 'modules/list': return { ok: true, data: this.modules.list() };
    }
  }
}
