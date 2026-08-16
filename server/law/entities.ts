import type { AuthoritativeUniverseState, EntityRecord } from '../../src/core/state';
import { ZERO_CONTEXT_HEX } from '../../src/core/state';
import type { UniverseManifest } from '../../src/core/universe-manifest';
import { compareHashes } from './canonical-encoding';

export function genesisEntities(manifest: UniverseManifest): readonly EntityRecord[] {
  const [seed1, seed2] = manifest.genesisHashes;
  if (!seed1 || !seed2 || manifest.genesisHashes.length !== 2) throw new Error('Law v1 requires exactly two genesis hashes');
  const entities: EntityRecord[] = [
    { hash: seed1, provenance: { origin: 'genesis', createdAtTick: 0, seed: 'seed1' } },
    { hash: seed2, provenance: { origin: 'genesis', createdAtTick: 0, seed: 'seed2' } },
  ];
  return entities.sort((a, b) => compareHashes(a.hash, b.hash));
}

export function createGenesisState(manifest: UniverseManifest): AuthoritativeUniverseState {
  const entities = genesisEntities(manifest);
  return {
    manifest, tick: 0, entities, bonds: [],
    contexts: entities.map(({ hash }) => ({ entityHash: hash, contextHash: ZERO_CONTEXT_HEX })),
    clusterStability: [], condensationRecords: [], injectionCounter: 0, deterministicModuleState: {},
  };
}
