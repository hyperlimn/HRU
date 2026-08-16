import type { ContextRecord, EntityRecord } from '../../src/core/state';
import { ZERO_CONTEXT_HEX } from '../../src/core/state';
import { compareHashes } from './canonical-encoding';
import type { Cluster } from './clusters';

export function nextContexts(entities: readonly EntityRecord[], clusters: readonly Cluster[]): readonly ContextRecord[] {
  const clustered = new Map(clusters.flatMap((cluster) => cluster.memberHashes.map((hash) => [hash, cluster.clusterHash] as const)));
  return entities.map((entity) => ({ entityHash: entity.hash, contextHash: clustered.get(entity.hash) ?? ZERO_CONTEXT_HEX }))
    .sort((a, b) => compareHashes(a.entityHash, b.entityHash));
}
