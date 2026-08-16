import type { AuthoritativeUniverseState, EntityRecord } from '../../src/core/state';
import { ZERO_CONTEXT_HEX } from '../../src/core/state';
import { compareHashes } from './canonical-encoding';
import { updateBonds } from './bonds';
import { generateCandidates } from './candidates';
import { detectClusters } from './clusters';
import { applyCondensation } from './condensation';
import { nextContexts } from './contexts';
import type { HashProvider } from './hash-law';
import { sha256Provider } from './hash-law';
import { injectAtTick } from './injection';
import { computePhases } from './phases';

export class UniverseEngine {
  constructor(private state: AuthoritativeUniverseState, private readonly hashes: HashProvider = sha256Provider) {}

  snapshot(): AuthoritativeUniverseState { return structuredClone(this.state); }
  replace(state: AuthoritativeUniverseState): void { this.state = structuredClone(state); }

  advanceOne(): AuthoritativeUniverseState {
    const tick = this.state.tick + 1;
    const parameters = this.state.manifest.parameters;
    const entitiesAtStart = [...this.state.entities].sort((a, b) => compareHashes(a.hash, b.hash));
    const phases = computePhases(entitiesAtStart, this.state.contexts, tick, parameters.B, parameters.Vmax, this.hashes);
    const candidates = generateCandidates(phases, this.state.bonds);
    const bonds = updateBonds(candidates, this.state.bonds, phases, this.state.contexts, tick, parameters, this.hashes);
    const clusters = detectClusters(entitiesAtStart, bonds, parameters, this.hashes);
    const contexts = [...nextContexts(entitiesAtStart, clusters)];
    const condensation = applyCondensation(clusters, this.state.clusterStability, entitiesAtStart, this.state.condensationRecords, tick, parameters);
    const injection = injectAtTick(tick, this.state.injectionCounter, parameters, this.hashes);
    const additions: EntityRecord[] = [...condensation.newEntities];
    if (injection.entity && !entitiesAtStart.some((entity) => entity.hash === injection.entity!.hash) && !additions.some((entity) => entity.hash === injection.entity!.hash)) additions.push(injection.entity);
    for (const entity of additions) contexts.push({ entityHash: entity.hash, contextHash: ZERO_CONTEXT_HEX });
    const entities = [...entitiesAtStart, ...additions].sort((a, b) => compareHashes(a.hash, b.hash));
    contexts.sort((a, b) => compareHashes(a.entityHash, b.entityHash));
    this.state = {
      ...this.state, tick, entities, bonds, contexts,
      clusterStability: condensation.stability, condensationRecords: condensation.records,
      injectionCounter: injection.nextCounter,
    };
    return this.snapshot();
  }

  advance(count: number): AuthoritativeUniverseState {
    if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('Tick count must be a non-negative safe integer');
    for (let index = 0; index < count; index += 1) this.advanceOne();
    return this.snapshot();
  }
}
