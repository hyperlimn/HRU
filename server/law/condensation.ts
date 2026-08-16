import type { ClusterStabilityRecord, CondensationRecord, EntityRecord } from '../../src/core/state';
import type { LawParameters } from '../../src/core/universe-manifest';
import { compareHashes } from './canonical-encoding';
import type { Cluster } from './clusters';

export interface CondensationResult { readonly stability: readonly ClusterStabilityRecord[]; readonly newEntities: readonly EntityRecord[]; readonly records: readonly CondensationRecord[] }

export function applyCondensation(clusters: readonly Cluster[], previous: readonly ClusterStabilityRecord[], entities: readonly EntityRecord[], existingRecords: readonly CondensationRecord[], tick: number, parameters: LawParameters): CondensationResult {
  const previousByHash = new Map(previous.map((record) => [record.clusterHash, record]));
  const entityHashes = new Set(entities.map((entity) => entity.hash));
  const recorded = new Set(existingRecords.map((record) => record.entityHash));
  const newEntities: EntityRecord[] = []; const records: CondensationRecord[] = [...existingRecords];
  const stability = clusters.map((cluster) => {
    const prior = previousByHash.get(cluster.clusterHash);
    const same = prior && prior.memberHashes.length === cluster.memberHashes.length && prior.memberHashes.every((hash, index) => hash === cluster.memberHashes[index]);
    const consecutiveTicks = same ? prior.consecutiveTicks + 1 : 1;
    if (consecutiveTicks >= parameters.condensationTicks && !recorded.has(cluster.clusterHash)) {
      const record = { entityHash: cluster.clusterHash, createdAtTick: tick, parentHashes: [...cluster.memberHashes] } satisfies CondensationRecord;
      records.push(record); recorded.add(cluster.clusterHash);
      if (!entityHashes.has(cluster.clusterHash)) {
        newEntities.push({ hash: cluster.clusterHash, provenance: { origin: 'condensation', createdAtTick: tick, parentHashes: [...cluster.memberHashes] } });
        entityHashes.add(cluster.clusterHash);
      }
    }
    return { clusterHash: cluster.clusterHash, memberHashes: [...cluster.memberHashes], consecutiveTicks };
  });
  return {
    stability: stability.sort((a, b) => compareHashes(a.clusterHash, b.clusterHash)),
    newEntities: newEntities.sort((a, b) => compareHashes(a.hash, b.hash)),
    records: records.sort((a, b) => compareHashes(a.entityHash, b.entityHash)),
  };
}
