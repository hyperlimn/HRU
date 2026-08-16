import type { BondRecord, EntityRecord } from '../../src/core/state';
import type { LawParameters } from '../../src/core/universe-manifest';
import type { HashHex } from '../../src/shared/ids';
import { compareHashes, concatBytes, hashToBytes } from './canonical-encoding';
import type { HashProvider } from './hash-law';
import { bytesToHash } from './canonical-encoding';
import { isActivePositive } from './bonds';

export interface Cluster { readonly clusterHash: HashHex; readonly memberHashes: readonly HashHex[] }

export function detectClusters(entities: readonly EntityRecord[], bonds: readonly BondRecord[], parameters: LawParameters, hashes: HashProvider): readonly Cluster[] {
  const members = entities.map((entity) => entity.hash).sort(compareHashes);
  const parent = new Map(members.map((hash) => [hash, hash]));
  const find = (hash: HashHex): HashHex => { const next = parent.get(hash)!; if (next === hash) return hash; const root = find(next); parent.set(hash, root); return root; };
  const union = (left: HashHex, right: HashHex) => { const a = find(left); const b = find(right); if (a !== b) parent.set(compareHashes(a, b) < 0 ? b : a, compareHashes(a, b) < 0 ? a : b); };
  for (const bond of [...bonds].sort((a, b) => compareHashes(a.low, b.low) || compareHashes(a.high, b.high))) if (isActivePositive(bond.strength, parameters)) union(bond.low, bond.high);
  const groups = new Map<HashHex, HashHex[]>();
  for (const hash of members) { const root = find(hash); const group = groups.get(root) ?? []; group.push(hash); groups.set(root, group); }
  return [...groups.values()].filter((group) => group.length > 1).map((group) => {
    const sorted = group.sort(compareHashes); return { memberHashes: sorted, clusterHash: bytesToHash(hashes.hash(concatBytes(...sorted.map(hashToBytes)))) };
  }).sort((a, b) => compareHashes(a.memberHashes[0]!, b.memberHashes[0]!));
}
