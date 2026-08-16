import type { AuthoritativeUniverseState, BondRecord } from '../../src/core/state';
import type { RelationshipEvent, RelationshipEventType } from '../../src/observer/observation-types';
import type { HashHex } from '../../src/shared/ids';
import { isActivePositive, isActiveRepulsion } from '../law/bonds';
import { bondKey, compareCanonicalStrings, compareHashes, concatBytes, float64, hashToBytes, lengthPrefixedUtf8, uint64 } from '../law/canonical-encoding';
import { detectClusters } from '../law/clusters';
import { sha256Hex, sha256Provider } from '../law/hash-law';

const EVENT_ORDER: readonly RelationshipEventType[] = [
  'positive-bond-created', 'negative-bond-created', 'bond-dissolved',
  'bond-became-active-positive', 'bond-became-active-repulsion', 'bond-left-active-positive', 'bond-left-active-repulsion',
  'entity-injected', 'entity-condensed', 'cluster-formed', 'cluster-dissolved',
];

function identity(tick: number, type: RelationshipEventType, participants: readonly HashHex[], strength?: number, clusterHash?: HashHex): HashHex {
  return sha256Hex(concatBytes(
    lengthPrefixedUtf8('HRU_OBSERVATION_EVENT_V1'), uint64(tick), lengthPrefixedUtf8(type), uint64(participants.length),
    ...participants.map(hashToBytes), strength === undefined ? Uint8Array.of(0) : concatBytes(Uint8Array.of(1), float64(strength)),
    clusterHash === undefined ? Uint8Array.of(0) : concatBytes(Uint8Array.of(1), hashToBytes(clusterHash)),
  ));
}

function event(tick: number, type: RelationshipEventType, participants: readonly HashHex[], options: { strength?: number; clusterHash?: HashHex } = {}): RelationshipEvent {
  const sorted = [...participants].sort(compareHashes);
  return { eventId: identity(tick, type, sorted, options.strength, options.clusterHash), tick, type, participants: sorted, ...options };
}

function clusterKey(members: readonly HashHex[]): string { return members.join(':'); }

export function deriveObservationEvents(before: AuthoritativeUniverseState, after: AuthoritativeUniverseState): readonly RelationshipEvent[] {
  if (after.tick !== before.tick + 1) throw new Error('Observation events require consecutive states');
  const parameters = after.manifest.parameters; const events: RelationshipEvent[] = [];
  const beforeBonds = new Map(before.bonds.map((bond) => [bondKey(bond.low, bond.high), bond]));
  const afterBonds = new Map(after.bonds.map((bond) => [bondKey(bond.low, bond.high), bond]));
  const keys = [...new Set([...beforeBonds.keys(), ...afterBonds.keys()])].sort(compareCanonicalStrings);
  const transitionEvents = (oldBond: BondRecord, newBond: BondRecord) => {
    const wasPositive = isActivePositive(oldBond.strength, parameters); const isPositive = isActivePositive(newBond.strength, parameters);
    const wasRepulsion = isActiveRepulsion(oldBond.strength, parameters); const isRepulsion = isActiveRepulsion(newBond.strength, parameters);
    if (!wasPositive && isPositive) events.push(event(after.tick, 'bond-became-active-positive', [newBond.low, newBond.high], { strength: newBond.strength }));
    if (wasPositive && !isPositive) events.push(event(after.tick, 'bond-left-active-positive', [newBond.low, newBond.high], { strength: newBond.strength }));
    if (!wasRepulsion && isRepulsion) events.push(event(after.tick, 'bond-became-active-repulsion', [newBond.low, newBond.high], { strength: newBond.strength }));
    if (wasRepulsion && !isRepulsion) events.push(event(after.tick, 'bond-left-active-repulsion', [newBond.low, newBond.high], { strength: newBond.strength }));
  };
  for (const key of keys) {
    const oldBond = beforeBonds.get(key); const newBond = afterBonds.get(key);
    if (!oldBond && newBond) events.push(event(after.tick, newBond.strength >= 0 ? 'positive-bond-created' : 'negative-bond-created', [newBond.low, newBond.high], { strength: newBond.strength }));
    else if (oldBond && !newBond) events.push(event(after.tick, 'bond-dissolved', [oldBond.low, oldBond.high], { strength: oldBond.strength }));
    else if (oldBond && newBond) transitionEvents(oldBond, newBond);
  }
  const beforeEntities = new Set(before.entities.map((entity) => entity.hash));
  for (const entity of [...after.entities].sort((a, b) => compareHashes(a.hash, b.hash))) if (!beforeEntities.has(entity.hash)) {
    if (entity.provenance.origin === 'injection') events.push(event(after.tick, 'entity-injected', [entity.hash]));
    if (entity.provenance.origin === 'condensation') events.push(event(after.tick, 'entity-condensed', [entity.hash, ...entity.provenance.parentHashes]));
  }
  const beforeClusters = detectClusters(before.entities, before.bonds, before.manifest.parameters, sha256Provider);
  const afterClusters = detectClusters(after.entities, after.bonds, after.manifest.parameters, sha256Provider);
  const beforeByMembers = new Map(beforeClusters.map((cluster) => [clusterKey(cluster.memberHashes), cluster]));
  const afterByMembers = new Map(afterClusters.map((cluster) => [clusterKey(cluster.memberHashes), cluster]));
  for (const [key, cluster] of [...afterByMembers].sort(([a], [b]) => compareCanonicalStrings(a, b))) if (!beforeByMembers.has(key)) events.push(event(after.tick, 'cluster-formed', cluster.memberHashes, { clusterHash: cluster.clusterHash }));
  for (const [key, cluster] of [...beforeByMembers].sort(([a], [b]) => compareCanonicalStrings(a, b))) if (!afterByMembers.has(key)) events.push(event(after.tick, 'cluster-dissolved', cluster.memberHashes, { clusterHash: cluster.clusterHash }));
  return events.sort((a, b) => a.tick - b.tick || EVENT_ORDER.indexOf(a.type) - EVENT_ORDER.indexOf(b.type) || compareCanonicalStrings(a.participants.join(':'), b.participants.join(':')) || compareHashes(a.eventId, b.eventId));
}
