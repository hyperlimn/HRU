import type { AuthoritativeUniverseState } from '../../src/core/state';
import type { ObservationFrame, ObservedBond, ObservedEntityDetail } from '../../src/observer/observation-types';
import type { HashHex } from '../../src/shared/ids';
import { isActivePositive, isActiveRepulsion } from '../law/bonds';
import { compareHashes } from '../law/canonical-encoding';
import { detectClusters } from '../law/clusters';
import { sha256Provider } from '../law/hash-law';
import { stateDigest } from '../law/state-digest';

function classify(strength: number, state: AuthoritativeUniverseState): ObservedBond['classification'] {
  if (isActivePositive(strength, state.manifest.parameters)) return 'active-positive';
  if (isActiveRepulsion(strength, state.manifest.parameters)) return 'active-repulsion';
  return strength >= 0 ? 'weak-positive' : 'weak-negative';
}

export function projectObservationFrame(state: AuthoritativeUniverseState): ObservationFrame {
  const clusters = detectClusters(state.entities, state.bonds, state.manifest.parameters, sha256Provider)
    .map((cluster) => ({ clusterHash: cluster.clusterHash, memberHashes: [...cluster.memberHashes] }));
  const clusterByEntity = new Map(clusters.flatMap((cluster) => cluster.memberHashes.map((hash) => [hash, cluster.clusterHash] as const)));
  const contextByEntity = new Map(state.contexts.map((context) => [context.entityHash, context.contextHash]));
  return {
    tick: state.tick, stateDigest: stateDigest(state),
    entities: [...state.entities].sort((a, b) => compareHashes(a.hash, b.hash)).map((entity) => ({
      hash: entity.hash, provenance: structuredClone(entity.provenance), createdAtTick: entity.provenance.createdAtTick,
      contextHash: contextByEntity.get(entity.hash)!, ...(clusterByEntity.has(entity.hash) ? { clusterHash: clusterByEntity.get(entity.hash)! } : {}),
    })),
    bonds: [...state.bonds].sort((a, b) => compareHashes(a.low, b.low) || compareHashes(a.high, b.high)).map((bond) => ({ ...bond, classification: classify(bond.strength, state) })),
    clusters, condensationRecords: structuredClone([...state.condensationRecords].sort((a, b) => compareHashes(a.entityHash, b.entityHash))),
  };
}

export function projectEntityDetail(frame: ObservationFrame, hash: HashHex): ObservedEntityDetail | undefined {
  const entity = frame.entities.find((candidate) => candidate.hash === hash); if (!entity) return undefined;
  const cluster = frame.clusters.find((candidate) => candidate.memberHashes.includes(hash));
  const bonds = frame.bonds.filter((bond) => bond.low === hash || bond.high === hash).map((bond) => ({ ...bond, neighborHash: bond.low === hash ? bond.high : bond.low }));
  return { ...structuredClone(entity), ...(cluster ? { cluster: structuredClone(cluster) } : {}), bonds: structuredClone(bonds) };
}
